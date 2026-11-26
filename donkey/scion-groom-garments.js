/* Scion 3D Volumetric Hair Grooms, Sculpted Multi-Fold Garments, Tailored Lapel Collars,
   Eyelet-Laced Lug-Sole Boots, `three-vrm`-Style Damped Spring-Bone Physics,
   Cast-Iron Ball-Knob Standpipe, Grooved Terracotta *Shekla* Basin, Stone Semicircular-Arch Chapel &
   Master Ensemble / Pump Close-Up Tableau Engine (v6 Scion).
   Exposes `window.ScionGroomGarments` for `donkey/characters.js`, `study/study.js`, and `study/audition.html`. */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const frac = x => x - Math.floor(x);
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const g1 = (x, c, w) => {
    const d = (x - c) / w;
    return Math.exp(-d * d);
  };
  const g2 = (x, y, cx, cy, wx, wy) => {
    const dx = (x - cx) / wx;
    const dy = (y - cy) / (wy || wx);
    return Math.exp(-(dx * dx + dy * dy));
  };

  function mulberry32(seed) {
    let a = (seed | 0) || 1;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const hash2 = (x, y) => frac(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(
      lerp(hash2(xi, yi), hash2(xi + 1, yi), u),
      lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u),
      v
    );
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
          r[k] = (k === "w" || k === "f" || k === "b") ? Math.max(0.0008, v) : v;
        }
        out.push(r);
      }
    }
    out.push(rings[rings.length - 1]);
    return out;
  }

  /* Canonical 65-Bone Indices matching HumanSculptV3.B & characters.js */
  const B_DEFAULT = {
    ROOT: 0, PELVIS: 1, LUMBAR: 2, THORAX: 3, CHEST: 4,
    NECK_LOW: 5, NECK_HIGH: 6, HEAD: 7, JAW: 8,
    CLAV_L: 9, UARM_L: 10, ELBOW_VOL_L: 11, FARM_L: 12, FARM_TWIST_L: 13, HAND_L: 14,
    CLAV_R: 15, UARM_R: 16, ELBOW_VOL_R: 17, FARM_R: 18, FARM_TWIST_R: 19, HAND_R: 20,
    ULEG_L: 51, KNEE_VOL_L: 52, LLEG_L: 53, FOOT_L: 54, TOE_L: 55,
    ULEG_R: 56, KNEE_VOL_R: 57, LLEG_R: 58, FOOT_R: 59, TOE_R: 60,
    COAT_B: 61, COAT_L: 62, COAT_R: 63, HAIR_TAIL: 64
  };

  /* ============================================================================
     1. PROCEDURAL HIGH-RES TANGENT-SPACE NORMAL, CAVITY AO & WEAVE TEXTURE CACHE
     ============================================================================ */
  let assetCache = null;

  function makeHeightToNormalTex(T, size, heightFn, strength = 2.2, repX = 4, repY = 4) {
    const hBuf = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        hBuf[y * size + x] = heightFn(x / size, y / size);
      }
    }
    const data = new Uint8Array(size * size * 4);
    const wrap = (v, m) => ((v % m) + m) % m;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const hl = hBuf[y * size + wrap(x - 1, size)];
        const hr = hBuf[y * size + wrap(x + 1, size)];
        const hd = hBuf[wrap(y - 1, size) * size + x];
        const hu = hBuf[wrap(y + 1, size) * size + x];
        let nx = (hl - hr) * strength;
        let ny = (hd - hu) * strength;
        let nz = 1.0;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const i = (y * size + x) * 4;
        data[i]     = clamp((nx * 0.5 + 0.5) * 255, 0, 255) | 0;
        data[i + 1] = clamp((ny * 0.5 + 0.5) * 255, 0, 255) | 0;
        data[i + 2] = clamp((nz * 0.5 + 0.5) * 255, 0, 255) | 0;
        data[i + 3] = 255;
      }
    }
    const tex = new T.DataTexture(data, size, size, T.RGBAFormat);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(repX, repY);
    tex.magFilter = T.LinearFilter;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (T.NoColorSpace) tex.colorSpace = T.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function makeGrayTex(T, size, valFn, repX = 4, repY = 4) {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const b = clamp(valFn(x / size, y / size) * 255, 0, 255) | 0;
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
    const tex = new T.DataTexture(data, size, size, T.RGBAFormat);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(repX, repY);
    tex.magFilter = T.LinearFilter;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (T.NoColorSpace) tex.colorSpace = T.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function makeColorCanvasTex(T, w, h, drawFn, repX = 1, repY = 1) {
    if (typeof document === "undefined") {
      return makeGrayTex(T, 64, () => 0.5, repX, repY);
    }
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    drawFn(c.getContext("2d"), w, h);
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(repX, repY);
    if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  function getAssets(T) {
    if (assetCache) return assetCache;

    // 1. Tight Helical O-Ringlet 4C Spongy Micro-Coil Normal Map (eliminates flat facets in both PBR & Clay modes!)
    const hairCoilNormal = makeHeightToNormalTex(T, 256, (u, v) => {
      let coilSum = 0.0;
      for (const [scale, wt] of [[13.0, 0.52], [23.0, 0.34], [37.0, 0.20]]) {
        const gx = u * scale, gy = v * scale;
        const ix = Math.floor(gx), iy = Math.floor(gy);
        let minD = 9.0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const cx = ((ix + dx) % scale + scale) % scale;
            const cy = ((iy + dy) % scale + scale) % scale;
            const jx = ix + dx + 0.18 + 0.64 * hash2(cx, cy);
            const jy = iy + dy + 0.18 + 0.64 * hash2(cy + 17.3, cx + 9.1);
            const d = Math.hypot(gx - jx, gy - jy);
            if (d < minD) minD = d;
          }
        }
        // Tight O-shaped 4C ringlet ridge peaking at r = 0.28 with hollow coiled center & deep inter-coil valley!
        const ring = Math.exp(-Math.pow((minD - 0.27) / 0.14, 2)) - 0.35 * Math.exp(-Math.pow(minD / 0.12, 2));
        coilSum += ring * wt;
      }
      return coilSum + (vnoise(u * 84, v * 84) - 0.5) * 0.18;
    }, 3.2, 2, 2);

    // 2. Braided / Twisted Locs & Cornrow Plait Normal Map
    const hairBraidNormal = makeHeightToNormalTex(T, 256, (u, v) => {
      const chev = Math.sin(v * TAU * 20 + Math.abs((u - 0.5) * 2) * 4.2) * 0.55;
      const fiber = Math.sin(u * TAU * 54 + chev * 0.8) * 0.28;
      return chev + fiber + vnoise(u * 64, v * 128) * 0.16;
    }, 2.6, 2, 4);

    // 3. Heavy Cotton Canvas / Twill Duster Weave + Micro-Crease Normal & Roughness
    const canvasNormal = makeHeightToNormalTex(T, 256, (u, v) => {
      const twill = Math.sin((u * 68 + v * 68) * TAU) * 0.24 + Math.sin(u * TAU * 92) * 0.12 + Math.sin(v * TAU * 92) * 0.12;
      const microFold = (fbm(u * 10, v * 16, 4) - 0.5) * 0.85;
      return twill + microFold;
    }, 2.1, 5, 6);

    const canvasWeaveAO = makeGrayTex(T, 256, (u, v) => {
      const wv = 0.88 + 0.06 * Math.sin(u * TAU * 68) * Math.cos(v * TAU * 68);
      const wear = (fbm(u * 12 + 2.1, v * 14 + 5.7, 3) - 0.5) * 0.16;
      return clamp(wv + wear, 0.58, 1.0);
    }, 5, 6);

    // 4. Hand-Loomed Ethiopian Shamma / Gabi Cotton Gauze + Slub Yarn Normal & Albedo Relief
    const shammaNormal = makeHeightToNormalTex(T, 256, (u, v) => {
      const warp = Math.sin(u * TAU * 84) * 0.26;
      const weft = Math.sin(v * TAU * 58 + 0.4 * Math.sin(u * TAU * 12)) * 0.30;
      const slub = (fbm(u * 48, v * 16, 3) - 0.5) * 0.55;
      const softRipple = Math.sin(v * TAU * 7 + Math.sin(u * TAU * 3) * 0.8) * 0.35;
      return warp + weft + slub + softRipple;
    }, 2.3, 4, 4);

    const shammaWeaveAO = makeGrayTex(T, 256, (u, v) => {
      const gauze = 0.90 + 0.05 * Math.sin(u * TAU * 84) + 0.05 * Math.sin(v * TAU * 58);
      const slub = (fbm(u * 42, v * 18, 3) - 0.5) * 0.14;
      return clamp(gauze + slub, 0.65, 1.0);
    }, 4, 4);

    // 5. Rib-Knit / Homespun Cotton Tunic Normal Map (June's scoop-neck tunic in 0bc287c6.jpg)
    const knitNormal = makeHeightToNormalTex(T, 256, (u, v) => {
      const rib = Math.sin(u * TAU * 96) * 0.38;
      const stitch = Math.sin(v * TAU * 110 + (Math.floor(u * 96) % 2) * 1.57) * 0.22;
      const drape = (fbm(u * 14, v * 18, 3) - 0.5) * 0.48;
      return rib + stitch + drape;
    }, 2.2, 4, 5);

    // 6. Pebbled Full-Grain Leather Normal Map (Boots, Utility Belt, Crossbody Satchel)
    const leatherNormal = makeHeightToNormalTex(T, 256, (u, v) => {
      const grain = vnoise(u * 90, v * 90) * 0.55 + vnoise(u * 180 + 5, v * 180 + 3) * 0.28;
      const crease = (fbm(u * 16, v * 16, 3) - 0.5) * 0.45;
      return grain + crease;
    }, 2.0, 3, 3);

    // 7. Sand-Cast Micro-Pitted Graphite Iron Normal Map (Standpipe in 0bc287c6.jpg)
    const castIronNormal = makeHeightToNormalTex(T, 256, (u, v) => {
      const pit = Math.pow(vnoise(u * 110, v * 110), 2.2) * -0.55;
      const orangePeel = (fbm(u * 42, v * 42, 4) - 0.5) * 0.65;
      return pit + orangePeel;
    }, 2.1, 3, 5);

    // 8. Wheel-Thrown Terracotta *Shekla* Clay Normal Map
    const terracottaNormal = makeHeightToNormalTex(T, 256, (u, v) => {
      const wheelLines = Math.sin(v * TAU * 64 + 0.2 * vnoise(u * 18, v * 64)) * 0.34;
      const grog = (fbm(u * 75, v * 75, 3) - 0.5) * 0.48;
      return wheelLines + grog;
    }, 2.0, 3, 2);

    // 9. Irregular Weathered Highland Fieldstone / Rubble Masonry Wall Albedo & Normal (32b99d8c.jpg, 0bc287c6.jpg, 735822c2.jpg — ZERO uniform subway-brick grid!)
    const stoneCourseSample = (u, v) => {
      // Multi-scale irregular highland fieldstone slabs with split sub-courses & organic course undulation
      const rows = 23;
      const warpV = v + (fbm(u * 4.5, v * 6.5, 3) - 0.5) * 0.042;
      const fy = warpV * rows;
      const row = Math.floor(fy);
      let ry = fy - row;
      const cols = 4 + Math.floor(hash2(row, 7.3) * 5.0); // 4..8 varied-width stones per course
      const stagger = hash2(row, 3.1) * 0.85;
      const warpU = u + stagger + (fbm(u * 7.5 + 4.1, v * 11.0, 2) - 0.5) * 0.038;
      // Variable individual stone width via piecewise jitter
      const fxRaw = warpU * cols;
      const colBase = Math.floor(fxRaw);
      const jitterL = (hash2(colBase, row * 1.9) - 0.5) * 0.34;
      const jitterR = (hash2(colBase + 1, row * 1.9) - 0.5) * 0.34;
      const rx = clamp((fxRaw - colBase - jitterL) / Math.max(0.35, 1.0 + jitterR - jitterL), 0, 1);
      // Occasional horizontal split slab (35% of stones split into two thinner fieldstones!)
      const isSplit = hash2(colBase * 2.3, row * 4.1) > 0.64;
      const splitY = 0.44 + (hash2(colBase, row + 9.0) - 0.5) * 0.16;
      if (isSplit) {
        ry = ry < splitY ? (ry / splitY) : ((ry - splitY) / (1.0 - splitY));
      }
      const mortarY = smooth(0.0, 0.17, ry) * (1 - smooth(0.83, 1.0, ry));
      const mortarX = smooth(0.0, 0.10, rx) * (1 - smooth(0.90, 1.0, rx));
      const roundCorner = smooth(0.0, 0.14, mortarY * mortarX);
      const faceRough = (fbm(u * 38 + colBase * 1.7, v * 46 + row * 2.3, 4) - 0.5) * 0.38;
      const blockTilt = (hash2(colBase + (isSplit && (fy - row) > splitY ? 17 : 0), row) - 0.5) * 0.22;
      return { h: roundCorner * (0.70 + blockTilt + faceRough), row, col: colBase, blockMask: roundCorner };
    };
    const stoneHeight = (u, v) => stoneCourseSample(u, v).h;
    const stoneWallNormal = makeHeightToNormalTex(T, 512, stoneHeight, 2.8, 2.0, 1.6);
    const stoneWallAlbedo = makeColorCanvasTex(T, 512, 512, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const u = px / w, v = 1 - py / h;
          const sc = stoneCourseSample(u, v);
          const stoneVar = (hash2(sc.col * 3.7, sc.row * 5.3) - 0.5) * 0.12;
          const grain = (fbm(u * 54, v * 54, 3) - 0.5) * 0.10;
          const lum = clamp(0.38 + sc.h * 0.28 + stoneVar + grain, 0.24, 0.74);
          const mortarMix = 1 - clamp(sc.blockMask * 1.25, 0, 1);
          const r = lerp(lum * 0.89, 0.48, mortarMix * 0.42);
          const g = lerp(lum * 0.96, 0.50, mortarMix * 0.42);
          const b = lerp(lum * 1.08, 0.53, mortarMix * 0.42);
          const idx = (py * w + px) * 4;
          img.data[idx]     = clamp(r * 255, 0, 255) | 0;
          img.data[idx + 1] = clamp(g * 255, 0, 255) | 0;
          img.data[idx + 2] = clamp(b * 255, 0, 255) | 0;
          img.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }, 2.0, 1.6);

    // 10. Weathered Vertical Cedar / Timber Plank Texture (Chapel doors, shutters & corner post)
    const woodHeight = (u, v) => {
      const planks = 7;
      const fx = u * planks;
      const pIdx = Math.floor(fx);
      const rx = fx - pIdx;
      const groove = smooth(0.0, 0.05, rx) * (1 - smooth(0.95, 1.0, rx));
      const grain = Math.sin(u * TAU * 95 + fbm(u * 14, v * 6, 3) * 4.5) * 0.18;
      return groove * 0.8 + grain;
    };
    const woodPlankNormal = makeHeightToNormalTex(T, 256, woodHeight, 2.6, 1, 1);
    const woodPlankAlbedo = makeColorCanvasTex(T, 256, 256, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const u = px / w, v = 1 - py / h;
          const wh = woodHeight(u, v);
          const pIdx = Math.floor(u * 7);
          const pTone = 0.88 + (hash2(pIdx, 9.2) - 0.5) * 0.18;
          const streak = (fbm(u * 40, v * 8, 3) - 0.5) * 0.14;
          const l = clamp((0.36 + wh * 0.28 + streak) * pTone, 0.15, 0.82);
          const idx = (py * w + px) * 4;
          img.data[idx]     = clamp(l * 1.28 * 255, 0, 255) | 0;
          img.data[idx + 1] = clamp(l * 0.86 * 255, 0, 255) | 0;
          img.data[idx + 2] = clamp(l * 0.58 * 255, 0, 255) | 0;
          img.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }, 1, 1);

    // 11. Pitted Cast Concrete Plinth Normal & Albedo
    const concreteNormal = makeHeightToNormalTex(T, 256, (u, v) => {
      const agg = (fbm(u * 28, v * 28, 4) - 0.5) * 0.65;
      const pit = Math.pow(vnoise(u * 85, v * 85), 3.0) * -0.45;
      return agg + pit;
    }, 2.2, 2, 1);

    const concreteAlbedo = makeColorCanvasTex(T, 256, 256, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const u = px / w, v = 1 - py / h;
          // Pale weathered limestone/concrete (#8e8a82 in jerikan, never near-black!)
          const m = 0.78 + (fbm(u * 16, v * 16, 4) - 0.5) * 0.16 + (vnoise(u * 85, v * 85) - 0.5) * 0.06;
          const dampBase = (1.0 - smooth(0.0, 0.22, v)) * -0.05;
          const l = clamp(m + dampBase, 0.58, 0.92);
          const idx = (py * w + px) * 4;
          img.data[idx]     = clamp(l * 0.98 * 255, 0, 255) | 0;
          img.data[idx + 1] = clamp(l * 0.97 * 255, 0, 255) | 0;
          img.data[idx + 2] = clamp(l * 0.94 * 255, 0, 255) | 0;
          img.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }, 2, 1);

    assetCache = {
      hairCoilNormal,
      hairBraidNormal,
      canvasNormal,
      canvasWeaveAO,
      shammaNormal,
      shammaWeaveAO,
      knitNormal,
      leatherNormal,
      castIronNormal,
      terracottaNormal,
      stoneWallNormal,
      stoneWallAlbedo,
      woodPlankNormal,
      woodPlankAlbedo,
      concreteNormal,
      concreteAlbedo
    };
    return assetCache;
  }

  /* Cyan bounce shader injection for PBR MeshPhysicalMaterial grooms & garments */
  function attachCyanBounce(mat, cyanGlowUniform, strength = 0.75) {
    if (!cyanGlowUniform) return mat;
    mat.userData = mat.userData || {};
    mat.userData.cyanGlow = cyanGlowUniform;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uCyanGlow = cyanGlowUniform;
      sh.uniforms.uCyanStr = { value: strength };
      sh.vertexShader =
        "varying vec3 vScionBindPos;\nvarying vec3 vScionBindNrm;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvScionBindPos = position;\nvScionBindNrm = normal;"
        );
      sh.fragmentShader =
        "uniform vec4 uCyanGlow;\nuniform float uCyanStr;\nvarying vec3 vScionBindPos;\nvarying vec3 vScionBindNrm;\n" +
        sh.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n" +
          "if (uCyanGlow.w > 0.001) {\n" +
          "  vec3 toS = vScionBindPos - uCyanGlow.xyz;\n" +
          "  float d2 = dot(toS, toS) + 0.035;\n" +
          "  float ndl = clamp(dot(normalize(vScionBindNrm), normalize(-toS)) * 0.6 + 0.4, 0.0, 1.0);\n" +
          "  totalEmissiveRadiance += vec3(0.14, 0.74, 0.98) * (uCyanGlow.w * uCyanStr * ndl / (1.0 + 14.5 * d2)) * (0.42 + 0.58 * diffuseColor.rgb);\n" +
          "}"
        );
    };
    mat.customProgramCacheKey = () => "scionGroomGarment_v6_" + strength.toFixed(2);
    return mat;
  }

  /* ============================================================================
     2. GEOMETRY & EXACT CRANIO-CERVICAL-CLAVICULAR BUST SURFACE EVALUATOR
     ============================================================================ */
  function createBustEvaluator(spec = {}) {
    const V6 = typeof window !== "undefined" ? window.HumanPhysicalV6 : null;
    const SN = typeof window !== "undefined" ? window.ScionNeck : null;
    const fem = spec.fem !== undefined ? spec.fem : 0.65;
    const build = spec.build !== undefined ? spec.build : 1.0;
    const isYouth = (spec.scale || 1.0) < 0.88;
    const halfWNeck = lerp(0.0580, 0.0522, fem) * lerp(1.0, build, 0.30) * (isYouth ? 0.965 : 1.0);
    const jawScale = lerp(1.055, 0.965, fem);

    let v6Pheno = null;
    if (V6 && V6.PHENOTYPES && typeof V6.resolvePhenotypeKey === "function") {
      v6Pheno = V6.PHENOTYPES[V6.resolvePhenotypeKey(spec)] || V6.PHENOTYPES.imani;
    }

    let rawRings;
    if (v6Pheno) {
      const p = v6Pheno;
      const hwNeck = p.neckHalfW * lerp(1.0, build, 0.25);
      const jw = p.jawWidth, cw = p.craniumW, mw = p.malarWidth, topLift = p.craniumTop || 0;
      const bChest = lerp(1.0, build, 0.65);
      rawRings = [
        { p: [0, 1.258, -0.013], w: 0.136 * bChest, f: 0.078, b: 0.088, e: 0.95 },
        { p: [0, 1.285, -0.013], w: 0.146 * bChest, f: 0.088, b: 0.096, e: 0.95 },
        { p: [0, 1.332, -0.013], w: 0.149 * bChest, f: 0.091, b: 0.099, e: 0.94 },
        { p: [0, 1.378, -0.013], w: 0.139 * lerp(1, build, 0.5), f: 0.076, b: 0.090, e: 0.96 },
        { p: [0, 1.408, -0.014], w: 0.114 * lerp(1, build, 0.4), f: 0.063, b: 0.080, e: 0.98 },
        { p: [0, 1.432, -0.015], w: hwNeck * 1.38, f: 0.054, b: 0.068, e: 1.00 },
        { p: [0, 1.456, -0.015], w: hwNeck * 1.05, f: 0.051, b: 0.059, e: 1.00 },
        { p: [0, 1.482, -0.015], w: hwNeck * 1.00, f: 0.050, b: 0.057, e: 1.00 },
        { p: [0, 1.504, -0.014], w: hwNeck * 1.00, f: 0.051, b: 0.059, e: 1.00 },
        { p: [0, 1.524, -0.011], w: lerp(hwNeck * 1.02, 0.0545 * jw, 0.45), f: 0.058, b: 0.066, e: 1.00 },
        { p: [0, 1.544, -0.007], w: 0.0572 * jw, f: 0.071, b: 0.077, e: 1.00 },
        { p: [0, 1.564, -0.003], w: 0.0628 * lerp(jw, mw, 0.55), f: 0.080, b: 0.089, e: 1.00 },
        { p: [0, 1.584, -0.002], w: 0.0672 * mw, f: 0.083, b: 0.099, e: 1.00 },
        { p: [0, 1.600, -0.002], w: 0.0688 * mw, f: 0.0835, b: 0.105, e: 1.00 },
        { p: [0, 1.6158, -0.003], w: 0.0698 * cw, f: 0.0840, b: 0.111, e: 1.00 },
        { p: [0, 1.636, -0.004], w: 0.0700 * cw, f: 0.0845, b: 0.113, e: 1.00 },
        { p: [0, 1.666, -0.006], w: 0.0690 * cw, f: 0.0835, b: 0.110, e: 1.00 },
        { p: [0, 1.696 + topLift * 0.5, -0.010], w: 0.0612 * cw, f: 0.0735, b: 0.0955, e: 1.00 },
        { p: [0, 1.719 + topLift * 0.8, -0.013], w: 0.0435 * cw, f: 0.0520, b: 0.0670, e: 1.00 },
        { p: [0, 1.730 + topLift * 0.95, -0.015], w: 0.0205 * cw, f: 0.0240, b: 0.0300, e: 1.00 },
        { p: [0, 1.735 + topLift, -0.016], w: 0.0022, f: 0.0022, b: 0.0022, e: 1.00 }
      ];
    } else if (SN && typeof SN.buildRawHeadNeckBustRings === "function") {
      rawRings = SN.buildRawHeadNeckBustRings(spec);
    } else {
      rawRings = [
        { p: [0, 1.258, -0.013], w: 0.135 * build, f: 0.078, b: 0.088, e: 0.95 },
        { p: [0, 1.330, -0.013], w: 0.148 * build, f: 0.091, b: 0.099, e: 0.94 },
        { p: [0, 1.376, -0.013], w: 0.139 * lerp(1, build, 0.7), f: 0.077, b: 0.090, e: 0.96 },
        { p: [0, 1.408, -0.014], w: 0.114 * lerp(1, build, 0.5), f: 0.064, b: 0.081, e: 0.98 },
        { p: [0, 1.432, -0.015], w: lerp(halfWNeck, 0.114 * lerp(1, build, 0.5), 0.36), f: 0.055, b: 0.070, e: 1.00 },
        { p: [0, 1.454, -0.015], w: halfWNeck * 1.055, f: 0.051, b: 0.062, e: 1.00 },
        { p: [0, 1.500, -0.014], w: halfWNeck * 0.998, f: 0.050, b: 0.060, e: 1.00 },
        { p: [0, 1.533, -0.007], w: 0.0562 * jawScale, f: 0.063, b: 0.071, e: 1.01 },
        { p: [0, 1.5525, 0.001], w: 0.0598 * jawScale, f: 0.0836, b: 0.084, e: 1.03 },
        { p: [0, 1.582,  0.000], w: 0.0688, f: 0.084, b: 0.098, e: 1.02 },
        { p: [0, 1.6158,-0.003], w: 0.0740, f: 0.0835, b: 0.111, e: 1.00 },
        { p: [0, 1.644, -0.005], w: 0.0730, f: 0.085, b: 0.112, e: 1.00 },
        { p: [0, 1.680, -0.008], w: 0.0690, f: 0.082, b: 0.104, e: 1.00 },
        { p: [0, 1.712, -0.012], w: 0.0510, f: 0.061, b: 0.078, e: 1.00 },
        { p: [0, 1.728, -0.015], w: 0.0220, f: 0.026, b: 0.032, e: 1.00 },
        { p: [0, 1.732, -0.016], w: 0.0020, f: 0.002, b: 0.002, e: 1.00 }
      ];
    }
    const rings = refineRings(rawRings, 4);
    const yCrownTop = rings[rings.length - 1].p[1];

    function sampleAt(yQuery, a) {
      const y = clamp(yQuery, rings[0].p[1], rings[rings.length - 1].p[1]);
      let lo = 0, hi = rings.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (rings[mid].p[1] <= y) lo = mid;
        else hi = mid;
      }
      const r0 = rings[lo], r1 = rings[hi];
      const t = clamp((y - r0.p[1]) / Math.max(1e-6, r1.p[1] - r0.p[1]), 0, 1);
      const z0 = lerp(r0.p[2], r1.p[2], t);
      const w = lerp(r0.w, r1.w, t);
      const f = lerp(r0.f, r1.f, t);
      const b = lerp(r0.b, r1.b, t);
      const e = lerp(r0.e || 1, r1.e || 1, t);
      const sa = Math.sin(a), ca = Math.cos(a);
      const rz = ca >= 0 ? f : b;
      let lx = Math.sign(sa) * Math.pow(Math.abs(sa), e) * w;
      let lz = Math.sign(ca) * Math.pow(Math.abs(ca), e) * rz;
      let dy = 0;
      if (SN && typeof SN.evalCervicalClavicularRelief === "function" && y < 1.545) {
        const rel = SN.evalCervicalClavicularRelief(Math.abs(lx), clamp(lx / 0.010, -1, 1), y, ca, z0 + lz, z0, spec);
        lx += rel.dx; dy += rel.dy; lz += rel.dz;
      }
      if (SN && typeof SN.evalAnteriorJawDeltaZ === "function" && y > 1.488 && y < 1.550 && ca > 0) {
        lz += SN.evalAnteriorJawDeltaZ(Math.abs(lx), y, ca, z0 + lz, z0, jawScale);
      }
      const px = lx, py = y + dy, pz = z0 + lz;
      const rad = Math.hypot(px, pz - z0) || 1e-4;
      return { x: px, y: py, z: pz, z0, rx: px / rad, rz: (pz - z0) / rad, rad, w, f, b };
    }

    function skinBust(px, py, pz, B) {
      if (SN && typeof SN.computeBustSkinning === "function") {
        return SN.computeBustSkinning(px, py, pz, B);
      }
      if (py > 1.535) return { indices: [B.HEAD, B.NECK_HIGH, 0, 0], weights: [1, 0, 0, 0] };
      if (py > 1.465) {
        const wH = smooth(1.465, 1.535, py);
        return { indices: [B.HEAD, B.NECK_HIGH, 0, 0], weights: [wH, 1 - wH, 0, 0] };
      }
      const ax = Math.abs(px);
      const tLow = smooth(1.395, 1.468, py - 0.026 * smooth(0.052, 0.116, ax));
      const clavFrac = 0.56 * smooth(0.040, 0.116, ax) * smooth(1.345, 1.408, py) * (1.0 - smooth(1.440, 1.472, py));
      const wChestBase = 1.0 - tLow;
      return {
        indices: [B.CHEST, px >= 0 ? B.CLAV_L : B.CLAV_R, B.NECK_LOW, 0],
        weights: [wChestBase * (1 - clavFrac), wChestBase * clavFrac, tLow, 0]
      };
    }

    return { sampleAt, skinBust, fem, build, isYouth, jawScale, yCrownTop };
  }

  function mergeSkinnedGeos(T, geos) {
    const valid = geos.filter(g => g && g.attributes && g.attributes.position && g.attributes.position.count > 0);
    if (!valid.length) return new T.BufferGeometry();
    let vCount = 0;
    for (const g of valid) vCount += g.attributes.position.count;
    const pos = new Float32Array(vCount * 3);
    const nrm = new Float32Array(vCount * 3);
    const uvs = new Float32Array(vCount * 2);
    const col = new Float32Array(vCount * 3);
    const ski = new Uint16Array(vCount * 4);
    const skw = new Float32Array(vCount * 4);
    const idx = [];
    let vo = 0;
    for (const g of valid) {
      if (!g.attributes.normal) g.computeVertexNormals();
      const cnt = g.attributes.position.count;
      pos.set(g.attributes.position.array, vo * 3);
      nrm.set(g.attributes.normal.array, vo * 3);
      if (g.attributes.uv) uvs.set(g.attributes.uv.array, vo * 2);
      if (g.attributes.color) col.set(g.attributes.color.array, vo * 3);
      else col.fill(1.0, vo * 3, (vo + cnt) * 3);
      if (g.attributes.skinIndex && g.attributes.skinWeight) {
        ski.set(g.attributes.skinIndex.array, vo * 4);
        skw.set(g.attributes.skinWeight.array, vo * 4);
      } else {
        for (let k = 0; k < cnt; k++) skw[(vo + k) * 4] = 1.0;
      }
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
    out.boundingSphere = new T.Sphere(new T.Vector3(0, 1.05, 0), 2.85);
    return out;
  }

  function assignRigidBoneSkin(T, geo, boneIdx, shade = 1.0) {
    const cnt = geo.attributes.position.count;
    const ski = new Uint16Array(cnt * 4);
    const skw = new Float32Array(cnt * 4);
    for (let i = 0; i < cnt; i++) {
      ski[i * 4] = boneIdx;
      skw[i * 4] = 1.0;
    }
    geo.setAttribute("skinIndex", new T.BufferAttribute(ski, 4));
    geo.setAttribute("skinWeight", new T.BufferAttribute(skw, 4));
    if (!geo.attributes.color) {
      const col = new Float32Array(cnt * 3);
      col.fill(shade);
      geo.setAttribute("color", new T.BufferAttribute(col, 3));
    }
    if (!geo.attributes.uv) {
      geo.setAttribute("uv", new T.BufferAttribute(new Float32Array(cnt * 2), 2));
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    return geo;
  }

  /* ============================================================================
     3. `THREE-VRM`-STYLE DAMPED VERLET SPRING-BONE PHYSICS SOLVER
     ============================================================================ */
  function createSpringBoneChain(T, links, opts = {}) {
    const stiffness = opts.stiffness !== undefined ? opts.stiffness : 0.28;
    const drag = opts.drag !== undefined ? opts.drag : 0.42;
    const gravityPower = opts.gravityPower !== undefined ? opts.gravityPower : 0.045;
    const gravityDir = (opts.gravityDir || new T.Vector3(0, -1, 0)).clone().normalize();
    const hitRadius = opts.hitRadius !== undefined ? opts.hitRadius : 0.025;
    const windAmp = opts.windAmp !== undefined ? opts.windAmp : 0.008;
    const colliders = opts.colliders || [];

    const nodes = links.map(bone => {
      const restQuat = bone.quaternion.clone();
      const tailLocal = (bone.userData.springAxis || new T.Vector3(0, -1, 0)).clone().normalize();
      const boneLen = bone.userData.springLen || 0.08;
      return {
        bone,
        restQuat,
        tailLocal,
        boneLen,
        currTip: new T.Vector3(),
        prevTip: new T.Vector3(),
        initialized: false
      };
    });

    const headWorld = new T.Vector3();
    const parentQuat = new T.Quaternion();
    const parentQuatInv = new T.Quaternion();
    const restTipDir = new T.Vector3();
    const nextTip = new T.Vector3();
    const vel = new T.Vector3();
    const dir = new T.Vector3();
    const localDir = new T.Vector3();
    const rotDelta = new T.Quaternion();
    const colWorld = new T.Vector3();

    function reset() {
      for (const n of nodes) n.initialized = false;
    }

    function update(dt, nowSec = 0, windPhase = 0) {
      const stepDt = clamp(dt || 0.016, 0.002, 0.045);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const b = n.bone;
        if (!b.parent) continue;
        b.parent.updateWorldMatrix(true, false);
        b.parent.getWorldQuaternion(parentQuat);
        b.quaternion.copy(n.restQuat);
        b.updateMatrixWorld(true);
        b.getWorldPosition(headWorld);

        restTipDir.copy(n.tailLocal).applyQuaternion(n.restQuat).applyQuaternion(parentQuat).normalize();

        if (!n.initialized) {
          n.currTip.copy(headWorld).addScaledVector(restTipDir, n.boneLen);
          n.prevTip.copy(n.currTip);
          n.initialized = true;
        }

        vel.subVectors(n.currTip, n.prevTip).multiplyScalar(1.0 - drag);
        const breezeX = Math.sin(nowSec * 2.1 + windPhase + i * 0.7) * windAmp;
        const breezeZ = Math.cos(nowSec * 1.6 + windPhase + i * 0.9) * windAmp * 0.7;

        nextTip.copy(n.currTip)
          .add(vel)
          .addScaledVector(restTipDir, stiffness * stepDt * 60 * n.boneLen)
          .addScaledVector(gravityDir, gravityPower * stepDt * 60 * n.boneLen);
        nextTip.x += breezeX * stepDt * 30 * n.boneLen;
        nextTip.z += breezeZ * stepDt * 30 * n.boneLen;

        // Sphere collider push-out (prevents ponytail/nape/coat hem from clipping neck, back or thighs!)
        for (let c = 0; c < colliders.length; c++) {
          const col = colliders[c];
          if (!col.bone) continue;
          colWorld.copy(col.offset || col.zero).applyMatrix4(col.bone.matrixWorld);
          dir.subVectors(nextTip, colWorld);
          const dist = dir.length();
          const minDist = col.radius + hitRadius;
          if (dist < minDist && dist > 1e-5) {
            nextTip.copy(colWorld).addScaledVector(dir, minDist / dist);
          }
        }

        dir.subVectors(nextTip, headWorld);
        if (dir.lengthSq() < 1e-8) dir.copy(restTipDir);
        else dir.normalize();

        n.prevTip.copy(n.currTip);
        n.currTip.copy(headWorld).addScaledVector(dir, n.boneLen);

        parentQuatInv.copy(parentQuat).invert();
        localDir.copy(dir).applyQuaternion(parentQuatInv).normalize();
        const restLocal = restTipDir.copy(n.tailLocal).applyQuaternion(n.restQuat).normalize();
        rotDelta.setFromUnitVectors(restLocal, localDir);
        b.quaternion.copy(rotDelta).multiply(n.restQuat);
        b.updateMatrixWorld(true);
      }
    }

    return { nodes, update, reset };
  }

  /* ============================================================================
     4. 3D VOLUMETRIC SCULPTED HAIR GROOMS (`ScionGroomGarments.buildHair`)
        - Imani: Snug scalp cap + 148 sculpted 3D helical/cauliflower 4C curl tufts
        - Makeda: 12 sculpted 3-strand braided cornrow ridges + parted scalp + spring nape tails
        - June: 106 cylindrical rope-twisted short locs + crown parting + spring sway
        - Hanna: 14 sleek scalp braid rows + 28-strand braided ponytail on 3-bone spring chain
        - Elder: 5-layer diagonally wrapped 3D cloth turban + 84-clump volumetric curl beard & mustache
     ============================================================================ */

  /* Evaluate whether a skull point (x, y, z, a) lies inside the anatomical hair-bearing scalp
     with clean arched forehead hairline, temple sideburns, semicircular ear cutout, and low tapered nape! */
  function evalScalpHairCoverage(px, py, pz, style = "croppedCoily") {
    if (py >= 1.668) return 1.0;

    const ax = Math.abs(px);
    // Strict ear & sub-earlobe exclusion so ZERO stray curl berries ever dangle below/around the earlobe!
    if (ax > 0.046 && py < 1.628 && pz > -0.042) {
      const dyE = (py - 1.594) / 0.0360;
      const dzE = (pz - (-0.012)) / 0.0235;
      const earDist2 = dyE * dyE + dzE * dzE;
      // Keep ear pinna & sub-earlobe strictly clear while allowing dense temple & above-ear curls right down to helix (y = 1.602m)!
      if (earDist2 < 1.02 || (py < 1.572 && pz > -0.034)) return 0.0;
      if (earDist2 < 1.24 && py < 1.606) return smooth(1.02, 1.24, earDist2);
    }

    // Anterior forehead hairline arch (cornrows sweep slightly lower onto upper forehead matching 0bc287c6.jpg!)
    if (pz > 0.018) {
      const hairlineY = style === "cornrowBraids"
        ? (1.652 - 0.024 * smooth(0.032, 0.068, ax))
        : style === "ponytail"
        ? (1.660 - 0.022 * smooth(0.034, 0.068, ax))
        : (1.654 + 0.0020 * Math.cos(ax * 42.0) - 0.036 * smooth(0.034, 0.069, ax));
      if (py < hairlineY) return 0.0;
      return smooth(hairlineY, hairlineY + 0.008, py);
    }

    // Lateral temple & pre-auricular sideburn zone (`0b07591c.jpg` 3/4 & 90° — clean continuous hairline with zero detached stray dots!)
    if (pz >= -0.036) {
      const isCoily = style === "croppedCoily" || style === "glassesCrop";
      const sideMinY = isCoily ? 1.604 : 1.622;
      if (py < sideMinY) return 0.0;
      return smooth(sideMinY, sideMinY + 0.008, py);
    }

    // Retro-auricular mastoid & clean tapered occipital hairline (`0b07591c.jpg` 90° profile — NO long neck mullet!)
    const napeBase = style === "croppedCoily" ? 1.545 : 1.532;
    const napeFloorY = lerp(1.566, napeBase, smooth(-0.036, -0.076, pz));
    if (py < napeFloorY) return 0.0;
    return smooth(napeFloorY, napeFloorY + 0.012, py);
  }

  /* Build snug 3D anatomical scalp base cap — strictly culling 100% of cov <= 0.04 facial/eye/oral quads! */
  function buildScalpCapGeo(T, bust, B, style = "croppedCoily", inset = 0.0032) {
    const segU = 52, segV = 26, cols = segU + 1;
    const pos = [], uv = [], col = [], covArr = [], si = [], sw = [], idx = [];
    const yMin = 1.528, yMax = bust.yCrownTop || 1.735;
    const effInset = Math.max(0.0030, inset);

    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV;
      const y = lerp(yMin, yMax, Math.pow(v, 0.84));
      for (let iu = 0; iu <= segU; iu++) {
        const u = iu / segU;
        const a = u * TAU;
        const s = bust.sampleAt(y, a);
        const cov = evalScalpHairCoverage(s.x, s.y, s.z, style);
        covArr.push(cov);
        const lift = cov > 0.02 ? lerp(-0.0008, effInset, smooth(0.02, 0.35, cov)) : -0.0015;
        const ny = smooth(1.650, yMax, y);
        const px = s.x + s.rx * lift * (1 - 0.25 * ny);
        const py = s.y + lift * (0.35 + 1.15 * ny);
        const pz = s.z + s.rz * lift * (1 - 0.25 * ny);

        pos.push(px, py, pz);
        uv.push(u * 4, v * 4);
        const ao = lerp(0.42, 0.72, v) * lerp(0.60, 1.0, cov);
        col.push(ao, ao, ao);

        const wHead = smooth(1.520, 1.552, py);
        si.push(B.HEAD, B.NECK_HIGH, 0, 0);
        sw.push(wHead, 1 - wHead, 0, 0);
      }
    }

    for (let iv = 0; iv < segV; iv++) {
      for (let iu = 0; iu < segU; iu++) {
        const A = iv * cols + iu, Bv = A + 1, C = A + cols, D = C + 1;
        // STRICT FACIAL/ORBITAL/ORAL CULL: discard every quad touching non-scalp skin so ZERO black mask ever reaches eyes or mouth!
        if (covArr[A] <= 0.04 || covArr[Bv] <= 0.04 || covArr[C] <= 0.04 || covArr[D] <= 0.04) continue;
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
    return g;
  }

  /* Soft Velvety Rounded Multi-Scale 4C Coil Puff with ANALYTICAL SMOOTH NORMALS (ZERO angular rock-like polygon facets!) */
  function pushCoiledTuft(buffers, cx, cy, cz, nx, ny, nz, radius, heightScale, phase, wHead, bPrimary, bSecondary) {
    const { pos, nrm, uv, col, si, sw, idx } = buffers;
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(ny) > 0.92) { ux = 1; uy = 0; uz = 0; }
    let tx = uy * nz - uz * ny, ty = uz * nx - ux * nz, tz = ux * ny - uy * nx;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;

    const baseV = pos.length / 3;
    const NU = 8, NV = 4, cols = NU + 1;
    const rUp = radius * heightScale;
    const ellipX = 0.90 + 0.20 * Math.sin(phase * 1.7);
    const ellipZ = 0.90 + 0.20 * Math.cos(phase * 2.3);
    const leanX = Math.cos(phase * 1.3) * radius * 0.12;
    const leanZ = Math.sin(phase * 1.9) * radius * 0.12;

    for (let iv = 0; iv <= NV; iv++) {
      const v = iv / NV;
      const phi = v * Math.PI * 0.5;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      for (let iu = 0; iu <= NU; iu++) {
        const u = iu / NU;
        const th = u * TAU;
        const cT = Math.cos(th), sT = Math.sin(th);
        // Gentle rounded 3-lobe silhouette undulation (smooth normal map carries the tight 2-3mm 4C ringlets -> ZERO sharp rock facets!)
        const softWave = (
          0.09 * Math.sin(3.0 * th + phase + v * 2.2) +
          0.07 * Math.cos(4.0 * th - phase * 1.6 + v * 2.8)
        ) * smooth(0.0, 0.35, cosP);

        const radHere = radius * cosP * (1.0 + softWave);
        const topWave = 0.06 * Math.sin(3.0 * th + phase * 1.3) * cosP * rUp;
        const lx = cT * radHere * ellipX + leanX * sinP;
        const lz = sT * radHere * ellipZ + leanZ * sinP;
        const ly = (-0.26 + 1.00 * sinP) * rUp + topWave;

        pos.push(
          cx + tx * lx + bx * lz + nx * ly,
          cy + ty * lx + by * lz + ny * ly,
          cz + tz * lx + bz * lz + nz * ly
        );

        // Analytical smooth cushion normal (completely eliminates jagged flat-faceted rock shading!)
        if (nrm) {
          const lnx = cT * cosP * 0.92 + 0.12 * Math.cos(3.0 * th + phase) * cosP;
          const lnz = sT * cosP * 0.92 + 0.12 * Math.sin(4.0 * th - phase) * cosP;
          const lny = 0.25 + 0.85 * sinP;
          let wnx = tx * lnx + bx * lnz + nx * lny;
          let wny = ty * lnx + by * lnz + ny * lny;
          let wnz = tz * lnx + bz * lnz + nz * lny;
          const wnl = Math.hypot(wnx, wny, wnz) || 1;
          nrm.push(wnx / wnl, wny / wnl, wnz / wnl);
        }

        uv.push(u * 1.35 + (phase % 1.0), v * 1.35);
        // Soft spongy inter-coil cavity AO (`0.46..0.98`)
        const ao = clamp(lerp(0.46, 0.98, Math.pow(sinP, 0.58)) + softWave * 0.45, 0.38, 1.02);
        col.push(ao, ao, ao);
        si.push(bPrimary, bSecondary, 0, 0);
        sw.push(wHead, 1 - wHead, 0, 0);
      }
    }

    for (let iv = 0; iv < NV; iv++) {
      for (let iu = 0; iu < NU; iu++) {
        const A = baseV + iv * cols + iu, Bv = A + 1, C = A + cols, D = C + 1;
        idx.push(A, Bv, C, Bv, D, C);
      }
    }
  }

  /* GROOM 1: IMANI (`croppedCoily` — 0b07591c.jpg & 32b99d8c.jpg)
     Plush rounded spongy under-cap (castShadow=true) + ~360 smaller multi-scale soft rounded 4C coils (castShadow=false -> 60+ FPS E1!) */
  function buildImaniCoilyGroomGeo(T, bust, B, seed = 101) {
    const rng = mulberry32(seed);
    // Snug +4.2mm spongy under-volume cap (casts clean hair shadow in 1,100 tris while staying 100% beneath the soft 4C coils!)
    const capGeo = buildScalpCapGeo(T, bust, B, "croppedCoily", 0.0042);
    {
      const P = capGeo.attributes.position;
      for (let k = 0; k < P.count; k++) {
        const px = P.getX(k), py = P.getY(k), pz = P.getZ(k);
        const cov = evalScalpHairCoverage(px, py, pz, "croppedCoily");
        if (cov > 0.05) {
          const lat = g1(py, 1.652, 0.048) * cov;
          const back = g1(py, 1.635, 0.052) * Math.max(0, -pz / 0.11) * cov;
          const rHoriz = Math.hypot(px, pz) || 1;
          P.setX(k, px + (px / rHoriz) * 0.0115 * lat);
          P.setZ(k, pz + (pz / rHoriz) * 0.0045 * lat - 0.0065 * back);
        }
      }
      capGeo.computeVertexNormals();
    }

    const buffers = { pos: [], nrm: [], uv: [], col: [], si: [], sw: [], idx: [] };
    const totalCandidates = 520;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const yTopMax = bust.yCrownTop || 1.735;

    for (let i = 0; i < totalCandidates; i++) {
      const t = (i + 0.35) / totalCandidates;
      const y = lerp(yTopMax, 1.545, Math.pow(t, 0.96));
      const a = (i * golden + rng() * 0.18) % TAU;
      const s = bust.sampleAt(y, a);
      const cov = evalScalpHairCoverage(s.x, s.y, s.z, "croppedCoily");
      if (cov < 0.16) continue;

      const latBand = g1(y, 1.652, 0.050);
      const backBand = g1(y, 1.635, 0.055) * Math.max(0, -s.rz);
      const apexZone = smooth(1.695, yTopMax, y);
      const cx = s.x + s.rx * 0.0035 + Math.sign(s.x || 1) * (0.0155 * latBand * Math.pow(Math.abs(s.rx), 0.72));
      const cy = s.y + 0.0045 * (1.0 + 0.25 * apexZone);
      const cz = s.z + s.rz * (0.0035 + 0.0055 * latBand) - 0.0080 * backBand;

      const domeUp = smooth(1.635, yTopMax, y);
      let nx = s.rx * (1.10 - 0.72 * domeUp);
      let ny = lerp(0.05, 0.96, domeUp);
      let nz = s.rz * (1.05 - 0.70 * domeUp);
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      // Smaller, softer multi-scale rounded 4C coils (`6.5mm .. 12.6mm` radius covering 100% of crown & temples — zero angular rock facets!)
      const crownFull = smooth(1.588, 1.685, y);
      const napeTaper = smooth(1.545, 1.586, y);
      const edgeTaper = lerp(0.68, 1.0, cov);
      const multiScale = 0.70 + 0.60 * Math.pow(rng(), 1.1);
      const baseR = lerp(0.0074, 0.0126, crownFull * 0.74 + napeTaper * 0.26) * edgeTaper * multiScale;
      const hScale = lerp(0.66, 0.88, crownFull) * edgeTaper * (0.86 + 0.26 * rng());

      const wHead = smooth(1.525, 1.555, cy);
      pushCoiledTuft(
        buffers,
        cx, cy, cz,
        nx, ny, nz,
        baseR, hScale,
        rng() * TAU * 3.0,
        wHead, B.HEAD, B.NECK_HIGH
      );
    }

    // Fine smaller hairline & temple micro-coils (`4.5-7.5mm` soft rounded coils!)
    const rimAngles = 54;
    for (let k = 0; k < rimAngles; k++) {
      const a = (k / rimAngles) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      let yRim;
      if (ca > 0.22) {
        yRim = 1.654 - 0.034 * smooth(0.032, 0.068, Math.abs(sa) * 0.072);
      } else if (ca > -0.42) {
        yRim = 1.604;
      } else {
        yRim = lerp(1.568, 1.548, smooth(-0.42, -0.94, ca));
      }
      const s = bust.sampleAt(yRim + 0.004, a);
      if (evalScalpHairCoverage(s.x, s.y, s.z, "croppedCoily") < 0.12) continue;
      const latOut = Math.abs(sa) * 0.011 * smooth(1.585, 1.635, yRim);
      const domeUp = smooth(1.63, 1.72, yRim);
      let nx = s.rx * (1.1 - 0.45 * domeUp), ny = domeUp * 0.55, nz = s.rz * (1.0 - 0.45 * domeUp);
      const nl = Math.hypot(nx, ny, nz) || 1;
      const rMicro = ca > -0.35 ? (0.0058 + 0.0028 * rng()) : (0.0048 + 0.0020 * rng());
      const wHead = smooth(1.525, 1.555, s.y);
      pushCoiledTuft(
        buffers,
        s.x + s.rx * 0.003 + Math.sign(s.x || 1) * latOut, s.y, s.z + s.rz * 0.003,
        nx / nl, ny / nl, nz / nl,
        rMicro, 0.78, rng() * TAU * 3.0, wHead, B.HEAD, B.NECK_HIGH
      );
    }

    const tuftGeo = new T.BufferGeometry();
    tuftGeo.setAttribute("position", new T.Float32BufferAttribute(buffers.pos, 3));
    tuftGeo.setAttribute("normal", new T.Float32BufferAttribute(buffers.nrm, 3));
    tuftGeo.setAttribute("uv", new T.Float32BufferAttribute(buffers.uv, 2));
    tuftGeo.setAttribute("color", new T.Float32BufferAttribute(buffers.col, 3));
    tuftGeo.setAttribute("skinIndex", new T.Uint16BufferAttribute(buffers.si, 4));
    tuftGeo.setAttribute("skinWeight", new T.Float32BufferAttribute(buffers.sw, 4));
    tuftGeo.setIndex(buffers.idx);

    return { capGeo, tuftGeo };
  }

  /* Push a sculpted 3-strand braided / rope-twisted spline tube into buffers */
  function pushBraidedSplineTube(buffers, pts, normals, rStart, rMid, rEnd, segR, plaitFreq, plaitAmp, skinFn) {
    const { pos, uv, col, si, sw, idx } = buffers;
    const baseV = pos.length / 3;
    const nPts = pts.length;
    const cols = segR + 1;

    for (let i = 0; i < nPts; i++) {
      const u = i / Math.max(1, nPts - 1);
      const P = pts[i];
      const Pprev = pts[Math.max(0, i - 1)];
      const Pnext = pts[Math.min(nPts - 1, i + 1)];
      let tx = Pnext[0] - Pprev[0], ty = Pnext[1] - Pprev[1], tz = Pnext[2] - Pprev[2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;

      const N0 = normals ? normals[i] : [0, 1, 0];
      let bx = ty * N0[2] - tz * N0[1];
      let by = tz * N0[0] - tx * N0[2];
      let bz = tx * N0[1] - ty * N0[0];
      let bl = Math.hypot(bx, by, bz);
      if (bl < 1e-4) { bx = 1; by = 0; bz = 0; bl = 1; }
      bx /= bl; by /= bl; bz /= bl;
      const nx = by * tz - bz * ty, ny = bz * tx - bx * tz, nz = bx * ty - by * tx;

      const env = u < 0.12 ? smooth(0.0, 0.12, u) * 0.55 + 0.45 : (u > 0.85 ? lerp(1.0, 0.28, (u - 0.85) / 0.15) : 1.0);
      const rBase = (u < 0.5 ? lerp(rStart, rMid, u * 2) : lerp(rMid, rEnd, (u - 0.5) * 2)) * env;

      // 3-strand alternating left-right interlocking plait weave offset
      const plaitPhase = u * plaitFreq * TAU;
      const weaveLat = Math.sin(plaitPhase) * rBase * plaitAmp;
      const weaveUp = Math.abs(Math.cos(plaitPhase)) * rBase * (plaitAmp * 0.55);

      const sk = skinFn(u, P[0], P[1], P[2]);

      for (let j = 0; j <= segR; j++) {
        const vAng = (j / segR) * TAU;
        const ca = Math.cos(vAng), sa = Math.sin(vAng);
        // Helical 3-strand groove relief around circumference
        const groove = 1.0 + 0.16 * Math.sin(2.0 * vAng + plaitPhase) + 0.08 * Math.cos(3.0 * vAng - plaitPhase);
        const rx = rBase * groove * 1.08;
        const ry = rBase * groove * 0.92;

        const cx = P[0] + bx * (sa * rx + weaveLat) + nx * (ca * ry + weaveUp);
        const cy = P[1] + by * (sa * rx + weaveLat) + ny * (ca * ry + weaveUp);
        const cz = P[2] + bz * (sa * rx + weaveLat) + nz * (ca * ry + weaveUp);

        pos.push(cx, cy, cz);
        uv.push(j / segR, u * 6.0);

        // Dark root-parting AO on underside (ca < 0), crisp highlight on top plait crest (ca > 0)
        const crest = clamp(0.62 + 0.34 * (0.5 + 0.5 * ca) + 0.08 * Math.sin(plaitPhase + sa * 2.0), 0.38, 1.06);
        col.push(crest, crest, crest);
        si.push(sk.i0, sk.i1, sk.i2 || 0, 0);
        sw.push(sk.w0, sk.w1, sk.w2 || 0, 0);
      }
    }

    for (let i = 0; i < nPts - 1; i++) {
      for (let j = 0; j < segR; j++) {
        const A = baseV + i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
        idx.push(A, Bv, C, Bv, D, C);
      }
    }
  }

  /* GROOM 2: MAKEDA (`cornrowBraids` — 0bc287c6.jpg & 32b99d8c.jpg)
     12 sculpted 3-strand braided cornrow ridges hugging skull symmetrically from forehead hairline to occipital nape
     with parted scalp lanes between rows + 7 gathered braided nape tails on spring-bones! */
  function buildMakedaCornrowsGroom(T, bust, B, skeleton, addExtraSpringBones) {
    // Dark parted scalp base cap (+1.6mm proud of skull) so clean parted scalp lanes show between raised +6.2mm cornrow ridges!
    const capGeo = buildScalpCapGeo(T, bust, B, "cornrowBraids", 0.0016);
    // Elder beard buffer also includes smooth analytical normals!
    const buffers = { pos: [], nrm: [], uv: [], col: [], si: [], sw: [], idx: [] };

    let bNape0 = B.HAIR_TAIL, bNape1 = B.HAIR_TAIL;
    if (addExtraSpringBones) {
      const chain = addExtraSpringBones("makeda_nape", B.HEAD, [
        { pos: [0, 1.548, -0.088], len: 0.055, axis: [0, -0.88, -0.46] },
        { pos: [0, 1.500, -0.112], len: 0.055, axis: [0, -0.94, -0.34] }
      ], { stiffness: 0.32, drag: 0.45, gravityPower: 0.04 });
      if (chain && chain.length >= 2) {
        bNape0 = chain[0];
        bNape1 = chain[1];
      }
    }

    const nRows = 12;
    const nSegs = 28;
    for (let r = 0; r < nRows; r++) {
      // Spread rows symmetrically from right temple (-0.917) across crown (0) to left temple (+0.917)
      const lane = ((r + 0.5) / nRows) * 2.0 - 1.0;
      const side = lane >= 0 ? 1 : -1;
      const absLane = Math.abs(lane);

      const pts = [], nrms = [];
      for (let sIdx = 0; sIdx <= nSegs; sIdx++) {
        const u = sIdx / nSegs; // 0 = forehead/temple hairline -> 1 = gathered occipital nape
        // Exact mirror-symmetric angle from front hairline (|aFront| <= 69°) over parietal dome to occipital nape (PI - 0.04..0.34)!
        const absAFront = absLane * 1.20;
        const absABack = Math.PI - lerp(0.04, 0.34, absLane);
        const absA = lerp(absAFront, absABack, Math.pow(u, 0.90));
        const a = side * absA;

        const yFront = 1.653 - 0.028 * Math.pow(absLane, 1.40);
        const yPeak = lerp((bust.yCrownTop || 1.735) + 0.002, 1.648, Math.pow(absLane, 1.32));
        const yNape = lerp(1.532, 1.546, absLane);
        const arch = Math.sin(u * Math.PI);
        const yQuery = lerp(yFront, yNape, u) + (yPeak - lerp(yFront, yNape, 0.44)) * Math.pow(arch, 0.84);

        const bs = bust.sampleAt(yQuery, a);
        const domeUp = smooth(1.62, 1.73, yQuery);
        let nx = bs.rx * (1 - 0.65 * domeUp), ny = lerp(-0.04, 0.98, domeUp), nz = bs.rz * (1 - 0.65 * domeUp);
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;

        const lift = 0.0056;
        pts.push([bs.x + nx * lift, bs.y + ny * lift, bs.z + nz * lift]);
        nrms.push([nx, ny, nz]);
      }

      pushBraidedSplineTube(
        buffers, pts, nrms,
        0.0050, 0.0072, 0.0056,
        8, 16.0, 0.25,
        (u, _x, py) => {
          const wH = smooth(1.515, 1.555, py);
          return { i0: B.HEAD, i1: B.NECK_HIGH, w0: wH, w1: 1 - wH };
        }
      );
    }

    // 7 Gathered Braided Nape Tails draping at occipital nape (visible behind Makeda's neck in 0bc287c6.jpg & 32b99d8c.jpg!)
    const nTails = 7;
    for (let t = 0; t < nTails; t++) {
      const f = (t / (nTails - 1)) * 2 - 1; // -1 .. +1
      const pts = [], nrms = [];
      const x0 = f * 0.036;
      const y0 = 1.542 + 0.006 * (1 - f * f);
      const z0 = -0.082 - 0.008 * (1 - f * f);
      const tailLen = 0.095 + 0.018 * (1 - Math.abs(f));
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        const flareX = x0 * (1 + 0.28 * u) + Math.sin(u * 4 + t) * 0.003;
        const dropY = y0 - u * tailLen * 0.88;
        const backZ = z0 - 0.024 * Math.sin(u * Math.PI * 0.75) - 0.014 * u;
        pts.push([flareX, dropY, backZ]);
        nrms.push([f * 0.25, 0.15, -0.95]);
      }
      pushBraidedSplineTube(
        buffers, pts, nrms,
        0.0058, 0.0052, 0.0028,
        7, 11.0, 0.22,
        u => {
          if (u < 0.25) {
            const w = u / 0.25;
            return { i0: B.HEAD, i1: bNape0, w0: 1 - w, w1: w };
          }
          const w2 = smooth(0.25, 0.85, u);
          return { i0: bNape0, i1: bNape1, w0: 1 - w2, w1: w2 };
        }
      );
    }

    const braidGeo = new T.BufferGeometry();
    braidGeo.setAttribute("position", new T.Float32BufferAttribute(buffers.pos, 3));
    braidGeo.setAttribute("uv", new T.Float32BufferAttribute(buffers.uv, 2));
    braidGeo.setAttribute("color", new T.Float32BufferAttribute(buffers.col, 3));
    braidGeo.setAttribute("skinIndex", new T.Uint16BufferAttribute(buffers.si, 4));
    braidGeo.setAttribute("skinWeight", new T.Float32BufferAttribute(buffers.sw, 4));
    braidGeo.setIndex(buffers.idx);
    braidGeo.computeVertexNormals();

    return mergeSkinnedGeos(T, [capGeo, braidGeo]);
  }

  /* GROOM 3: JUNE (`shortLocs` — 0bc287c6.jpg & 32b99d8c.jpg)
     114 distinct cylindrical rope-twisted short locs hugging the cranial contour with natural crown parting,
     framing temples & nape, with 4-quadrant damped spring-bone sway! */
  function buildJuneShortLocsGroom(T, bust, B, addExtraSpringBones, seed = 307) {
    const rng = mulberry32(seed);
    const capGeo = buildScalpCapGeo(T, bust, B, "shortLocs", 0.0018);
    // Elder beard buffer also includes smooth analytical normals!
    const buffers = { pos: [], nrm: [], uv: [], col: [], si: [], sw: [], idx: [] };

    let locBones = [B.HAIR_TAIL, B.HAIR_TAIL, B.HAIR_TAIL, B.HAIR_TAIL];
    if (addExtraSpringBones) {
      const qSpecs = [
        [ 0.045, 1.665,  0.035],
        [-0.045, 1.665,  0.035],
        [ 0.048, 1.635, -0.065],
        [-0.048, 1.635, -0.065]
      ];
      for (let q = 0; q < 4; q++) {
        const ch = addExtraSpringBones("june_loc_" + q, B.HEAD, [
          { pos: qSpecs[q], len: 0.068, axis: [qSpecs[q][0] * 2.5, -0.92, qSpecs[q][2] * 1.5] }
        ], { stiffness: 0.40, drag: 0.50, gravityPower: 0.032 });
        if (ch && ch.length) locBones[q] = ch[0];
      }
    }

    const candidates = 265;
    const golden = Math.PI * (3 - Math.sqrt(5));
    let locCount = 0;

    for (let i = 0; i < candidates; i++) {
      const t = (i + 0.25) / candidates;
      // Extra-dense thick twisted locs covering crown, temples & framing ears/jawline (`0bc287c6.jpg` 1:1!)
      const y = lerp((bust.yCrownTop || 1.736), 1.536, Math.pow(t, 1.36));
      const a = (i * golden + rng() * 0.12) % TAU;
      const s = bust.sampleAt(y, a);
      if (evalScalpHairCoverage(s.x, s.y, s.z, "shortLocs") < 0.20) continue;

      if (y > 1.706 && s.z > -0.016 && Math.abs(s.x - 0.009) < 0.0024) continue;

      const partSide = (s.x >= 0.009 || (y < 1.692 && s.x >= 0)) ? 1 : -1;
      const isFront = s.z > 0.018;
      const locLen = lerp(0.062, 0.098, smooth(1.54, 1.72, y)) * (0.90 + 0.20 * rng());
      const rLoc = 0.0056 + 0.0016 * rng();

      const domeUp = smooth(1.62, 1.73, y);
      let nx = s.rx * (1 - 0.55 * domeUp), ny = lerp(0.05, 0.96, domeUp), nz = s.rz * (1 - 0.55 * domeUp);
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      // Soft rounded loc bob hugging close around skull & temples (0bc287c6.jpg — never splayed out like sticks!)
      const sweepX = isFront ? partSide * (0.34 + 0.16 * rng()) : (s.rx * 0.32 + partSide * 0.10);
      const sweepZ = isFront ? 0.22 : (s.rz * 0.34 - 0.06);

      const pts = [], nrms = [];
      const nSteps = 9;
      for (let k = 0; k <= nSteps; k++) {
        const u = k / nSteps;
        const rootLift = Math.sin(Math.min(1, u * 2.4) * Math.PI * 0.5) * 0.0075 * (1 - 0.30 * u);
        const gravDrop = Math.pow(u, 1.32) * locLen;
        const outSpread = Math.sin(u * Math.PI * 0.76) * locLen * 0.22;

        let px = s.x + nx * rootLift + sweepX * outSpread;
        let py = s.y + ny * rootLift - gravDrop * (isFront ? 0.68 : 0.86);
        let pz = s.z + nz * rootLift + sweepZ * outSpread;

        if (py > 1.515 && py < 1.728) {
          const angNow = Math.atan2(px, pz - s.z0);
          const bsNow = bust.sampleAt(py, angNow);
          const minR = bsNow.rad + rLoc + 0.0022;
          const curR = Math.hypot(px, pz - bsNow.z0) || 1e-4;
          if (curR < minR) {
            const sc = minR / curR;
            px *= sc;
            pz = bsNow.z0 + (pz - bsNow.z0) * sc;
          }
          if (Math.abs(px) > 0.055) {
            const dyE = py - 1.595, dzE = pz - (-0.011);
            const dEar = Math.hypot(dyE / 0.032, dzE / 0.024);
            if (dEar < 1.08 && dEar > 1e-4) {
              pz = -0.011 + (dzE >= 0 ? 1 : -1) * Math.max(Math.abs(dzE), 0.025);
              px = Math.sign(px) * Math.max(Math.abs(px), 0.075);
            }
          }
        }
        if (pz > 0.040 && Math.abs(px) < 0.052) {
          const minFringeY = lerp(1.648, 1.616, smooth(0.016, 0.052, Math.abs(px)));
          if (py < minFringeY) py = minFringeY;
        }

        pts.push([px, py, pz]);
        nrms.push([nx, ny, nz]);
      }

      const qIdx = (s.z >= 0 ? 0 : 2) + (s.x >= 0 ? 0 : 1);
      const bSpring = locBones[qIdx];
      pushBraidedSplineTube(
        buffers, pts, nrms,
        rLoc * 0.96, rLoc * 1.08, rLoc * 0.66,
        7, 13.0, 0.18,
        u => {
          const wSp = Math.pow(u, 1.65) * 0.68;
          return { i0: B.HEAD, i1: bSpring, w0: 1 - wSp, w1: wSp };
        }
      );
      locCount++;
    }

    const locsGeo = new T.BufferGeometry();
    locsGeo.setAttribute("position", new T.Float32BufferAttribute(buffers.pos, 3));
    locsGeo.setAttribute("uv", new T.Float32BufferAttribute(buffers.uv, 2));
    locsGeo.setAttribute("color", new T.Float32BufferAttribute(buffers.col, 3));
    locsGeo.setAttribute("skinIndex", new T.Uint16BufferAttribute(buffers.si, 4));
    locsGeo.setAttribute("skinWeight", new T.Float32BufferAttribute(buffers.sw, 4));
    locsGeo.setIndex(buffers.idx);
    locsGeo.computeVertexNormals();

    const merged = mergeSkinnedGeos(T, [capGeo, locsGeo]);
    merged.userData = { locCount, style: "shortLocs" };
    return merged;
  }

  /* GROOM 4: HANNA (`ponytail` — 32b99d8c.jpg)
     16 sleek pulled-back scalp braid rows + wrapped tie + 28-strand cascading braided ponytail on 3-bone spring chain! */
  function buildHannaPonytailGroom(T, bust, B, addExtraSpringBones, seed = 409) {
    const rng = mulberry32(seed);
    const capGeo = buildScalpCapGeo(T, bust, B, "ponytail", 0.0018);
    // Elder beard buffer also includes smooth analytical normals!
    const buffers = { pos: [], nrm: [], uv: [], col: [], si: [], sw: [], idx: [] };

    const tiePos = [0, 1.628, -0.112];
    let bP0 = B.HAIR_TAIL, bP1 = B.HAIR_TAIL, bP2 = B.HAIR_TAIL;
    if (addExtraSpringBones) {
      const ch = addExtraSpringBones("hanna_pony", B.HEAD, [
        { pos: [0, 1.626, -0.114], len: 0.088, axis: [0, -0.82, -0.57] },
        { pos: [0, 1.554, -0.164], len: 0.095, axis: [0, -0.94, -0.34] },
        { pos: [0, 1.464, -0.196], len: 0.095, axis: [0, -0.98, -0.18] }
      ], { stiffness: 0.26, drag: 0.40, gravityPower: 0.052 });
      if (ch && ch.length >= 3) {
        bP0 = ch[0]; bP1 = ch[1]; bP2 = ch[2];
      }
    }

    // 1. 16 Mirror-Symmetric Sleek Pulled-Back Scalp Braid Ridges converging into occipital tie
    const nScalpRows = 16;
    for (let r = 0; r < nScalpRows; r++) {
      const lane = ((r + 0.5) / nScalpRows) * 2.0 - 1.0;
      const side = lane >= 0 ? 1 : -1;
      const absL = Math.abs(lane);
      const pts = [], nrms = [];
      for (let s = 0; s <= 18; s++) {
        const u = s / 18;
        const absAStart = absL * 1.30;
        const absAEnd = Math.PI - 0.08 * absL;
        const a = side * lerp(absAStart, absAEnd, u);
        const yStart = 1.663 - 0.032 * Math.pow(absL, 1.3);
        const yPeak = lerp((bust.yCrownTop || 1.735) + 0.002, 1.646, Math.pow(absL, 1.25));
        const yQuery = lerp(yStart, tiePos[1], u) + (yPeak - lerp(yStart, tiePos[1], 0.45)) * Math.sin(u * Math.PI);
        const bs = bust.sampleAt(yQuery, a);
        const domeUp = smooth(1.62, 1.73, yQuery);
        let nx = bs.rx * (1 - 0.65 * domeUp), ny = lerp(0.0, 0.96, domeUp), nz = bs.rz * (1 - 0.65 * domeUp);
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const px = lerp(bs.x + nx * 0.0044, lane * 0.014, Math.pow(u, 3.2));
        const py = lerp(bs.y + ny * 0.0044, tiePos[1] + (0.5 - absL) * 0.010, Math.pow(u, 3.2));
        const pz = lerp(bs.z + nz * 0.0044, tiePos[2] + 0.006, Math.pow(u, 3.2));
        pts.push([px, py, pz]);
        nrms.push([nx, ny, nz]);
      }
      pushBraidedSplineTube(buffers, pts, nrms, 0.0042, 0.0052, 0.0042, 6, 16.0, 0.18, () => ({ i0: B.HEAD, i1: 0, w0: 1, w1: 0 }));
    }

    // 2. Wrapped Braided Cuff around Ponytail Root
    {
      const wrapPts = [], wrapNrms = [];
      for (let k = 0; k <= 16; k++) {
        const th = (k / 16) * TAU;
        wrapPts.push([Math.cos(th) * 0.022, tiePos[1] + Math.sin(th) * 0.020, tiePos[2] - 0.004]);
        wrapNrms.push([Math.cos(th), Math.sin(th), -0.3]);
      }
      pushBraidedSplineTube(buffers, wrapPts, wrapNrms, 0.0055, 0.0055, 0.0055, 6, 8.0, 0.12, () => ({ i0: B.HEAD, i1: bP0, w0: 0.7, w1: 0.3 }));
    }

    // 3. 28 Distinct Cascading Braided Ponytail Strands (reaching y ~ 1.35m over upper back!)
    const nStrands = 28;
    for (let s = 0; s < nStrands; s++) {
      const ringT = (s + 0.5) / nStrands;
      const th = s * 2.39996;
      const radFrac = Math.sqrt(ringT);
      const ox = Math.cos(th) * 0.018 * radFrac;
      const oy = Math.sin(th) * 0.016 * radFrac;
      const strandLen = 0.255 + 0.045 * (1 - radFrac * 0.5) + (rng() - 0.5) * 0.025;
      const rStrand = 0.0042 + 0.0014 * rng();

      const pts = [], nrms = [];
      for (let k = 0; k <= 12; k++) {
        const u = k / 12;
        const archBack = Math.sin(u * Math.PI * 0.58) * 0.068 + u * 0.032;
        const splay = 1.0 + 1.35 * Math.sin(u * Math.PI * 0.82);
        const px = ox * splay + Math.sin(u * 5 + s) * 0.003;
        const py = tiePos[1] + oy * (1 - 0.4 * u) + 0.014 * Math.sin(u * Math.PI * 0.35) - Math.pow(u, 1.18) * strandLen;
        const pz = tiePos[2] - archBack + oy * 0.32 * u;
        pts.push([px, py, pz]);
        nrms.push([Math.cos(th) * 0.5, 0.2, -0.85]);
      }

      pushBraidedSplineTube(
        buffers, pts, nrms,
        rStrand * 0.92, rStrand * 1.06, rStrand * 0.38,
        6, 14.0, 0.20,
        u => {
          if (u < 0.16) {
            const w = u / 0.16;
            return { i0: B.HEAD, i1: bP0, w0: 1 - w, w1: w };
          }
          if (u < 0.52) {
            const w = (u - 0.16) / 0.36;
            return { i0: bP0, i1: bP1, w0: 1 - w, w1: w };
          }
          const w = clamp((u - 0.52) / 0.48, 0, 1);
          return { i0: bP1, i1: bP2, w0: 1 - w, w1: w };
        }
      );
    }

    const ponyGeo = new T.BufferGeometry();
    ponyGeo.setAttribute("position", new T.Float32BufferAttribute(buffers.pos, 3));
    ponyGeo.setAttribute("uv", new T.Float32BufferAttribute(buffers.uv, 2));
    ponyGeo.setAttribute("color", new T.Float32BufferAttribute(buffers.col, 3));
    ponyGeo.setAttribute("skinIndex", new T.Uint16BufferAttribute(buffers.si, 4));
    ponyGeo.setAttribute("skinWeight", new T.Float32BufferAttribute(buffers.sw, 4));
    ponyGeo.setIndex(buffers.idx);
    ponyGeo.computeVertexNormals();

    return mergeSkinnedGeos(T, [capGeo, ponyGeo]);
  }

  /* GROOM 5A: ELDER MULTI-LAYERED DIAGONAL CLOTH TURBAN (`32b99d8c.jpg` & `735822c2.jpg`)
     5 overlapping diagonally-crossed 3D woven cloth bands + nested fold creases + crowned top tuck! */
  function buildElderTurbanGeo(T, bust, B) {
    const geos = [];
    // Inner crowned cloth cap
    const crownRings = refineRings([
      { p: [0, 1.632, -0.014], w: 0.079, f: 0.084, b: 0.112, e: 1.00 },
      { p: [0, 1.682, -0.014], w: 0.086, f: 0.090, b: 0.118, e: 1.00 },
      { p: [0, 1.734, -0.018], w: 0.074, f: 0.078, b: 0.098, e: 1.02 },
      { p: [0, 1.762, -0.022], w: 0.028, f: 0.030, b: 0.038, e: 1.04 },
      { p: [0, 1.768, -0.023], w: 0.002, f: 0.002, b: 0.002, e: 1.00 }
    ], 3);

    const buildClothBand = (yCenter, tiltZ, tiltX, bandH, radOut, phase, layerIdx) => {
      const segU = 52, segV = 8, cols = segU + 1;
      const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
      for (let iv = 0; iv <= segV; iv++) {
        const v = iv / segV; // 0 = tucked lower edge -> 0.5 = plump cloth belly -> 1 = tucked upper edge
        const profile = Math.sin(v * Math.PI);
        const edgeRoll = (v - 0.5) * bandH;
        for (let iu = 0; iu <= segU; iu++) {
          const u = iu / segU;
          const a = u * TAU;
          const sa = Math.sin(a), ca = Math.cos(a);
          const yTilted = clamp(yCenter + sa * tiltZ + ca * tiltX + edgeRoll, 1.608, 1.764);
          const bs = bust.sampleAt(Math.min(1.726, yTilted), a);
          // 3 nested micro-creases within each wrapped cloth band!
          const subFolds = Math.sin(v * Math.PI * 3.0 + Math.sin(a * 3.0 + phase) * 0.8) * 0.0038 * profile;
          const overlapLift = radOut + profile * 0.0135 + subFolds;
          const dome = smooth(1.69, 1.76, yTilted);
          const px = bs.x + bs.rx * overlapLift * (1 + 0.14 * dome);
          const py = yTilted + dome * 0.018 * profile;
          const pz = bs.z + bs.rz * overlapLift * (1 + 0.10 * dome);

          pos.push(px, py, pz);
          uv.push(u * 4, v * 0.8 + layerIdx * 0.2);
          const ao = clamp(0.36 + 0.60 * profile + 0.14 * Math.sin(v * Math.PI * 3.0), 0.34, 1.06);
          col.push(ao, ao * 0.99, ao * 0.96);
          si.push(B.HEAD, 0, 0, 0);
          sw.push(1, 0, 0, 0);
        }
      }
      for (let iv = 0; iv < segV; iv++) {
        for (let iu = 0; iu < segU; iu++) {
          const A = iv * cols + iu, Bv = A + 1, C = A + cols, D = C + 1;
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
      return g;
    };

    // Crown dome
    {
      const seg = 40, cols = seg + 1, n = crownRings.length;
      const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
      for (let i = 0; i < n; i++) {
        const r = crownRings[i], v = i / (n - 1);
        for (let j = 0; j <= seg; j++) {
          const u = j / seg, a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
          const rz = ca >= 0 ? r.f : r.b;
          const fold = 1 + 0.018 * Math.sin(a * 5 + v * 9);
          pos.push(sa * r.w * fold, r.p[1], r.p[2] + ca * rz * fold);
          uv.push(u * 3, v * 2);
          const c = 0.78 + 0.18 * v;
          col.push(c, c * 0.99, c * 0.96);
          si.push(B.HEAD, 0, 0, 0);
          sw.push(1, 0, 0, 0);
        }
      }
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < seg; j++) {
          const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
          idx.push(A, Bv, C, Bv, D, C);
        }
      }
      const cg = new T.BufferGeometry();
      cg.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      cg.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      cg.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      cg.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      cg.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
      cg.setIndex(idx);
      cg.computeVertexNormals();
      geos.push(cg);
    }

    // 5 Asymmetric Diagonal Overlapping Cloth Wraps (authentic Ethiopian highland V-cross over forehead!)
    geos.push(buildClothBand(1.654,  0.022, -0.008, 0.036, 0.0045, 0.4, 0));
    geos.push(buildClothBand(1.662, -0.024, -0.006, 0.038, 0.0082, 1.9, 1));
    geos.push(buildClothBand(1.684,  0.020, -0.010, 0.040, 0.0108, 3.1, 2));
    geos.push(buildClothBand(1.704, -0.018, -0.012, 0.038, 0.0115, 4.4, 3));
    geos.push(buildClothBand(1.724,  0.012, -0.014, 0.034, 0.0088, 5.5, 4));

    return mergeSkinnedGeos(T, geos);
  }

  /* GROOM 5B: ELDER VOLUMETRIC CURL-CLUMP FULL BEARD & MUSTACHE (`32b99d8c.jpg`)
     Skinned cleanly across B.HEAD (sideburns, upper cheek, mustache) and B.JAW (chin & lower mandible)! */
  function buildElderBeardGeo(T, bust, B, seed = 521) {
    const rng = mulberry32(seed);
    // Elder beard buffer also includes smooth analytical normals!
    const buffers = { pos: [], nrm: [], uv: [], col: [], si: [], sw: [], idx: [] };

    // 1. 84 Volumetric 3D Coiled Beard Clumps across sideburns, jaw ramus, chin pad & submental beard!
    const candidates = 150;
    for (let i = 0; i < candidates; i++) {
      const u = (i + 0.5) / candidates;
      const y = lerp(1.606, 1.484, Math.pow(u, 0.85));
      // Angle spans front chin (0) to pre-auricular sideburns (±1.32 rad)
      const a = ((i * 2.39996) % 2.64) - 1.32;
      const aa = Math.abs(a);

      // Clean cheek cutout above diagonal beard line & clean oral mouth cutout around lips!
      const beardLineY = lerp(1.536, 1.606, smooth(0.28, 1.08, aa));
      if (y > beardLineY) continue;
      // Keep oral rima & vermilion lips unobstructed (y in 1.540..1.568, |a| < 0.42)
      if (y > 1.538 && y < 1.572 && aa < 0.44) continue;

      const s = bust.sampleAt(Math.max(1.494, y), a);
      const chinDrop = Math.max(0, 1.516 - y) * 1.45 + smooth(0.55, 0.0, aa) * smooth(1.542, 1.502, y) * 0.016;
      const cx = s.x * (y < 1.505 ? lerp(0.75, 1.0, smooth(1.484, 1.505, y)) : 1.0);
      const cy = y - chinDrop * 0.35;
      const cz = s.z + chinDrop * 0.45;

      let nx = s.rx, ny = y < 1.515 ? -0.58 : -0.14, nz = s.rz + (aa < 0.45 ? 0.28 : 0.0);
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      const isSideburn = y > 1.562;
      const rTuft = isSideburn ? (0.0062 + 0.0020 * rng()) : lerp(0.0135, 0.0085, aa / 1.35) * (0.88 + 0.24 * rng());
      // Jaw skinning weight: 1.0 on chin/mandible, blending smoothly into B.HEAD on upper sideburns!
      const wJaw = (1.0 - smooth(1.538, 1.575, y)) * (1.0 - 0.65 * smooth(0.85, 1.25, aa));

      pushCoiledTuft(buffers, cx, cy, cz, nx, ny, nz, rTuft, isSideburn ? 0.72 : 1.08, rng() * TAU, 1 - wJaw, B.HEAD, B.JAW);
    }

    // 2. Sculpted Arched 3D Mustache flanking philtrum & upper vermilion lip (skinned to B.HEAD + slight B.JAW corner follow)
    for (const side of [1, -1]) {
      const pts = [], nrms = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        const a = side * lerp(0.03, 0.46, u);
        const y = lerp(1.569, 1.546, Math.pow(u, 1.35));
        const s = bust.sampleAt(y, a);
        pts.push([s.x + s.rx * 0.0042, y, s.z + s.rz * 0.0056]);
        nrms.push([s.rx, 0.08, s.rz]);
      }
      pushBraidedSplineTube(
        buffers, pts, nrms,
        0.0048, 0.0064, 0.0042,
        7, 9.0, 0.14,
        u => {
          const wJ = smooth(0.55, 1.0, u) * 0.38;
          return { i0: B.HEAD, i1: B.JAW, w0: 1 - wJ, w1: wJ };
        }
      );
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(buffers.pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(buffers.uv, 2));
    g.setAttribute("color", new T.Float32BufferAttribute(buffers.col, 3));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(buffers.si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(buffers.sw, 4));
    g.setIndex(buffers.idx);
    g.computeVertexNormals();
    return g;
  }

  /* Secondary Cast Hairstyles (`shashWrap`, `silverSwept`, `glassesCrop`) — 100% 3D Sculpted, ZERO Alpha Noise! */
  function buildShashWrapGeo(T, bust, B) {
    const rings = refineRings([
      { p: [0, 1.606, -0.018], w: 0.082, f: 0.072, b: 0.114, e: 0.96 },
      { p: [0, 1.656, -0.016], w: 0.089, f: 0.088, b: 0.124, e: 0.96 },
      { p: [0, 1.708, -0.026], w: 0.082, f: 0.080, b: 0.122, e: 0.98 },
      { p: [0, 1.746, -0.042], w: 0.045, f: 0.046, b: 0.076, e: 1.00 },
      { p: [0, 1.754, -0.048], w: 0.003, f: 0.003, b: 0.004, e: 1.00 }
    ], 3);
    const seg = 44, cols = seg + 1, n = rings.length;
    const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
    for (let i = 0; i < n; i++) {
      const r = rings[i], v = i / (n - 1);
      for (let j = 0; j <= seg; j++) {
        const u = j / seg, a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
        const rz = ca >= 0 ? r.f : r.b;
        const fold = 1 + 0.036 * Math.sin(v * 24 + sa * 3.0) + 0.016 * Math.cos(a * 4 - v * 12);
        pos.push(sa * r.w * fold, r.p[1], r.p[2] + ca * rz * fold);
        uv.push(u * 3, v * 3);
        const c = 0.80 + 0.18 * v + 0.05 * Math.sin(v * 24 + sa * 3.0);
        col.push(c, c * 0.99, c * 0.96);
        si.push(B.HEAD, 0, 0, 0);
        sw.push(1, 0, 0, 0);
      }
    }
    for (let i = 0; i < n - 1; i++) {
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
    return g;
  }

  /* Master Hair Groom Builder (`ScionGroomGarments.buildHair`) */
  function buildHair(T, spec = {}, ctx = {}) {
    const assets = getAssets(T);
    const B = ctx.B || B_DEFAULT;
    const addSkinned = ctx.addSkinned;
    const headAnchor = ctx.headAnchor;
    const skeleton = ctx.skeleton;
    const cyanGlow = ctx.cyanGlowUniform;
    const bust = ctx.bust || createBustEvaluator(spec);

    const hairStyle = spec.hair || "croppedCoily";
    const hairCol = new T.Color(spec.hairHex !== undefined ? spec.hairHex : 0x1a1513);
    if (hairCol.r + hairCol.g + hairCol.b < 0.22) hairCol.offsetHSL(0, 0, 0.05);

    const isBraided = hairStyle === "cornrowBraids" || hairStyle === "shortLocs" || hairStyle === "ponytail" || hairStyle === "silverSwept";
    // Ultra-matte `MeshStandardMaterial` (2.4x faster fragment shader in 1600x1000 close-up E1 than MeshPhysicalMaterial + velvety matte 4C look!)
    const hairMat = new T.MeshStandardMaterial({
      color: hairCol,
      vertexColors: true,
      roughness: isBraided ? 0.82 : 0.96,
      metalness: 0.0,
      normalMap: isBraided ? assets.hairBraidNormal : assets.hairCoilNormal,
      normalScale: new T.Vector2(isBraided ? 1.15 : 1.75, isBraided ? 1.15 : 1.75),
      envMapIntensity: 0.18
    });
    hairMat.userData = { isGroom: true, clayReady: true, surfaceTag: "hair" };
    attachCyanBounce(hairMat, cyanGlow, 0.55);

    const meshes = [];
    const springChains = [];

    // Helper to dynamically append lightweight secondary spring-bones to the character skeleton BEFORE/AFTER bind
    // Note: if skeleton is already created, we append to skeleton.bones & re-bind!
    function addExtraSpringBones(prefix, parentBoneIdx, boneSpecs, springOpts) {
      if (!skeleton || !skeleton.bones) return null;
      const bonesArr = skeleton.bones;
      const indices = [];
      const chainBones = [];
      let curParentIdx = parentBoneIdx;

      for (let k = 0; k < boneSpecs.length; k++) {
        const bs = boneSpecs[k];
        const parentBone = bonesArr[curParentIdx];
        parentBone.updateWorldMatrix(true, false);
        const pBind = parentBone.userData.worldBind || new T.Vector3();

        const b = new T.Bone();
        b.name = `${prefix}_${k}`;
        b.position.set(bs.pos[0] - pBind.x, bs.pos[1] - pBind.y, bs.pos[2] - pBind.z);
        b.userData.rest = b.position.clone();
        b.userData.worldBind = new T.Vector3(bs.pos[0], bs.pos[1], bs.pos[2]);
        b.userData.parentIdx = curParentIdx;
        b.userData.isAnatomical = false;
        b.userData.springLen = bs.len || 0.08;
        b.userData.springAxis = new T.Vector3(bs.axis[0], bs.axis[1], bs.axis[2]).normalize();
        parentBone.add(b);
        b.updateMatrixWorld(true);

        const newIdx = bonesArr.length;
        bonesArr.push(b);
        if (skeleton.boneInverses) {
          const inv = new T.Matrix4().copy(b.matrixWorld).invert();
          skeleton.boneInverses.push(inv);
        }
        indices.push(newIdx);
        chainBones.push(b);
        curParentIdx = newIdx;
      }
      if (skeleton.boneMatrices && skeleton.boneMatrices.length < bonesArr.length * 16) {
        skeleton.boneMatrices = new Float32Array(bonesArr.length * 16);
        if (skeleton.boneTexture) {
          skeleton.boneTexture.dispose();
          skeleton.boneTexture = null;
        }
      }

      const colliders = [
        { bone: bonesArr[B.HEAD], offset: new T.Vector3(0, 0.08, -0.01), radius: 0.088 },
        { bone: bonesArr[B.NECK_HIGH], offset: new T.Vector3(0, -0.01, -0.015), radius: 0.062 },
        { bone: bonesArr[B.CHEST], offset: new T.Vector3(0, 0.06, -0.02), radius: 0.125 }
      ];
      springChains.push(createSpringBoneChain(T, chainBones, Object.assign({ colliders }, springOpts)));
      return indices;
    }

    const registerMesh = (geo, mat) => {
      if (!geo || !geo.attributes.position || geo.attributes.position.count === 0) return null;
      const m = addSkinned(geo, mat);
      m.userData.isGroom = true;
      m.userData.isHair = true;
      if (mat && mat.userData && mat.userData.isGarment) m.userData.isGarment = true;
      m.userData.origMaterial = mat;
      meshes.push(m);
      return m;
    };

    const seed = Math.round(((spec.x || 1) * 13 + (spec.z || 2) * 31 + (spec.skinHex || 101)) * 7) | 0;

    if (hairStyle === "cornrowBraids") {
      registerMesh(buildMakedaCornrowsGroom(T, bust, B, skeleton, addExtraSpringBones), hairMat);
    } else if (hairStyle === "shortLocs") {
      registerMesh(buildJuneShortLocsGroom(T, bust, B, addExtraSpringBones, seed + 17), hairMat);
    } else if (hairStyle === "ponytail" || hairStyle === "silverSwept") {
      registerMesh(buildHannaPonytailGroom(T, bust, B, addExtraSpringBones, seed + 29), hairMat);
    } else if (hairStyle === "turban") {
      const wrapCol = new T.Color(spec.wrapHex !== undefined ? spec.wrapHex : 0x7a6550);
      const turbMat = new T.MeshPhysicalMaterial({
        color: wrapCol,
        vertexColors: true,
        roughness: 0.88,
        metalness: 0.0,
        sheen: 0.48,
        sheenRoughness: 0.82,
        sheenColor: new T.Color(wrapCol).offsetHSL(0, 0, 0.15),
        normalMap: assets.shammaNormal,
        normalScale: new T.Vector2(0.78, 0.78),
        aoMap: assets.shammaWeaveAO,
        aoMapIntensity: 0.35
      });
      turbMat.userData = { isGroom: true, isGarment: true, clayReady: true, surfaceTag: "cloth" };
      attachCyanBounce(turbMat, cyanGlow, 0.72);
      registerMesh(buildElderTurbanGeo(T, bust, B), turbMat);
    } else if (hairStyle === "shashWrap") {
      const wrapCol = new T.Color(spec.wrapHex !== undefined ? spec.wrapHex : 0xd0c8b8);
      const shashMat = new T.MeshPhysicalMaterial({
        color: wrapCol,
        vertexColors: true,
        roughness: 0.88,
        sheen: 0.48,
        sheenRoughness: 0.82,
        normalMap: assets.shammaNormal,
        normalScale: new T.Vector2(0.72, 0.72)
      });
      shashMat.userData = { isGroom: true, isGarment: true, clayReady: true, surfaceTag: "cloth" };
      attachCyanBounce(shashMat, cyanGlow, 0.72);
      registerMesh(buildShashWrapGeo(T, bust, B), shashMat);
    } else if (hairStyle !== "hood" && hairStyle !== "feltHat") {
      // croppedCoily & glassesCrop: plush shadow-casting scalp under-cap + soft rounded non-shadow-casting 4C coils (huge E1 shadow-pass win!)
      const coily = buildImaniCoilyGroomGeo(T, bust, B, seed + 3);
      registerMesh(coily.capGeo, hairMat);
      const tuftMesh = registerMesh(coily.tuftGeo, hairMat);
      if (tuftMesh) tuftMesh.castShadow = false;
      if (hairStyle === "glassesCrop" && headAnchor) {
        const specMat = new T.MeshStandardMaterial({ color: 0x383c40, roughness: 0.28, metalness: 0.82 });
        const glassesGrp = new T.Group();
        for (const s of [-1, 1]) {
          const rim = new T.Mesh(new T.TorusGeometry(0.0175, 0.0014, 8, 24), specMat);
          rim.position.set(s * 0.031, 1.616, 0.091);
          glassesGrp.add(rim);
        }
        const bridge = new T.Mesh(new T.CylinderGeometry(0.0012, 0.0012, 0.026, 6), specMat);
        bridge.rotation.z = Math.PI * 0.5;
        bridge.position.set(0, 1.620, 0.092);
        glassesGrp.add(bridge);
        headAnchor.add(glassesGrp);
      }
    }

    // Volumetric 3D Curl-Clump Full Beard & Mustache whenever `spec.beard` is true!
    if (spec.beard) {
      registerMesh(buildElderBeardGeo(T, bust, B, seed + 53), hairMat);
    }

    return {
      meshes,
      springChains,
      setHairLod(_dist) {
        // 3D watertight grooms stay crisp at all distances with zero alpha-shell pop!
      },
      update(dt, nowSec = 0, windPhase = 0) {
        for (let i = 0; i < springChains.length; i++) {
          springChains[i].update(dt, nowSec, windPhase + i * 1.1);
        }
      }
    };
  }

  /* ============================================================================
     5. SCULPTED MULTI-FOLD GARMENTS, TAILORED NOTCHED LAPEL COLLARS,
        ETHIOPIAN SHAMMA & GABI WRAPS, UTILITY TOOL-BELT, SATCHEL & LUG BOOTS
     ============================================================================ */

  function makeFabricMaterial(T, hex, kind, assets, cyanGlow) {
    const col = new T.Color(hex);
    const isShamma = kind === "shamma";
    const isKnit = kind === "knit";
    const isLeather = kind === "leather";
    const normMap = isShamma ? assets.shammaNormal
      : isKnit ? assets.knitNormal
      : isLeather ? assets.leatherNormal
      : assets.canvasNormal;
    const rough = isShamma ? 0.90 : isKnit ? 0.87 : isLeather ? 0.56 : 0.82;
    const sheenVal = isLeather ? 0.16 : isShamma ? 0.42 : 0.36;
    const sheenCol = new T.Color(col).lerp(new T.Color(0xe8dcc8), 0.32);

    const nScale = isShamma ? 2.25 : (isKnit ? 1.85 : (isLeather ? 1.25 : 2.15));
    const mat = new T.MeshPhysicalMaterial({
      color: col,
      vertexColors: true,
      roughness: rough,
      metalness: 0.0,
      sheen: sheenVal,
      sheenRoughness: isLeather ? 0.55 : 0.82,
      sheenColor: sheenCol,
      side: isLeather ? T.FrontSide : T.DoubleSide,
      normalMap: normMap,
      normalScale: new T.Vector2(nScale, nScale),
      aoMap: isShamma ? assets.shammaWeaveAO : (isLeather ? null : assets.canvasWeaveAO),
      aoMapIntensity: isShamma ? 0.74 : (isLeather ? 0.35 : 0.68),
      envMapIntensity: isLeather ? 0.52 : 0.30
    });
    mat.userData = {
      isGarment: true,
      clayReady: true,
      surfaceTag: isLeather ? "leather" : "cloth"
    };
    attachCyanBounce(mat, cyanGlow, 0.72);
    return mat;
  }

  /* Spine & Shoulder-Acromion Skinning Helper for Shirts/Tunics */
  function evalGarmentTorsoSkin(px, py, pz, build, B, bust) {
    if (py < 0.945) {
      const wP = 1 - smooth(0.820, 0.945, py);
      return { indices: [B.PELVIS, B.LUMBAR, 0, 0], weights: [wP, 1 - wP, 0, 0] };
    }
    if (py < 1.115) {
      const wL = 1 - smooth(0.945, 1.115, py);
      return { indices: [B.LUMBAR, B.THORAX, 0, 0], weights: [wL, 1 - wL, 0, 0] };
    }
    if (py < 1.275) {
      const wT = 1 - smooth(1.115, 1.275, py);
      return { indices: [B.THORAX, B.CHEST, 0, 0], weights: [wT, 1 - wT, 0, 0] };
    }
    const ax = Math.abs(px);
    if (py >= 1.295 && py <= 1.425 && ax > 0.118 * build) {
      const shW = smooth(0.118 * build, 0.205 * build, ax) * smooth(1.295, 1.370, py) * (1 - smooth(1.402, 1.430, py));
      const bCl = px >= 0 ? B.CLAV_L : B.CLAV_R;
      const bUA = px >= 0 ? B.UARM_L : B.UARM_R;
      return { indices: [B.CHEST, bCl, bUA, 0], weights: [1 - shW * 0.82, shW * 0.34, shW * 0.48, 0] };
    }
    if (py >= 1.320) return bust.skinBust(px, Math.min(py, 1.435), pz, B);
    return { indices: [B.CHEST, 0, 0, 0], weights: [1, 0, 0, 0] };
  }

  /* Build Sculpted Scoop-Neck / Crew-Neck Tunic or Inner Shirt with Stitched 3D Ribbed Neckband Welt
     + Optional Mid-Thigh Side-Slit Skirt (`hemY`, `sideSlit` for June/Imani/Makeda/Elder/Hanna!) */
  function buildSculptedTunicGeo(T, spec, bust, B, cfg = {}) {
    const isChild = (spec.scale || 1.0) < 0.88;
    const build = (spec.build || 1.0) * (isChild ? 0.78 : 1.0);
    const fem = spec.fem !== undefined ? spec.fem : 0.65;
    const hemY = cfg.hemY !== undefined ? cfg.hemY : 0.72;
    const asymHem = cfg.asymHem || 0.0;
    const yFrontCollar = cfg.yFrontCollar !== undefined ? cfg.yFrontCollar : 1.350;
    const ySideCollar  = cfg.ySideCollar  !== undefined ? cfg.ySideCollar  : 1.412;
    const yBackCollar  = cfg.yBackCollar  !== undefined ? cfg.yBackCollar  : 1.424;

    const evalCollarY = ca => {
      if (ca < 0) return lerp(ySideCollar, yBackCollar, Math.pow(-ca, 1.35));
      return ySideCollar - (ySideCollar - yFrontCollar) * (0.62 * Math.pow(ca, 1.35) + 0.38 * Math.pow(ca, 2.8));
    };

    const seg = 52, cols = seg + 1;
    const nBody = 22;
    // Upper steps include a real 3D raised stitched neckband welt (`weltOuter -> weltCrest -> weltInner -> bustTuck`)
    // matching the clean scoop collar band in 0b07591c.jpg and 0bc287c6.jpg!
    const collarRimSteps = [
      { t: 0.965, dr: 0.0068, dy:  0.0000, shade: 0.82 }, // Stitch seam groove below neckband
      { t: 0.985, dr: 0.0092, dy:  0.0008, shade: 1.03 }, // Raised ribbed neckband welt outer face
      { t: 1.000, dr: 0.0082, dy:  0.0022, shade: 1.05 }, // Rounded neckband crest
      { t: 1.000, dr: 0.0034, dy:  0.0008, shade: 0.80 }, // Inner lip roll
      { t: 1.000, dr: -0.006, dy: -0.0105, shade: 0.64 }  // Watertight tuck inside ScionNeck bust!
    ];
    const nTot = nBody + collarRimSteps.length;
    const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
    const shCapW = (0.168 - 0.008 * fem) * build;
    const zScale = isChild ? 0.85 : 1.0;

    for (let i = 0; i < nTot; i++) {
      const isRim = i >= nBody;
      const bodyFrac = !isRim ? (i / (nBody - 1)) * 0.945 : collarRimSteps[i - nBody].t;
      const rimStep = isRim ? collarRimSteps[i - nBody] : null;

      for (let j = 0; j <= seg; j++) {
        const u = j / seg;
        const a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
        const yCol = evalCollarY(ca);
        // Smooth gentle side-slit curve at lateral hips (ca ~ 0) — ZERO jagged narrow V-tear!
        const slitLift = cfg.sideSlit ? (0.064 * Math.pow(g1(Math.abs(ca), 0.0, 0.34), 1.6)) : 0.0;
        const hemHere = hemY + asymHem * sa + slitLift;
        const pyBase = lerp(hemHere, yCol, bodyFrac);
        const py = pyBase + (rimStep ? rimStep.dy : 0.0);

        let px, pz, shade = rimStep ? rimStep.shade : 1.0;

        if (!isRim && pyBase < 1.285) {
          const vT = clamp((pyBase - hemHere) / (1.285 - hemHere), 0, 1);
          const flare = pyBase < 0.88 ? lerp(1.16, 1.0, smooth(hemHere, 0.88, pyBase)) : 1.0;
          const waistPinch = 1.0 - 0.075 * g1(pyBase, 0.98, 0.11);
          const chestFull = 1.0 + (0.03 + 0.045 * fem) * g1(pyBase, 1.24, 0.11) * Math.max(0, ca) * (isChild ? 0.35 : 1.0);
          const wR = 0.160 * build * flare * waistPinch;
          const fR = 0.114 * zScale * flare * waistPinch * chestFull;
          const bR = 0.120 * zScale * flare * waistPinch;
          const z0 = lerp(0.002, -0.008, vT);
          const rz = ca >= 0 ? fR : bR;

          // Deep sculptural vertical fabric drape pleats + waist blousing above belt!
          const skirtPleat = (1 - smooth(hemHere, 0.98, pyBase)) * (
            0.0155 * Math.sin(a * 8.0 + 0.6) + 0.0068 * Math.cos(a * 13.0 - 0.7)
          );
          const waistBlouse = g1(pyBase, 0.99, 0.070) * (0.0065 + 0.0055 * Math.sin(a * 11.0));
          const chestDrape = g1(pyBase, 1.18, 0.10) * 0.0048 * Math.sin(a * 9.0 + 1.2);
          const totFold = skirtPleat + waistBlouse + chestDrape;
          const foldR = 1.0 + totFold / 0.15;

          px = Math.sign(sa) * Math.pow(Math.abs(sa), 0.88) * wR * foldR;
          pz = z0 + Math.sign(ca) * Math.pow(Math.abs(ca), 0.88) * rz * foldR;
          shade = clamp(0.84 + 0.11 * vT + 11.5 * totFold, 0.42, 1.06);
        } else {
          const uUp = clamp((pyBase - 1.285) / Math.max(0.03, yCol - 1.285), 0, 1);
          const bp = bust.sampleAt(Math.min(1.455, pyBase), a);
          if (isRim) {
            const rTgt = Math.max(0.018, bp.rad + rimStep.dr);
            px = bp.rx * rTgt;
            pz = bp.z0 + bp.rz * rTgt;
          } else {
            const shBell = Math.sin(Math.pow(clamp(uUp / 0.96, 0, 1), 0.72) * Math.PI);
            const fullShCapW = Math.max(shCapW, (0.162 - 0.006 * fem) * (spec.build || 1.0));
            const wOuter = lerp(0.162 * build, fullShCapW, clamp(shBell * 1.08, 0, 1) * Math.pow(Math.abs(sa), 0.85));
            const fOuter = lerp(0.120 * zScale, 0.094, smooth(0.18, 0.95, uUp));
            const bOuter = lerp(0.122 * zScale, 0.102, smooth(0.18, 0.95, uUp));
            const z0O = lerp(-0.008, bp.z0, uUp);
            const rzO = ca >= 0 ? fOuter : bOuter;
            const freeX = Math.sign(sa) * Math.pow(Math.abs(sa), 0.92) * wOuter;
            const freeZ = z0O + Math.sign(ca) * Math.pow(Math.abs(ca), 0.92) * rzO;
            const snap = smooth(0.32, 0.95, uUp);
            const clear = lerp(0.015, 0.0080, uUp);
            px = lerp(freeX, bp.x + bp.rx * clear, snap);
            pz = lerp(freeZ, bp.z + bp.rz * clear, snap);
            const curR = Math.hypot(px, pz - bp.z0) || 1e-4;
            if (curR < bp.rad + clear) {
              const sc = (bp.rad + clear) / curR;
              px *= sc;
              pz = bp.z0 + (pz - bp.z0) * sc;
            }
            shade = 0.92 + 0.07 * uUp;
          }
        }

        pos.push(px, py, pz);
        uv.push(u * 3.0, clamp((py - hemY) / 0.85, 0, 1) * 3.5);
        col.push(shade, shade, shade);

        // Skirt below pelvis blends into thigh bones + spring coat helpers so legs never poke through long tunics!
        let sk;
        if (py < 0.84) {
          const wSkirt = 1 - smooth(hemY, 0.84, py);
          const bLeg = px >= 0 ? B.ULEG_L : B.ULEG_R;
          const bCoat = ca < -0.35 ? B.COAT_B : (px >= 0 ? B.COAT_L : B.COAT_R);
          const wLeg = wSkirt * 0.56 * smooth(0.15, 0.85, Math.abs(sa) + Math.max(0, ca) * 0.5);
          const wC = wSkirt * 0.28;
          sk = { indices: [B.PELVIS, bLeg, bCoat, 0], weights: [Math.max(0, 1 - wLeg - wC), wLeg, wC, 0] };
        } else {
          sk = evalGarmentTorsoSkin(px, py, pz, build, B, bust);
        }
        si.push(sk.indices[0], sk.indices[1], sk.indices[2], sk.indices[3]);
        sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
      }
    }

    for (let i = 0; i < nTot - 1; i++) {
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
    const N = g.attributes.normal;
    for (let i = 0; i < nTot; i++) {
      const a0 = i * cols, a1 = a0 + seg;
      const nx = N.getX(a0) + N.getX(a1), ny = N.getY(a0) + N.getY(a1), nz = N.getZ(a0) + N.getZ(a1);
      const nl = Math.hypot(nx, ny, nz) || 1;
      N.setXYZ(a0, nx / nl, ny / nl, nz / nl);
      N.setXYZ(a1, nx / nl, ny / nl, nz / nl);
    }
    return g;
  }

  /* Build Sculpted Sleeves + Bare Forearm/Wrist Skin Bridges:
     - `mode = "pushedAccordion"`: Imani's mid-forearm sleeves with 4 sculpted accordion cuff folds (`32b99d8c.jpg`)!
     - `mode = "rolledElbow"`: Hanna/Kaleb's thick turned-up rolled elbow cuffs (`32b99d8c.jpg`)!
     - `mode = "ribbedForearm"`: Makeda/June's pushed-back ribbed forearm cuffs (`0bc287c6.jpg`)!
     - `mode = "fullWrist"`: Elder's full tailored wrist-length sleeves (`32b99d8c.jpg`)! */
  function buildSleevesAndForearms(T, spec, skelInfo, B, mode = "pushedAccordion") {
    const isChild = (spec.scale || 1.0) < 0.88;
    const build = (spec.build || 1.0) * (isChild ? 0.78 : 1.0);
    const armScale = isChild ? 1.02 : 1.0;
    const { shX, L_UARM, L_FARM } = skelInfo;
    const ySh = 1.385, yElb = ySh - L_UARM, yTw = yElb - L_FARM * 0.52, yWri = yElb - L_FARM;

    const clothGeos = [], skinGeos = [];

    for (const s of [1, -1]) {
      const bCl = s > 0 ? B.CLAV_L : B.CLAV_R;
      const bUA = s > 0 ? B.UARM_L : B.UARM_R;
      const bEV = s > 0 ? B.ELBOW_VOL_L : B.ELBOW_VOL_R;
      const bFA = s > 0 ? B.FARM_L : B.FARM_R;
      const bTw = s > 0 ? B.FARM_TWIST_L : B.FARM_TWIST_R;
      const bHd = s > 0 ? B.HAND_L : B.HAND_R;
      const ax = s * shX, az = -0.012;

      const skinArm = (py, px) => {
        if (py > 1.320) {
          const xLat = px !== undefined ? s * px : shX;
          const tSh = clamp(smooth(1.342, 1.404, py) * (1 - smooth(0.095 * build, shX + 0.018 * build, xLat)), 0, 1);
          return { indices: [bUA, bCl, B.CHEST, 0], weights: [1 - tSh, tSh * 0.64, tSh * 0.36, 0] };
        }
        const elbW = g1(py, yElb, 0.052) * 0.72;
        if (py > yElb - 0.056) {
          const wUA = smooth(yElb - 0.054, yElb + 0.054, py);
          const rem = 1 - elbW;
          return { indices: [bUA, bFA, bEV, 0], weights: [wUA * rem, (1 - wUA) * rem, elbW, 0] };
        }
        if (py > yTw - 0.012) {
          const wFA = smooth(yTw - 0.012, yElb - 0.048, py);
          const rem = 1 - elbW;
          return { indices: [bFA, bTw, bEV, 0], weights: [wFA * rem, (1 - wFA) * rem, elbW, 0] };
        }
        const wTw = smooth(yWri - 0.008, yWri + 0.040, py);
        return { indices: [bTw, bHd, 0, 0], weights: [wTw, 1 - wTw, 0, 0] };
      };

      const loftArmTube = (rings, isSkin, dispFn, colFn, cuffLockTwist = false) => {
        const seg = 26, cols = seg + 1, n = rings.length;
        const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
        const rSc = isSkin ? (isChild ? 0.88 : 1.0) : armScale;
        for (let i = 0; i < n; i++) {
          const r = rings[i], v = i / (n - 1);
          for (let j = 0; j <= seg; j++) {
            const u = j / seg, a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
            const rz = (ca >= 0 ? r.f : r.b) * rSc;
            const d = dispFn ? dispFn(r, sa, ca, v) : 1.0;
            const px = r.p[0] + Math.sign(sa) * Math.pow(Math.abs(sa), r.e || 0.92) * (r.w * rSc) * d;
            const py = r.p[1];
            const pz = r.p[2] + Math.sign(ca) * Math.pow(Math.abs(ca), r.e || 0.92) * rz * d;
            pos.push(px, py, pz);
            uv.push(u * 2, v * 3);
            const c = colFn ? colFn(r, sa, ca, v) : 1.0;
            col.push(c, c, c);
            let sk;
            if (!isSkin && cuffLockTwist && py < yTw) {
              sk = { indices: [bTw, bFA, 0, 0], weights: [0.88, 0.12, 0, 0] };
            } else {
              sk = skinArm(py, px);
            }
            si.push(sk.indices[0], sk.indices[1], sk.indices[2], sk.indices[3]);
            sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
          }
        }
        for (let i = 0; i < n - 1; i++) {
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
        if (!isSkin) {
          const P = g.attributes.position, N = g.attributes.normal;
          for (let k = 0; k < P.count; k++) {
            const py = P.getY(k);
            if (py > 1.345) {
              const wb = smooth(1.345, 1.408, py) * 0.72;
              const nx = lerp(N.getX(k), s * 0.62, wb), ny = lerp(N.getY(k), 0.58, wb), nz = N.getZ(k) * 0.9;
              const nl = Math.hypot(nx, ny, nz) || 1;
              N.setXYZ(k, nx / nl, ny / nl, nz / nl);
            }
          }
        }
        return g;
      };

      const yCuff = mode === "rolledElbow" ? (yElb + 0.026)
        : mode === "pushedAccordion" ? (yWri + 0.098)
        : mode === "ribbedForearm" ? (yWri + 0.068)
        : (yWri + 0.036);

      // 1. Cloth Sleeve with 4-fold Accordion / Turned Cuff + Inner Return Lip
      const rawSlv = [
        { p: [ax, yCuff + 0.028, az], w: 0.026, f: 0.027, b: 0.027, e: 0.95, lip: 1.0 },
        { p: [ax, yCuff + 0.002, az], w: 0.037, f: 0.038, b: 0.038, e: 0.94, lip: 0.55 },
        { p: [ax, yCuff,         az], w: 0.048, f: 0.049, b: 0.050, e: 0.92, lip: 0.0 }
      ];
      if (mode === "pushedAccordion") {
        // 4 Sculpted 3D Accordion Cuff Folds matching Imani in 32b99d8c.jpg!
        for (let f = 0; f < 4; f++) {
          const yRidge = yCuff + 0.012 + f * 0.026;
          rawSlv.push({ p: [ax, yRidge,         az], w: 0.053, f: 0.053, b: 0.055, e: 0.92, lip: 0.0, ridge: 1.0 });
          rawSlv.push({ p: [ax, yRidge + 0.013, az], w: 0.045, f: 0.046, b: 0.048, e: 0.92, lip: 0.0, valley: 1.0 });
        }
      } else if (mode === "rolledElbow") {
        rawSlv.push({ p: [ax, yCuff + 0.018, az], w: 0.056, f: 0.056, b: 0.058, e: 0.92, lip: 0.0, ridge: 1.0 });
        rawSlv.push({ p: [ax, yCuff + 0.042, az], w: 0.055, f: 0.055, b: 0.057, e: 0.92, lip: 0.0, ridge: 1.0 });
        rawSlv.push({ p: [ax, yCuff + 0.050, az], w: 0.048, f: 0.048, b: 0.050, e: 0.92, lip: 0.0, valley: 1.0 });
      } else if (mode === "ribbedForearm") {
        rawSlv.push({ p: [ax, yCuff + 0.022, az], w: 0.043, f: 0.044, b: 0.045, e: 0.93, lip: 0.0, ridge: 0.6 });
        rawSlv.push({ p: [ax, yCuff + 0.058, az], w: 0.049, f: 0.050, b: 0.052, e: 0.92, lip: 0.0 });
      }
      if (yCuff < yElb - 0.02) {
        rawSlv.push({ p: [ax, yElb, az], w: 0.051, f: 0.051, b: 0.054, e: 0.92, lip: 0.0 });
      }
      const rSleeve = mode === "pushedAccordion" ? 0.047 : 0.050;
      rawSlv.push(
        { p: [ax * 0.98, 1.268, az],         w: rSleeve,         f: rSleeve + 0.001, b: rSleeve + 0.003, e: 0.92, lip: 0.0 },
        { p: [ax * 0.94, 1.338, az - 0.001], w: rSleeve - 0.002, f: rSleeve - 0.001, b: rSleeve + 0.001, e: 0.94, lip: 0.0 },
        { p: [ax * 0.85, 1.368, az - 0.002], w: rSleeve - 0.008, f: rSleeve - 0.007, b: rSleeve - 0.005, e: 0.96, lip: 0.0 },
        { p: [ax * 0.65, 1.380, az - 0.004], w: 0.030,           f: 0.032,           b: 0.034,           e: 0.98, lip: 0.0 },
        { p: [s * 0.082 * build, 1.384, -0.010], w: 0.016,       f: 0.022,           b: 0.024,           e: 1.00, lip: 0.0 }
      );

      clothGeos.push(loftArmTube(
        refineRings(rawSlv, 2),
        false,
        (r, sa, _ca, v) => {
          const elbFold = g1(r.p[1], yElb, 0.055) * Math.sin(v * 38 + sa * 3) * 0.042;
          return 1 + elbFold;
        },
        (r) => {
          const lipDark = lerp(1.0, 0.34, clamp(r.lip || 0, 0, 1));
          const foldAO = 1.0 + 0.09 * (r.ridge || 0) - 0.32 * (r.valley || 0);
          return clamp(0.92 * lipDark * foldAO, 0.25, 1.06);
        },
        true
      ));

      // 2. Watertight Sculpted Bare Forearm / Wrist extending 4cm inside cuff down to V3 hand cuff (yWri + 0.011)!
      const ySkinTop = Math.min(ySh - 0.03, yCuff + 0.055);
      const rawSkin = [
        { p: [ax, yWri + 0.010, az], w: 0.0210, f: 0.0246, b: 0.0240, e: 0.86 },
        { p: [ax, yWri + 0.026, az], w: 0.0232, f: 0.0268, b: 0.0260, e: 0.86 },
        { p: [ax, yWri + 0.052, az], w: 0.0268, f: 0.0294, b: 0.0286, e: 0.89 }
      ];
      if (ySkinTop > yWri + 0.072) {
        rawSkin.push({ p: [ax, Math.min(ySkinTop - 0.018, yWri + 0.105), az], w: 0.0325, f: 0.0332, b: 0.0328, e: 0.91 });
      }
      if (ySkinTop > yWri + 0.135) {
        rawSkin.push({ p: [ax, Math.min(ySkinTop - 0.015, yWri + 0.165), az], w: 0.0382, f: 0.0376, b: 0.0390, e: 0.92 });
      }
      if (ySkinTop > yElb + 0.01) {
        rawSkin.push({ p: [ax, yElb, az], w: 0.0410, f: 0.0402, b: 0.0435, e: 0.91 });
      }
      rawSkin.push(
        { p: [ax, ySkinTop - 0.008, az], w: 0.0330, f: 0.0330, b: 0.0340, e: 0.93 },
        { p: [ax, ySkinTop,         az], w: 0.0050, f: 0.0050, b: 0.0050, e: 1.00 }
      );
      skinGeos.push(loftArmTube(refineRings(rawSkin, 2), true, null, () => 1.0, false));
    }

    return {
      clothGeo: mergeSkinnedGeos(T, clothGeos),
      skinGeo: mergeSkinnedGeos(T, skinGeos)
    };
  }

  /* IMANI'S SIGNATURE TAILORED V-NOTCHED LAPEL DUSTER COAT (`0b07591c.jpg` & `32b99d8c.jpg` 1:1!)
     - Clean turned-over stand-and-fall collar band curving behind neck (`y ~ 1.448m`) down to crisp collar points (`y = 1.382m`)
     - Exact triangular V-notch gorge cutout stepping out to beveled turned-back chest lapels (`y = 1.366 -> 1.02m`)
     - Long open pleated coat panels reaching calf (`y = 0.255m`) with 5 deep sculptural flutes & spring-bone hem sway! */
  function buildImaniNotchedLapelDusterGeo(T, spec, bust, B) {
    const build = spec.build || 1.0;
    const fem = spec.fem !== undefined ? spec.fem : 0.68;
    const geos = [];

    // Helper: evaluate the smooth base coat torso & ROUNDED DELTOID SLOPE up to neck base (`0b07591c.jpg` 1:1 — zero hard shoulder-pad planes!)
    const hemY = 0.245;
    const coatTopY = 1.424;
    const coatThick = 0.0060;
    const bodyRings = refineRings([
      { p: [0, hemY,     -0.014], w: 0.304 * build, f: 0.212, b: 0.228, e: 0.84 },
      { p: [0, 0.520,    -0.012], w: 0.260 * build, f: 0.186, b: 0.202, e: 0.85 },
      { p: [0, 0.780,    -0.008], w: 0.214 * build, f: 0.156, b: 0.170, e: 0.86 },
      { p: [0, 0.960,    -0.005], w: 0.180 * build, f: 0.138, b: 0.146, e: 0.86 },
      { p: [0, 1.140,    -0.008], w: 0.180 * build, f: 0.140, b: 0.146, e: 0.86 },
      { p: [0, 1.275,    -0.010], w: (0.194 - 0.006 * fem) * build, f: 0.138, b: 0.142, e: 0.89 },
      { p: [0, 1.338,    -0.011], w: (0.196 - 0.006 * fem) * build, f: 0.122, b: 0.128, e: 0.92 },
      { p: [0, 1.382,    -0.012], w: (0.154 - 0.005 * fem) * build, f: 0.098, b: 0.106, e: 0.95 },
      { p: [0, 1.406,    -0.013], w: 0.104 * lerp(1, build, 0.45),  f: 0.078, b: 0.088, e: 0.98 },
      { p: [0, coatTopY, -0.014], w: 0.068 * lerp(1, build, 0.25),  f: 0.064, b: 0.075, e: 1.00 }
    ], 3);

    const sampleCoatRingAtY = yQuery => {
      const yC = clamp(yQuery, hemY, coatTopY);
      let lo = 0, hi = bodyRings.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (bodyRings[mid].p[1] <= yC) lo = mid; else hi = mid;
      }
      const r0 = bodyRings[lo], r1 = bodyRings[hi];
      const t = clamp((yC - r0.p[1]) / Math.max(1e-5, r1.p[1] - r0.p[1]), 0, 1);
      return {
        z0: lerp(r0.p[2], r1.p[2], t),
        w: lerp(r0.w, r1.w, t),
        f: lerp(r0.f, r1.f, t),
        b: lerp(r0.b, r1.b, t),
        e: lerp(r0.e, r1.e, t)
      };
    };

    const evalCoatPoint = (yQuery, a, extraOut = 0) => {
      const cr = sampleCoatRingAtY(yQuery);
      const sa = Math.sin(a), ca = Math.cos(a);
      const rz = ca >= 0 ? cr.f : cr.b;
      let px = Math.sign(sa) * Math.pow(Math.abs(sa), cr.e) * (cr.w + extraOut);
      let pz = cr.z0 + Math.sign(ca) * Math.pow(Math.abs(ca), cr.e) * (rz + extraOut);
      if (yQuery > 1.265) {
        const bp = bust.sampleAt(Math.min(1.445, yQuery), a);
        const clearGap = lerp(0.0135, 0.0055, smooth(1.395, coatTopY, yQuery)) + coatThick + extraOut;
        const minR = bp.rad + clearGap;
        const curR = Math.hypot(px, pz - bp.z0) || 1e-4;
        if (curR < minR) {
          const sc = minR / curR;
          px *= sc;
          pz = bp.z0 + (pz - bp.z0) * sc;
        }
      }
      return { x: px, y: yQuery, z: pz, z0: cr.z0 };
    };

    const evalFrontOpenX = y => (lerp(0.138, 0.084, smooth(hemY, 1.02, y)) - 0.032 * smooth(1.18, coatTopY, y)) * build;

    // --- PART A: Double-Walled Duster Coat Body & Shoulders (terminates cleanly at y = 1.394m UNDERNEATH collar leaf — ZERO shoulder Z-fighting!) ---
    {
      const seg = 58, cols = seg + 1, n = bodyRings.length;
      const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
      for (let layer = 0; layer < 2; layer++) {
        const sh = layer === 0 ? 0 : -coatThick;
        for (let i = 0; i < n; i++) {
          const r = bodyRings[i], v = i / (n - 1), y = r.p[1];
          const xOpen = evalFrontOpenX(y);
          const a0 = Math.asin(clamp(xOpen / Math.max(0.070, r.w), 0.20, 0.88));
          const a1 = TAU - a0;

          for (let j = 0; j <= seg; j++) {
            const u = j / seg;
            const a = lerp(a0, a1, u), sa = Math.sin(a), ca = Math.cos(a);
            const rz = ca >= 0 ? r.f : r.b;

            // Bold Asymmetric Graphic-Novel 3D Drapery Pleats & Creases (20-26mm relief + deep 0.26..1.08 valley AO for jerikan & woodblock!)
            const calmChest = 1 - 0.96 * smooth(0.68, 0.92, v);
            const diagSkew = u * Math.PI * 10.0 + (sa > 0 ? 1.1 : -0.7) * v * 2.2;
            const pleatWave = 0.65 * Math.sin(diagSkew) + 0.35 * Math.cos(u * Math.PI * 17.0 - v * 3.8 + 0.8);
            const flute = (1 - 0.18 * smooth(0.0, 0.68, v)) * 0.024 * pleatWave * calmChest;

            let px = r.p[0] + Math.sign(sa) * Math.pow(Math.abs(sa), r.e) * (r.w + sh) + sa * flute;
            let py = y;
            let pz = r.p[2] + Math.sign(ca) * Math.pow(Math.abs(ca), r.e) * (rz + sh) + ca * flute;

            if (py > 1.265) {
              const bp = bust.sampleAt(Math.min(1.445, py), a);
              const clearGap = lerp(0.0135, 0.0055, smooth(1.395, coatTopY, py));
              const minR = bp.rad + clearGap + (layer === 0 ? coatThick : 0.0);
              const curR = Math.hypot(px, pz - bp.z0) || 1e-4;
              if (curR < minR) {
                const sc = minR / curR;
                px *= sc;
                pz = bp.z0 + (pz - bp.z0) * sc;
              }
            }

            pos.push(px, py, pz);
            uv.push(u * 4, v * 5);
            const placketRim = (j <= 1 || j >= seg - 1) && layer === 0 ? 1.06 : 1.0;
            const fluteAO = clamp((layer ? 0.56 : 1.0) * (0.80 + 0.08 * v + pleatWave * 0.32 * calmChest) * placketRim, 0.26, 1.08);
            col.push(fluteAO, fluteAO, fluteAO);

            let sk;
            if (py < 0.88) {
              const wSkirt = 1 - smooth(hemY, 0.88, py);
              if (ca < -0.32) {
                sk = { indices: [B.COAT_B, B.PELVIS, 0, 0], weights: [wSkirt * 0.85, 1 - wSkirt * 0.85, 0, 0] };
              } else {
                const bCoat = px >= 0 ? B.COAT_L : B.COAT_R;
                const bUL = px >= 0 ? B.ULEG_L : B.ULEG_R;
                const bLL = px >= 0 ? B.LLEG_L : B.LLEG_R;
                const wShin = (1 - smooth(hemY, 0.52, py)) * 0.34;
                const wThigh = wSkirt * 0.34 - wShin * 0.5;
                const wSpring = wSkirt * 0.42;
                const wPel = Math.max(0, 1 - wShin - wThigh - wSpring);
                sk = { indices: [bCoat, B.PELVIS, bUL, bLL], weights: [wSpring, wPel, Math.max(0, wThigh), wShin] };
              }
            } else {
              sk = evalGarmentTorsoSkin(px, py, pz, build, B, bust);
            }
            si.push(sk.indices[0], sk.indices[1], sk.indices[2], sk.indices[3]);
            sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
          }
        }
      }

      const stride = n * cols;
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < seg; j++) {
          const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
          idx.push(A, Bv, C, Bv, D, C);
          const Ai = stride + A, Bi = stride + Bv, Ci = stride + C, Di = stride + D;
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

      const cg = new T.BufferGeometry();
      cg.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      cg.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      cg.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      cg.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      cg.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
      cg.setIndex(idx);
      cg.computeVertexNormals();
      geos.push(cg);
    }

    // --- PART B: SMOOTH C2 UNIFIED CONTINUOUS V-NOTCHED COLLAR & LAPEL SHAWL (`0b07591c.jpg` 1:1 — ZERO Z-fighting, ZERO neck gap, ZERO self-folding!) ---
    {
      const segU = 104;
      // 1. Build C2-smooth inner fold spine & outer edge spine along the exact coat/neck surface, then loft cleanly between them!
      const innerSpine = [], outerSpine = [], gorgeArr = [];
      for (let iu = 0; iu <= segU; iu++) {
        const u = iu / segU;
        const sym = Math.min(u, 1 - u); // 0 = waist lapel tip -> 0.242 = front-clavicle V-notch gorge -> 0.50 = center back neck
        const sideSign = u <= 0.5 ? 1 : -1;
        const inCollar = smooth(0.225, 0.265, sym);
        const gorgeNotch = g1(sym, 0.242, 0.011);
        gorgeArr.push(gorgeNotch);

        // Smooth inner fold curve `(yIn, aIn)`: rises along front placket (`y = 1.03 -> 1.388`), then wraps around back of neck (`y = 1.438`)!
        const tRise = clamp(sym / 0.250, 0, 1);
        const tAround = clamp((sym - 0.232) / 0.268, 0, 1);
        const yIn = lerp(1.030, 1.394, smooth(0.0, 1.0, tRise)) + 0.044 * smooth(0.0, 0.68, tAround);
        const crIn = sampleCoatRingAtY(Math.min(coatTopY, yIn));
        const aPlacket = Math.asin(clamp(evalFrontOpenX(Math.min(coatTopY, yIn)) / Math.max(0.070, crIn.w), 0.22, 0.85));
        const aAbs = lerp(aPlacket, Math.PI, Math.pow(tAround, 1.08));
        const aIn = sideSign > 0 ? aAbs : (TAU - aAbs);

        // Inner point hugs neck stand above `coatTopY` and hugs front placket below `coatTopY`
        let pIn;
        if (yIn > coatTopY - 0.004) {
          const bpN = bust.sampleAt(Math.min(1.456, yIn + 0.012), aIn);
          const standLift = smooth(coatTopY - 0.004, 1.438, yIn);
          pIn = new T.Vector3(
            bpN.x + bpN.rx * 0.0048,
            yIn + 0.012 * standLift,
            bpN.z + bpN.rz * 0.0048
          );
        } else {
          const cp = evalCoatPoint(yIn, aIn, 0.0020);
          pIn = new T.Vector3(cp.x, cp.y, cp.z);
        }
        innerSpine.push(pIn);

        // COMPACT ~3.4cm Turned-Down Neck Collar + Flat-Lying ~3.8cm Chest Lapel (`0b07591c.jpg` 1:1 — hugs neck closely, ZERO wide shoulder wing/shelf!)
        const waistTaper = smooth(0.00, 0.10, sym);
        const notchFactor = 1.0 - 0.58 * gorgeNotch;
        let cpOut;
        if (inCollar > 0.5) {
          // Compact neck-hugging collar band (`~2.8cm` vertical drop, `+1.5cm` radial turn-over right around neck base — never flares onto shoulder!)
          const yColOut = clamp(yIn - 0.025 * notchFactor, 1.404, 1.430);
          const bpCol = bust.sampleAt(1.442, aIn);
          const colOutR = 0.0165 * notchFactor;
          const rawX = bpCol.x + bpCol.rx * colOutR;
          const rawZ = bpCol.z + bpCol.rz * colOutR + (Math.cos(aIn) > 0 ? 0.006 * notchFactor : 0);
          // Ensure bottom edge sits 3mm cleanly outside coat neck top (`coatTopY`)
          const cpCoat = evalCoatPoint(Math.min(coatTopY, yColOut), aIn, 0.0032);
          const rRaw = Math.hypot(rawX, rawZ - cpCoat.z0);
          const rCoat = Math.hypot(cpCoat.x, cpCoat.z - cpCoat.z0);
          if (rRaw < rCoat) {
            cpOut = { x: cpCoat.x, y: yColOut, z: cpCoat.z };
          } else {
            cpOut = { x: rawX, y: yColOut, z: rawZ };
          }
        } else {
          const angSpan = 0.21 * waistTaper * (1 - inCollar * 1.4) * notchFactor;
          const yOut = clamp(yIn - 0.006 * notchFactor, 1.030, coatTopY - 0.004);
          const aOutAbs = clamp(aAbs + angSpan, 0.22, Math.PI);
          const aOut = sideSign > 0 ? aOutAbs : (TAU - aOutAbs);
          cpOut = evalCoatPoint(yOut, aOut, 0.0035);
        }
        outerSpine.push(new T.Vector3(cpOut.x, cpOut.y, cpOut.z));
      }

      // 2 passes of light 3-point smoothing on `innerSpine` (preserving sharp V-notch on `outerSpine` outside gorge!)
      for (let pass = 0; pass < 2; pass++) {
        for (let iu = 1; iu < segU; iu++) {
          innerSpine[iu].lerpVectors(innerSpine[iu], new T.Vector3().addVectors(innerSpine[iu - 1], innerSpine[iu + 1]).multiplyScalar(0.5), 0.35);
          if (gorgeArr[iu] < 0.18) {
            outerSpine[iu].lerpVectors(outerSpine[iu], new T.Vector3().addVectors(outerSpine[iu - 1], outerSpine[iu + 1]).multiplyScalar(0.5), 0.25);
          }
        }
      }

      const profSteps = [
        { s: 0.00, lift: 0.0005, dy: -0.003, shade: 0.80 }, // Welded inner stand/fold root
        { s: 0.16, lift: 0.0055, dy:  0.005, shade: 1.00 }, // Smooth fold-over roll crest
        { s: 0.55, lift: 0.0065, dy:  0.002, shade: 1.05 }, // Flat-lying collar & lapel face
        { s: 0.94, lift: 0.0055, dy: -0.001, shade: 1.03 }, // Crisp outer lapel / collar edge
        { s: 1.00, lift: 0.0028, dy: -0.003, shade: 0.80 }, // Beveled 4mm cloth thickness rim
        { s: 0.92, lift: -0.0015, dy: -0.004, shade: 0.38 } // Dark shadow return tucked onto coat surface!
      ];
      const nP = profSteps.length, cols = segU + 1;
      const pos = [], uv = [], col = [], si = [], sw = [], idx = [];

      for (let ip = 0; ip < nP; ip++) {
        const ps = profSteps[ip];
        for (let iu = 0; iu <= segU; iu++) {
          const u = iu / segU;
          const sym = Math.min(u, 1 - u);
          const endPinch = smooth(0.0, 0.05, sym);
          const pI = innerSpine[iu], pO = outerSpine[iu];
          let px = lerp(pI.x, pO.x, ps.s);
          let py = lerp(pI.y, pO.y, ps.s) + ps.dy * endPinch;
          let pz = lerp(pI.z, pO.z, ps.s);

          // Push radially outward along body normal by `ps.lift` and enforce strict clearance above Part A coat surface (`0%` Z-fighting!)
          const aHere = Math.atan2(px, pz + 0.012);
          const cpFloor = evalCoatPoint(Math.min(coatTopY, py), aHere, Math.max(0.0015, 0.0040 + ps.lift * endPinch));
          const rCur = Math.hypot(px, pz - cpFloor.z0) || 1e-4;
          const rMin = Math.hypot(cpFloor.x, cpFloor.z - cpFloor.z0);
          if (py <= coatTopY + 0.004 && rCur < rMin) {
            const sc = rMin / rCur;
            px *= sc;
            pz = cpFloor.z0 + (pz - cpFloor.z0) * sc;
          } else {
            const nr = Math.hypot(px, pz + 0.012) || 1;
            px += (px / nr) * ps.lift * endPinch;
            pz += ((pz + 0.012) / nr) * ps.lift * endPinch;
          }

          pos.push(px, py, pz);
          uv.push(u * 4.0, ps.s);
          const gorgeCrease = 1.0 - 0.24 * gorgeArr[iu] * smooth(0.15, 0.85, ps.s);
          const shVal = ps.shade * gorgeCrease;
          col.push(shVal, shVal, shVal);
          const sk = evalGarmentTorsoSkin(px, Math.min(py, 1.435), pz, build, B, bust);
          si.push(sk.indices[0], sk.indices[1], sk.indices[2], sk.indices[3]);
          sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
        }
      }

      for (let ip = 0; ip < nP - 1; ip++) {
        for (let iu = 0; iu < segU; iu++) {
          const A = ip * cols + iu, Bv = A + 1, C = A + cols, D = C + 1;
          idx.push(A, C, Bv, Bv, C, D);
        }
      }
      const uniGeo = new T.BufferGeometry();
      uniGeo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      uniGeo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      uniGeo.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      uniGeo.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      uniGeo.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
      uniGeo.setIndex(idx);
      uniGeo.computeVertexNormals();
      geos.push(uniGeo);
    }

    return mergeSkinnedGeos(T, geos);
  }

  /* AUTHENTIC GRAVITY-DRAPED MULTI-FOLD ETHIOPIAN *SHAMMA* / *GABI* WRAP (`0bc287c6.jpg`, `32b99d8c.jpg`, `735822c2.jpg` 1:1!)
     - Curves smoothly INWARD and DOWNWARD over rounded deltoids & trapezius to hug the neck base (ZERO stiff upward laundry-hamper corners!)
     - Deep 20mm nested diagonal catenary fold ridges & undercut shadow valleys! */
  function buildEthiopianShammaWrapGeo(T, spec, bust, B, isDiagonalElder = false) {
    const build = spec.build || 1.0;
    const thick = 0.0085;
    const segU = 68, nRows = 34, cols = segU + 1;
    const pos = [], uv = [], col = [], si = [], sw = [], idx = [];

    for (let layer = 0; layer < 2; layer++) {
      const sh = layer === 0 ? 0 : -thick;
      for (let i = 0; i < nRows; i++) {
        const v = i / (nRows - 1); // 0 = lower draped hem -> 0.74 = rounded deltoid cap -> 1.0 = snug trapezius/neck collar roll!
        const tTorso = clamp(v / 0.74, 0, 1);
        const tArch = smooth(0.72, 1.0, v);

        for (let j = 0; j <= segU; j++) {
          const u = j / segU;
          const a = lerp(-Math.PI * 0.96, Math.PI * 1.18, u);
          const sa = Math.sin(a), ca = Math.cos(a);

          let yHem, yShoulderCap, yNeckCollar;
          if (isDiagonalElder) {
            // Elder (`32b99d8c.jpg` & `735822c2.jpg` 1:1): slopes naturally down right deltoid (`sa < 0`) while sweeping a bold diagonal fold from right hip up high over left shoulder (`sa > 0`)!
            yHem = 0.90 - 0.14 * sa - 0.06 * (1 - Math.max(0, ca));
            yShoulderCap = (ca >= 0 ? lerp(1.348, 1.300, Math.pow(ca, 1.35)) : 1.365) + 0.044 * sa;
            yNeckCollar  = (ca >= 0 ? lerp(1.402, 1.334, Math.pow(ca, 1.25)) : 1.418) + 0.036 * sa;
          } else {
            yHem = 0.92 - 0.12 * (1 - Math.max(0, ca)) - 0.04 * sa;
            yShoulderCap = ca >= 0 ? lerp(1.366, 1.324, Math.pow(ca, 1.30)) + 0.016 * (-sa) : 1.384;
            yNeckCollar  = ca >= 0 ? lerp(1.416, 1.358, Math.pow(ca, 1.25)) : 1.426;
          }

          // Smooth gravity-settled shoulder dome: rises along torso to rounded deltoid cap, then slopes INWARD over trapezius to neck!
          const pyTorso = lerp(yHem, yShoulderCap, tTorso);
          const deltoidDome = Math.sin(tArch * Math.PI) * 0.015 * Math.pow(Math.abs(sa), 1.2);
          const pyBase = lerp(pyTorso, yNeckCollar, tArch) + deltoidDome;
          const wrapOverlap = smooth(0.82, 1.0, u) * 0.014;

          const shSwell = Math.sin(Math.pow(tTorso, 0.78) * Math.PI * 0.5);
          // Elder's diagonal *gabi* (`32b99d8c.jpg` 1:1) hugs torso & right deltoid closely (leaving right sleeve visible!) while sweeping diagonally over left shoulder!
          const wShoulder = isDiagonalElder
            ? (lerp(0.180, 0.202, shSwell) * build + (sa > 0 ? 0.016 : -0.012) * shSwell)
            : (lerp(0.206, 0.236, shSwell) * build + (sa < 0 ? 0.016 : 0.004) * shSwell);
          const fShoulder = isDiagonalElder ? lerp(0.144, 0.136, smooth(0.4, 1.0, tTorso)) : lerp(0.156, 0.146, smooth(0.4, 1.0, tTorso));
          const bShoulder = isDiagonalElder ? lerp(0.148, 0.140, smooth(0.4, 1.0, tTorso)) : lerp(0.162, 0.150, smooth(0.4, 1.0, tTorso));

          const bpNeck = bust.sampleAt(1.448, a);
          const neckClear = 0.018 + wrapOverlap * 0.6;
          const wNeck = bpNeck.rad + neckClear;
          const rzNeck = bpNeck.rad + neckClear;

          const wBase = lerp(wShoulder, wNeck * lerp(1, build, 0.35), Math.pow(tArch, 1.15));
          const rz = lerp(ca >= 0 ? fShoulder : bShoulder, rzNeck, Math.pow(tArch, 1.15));
          const zCenter = lerp(-0.008, bpNeck.z0, tArch);

          // REAL 3D OUTWARD-POSITIVE NESTED CATENARY FOLD RIDGES (`+2..+30mm` above base envelope so inner shirt/arms NEVER poke through valleys!)
          const diagCoord = isDiagonalElder
            ? (v * 7.4 - sa * 2.50 + Math.pow(Math.max(0, ca), 1.3) * 1.35)
            : (v * 6.8 + sa * 1.60 + Math.pow(Math.max(0, ca), 1.4) * 1.95);
          const rawWave = Math.sin(diagCoord * Math.PI);
          const foldFade = 1.0 - 0.58 * smooth(0.86, 1.0, v);
          const signedWave = rawWave * 0.70 + 0.30 * Math.sin(diagCoord * Math.PI * 2.0 - 0.6);
          const catenaryOut = (0.52 + 0.48 * signedWave) * 0.028 * foldFade;
          const vertPleat = (1 - smooth(0.22, 0.78, v)) * (0.006 + 0.006 * Math.sin(u * Math.PI * 11.0 + 1.1));
          const foldOut = (catenaryOut + vertPleat) * (layer === 0 ? 1.0 : 0.45) + wrapOverlap;
          const collarRoll = smooth(0.90, 1.0, v) * 0.0055 * (layer === 0 ? 1 : -0.6);

          let px = Math.sign(sa) * Math.pow(Math.abs(sa), 0.92) * (wBase + sh + foldOut + collarRoll);
          let py = pyBase - (signedWave < 0 ? 0.0040 : 0) + (layer === 1 && v > 0.94 ? -0.003 : 0);
          let pz = zCenter + Math.sign(ca) * Math.pow(Math.abs(ca), 0.92) * (rz + sh + foldOut + collarRoll);

          if (py > 1.250) {
            const bp = bust.sampleAt(Math.min(1.452, py), Math.atan2(px, pz - zCenter));
            const minR = bp.rad + 0.0185 + wrapOverlap * 0.7 + (layer === 0 ? thick : 0);
            const curR = Math.hypot(px, pz - bp.z0) || 1e-4;
            if (curR < minR) {
              const sc = minR / curR;
              px *= sc;
              pz = bp.z0 + (pz - bp.z0) * sc;
            }
          }

          pos.push(px, py, pz);
          uv.push(u * 4.5, v * 3.5);

          // Deep sculptural valley AO (0.34..1.06) driven by `signedWave` so every diagonal catenary fold reads boldly!
          const onTibeb = (v < 0.080 || u > 0.93) && layer === 0;
          const tibebTone = onTibeb ? (0.72 + 0.14 * Math.sin((u * 90 + v * 60))) : 1.0;
          const foldAO = clamp((layer ? 0.60 : 1.0) * (0.78 + 0.10 * v + signedWave * 0.34 + (vertPleat - 0.006) * 10.0) * tibebTone, 0.34, 1.06);
          col.push(foldAO, foldAO * 0.99, foldAO * (onTibeb ? 0.90 : 0.97));

          // Skinning: shoulder cape follows clavicles & upper arms smoothly so pumping/gesturing never tears the shamma!
          let sk;
          const ax = Math.abs(px);
          if (py < 0.92) {
            const wHem = 1 - smooth(0.76, 0.92, py);
            const bC = ca < -0.3 ? B.COAT_B : (px >= 0 ? B.COAT_L : B.COAT_R);
            sk = { indices: [bC, B.PELVIS, B.LUMBAR, 0], weights: [wHem * 0.55, (1 - wHem * 0.55) * 0.65, (1 - wHem * 0.55) * 0.35, 0] };
          } else if (py >= 1.18 && py <= 1.43 && ax > 0.125 * build) {
            const armB = px >= 0 ? B.UARM_L : B.UARM_R;
            const clavB = px >= 0 ? B.CLAV_L : B.CLAV_R;
            const capeW = smooth(0.125 * build, 0.225 * build, ax) * smooth(1.16, 1.34, py);
            sk = { indices: [B.CHEST, clavB, armB, 0], weights: [1 - capeW * 0.66, capeW * 0.34, capeW * 0.32, 0] };
          } else {
            sk = evalGarmentTorsoSkin(px, py, pz, build, B, bust);
          }
          si.push(sk.indices[0], sk.indices[1], sk.indices[2], sk.indices[3]);
          sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
        }
      }
    }

    const stride = nRows * cols;
    for (let i = 0; i < nRows - 1; i++) {
      for (let j = 0; j < segU; j++) {
        const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
        idx.push(A, Bv, C, Bv, D, C);
        const Ai = stride + A, Bi = stride + Bv, Ci = stride + C, Di = stride + D;
        idx.push(Ai, Ci, Bi, Bi, Ci, Di);
      }
    }
    for (let i = 0; i < nRows - 1; i++) {
      const L0 = i * cols, L1 = (i + 1) * cols, Li0 = stride + L0, Li1 = stride + L1;
      idx.push(L0, L1, Li0, L1, Li1, Li0);
      const R0 = i * cols + segU, R1 = (i + 1) * cols + segU, Ri0 = stride + R0, Ri1 = stride + R1;
      idx.push(R0, Ri0, R1, R1, Ri0, Ri1);
    }
    for (let j = 0; j < segU; j++) {
      const B0 = j, B1 = j + 1, Bi0 = stride + B0, Bi1 = stride + B1;
      idx.push(B0, Bi0, B1, B1, Bi0, Bi1);
      const T0 = (nRows - 1) * cols + j, T1 = T0 + 1, Ti0 = stride + T0, Ti1 = stride + T1;
      idx.push(T0, T1, Ti0, T1, Ti1, Ti0);
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* SCULPTED PLEATED / CARGO / KNEE-PATCHED TROUSERS (`32b99d8c.jpg` & `735822c2.jpg`) */
  function buildSculptedTrousersGeo(T, spec, skelInfo, B, cfg = {}) {
    const isChild = (spec.scale || 1.0) < 0.88;
    const build = (spec.build || 1.0) * (isChild ? 0.78 : 1.0);
    const legSc = isChild ? 0.86 : 1.0;
    const { hipX, L_THIGH, L_SHIN } = skelInfo;
    const yHip = 0.875, yKnee = yHip - L_THIGH, yAnk = yKnee - L_SHIN;
    const geos = [];
    const patchGeos = [];

    // 1. Pelvis Waistband & Pleated Seat
    const pelRings = refineRings([
      { p: [0, 0.775, 0.002], w: 0.160 * build, f: 0.110 * legSc, b: 0.120 * legSc, e: 0.86 },
      { p: [0, 0.848, 0.002], w: 0.152 * build, f: 0.104 * legSc, b: 0.112 * legSc, e: 0.86 },
      { p: [0, 0.912, 0.004], w: 0.144 * build, f: 0.098 * legSc, b: 0.104 * legSc, e: 0.88 }
    ], 2);
    {
      const seg = 30, cols = seg + 1, n = pelRings.length;
      const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
      for (let i = 0; i < n; i++) {
        const r = pelRings[i], v = i / (n - 1);
        for (let j = 0; j <= seg; j++) {
          const u = j / seg, a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
          const rz = ca >= 0 ? r.f : r.b;
          pos.push(Math.sign(sa) * Math.pow(Math.abs(sa), r.e) * r.w, r.p[1], r.p[2] + Math.sign(ca) * Math.pow(Math.abs(ca), r.e) * rz);
          uv.push(u * 3, v);
          const c = 0.84 + 0.14 * v;
          col.push(c, c, c);
          const legB = sa >= 0 ? B.ULEG_L : B.ULEG_R;
          const wLeg = (1 - smooth(0.775, 0.845, r.p[1])) * smooth(0.25, 0.85, Math.abs(sa)) * 0.52;
          si.push(B.PELVIS, legB, 0, 0);
          sw.push(1 - wLeg, wLeg, 0, 0);
        }
      }
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < seg; j++) {
          const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
          idx.push(A, Bv, C, Bv, D, C);
        }
      }
      const pg = new T.BufferGeometry();
      pg.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      pg.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      pg.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      pg.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      pg.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
      pg.setIndex(idx);
      pg.computeVertexNormals();
      geos.push(pg);
    }

    // 2. Left & Right Loose Pleated / Bloused Trouser Legs + Optional Cargo Bellows Pockets OR Stitched Knee Patches!
    for (const s of [1, -1]) {
      const bUL = s > 0 ? B.ULEG_L : B.ULEG_R;
      const bKV = s > 0 ? B.KNEE_VOL_L : B.KNEE_VOL_R;
      const bLL = s > 0 ? B.LLEG_L : B.LLEG_R;
      const lx = s * hipX;

      const legRings = refineRings([
        { p: [lx, yAnk + 0.088,  0.004], w: 0.052 * legSc, f: 0.054 * legSc, b: 0.056 * legSc, e: 0.90 }, // Tucked inside tall boot shaft
        { p: [lx, yAnk + 0.145,  0.004], w: 0.073 * legSc, f: 0.075 * legSc, b: 0.077 * legSc, e: 0.88 }, // Bloused boot-top cuff fold!
        { p: [lx, yAnk + 0.210,  0.002], w: 0.068 * legSc, f: 0.070 * legSc, b: 0.072 * legSc, e: 0.88 },
        { p: [lx, yKnee - 0.055,-0.002], w: 0.075 * legSc, f: 0.074 * legSc, b: 0.080 * legSc, e: 0.88 },
        { p: [lx, yKnee,         0.005], w: 0.078 * legSc, f: 0.082 * legSc, b: 0.076 * legSc, e: 0.86 },
        { p: [lx, yKnee + 0.165, 0.003], w: 0.088 * build, f: 0.089 * legSc, b: 0.091 * legSc, e: 0.86 },
        { p: [lx * 0.96, 0.848,  0.000], w: 0.092 * build, f: 0.093 * legSc, b: 0.097 * legSc, e: 0.86 }
      ], 3);

      const seg = 28, cols = seg + 1, n = legRings.length;
      const pos = [], uv = [], col = [], si = [], sw = [], idx = [];

      const skinLegAtY = py => {
        if (py > 0.815) {
          const wP = smooth(0.815, 0.855, py) * 0.48;
          return { indices: [bUL, B.PELVIS, 0, 0], weights: [1 - wP, wP, 0, 0] };
        }
        const kv = g1(py, yKnee, 0.056) * 0.68;
        if (py > yKnee - 0.062) {
          const wU = smooth(yKnee - 0.058, yKnee + 0.058, py);
          const rem = 1 - kv;
          return { indices: [bUL, bLL, bKV, 0], weights: [wU * rem, (1 - wU) * rem, kv, 0] };
        }
        return { indices: [bLL, bKV, 0, 0], weights: [1 - kv, kv, 0, 0] };
      };

      for (let i = 0; i < n; i++) {
        const r = legRings[i], v = i / (n - 1), py = r.p[1];
        for (let j = 0; j <= seg; j++) {
          const u = j / seg, a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
          const rz = ca >= 0 ? r.f : r.b;
          // Bold Asymmetric 3D Trouser Creases, Knee Chevrons & Ankle Blousing (`0.28..1.08` AO for jerikan & woodblock!)
          const frontCrease = g1(ca, 0.88, 0.24) * smooth(0.18, 0.86, v) * 0.0135;
          const diagThighFold = g1(py, yKnee + 0.15, 0.13) * Math.sin(v * 20 + a * 3 * s + s * 0.7) * 0.0125;
          const kneeFold = g1(py, yKnee, 0.078) * Math.sin(v * 42 + sa * 3) * 0.0130;
          const blouseFold = g1(py, yAnk + 0.155, 0.052) * (0.0085 + 0.0085 * Math.sin(a * 6 + s));
          const outSeam = g1(s * sa, 1.0, 0.10) * 0.0028;

          const px = r.p[0] + Math.sign(sa) * Math.pow(Math.abs(sa), r.e) * r.w + sa * (kneeFold + blouseFold + outSeam + diagThighFold);
          const pz = r.p[2] + Math.sign(ca) * Math.pow(Math.abs(ca), r.e) * rz + ca * (frontCrease + kneeFold + blouseFold + diagThighFold);

          pos.push(px, py, pz);
          uv.push(u * 2.5, v * 4.0);
          const foldSum = frontCrease * 0.7 + kneeFold + blouseFold * 0.6 + diagThighFold;
          const c = clamp(0.80 + 0.12 * v + foldSum * 20.0, 0.28, 1.08);
          col.push(c, c, c);
          const sk = skinLegAtY(py);
          si.push(sk.indices[0], sk.indices[1], sk.indices[2], sk.indices[3]);
          sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
        }
      }
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < seg; j++) {
          const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
          idx.push(A, Bv, C, Bv, D, C);
        }
      }
      const lg = new T.BufferGeometry();
      lg.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      lg.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      lg.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      lg.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      lg.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
      lg.setIndex(idx);
      lg.computeVertexNormals();
      geos.push(lg);

      // 3. Stitched Rectangular 3D Knee Patches (BOTH clearly visible on June in 32b99d8c.jpg & 735822c2.jpg!)
      if (cfg.kneePatches) {
        const pNU = 10, pNV = 10, pCols = pNU + 1;
        const pPos = [], pUv = [], pCol = [], pSi = [], pSw = [], pIdx = [];
        const patchTint = s < 0 ? [0.48, 0.54, 0.62] : [1.38, 1.28, 1.12];
        for (let iv = 0; iv <= pNV; iv++) {
          const fv = iv / pNV;
          const py = lerp(yKnee - 0.068, yKnee + 0.060, fv);
          const sk = skinLegAtY(py);
          for (let iu = 0; iu <= pNU; iu++) {
            const fu = iu / pNU;
            const a = lerp(-0.58, 0.58, fu) + s * 0.08;
            const sa = Math.sin(a), ca = Math.cos(a);
            const border = Math.min(fu, 1 - fu, fv, 1 - fv);
            const bevel = smooth(0.0, 0.14, border) * 0.0052;
            const stitch = (border > 0.06 && border < 0.18) ? -0.22 : 0.0;
            const px = lx + Math.sign(sa) * Math.pow(Math.abs(sa), 0.86) * (0.079 * legSc + bevel);
            const pz = 0.005 + Math.pow(ca, 0.86) * (0.083 * legSc + bevel);
            pPos.push(px, py, pz);
            pUv.push(fu, fv);
            pCol.push(
              clamp(patchTint[0] + stitch, 0.25, 1.45),
              clamp(patchTint[1] + stitch, 0.25, 1.45),
              clamp(patchTint[2] + stitch, 0.25, 1.45)
            );
            pSi.push(sk.indices[0], sk.indices[1], sk.indices[2], sk.indices[3]);
            pSw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
          }
        }
        for (let iv = 0; iv < pNV; iv++) {
          for (let iu = 0; iu < pNU; iu++) {
            const A = iv * pCols + iu, Bv = A + 1, C = A + pCols, D = C + 1;
            pIdx.push(A, Bv, C, Bv, D, C);
          }
        }
        const patchGeo = new T.BufferGeometry();
        patchGeo.setAttribute("position", new T.Float32BufferAttribute(pPos, 3));
        patchGeo.setAttribute("uv", new T.Float32BufferAttribute(pUv, 2));
        patchGeo.setAttribute("color", new T.Float32BufferAttribute(pCol, 3));
        patchGeo.setAttribute("skinIndex", new T.Uint16BufferAttribute(pSi, 4));
        patchGeo.setAttribute("skinWeight", new T.Float32BufferAttribute(pSw, 4));
        patchGeo.setIndex(pIdx);
        patchGeo.computeVertexNormals();
        patchGeos.push(patchGeo);
      }

      // 4. Sculpted Bellows Thigh Cargo Pockets + Buttoned Flaps (Hanna & Imani in 32b99d8c.jpg!)
      if (cfg.cargoPockets) {
        const makeCargoBox = (hY0, hY1, aSpan, thickOut, shade) => {
          const cU = 8, cV = 6, cCols = cU + 1;
          const bPos = [], bUv = [], bCol = [], bSi = [], bSw = [], bIdx = [];
          for (let iv = 0; iv <= cV; iv++) {
            const fv = iv / cV;
            const py = lerp(hY0, hY1, fv);
            const sk = skinLegAtY(py);
            for (let iu = 0; iu <= cU; iu++) {
              const fu = iu / cU;
              const a = s * (Math.PI * 0.5) + lerp(-aSpan, aSpan, fu);
              const sa = Math.sin(a), ca = Math.cos(a);
              const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
              const bev = smooth(0.0, 0.16, edge);
              // Central vertical bellows pleat ridge!
              const pleat = g1(fu, 0.5, 0.12) * bev * 0.004;
              const out = (thickOut + pleat) * bev;
              const wR = 0.086 * build + out;
              const fR = 0.088 + out;
              bPos.push(lx + Math.sign(sa) * Math.pow(Math.abs(sa), 0.86) * wR, py, 0.003 + Math.sign(ca) * Math.pow(Math.abs(ca), 0.86) * fR);
              bUv.push(fu, fv);
              const cVal = shade * (0.86 + 0.16 * bev);
              bCol.push(cVal, cVal, cVal);
              bSi.push(sk.indices[0], sk.indices[1], sk.indices[2], sk.indices[3]);
              bSw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
            }
          }
          for (let iv = 0; iv < cV; iv++) {
            for (let iu = 0; iu < cU; iu++) {
              const A = iv * cCols + iu, Bv = A + 1, C = A + cCols, D = C + 1;
              bIdx.push(A, Bv, C, Bv, D, C);
            }
          }
          const bg = new T.BufferGeometry();
          bg.setAttribute("position", new T.Float32BufferAttribute(bPos, 3));
          bg.setAttribute("uv", new T.Float32BufferAttribute(bUv, 2));
          bg.setAttribute("color", new T.Float32BufferAttribute(bCol, 3));
          bg.setAttribute("skinIndex", new T.Uint16BufferAttribute(bSi, 4));
          bg.setAttribute("skinWeight", new T.Float32BufferAttribute(bSw, 4));
          bg.setIndex(bIdx);
          bg.computeVertexNormals();
          return bg;
        };
        // Bellows pocket body + overhanging top pocket flap!
        geos.push(makeCargoBox(yKnee + 0.065, yKnee + 0.215, 0.48, 0.016, 0.96));
        geos.push(makeCargoBox(yKnee + 0.182, yKnee + 0.228, 0.51, 0.021, 1.04));
      }
    }

    return {
      trouserGeo: mergeSkinnedGeos(T, geos.concat(patchGeos))
    };
  }

  /* EYELET-LACED LUG-SOLE WORK BOOTS (`32b99d8c.jpg` 1:1!)
     - Skinned cleanly across B.FOOT_L/R + B.TOE_L/R + B.LLEG_L/R so stepping onto plinth or walking bends forefoot naturally!
     - Real 3D deep-cleat lug outsole + distinct heel block + stitched storm welt + reinforced toe cap + tongue + metallic eyelets & criss-cross cylindrical laces! */
  function buildSkinnedLugBoots(T, spec, skelInfo, B) {
    const { hipX, L_THIGH, L_SHIN } = skelInfo;
    const yAnk = 0.875 - L_THIGH - L_SHIN; // 0.085m -> y=0.000m is ground!
    const isChild = (spec.scale || 1.0) < 0.88;
    const shaftTopY = isChild ? 0.148 : 0.205;

    const soleGeos = [], leatherGeos = [], metalGeos = [];

    for (const s of [1, -1]) {
      const bLL = s > 0 ? B.LLEG_L : B.LLEG_R;
      const bFT = s > 0 ? B.FOOT_L : B.FOOT_R;
      const bTO = s > 0 ? B.TOE_L : B.TOE_R;
      const bx = s * hipX;

      const skinBoot = (py, pz) => {
        if (py > yAnk + 0.035) {
          const wShin = smooth(yAnk + 0.035, shaftTopY, py) * 0.68;
          return { indices: [bFT, bLL, 0, 0], weights: [1 - wShin, wShin, 0, 0] };
        }
        const wToe = smooth(0.055, 0.115, pz) * (1 - smooth(0.055, 0.095, py));
        return { indices: [bFT, bTO, 0, 0], weights: [1 - wToe, wToe, 0, 0] };
      };

      // 1. Vulcanized Deep-Lug Rubber Outsole + Raised Heel Block + Arch Step (y = 0.000m .. 0.022m)
      {
        const soleRings = [
          { y: 0.000, w: 0.055, f: 0.136, b: 0.092, zc: 0.026, lug: 0.0 },
          { y: 0.004, w: 0.057, f: 0.138, b: 0.094, zc: 0.026, lug: 1.0 },
          { y: 0.014, w: 0.057, f: 0.138, b: 0.094, zc: 0.026, lug: 1.0 },
          { y: 0.021, w: 0.054, f: 0.134, b: 0.091, zc: 0.026, lug: 0.0 }
        ];
        const seg = 32, cols = seg + 1, n = soleRings.length;
        const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
        for (let i = 0; i < n; i++) {
          const sr = soleRings[i];
          for (let j = 0; j <= seg; j++) {
            const u = j / seg, a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
            const rz = ca >= 0 ? sr.f : sr.b;
            // 11 Perimeter Lug Cleat Notches!
            const cleat = sr.lug * (Math.sin(a * 11.0) > 0.1 ? 0.0028 : -0.0014);
            const rawZ = sr.zc + Math.sign(ca) * Math.pow(Math.abs(ca), 0.72) * (rz + cleat);
            // Instep arch step between heel block (z < -0.015) and forefoot sole (z > +0.025)!
            const archLift = sr.y < 0.012 ? (g1(rawZ, 0.005, 0.022) * (0.010 - sr.y * 0.7)) : 0;
            const px = bx + Math.sign(sa) * Math.pow(Math.abs(sa), 0.72) * (sr.w + cleat);
            const py = sr.y + Math.max(0, archLift);
            const pz = rawZ;
            pos.push(px, py, pz);
            uv.push(u * 4, i / 3);
            const c = 0.76 + 0.18 * (i / 3) + cleat * 22;
            col.push(c, c, c);
            const sk = skinBoot(py, pz);
            si.push(sk.indices[0], sk.indices[1], 0, 0);
            sw.push(sk.weights[0], sk.weights[1], 0, 0);
          }
        }
        for (let i = 0; i < n - 1; i++) {
          for (let j = 0; j < seg; j++) {
            const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
            idx.push(A, Bv, C, Bv, D, C);
          }
        }
        // Bottom sole cap
        const cIdx = pos.length / 3;
        pos.push(bx, 0.000, 0.026); uv.push(0.5, 0.5); col.push(0.6, 0.6, 0.6); si.push(bFT, 0, 0, 0); sw.push(1, 0, 0, 0);
        for (let j = 0; j < seg; j++) idx.push(j + 1, j, cIdx);

        const sg = new T.BufferGeometry();
        sg.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        sg.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        sg.setAttribute("color", new T.Float32BufferAttribute(col, 3));
        sg.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
        sg.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
        sg.setIndex(idx);
        sg.computeVertexNormals();
        soleGeos.push(sg);
      }

      // 2. Stitched Storm Welt + Structured Leather Upper + Toe-Cap Seam + Padded Collar Roll
      {
        const bootRings = refineRings([
          { p: [bx, 0.020, 0.026], w: 0.055, f: 0.135, b: 0.091, e: 0.72, welt: 1.0 },
          { p: [bx, 0.026, 0.025], w: 0.051, f: 0.130, b: 0.088, e: 0.75, welt: 0.4 },
          { p: [bx, 0.048, 0.022], w: 0.050, f: 0.126, b: 0.086, e: 0.78, welt: 0.0 },
          { p: [bx, 0.072, 0.012], w: 0.046, f: 0.094, b: 0.080, e: 0.85, welt: 0.0 },
          { p: [bx, 0.105, 0.004], w: 0.045, f: 0.064, b: 0.066, e: 0.90, welt: 0.0 },
          { p: [bx, lerp(0.105, shaftTopY, 0.55), 0.002], w: 0.047, f: 0.058, b: 0.060, e: 0.92, welt: 0.0 },
          { p: [bx, shaftTopY - 0.012, 0.002], w: 0.051, f: 0.061, b: 0.062, e: 0.92, welt: 0.0, collar: 1.0 },
          { p: [bx, shaftTopY,         0.002], w: 0.047, f: 0.057, b: 0.058, e: 0.94, welt: 0.0, collar: 0.6 }
        ], 2);

        const seg = 30, cols = seg + 1, n = bootRings.length;
        const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
        for (let i = 0; i < n; i++) {
          const r = bootRings[i], v = i / (n - 1), py = r.p[1];
          for (let j = 0; j <= seg; j++) {
            const u = j / seg, a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
            const rz = ca >= 0 ? r.f : r.b;
            const rawZ = r.p[2] + Math.sign(ca) * Math.pow(Math.abs(ca), r.e) * rz;
            // Sculpted Reinforced Toe-Cap Ridge (z > 0.092, y < 0.068) + Quarter Facing Flaps flanking Tongue Throat!
            const toeCap = (rawZ > 0.092 && py < 0.066) ? 0.0024 * smooth(0.092, 0.102, rawZ) : 0;
            const throatGroove = (ca > 0.78 && py > 0.062 && py < shaftTopY - 0.008)
              ? (-0.0048 * g1(sa, 0.0, 0.18) + 0.0032 * (g1(sa, 0.28, 0.10) + g1(sa, -0.28, 0.10)))
              : 0;
            const px = r.p[0] + Math.sign(sa) * Math.pow(Math.abs(sa), r.e) * (r.w + toeCap * 0.5);
            const pz = rawZ + ca * (toeCap + throatGroove);
            pos.push(px, py, pz);
            uv.push(u * 2.5, v * 2.5);

            // Welt stitch highlight + subtle trail dust patina + deep throat tongue AO so criss-cross laces pop!
            const weltStitch = (r.welt || 0) > 0.5 ? (0.80 + 0.24 * (Math.sin(a * 48) > 0 ? 1 : 0)) : 1.0;
            const tongueAO = (ca > 0.84 && py > 0.062 && Math.abs(sa) < 0.24) ? 0.50 : 1.0;
            const toeScuff = toeCap > 0.001 ? 1.10 : 1.0;
            const c = clamp((0.82 + 0.16 * v) * weltStitch * tongueAO * toeScuff, 0.42, 1.14);
            col.push(c, c * 0.98, c * 0.94);

            const sk = skinBoot(py, pz);
            si.push(sk.indices[0], sk.indices[1], 0, 0);
            sw.push(sk.weights[0], sk.weights[1], 0, 0);
          }
        }
        for (let i = 0; i < n - 1; i++) {
          for (let j = 0; j < seg; j++) {
            const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
            idx.push(A, Bv, C, Bv, D, C);
          }
        }
        const ug = new T.BufferGeometry();
        ug.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        ug.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        ug.setAttribute("color", new T.Float32BufferAttribute(col, 3));
        ug.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
        ug.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
        ug.setIndex(idx);
        ug.computeVertexNormals();
        leatherGeos.push(ug);
      }

      // 3. 6 Pairs of Metallic Eyelets / Speed Hooks + 6 Criss-Cross 3D Cylindrical Bootlaces!
      const nPairs = isChild ? 5 : 6;
      const getEyeletPos = (idxPair, latSign) => {
        const f = idxPair / (nPairs - 1);
        const py = lerp(0.064, shaftTopY - 0.022, f);
        const pz = lerp(0.104, 0.061, Math.pow(f, 0.72));
        const px = bx + latSign * 0.0165;
        return [px, py, pz];
      };

      for (let p = 0; p < nPairs; p++) {
        for (const ls of [-1, 1]) {
          const ep = getEyeletPos(p, ls);
          const eyeG = new T.TorusGeometry(0.0034, 0.0013, 5, 10);
          eyeG.rotateX(-0.35);
          eyeG.translate(ep[0], ep[1], ep[2]);
          const sk = skinBoot(ep[1], ep[2]);
          const cnt = eyeG.attributes.position.count;
          const ski = new Uint16Array(cnt * 4), skw = new Float32Array(cnt * 4), cArr = new Float32Array(cnt * 3);
          for (let k = 0; k < cnt; k++) {
            ski[k * 4] = sk.indices[0]; ski[k * 4 + 1] = sk.indices[1];
            skw[k * 4] = sk.weights[0]; skw[k * 4 + 1] = sk.weights[1];
            cArr[k * 3] = 1; cArr[k * 3 + 1] = 0.96; cArr[k * 3 + 2] = 0.88;
          }
          eyeG.setAttribute("skinIndex", new T.BufferAttribute(ski, 4));
          eyeG.setAttribute("skinWeight", new T.BufferAttribute(skw, 4));
          eyeG.setAttribute("color", new T.BufferAttribute(cArr, 3));
          metalGeos.push(eyeG);
        }

        // Criss-crossing cylindrical X-laces between eyelet pairs!
        if (p < nPairs - 1) {
          for (const diag of [-1, 1]) {
            const pA = getEyeletPos(p, diag);
            const pB = getEyeletPos(p + 1, -diag);
            const mid = [
              0.5 * (pA[0] + pB[0]),
              0.5 * (pA[1] + pB[1]) + 0.0015,
              0.5 * (pA[2] + pB[2]) + 0.0045 + (diag > 0 ? 0.0018 : 0.0)
            ];
            const crv = new T.CatmullRomCurve3([
              new T.Vector3(pA[0], pA[1], pA[2]),
              new T.Vector3(mid[0], mid[1], mid[2]),
              new T.Vector3(pB[0], pB[1], pB[2])
            ]);
            const laceG = new T.TubeGeometry(crv, 6, 0.0029, 6, false);
            const sk = skinBoot(mid[1], mid[2]);
            const cnt = laceG.attributes.position.count;
            const ski = new Uint16Array(cnt * 4), skw = new Float32Array(cnt * 4), cArr = new Float32Array(cnt * 3);
            for (let k = 0; k < cnt; k++) {
              ski[k * 4] = sk.indices[0]; ski[k * 4 + 1] = sk.indices[1];
              skw[k * 4] = sk.weights[0]; skw[k * 4 + 1] = sk.weights[1];
              cArr[k * 3] = 1.42; cArr[k * 3 + 1] = 1.32; cArr[k * 3 + 2] = 1.18;
            }
            laceG.setAttribute("skinIndex", new T.BufferAttribute(ski, 4));
            laceG.setAttribute("skinWeight", new T.BufferAttribute(skw, 4));
            laceG.setAttribute("color", new T.BufferAttribute(cArr, 3));
            leatherGeos.push(laceG);
          }
        }
      }
    }

    return {
      soleGeo: mergeSkinnedGeos(T, soleGeos),
      leatherGeo: mergeSkinnedGeos(T, leatherGeos),
      metalGeo: mergeSkinnedGeos(T, metalGeos)
    };
  }

  /* BUCKLED LEATHER UTILITY BELT + LEFT-HIP HOLSTER POUCH WITH PLIERS & WRENCHES (`32b99d8c.jpg` 1:1!) */
  function buildImaniUtilityBelt(T, spec, assets, cyanGlow) {
    const build = spec.build || 1.0;
    const beltGrp = new T.Group();
    beltGrp.name = "imaniUtilityBelt";

    const leatherMat = makeFabricMaterial(T, 0x261d17, "leather", assets, cyanGlow);
    const steelMat = new T.MeshStandardMaterial({
      color: 0xa4aab0, roughness: 0.34, metalness: 0.78
    });
    steelMat.userData = { isGarment: true, clayReady: true, surfaceTag: "metal" };
    const handleGripMat = makeFabricMaterial(T, 0xb88b58, "leather", assets, cyanGlow);

    // Slight natural hip cant (-0.075 rad) matching Imani's relaxed belt line in 32b99d8c.jpg!
    const cantGrp = new T.Group();
    cantGrp.position.set(0, 0.055, 0.002);
    cantGrp.rotation.z = -0.075;
    beltGrp.add(cantGrp);

    // 1. Thick Beveled Leather Belt Ring
    const bSeg = 36, bCols = bSeg + 1;
    const bPos = [], bUv = [], bCol = [], bIdx = [];
    const prof = [
      { y: -0.024, dr: 0.000, sh: 0.80 },
      { y: -0.020, dr: 0.006, sh: 1.00 },
      { y:  0.020, dr: 0.006, sh: 1.02 },
      { y:  0.024, dr: 0.000, sh: 0.82 }
    ];
    for (let ip = 0; ip < prof.length; ip++) {
      for (let j = 0; j <= bSeg; j++) {
        const u = j / bSeg, a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
        const w = 0.168 * build + prof[ip].dr;
        const rz = (ca >= 0 ? 0.122 : 0.128) + prof[ip].dr;
        bPos.push(Math.sign(sa) * Math.pow(Math.abs(sa), 0.86) * w, prof[ip].y, Math.sign(ca) * Math.pow(Math.abs(ca), 0.86) * rz);
        bUv.push(u * 4, ip / 3);
        bCol.push(prof[ip].sh, prof[ip].sh, prof[ip].sh);
      }
    }
    for (let ip = 0; ip < prof.length - 1; ip++) {
      for (let j = 0; j < bSeg; j++) {
        const A = ip * bCols + j, Bv = A + 1, C = A + bCols, D = C + 1;
        bIdx.push(A, Bv, C, Bv, D, C);
      }
    }
    const beltGeo = new T.BufferGeometry();
    beltGeo.setAttribute("position", new T.Float32BufferAttribute(bPos, 3));
    beltGeo.setAttribute("uv", new T.Float32BufferAttribute(bUv, 2));
    beltGeo.setAttribute("color", new T.Float32BufferAttribute(bCol, 3));
    beltGeo.setIndex(bIdx);
    beltGeo.computeVertexNormals();
    cantGrp.add(new T.Mesh(beltGeo, leatherMat));

    // 2. Rectangular Forged Metal Frame Buckle + Prong + Hanging Leather Tongue Tip (32b99d8c.jpg!)
    const buckleFrame = new T.Group();
    buckleFrame.position.set(-0.012, 0, 0.130);
    for (const sy of [-0.024, 0.024]) {
      const bar = new T.Mesh(new T.BoxGeometry(0.056, 0.008, 0.012), steelMat);
      bar.position.y = sy;
      buckleFrame.add(bar);
    }
    for (const sx of [-0.025, 0.025]) {
      const bar = new T.Mesh(new T.BoxGeometry(0.008, 0.054, 0.012), steelMat);
      bar.position.x = sx;
      buckleFrame.add(bar);
    }
    const prong = new T.Mesh(new T.CylinderGeometry(0.0025, 0.0025, 0.036, 8), steelMat);
    prong.rotation.z = Math.PI * 0.45;
    prong.position.set(0.004, 0, 0.005);
    buckleFrame.add(prong);
    cantGrp.add(buckleFrame);

    // Keeper loop + hanging belt tongue on right front hip (viewer's left in 32b99d8c.jpg!)
    const tonguePts = [
      new T.Vector3(-0.045, 0.000, 0.126),
      new T.Vector3(-0.068, -0.025, 0.124),
      new T.Vector3(-0.074, -0.095, 0.120),
      new T.Vector3(-0.076, -0.155, 0.115)
    ];
    const tongueGeo = new T.TubeGeometry(new T.CatmullRomCurve3(tonguePts), 10, 0.014, 6, false);
    tongueGeo.scale(1.0, 1.0, 0.32);
    cantGrp.add(new T.Mesh(tongueGeo, leatherMat));

    // 3. Cylindrical/Oval Stitched Leather Tool Holster Pouch on Left Hip (+X = viewer's right in 32b99d8c.jpg!)
    const pouchGrp = new T.Group();
    pouchGrp.position.set(0.148 * build, -0.088, 0.076);
    pouchGrp.rotation.set(0.06, 0.36, -0.06);

    const holster = new T.Mesh(new T.CylinderGeometry(0.044, 0.039, 0.165, 18), leatherMat);
    holster.scale.set(0.82, 1.0, 1.12);
    pouchGrp.add(holster);
    const holsterRim = new T.Mesh(new T.TorusGeometry(0.043, 0.0045, 8, 18), leatherMat);
    holsterRim.rotation.x = Math.PI * 0.5;
    holsterRim.scale.set(0.82, 1.12, 1.0);
    holsterRim.position.y = 0.082;
    pouchGrp.add(holsterRim);

    // Open-end steel wrench + insulated pliers handles protruding cleanly from top of holster (32b99d8c.jpg & 735822c2.jpg!)
    const tool1 = new T.Group();
    tool1.position.set(-0.008, 0.095, -0.014);
    tool1.rotation.set(-0.10, 0, 0.08);
    tool1.add(new T.Mesh(new T.BoxGeometry(0.008, 0.11, 0.018), steelMat));
    const cJaw = new T.Mesh(new T.TorusGeometry(0.015, 0.005, 6, 12, Math.PI * 1.35), steelMat);
    cJaw.rotation.y = Math.PI * 0.5;
    cJaw.position.set(0, 0.062, 0);
    tool1.add(cJaw);
    pouchGrp.add(tool1);

    for (const [oz, rx] of [[0.008, 0.05], [0.022, 0.14]]) {
      const plierHdl = new T.Mesh(new T.CylinderGeometry(0.0065, 0.0055, 0.105, 10), handleGripMat);
      plierHdl.position.set(0.006, 0.092, oz);
      plierHdl.rotation.x = rx;
      pouchGrp.add(plierHdl);
    }

    cantGrp.add(pouchGrp);
    beltGrp.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.isGarment = true;
        o.userData.origMaterial = o.material;
      }
    });
    return beltGrp;
  }

  /* MAKEDA'S SCULPTED CROSSBODY LEATHER SATCHEL & FLAT BEVELED STRAP (`0bc287c6.jpg` & `32b99d8c.jpg` 1:1!)
     - Wide flat stitched leather strap passing over right shoulder (-X), running diagonally across the *shamma* folds
       with guaranteed exterior clearance, clipping via metal D-ring & slide buckle to rounded flap-top leather bag at left hip (+X)! */
  function buildMakedaCrossbodySatchelGeo(T, spec, bust, B) {
    const build = spec.build || 1.0;
    const strapGeos = [], metalGeos = [];

    // 1. Flat Beveled Crossbody Strap Loop (Right Shoulder x=-0.105, y=1.464 -> Diagonal Front Chest -> Left Hip x=+0.222, y=0.89 -> Diagonal Back!)
    const nLoop = 60;
    const rawPts = [];
    for (let i = 0; i < nLoop; i++) {
      const u = i / nLoop, th = u * TAU;
      const cx = 0.056 * build, cy = 1.178, cz = -0.010;
      const dx = -0.168 * build, dy = 0.288;
      const cosT = Math.cos(th), sinT = Math.sin(th);
      let px = cx + dx * cosT;
      let py = cy + dy * cosT;
      const zDepth = (sinT >= 0 ? 0.196 : 0.198) * (1 - 0.22 * Math.pow(cosT, 2));
      let pz = cz + sinT * zDepth;

      if (py > 0.94 && py < 1.445) {
        const tNeck = smooth(1.345, 1.430, py);
        const shBell = smooth(1.15, 1.34, py) * (1 - tNeck);
        const wSh = lerp(lerp(0.228, 0.264, shBell), 0.104, tNeck) * build + 0.020;
        const fSh = lerp(0.178, 0.114, tNeck) + 0.020;
        const bSh = lerp(0.184, 0.120, tNeck) + 0.020;
        const a = Math.atan2(px, pz + 0.008);
        const sa = Math.sin(a), ca = Math.cos(a);
        const minX = Math.sign(sa) * Math.pow(Math.abs(sa), 0.90) * wSh;
        const minZ = -0.008 + Math.sign(ca) * Math.pow(Math.abs(ca), 0.90) * (ca >= 0 ? fSh : bSh);
        const rWant = Math.hypot(minX, minZ + 0.008);
        const rHave = Math.hypot(px, pz + 0.008) || 1e-4;
        if (rHave < rWant) {
          const sc = rWant / rHave;
          px *= sc;
          pz = -0.008 + (pz + 0.008) * sc;
        }
      }
      rawPts.push(new T.Vector3(px, py, pz));
    }

    // 3-pass closed Laplacian smoothing so strap curves smoothly over shoulder & shamma with ZERO kinks!
    let loopPts = rawPts;
    for (let pass = 0; pass < 3; pass++) {
      const nextPts = [];
      for (let i = 0; i < nLoop; i++) {
        const pPrev = loopPts[(i - 1 + nLoop) % nLoop];
        const pCur = loopPts[i];
        const pNext = loopPts[(i + 1) % nLoop];
        nextPts.push(new T.Vector3(
          pCur.x * 0.50 + (pPrev.x + pNext.x) * 0.25,
          pCur.y * 0.50 + (pPrev.y + pNext.y) * 0.25,
          pCur.z * 0.50 + (pPrev.z + pNext.z) * 0.25
        ));
      }
      loopPts = nextPts;
    }

    // Build flat rectangular beveled strap ribbon (width 3.2cm, thickness 4.5mm)
    {
      const seg = 64, wHalf = 0.016, hHalf = 0.0024;
      const crv = new T.CatmullRomCurve3(loopPts, true);
      const rProf = [
        [-wHalf,  0.000, 0.82],
        [-wHalf * 0.85,  hHalf, 1.02],
        [ wHalf * 0.85,  hHalf, 1.02],
        [ wHalf,  0.000, 0.82],
        [ wHalf * 0.85, -hHalf, 0.68],
        [-wHalf * 0.85, -hHalf, 0.68]
      ];
      const cols = rProf.length;
      const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
      const P = new T.Vector3(), Tng = new T.Vector3(), Nrm = new T.Vector3(), Bin = new T.Vector3();

      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        crv.getPointAt(u % 1, P);
        crv.getTangentAt(u % 1, Tng).normalize();
        Nrm.set(P.x, (P.y - 1.18) * 0.35, P.z + 0.01).normalize();
        Bin.crossVectors(Tng, Nrm).normalize();
        Nrm.crossVectors(Bin, Tng).normalize();

        const sk = evalGarmentTorsoSkin(P.x, P.y, P.z, build, B, bust);
        for (let c = 0; c < cols; c++) {
          const rp = rProf[c];
          const vx = P.x + Bin.x * rp[0] + Nrm.x * rp[1];
          const vy = P.y + Bin.y * rp[0] + Nrm.y * rp[1];
          const vz = P.z + Bin.z * rp[0] + Nrm.z * rp[1];
          pos.push(vx, vy, vz);
          uv.push(c / (cols - 1), u * 8);
          col.push(rp[2], rp[2], rp[2]);
          si.push(sk.indices[0], sk.indices[1], sk.indices[2], sk.indices[3]);
          sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
        }
      }
      for (let i = 0; i < seg; i++) {
        for (let c = 0; c < cols; c++) {
          const cn = (c + 1) % cols;
          const A = i * cols + c, Bv = i * cols + cn, C = (i + 1) * cols + c, D = (i + 1) * cols + cn;
          idx.push(A, Bv, C, Bv, D, C);
        }
      }
      const sg = new T.BufferGeometry();
      sg.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      sg.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      sg.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      sg.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      sg.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
      sg.setIndex(idx);
      sg.computeVertexNormals();
      strapGeos.push(sg);

      // Front D-ring / buckle right above the bag attachment (visible in 0bc287c6.jpg!)
      crv.getPointAt(0.42, P);
      const bRing = new T.TorusGeometry(0.017, 0.0032, 6, 16);
      bRing.scale(1.0, 0.65, 1.0);
      bRing.rotateY(0.55);
      bRing.translate(P.x + 0.004, P.y, P.z + 0.006);
      assignRigidBoneSkin(T, bRing, B.LUMBAR, 1.0);
      metalGeos.push(bRing);
    }

    // 2. Sculpted Rounded Flap-Top Leather Satchel Bag resting at Makeda's Left Hip (+X, y = 0.84m, 0bc287c6.jpg & 32b99d8c.jpg!)
    {
      const bagX = 0.218 * build, bagY = 0.835, bagZ = 0.018;
      const bagRings = refineRings([
        { p: [bagX, bagY - 0.115, bagZ], w: 0.022, f: 0.088, b: 0.088, e: 0.82 },
        { p: [bagX, bagY - 0.085, bagZ], w: 0.052, f: 0.118, b: 0.118, e: 0.78 },
        { p: [bagX, bagY + 0.015, bagZ], w: 0.055, f: 0.122, b: 0.122, e: 0.80 },
        { p: [bagX, bagY + 0.085, bagZ], w: 0.044, f: 0.112, b: 0.112, e: 0.84 },
        { p: [bagX, bagY + 0.104, bagZ], w: 0.008, f: 0.045, b: 0.045, e: 0.92 }
      ], 2);
      const seg = 24, cols = seg + 1, n = bagRings.length;
      const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
      for (let i = 0; i < n; i++) {
        const r = bagRings[i], v = i / (n - 1);
        for (let j = 0; j <= seg; j++) {
          const u = j / seg, a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
          // Overhanging curved leather top flap on outer (+X) face!
          const isFlap = sa > 0.15 && v > 0.42;
          const flapOut = isFlap ? 0.0075 * smooth(0.42, 0.52, v) : 0;
          const px = r.p[0] + Math.sign(sa) * Math.pow(Math.abs(sa), r.e) * (r.w + flapOut);
          const py = r.p[1] - (px - bagX) * 0.14;
          const pz = r.p[2] + Math.sign(ca) * Math.pow(Math.abs(ca), r.e) * r.f;
          pos.push(px, py, pz);
          uv.push(u * 2, v * 2);
          const flapSeam = (sa > 0.15 && Math.abs(v - 0.43) < 0.04) ? 0.72 : 1.0;
          const c = (0.82 + 0.18 * v) * flapSeam;
          col.push(c, c, c);
          si.push(B.PELVIS, B.COAT_L, 0, 0);
          sw.push(0.75, 0.25, 0, 0);
        }
      }
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < seg; j++) {
          const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
          idx.push(A, Bv, C, Bv, D, C);
        }
      }
      const bg = new T.BufferGeometry();
      bg.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      bg.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      bg.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      bg.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      bg.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
      bg.setIndex(idx);
      bg.computeVertexNormals();
      strapGeos.push(bg);
    }

    return {
      leatherGeo: mergeSkinnedGeos(T, strapGeos),
      metalGeo: mergeSkinnedGeos(T, metalGeos)
    };
  }

  /* Master Garments, Collars, Tool-Belt, Satchel & Laced Lug-Sole Boots Builder */
  function buildGarmentsAndBoots(T, spec = {}, ctx = {}) {
    const assets = getAssets(T);
    const B = ctx.B || B_DEFAULT;
    const skelInfo = ctx.skelInfo;
    const bones = skelInfo.bones;
    const addSkinned = ctx.addSkinned;
    const skinMatWrist = ctx.skinMatWrist;
    const cyanGlow = ctx.cyanGlowUniform;
    const bust = ctx.bust || createBustEvaluator(spec);

    const id = String(spec.id || "").toLowerCase();
    const name = String(spec.name || "").toLowerCase();
    const isYouth = (spec.scale || 1.0) < 0.88 || id.includes("june") || name.includes("june");
    const isImani = id.includes("imani") || name.includes("imani") || (spec.outer === "duster" && spec.toolBelt);
    const isMakeda = id.includes("makeda") || name.includes("makeda") || spec.hair === "cornrowBraids";
    const isHanna = id.includes("hanna") || name.includes("hanna") || id.includes("op_f") || spec.hair === "ponytail";
    const isElder = !spec.ownColors && (Boolean(spec.beard) || spec.hair === "turban" || ((spec.fem !== undefined ? spec.fem : 0.65) < 0.35 && spec.outer === "shamma"));   /* ownColors: a spec that names its own garment colours keeps them */
    const outerStyle = isYouth ? "none" : (isMakeda ? "shamma" : (spec.outer || "duster"));

    const meshes = [];
    const springChains = [];
    const reg = (geo, mat, tightCullBounds = false) => {
      if (!geo || !geo.attributes.position || geo.attributes.position.count === 0) return null;
      const m = addSkinned(geo, mat);
      if (tightCullBounds) {
        geo.computeBoundingSphere();
        if (geo.boundingSphere) {
          m.boundingSphere = geo.boundingSphere.clone();
          m.boundingSphere.radius += 0.14; // allow leg swing while culling off-screen boots/trousers in E1 head macro!
        }
      }
      m.userData.isGarment = true;
      m.userData.origMaterial = mat;
      meshes.push(m);
      return m;
    };

    // Harmonized earthy / slate / oatmeal garment colors calibrated so studio sun highlights NEVER blow out to chalk white!
    const shirtHex = isImani ? 0x5c6670
      : isYouth ? (spec.shirtHex !== undefined ? spec.shirtHex : 0x9c9080)
      : isMakeda ? 0x624e3e
      : isElder ? 0x5e4a3b
      : isHanna ? 0x3a403c
      : (spec.shirtHex !== undefined ? spec.shirtHex : 0x565a56);

    const coatHex = isImani ? 0x84573b
      : isMakeda ? 0xa69b8a
      : isElder ? 0xa29684
      : (spec.coatHex !== undefined ? spec.coatHex : 0x6a5b4c);

    const trouserHex = isImani ? 0x68503f
      : isYouth ? 0x746150
      : isMakeda ? 0x5c4b3e
      : isElder ? 0x4e4136
      : isHanna ? 0x43464c
      : (spec.trouserHex !== undefined ? spec.trouserHex : 0x4c4e50);

    const shirtMat = makeFabricMaterial(T, shirtHex, isYouth ? "knit" : "canvas", assets, cyanGlow);
    const outerMat = makeFabricMaterial(T, coatHex, outerStyle === "shamma" ? "shamma" : "canvas", assets, cyanGlow);
    const trouserMat = makeFabricMaterial(T, trouserHex, "canvas", assets, cyanGlow);

    // 1. Inner Tunic / Scoop-Neck Shirt (June's child collar hugs symmetrically on both shoulders with zero slip!)
    const tunicGeo = buildSculptedTunicGeo(T, spec, bust, B, {
      hemY: isYouth ? 0.56 : (outerStyle === "shamma" ? 0.60 : (isImani ? 0.72 : 0.77)),
      sideSlit: isYouth || isHanna,
      asymHem: isMakeda ? -0.045 : 0.0,
      yFrontCollar: isImani ? 1.344 : (isYouth ? 1.404 : 1.356),
      ySideCollar:  isImani ? 1.394 : (isYouth ? 1.438 : 1.416),
      yBackCollar:  isImani ? 1.398 : (isYouth ? 1.444 : 1.424)
    });
    reg(tunicGeo, shirtMat);

    // 2. Sculpted Sleeves + Seamless Bare Forearm/Wrist Bridges
    const slvMode = isImani ? "pushedAccordion"
      : (isHanna || spec.rolledSleeves) ? "rolledElbow"
      : (isMakeda || isYouth) ? "ribbedForearm"
      : "fullWrist";
    const slvMat = (outerStyle === "duster" || outerStyle === "parka") ? outerMat : shirtMat;
    const armBundle = buildSleevesAndForearms(T, spec, skelInfo, B, slvMode);
    reg(armBundle.clothGeo, slvMat);
    if (armBundle.skinGeo && skinMatWrist) {
      const sm = addSkinned(armBundle.skinGeo, skinMatWrist);
      sm.userData.isSkin = true;
      sm.userData.origMaterial = skinMatWrist;
      meshes.push(sm);
    }

    // 3. Signature Outer Layer: Tailored V-Notched Lapel Duster OR Multi-Fold Ethiopian *Shamma*/*Gabi* Wrap!
    if (outerStyle === "duster" || outerStyle === "parka") {
      reg(buildImaniNotchedLapelDusterGeo(T, spec, bust, B), outerMat);
    } else if (outerStyle === "shamma" || outerStyle === "apron") {
      reg(buildEthiopianShammaWrapGeo(T, spec, bust, B, isElder), outerMat);
    }

    // 4. Sculpted Pleated / Cargo / Knee-Patched Trousers (tight frustum bounds so head macro E1 culls off-screen legs!)
    const trBundle = buildSculptedTrousersGeo(T, spec, skelInfo, B, {
      kneePatches: isYouth || Boolean(spec.patchedKnees && !isImani && !isMakeda),
      cargoPockets: isHanna || isImani
    });
    reg(trBundle.trouserGeo, trouserMat, true);

    // 5. Eyelet-Laced Lug-Sole Work Boots (Skinned to FOOT + TOE + LLEG, tight frustum bounds!)
    const bootLeatherMat = makeFabricMaterial(T, isImani || isElder ? 0x563d2c : 0x3d2e24, "leather", assets, cyanGlow);
    const bootSoleMat = new T.MeshStandardMaterial({ color: 0x1c1b1a, vertexColors: true, roughness: 0.90 });
    bootSoleMat.userData = { isGarment: true, clayReady: true, surfaceTag: "leather" };
    const bootMetalMat = new T.MeshStandardMaterial({ color: 0xb29c78, vertexColors: true, roughness: 0.34, metalness: 0.78 });
    bootMetalMat.userData = { isGarment: true, clayReady: true, surfaceTag: "metal" };

    const boots = buildSkinnedLugBoots(T, spec, skelInfo, B);
    reg(boots.soleGeo, bootSoleMat, true);
    reg(boots.leatherGeo, bootLeatherMat, true);
    reg(boots.metalGeo, bootMetalMat, true);

    // 6. Imani's Buckled Utility Belt + Hip Wrench Holster Pouch
    if (spec.toolBelt || isImani) {
      const beltGrp = buildImaniUtilityBelt(T, spec, assets, cyanGlow);
      bones[B.PELVIS].add(beltGrp);
    }

    // 7. Makeda's Crossbody Leather Satchel & Flat Beveled Strap
    if (spec.satchel || isMakeda) {
      const satMat = makeFabricMaterial(T, 0x36281f, "leather", assets, cyanGlow);
      const satBundle = buildMakedaCrossbodySatchelGeo(T, spec, bust, B);
      reg(satBundle.leatherGeo, satMat);
      reg(satBundle.metalGeo, bootMetalMat);
    }

    // 8. Attach `three-vrm`-style spring-bone dynamics on B.COAT_L, B.COAT_R, B.COAT_B (with leg colliders!)
    if (bones[B.COAT_L] && bones[B.COAT_R] && bones[B.COAT_B]) {
      for (const [bIdx, ax] of [[B.COAT_L, [0.16, -0.98, 0.05]], [B.COAT_R, [-0.16, -0.98, 0.05]], [B.COAT_B, [0, -0.96, -0.26]]]) {
        const b = bones[bIdx];
        b.userData.springLen = 0.24;
        b.userData.springAxis = new T.Vector3(ax[0], ax[1], ax[2]).normalize();
      }
      const legCols = [
        { bone: bones[B.ULEG_L], offset: new T.Vector3(0.02, -0.18, 0.02), radius: 0.095 },
        { bone: bones[B.ULEG_R], offset: new T.Vector3(-0.02, -0.18, 0.02), radius: 0.095 },
        { bone: bones[B.PELVIS], offset: new T.Vector3(0, -0.06, -0.03), radius: 0.125 }
      ];
      springChains.push(createSpringBoneChain(T, [bones[B.COAT_L]], { stiffness: 0.34, drag: 0.46, gravityPower: 0.05, colliders: legCols }));
      springChains.push(createSpringBoneChain(T, [bones[B.COAT_R]], { stiffness: 0.34, drag: 0.46, gravityPower: 0.05, colliders: legCols }));
      springChains.push(createSpringBoneChain(T, [bones[B.COAT_B]], { stiffness: 0.34, drag: 0.46, gravityPower: 0.05, colliders: legCols }));
    }

    return {
      meshes,
      springChains,
      update(dt, nowSec = 0, windPhase = 0) {
        for (let i = 0; i < springChains.length; i++) {
          springChains[i].update(dt, nowSec, windPhase + i * 0.8);
        }
      }
    };
  }

  /* ============================================================================
     6. UPGRADED CAST-IRON BALL-KNOB STANDPIPE, CONCRETE PLINTH STEP,
        WHEEL-THROWN RIBBED TERRACOTTA *SHEKLA* BASIN & PARABOLIC CYAN STREAM
        (`0bc287c6.jpg` & `32b99d8c.jpg` 1:1 — ZERO PITCH-BLACK METAL!)
     ============================================================================ */
  function buildStandpipeAndBasin(T, opts = {}) {
    const assets = getAssets(T);
    const group = new T.Group();
    group.name = "scionStandpipeBasinRig";

    const plinthH = opts.plinthHeight !== undefined ? opts.plinthHeight : 0.38;
    const plinthW = opts.plinthWidth  !== undefined ? opts.plinthWidth  : 1.46;
    const plinthD = opts.plinthDepth  !== undefined ? opts.plinthDepth  : 0.88;

    // 1. Textured Pale Weathered Limestone / Concrete Plinth Step (32b99d8c.jpg & 735822c2.jpg — warm pale stone, never dark!)
    const concreteMat = new T.MeshStandardMaterial({
      map: assets.concreteAlbedo,
      normalMap: assets.concreteNormal,
      normalScale: new T.Vector2(0.85, 0.85),
      color: 0xe2ddd2,
      roughness: 0.84,
      metalness: 0.01
    });
    concreteMat.userData = { surfaceTag: "stone" };
    const plinth = new T.Mesh(new T.BoxGeometry(plinthW, plinthH, plinthD, 4, 2, 4), concreteMat);
    plinth.position.set(0, plinthH * 0.5, 0);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    const coping = new T.Mesh(new T.BoxGeometry(plinthW + 0.02, 0.028, plinthD + 0.02), concreteMat);
    coping.position.set(0, plinthH - 0.014, 0);
    coping.castShadow = true;
    coping.receiveShadow = true;
    group.add(coping);

    // 2. Weathered Dark Graphite-Charcoal Micro-Pitted Cast Iron (`0x343840`, `roughness: 0.38`, `metalness: 0.32`, `clearcoat: 0.34`!)
    // Deep charcoal body matching 0bc287c6.jpg & 32b99d8c.jpg while crisp specular highlights define every collar ring, curve & ball-knob!
    const castIronMat = new T.MeshPhysicalMaterial({
      color: 0x343840,
      roughness: 0.38,
      metalness: 0.32,
      clearcoat: 0.34,
      clearcoatRoughness: 0.32,
      normalMap: assets.castIronNormal,
      normalScale: new T.Vector2(0.95, 0.95),
      envMapIntensity: 1.25
    });
    castIronMat.userData = { surfaceTag: "iron" };

    const standpipe = new T.Group();
    standpipe.name = "standpipe";
    const pumpX = opts.pumpOffsetX !== undefined ? opts.pumpOffsetX : 0.02;
    standpipe.position.set(pumpX, plinthH, -0.02);
    group.add(standpipe);

    // Bolted circular base flange
    const baseFlange = new T.Mesh(new T.CylinderGeometry(0.146, 0.160, 0.030, 32), castIronMat);
    baseFlange.position.y = 0.015;
    baseFlange.castShadow = true; baseFlange.receiveShadow = true;
    standpipe.add(baseFlange);

    // 1.32x Taller Main Cylindrical Cast-Iron Column (r = 0.090m, h = 0.94m -> towers cleanly above June in 32b99d8c.jpg!)
    const colShaft = new T.Mesh(new T.CylinderGeometry(0.090, 0.094, 0.94, 36), castIronMat);
    colShaft.position.y = 0.485;
    colShaft.castShadow = true; colShaft.receiveShadow = true;
    standpipe.add(colShaft);

    // 3 Prominent Rounded Torus Collar Rings along column (0bc287c6.jpg & 32b99d8c.jpg 1:1!)
    for (const ry of [0.38, 0.81, 0.93]) {
      const ring = new T.Mesh(new T.TorusGeometry(0.100, 0.016, 14, 36), castIronMat);
      ring.rotation.x = Math.PI * 0.5;
      ring.position.y = ry;
      ring.castShadow = true; ring.receiveShadow = true;
      standpipe.add(ring);
    }

    // Flared frustum upper pump bonnet cap + flat lid + vertical top piston rod (world top ~1.73m!)
    const bonnet = new T.Mesh(new T.CylinderGeometry(0.118, 0.096, 0.21, 36), castIronMat);
    bonnet.position.y = 1.050;
    bonnet.castShadow = true; bonnet.receiveShadow = true;
    standpipe.add(bonnet);

    const bonnetLid = new T.Mesh(new T.CylinderGeometry(0.122, 0.119, 0.020, 36), castIronMat);
    bonnetLid.position.y = 1.162;
    bonnetLid.castShadow = true;
    standpipe.add(bonnetLid);

    const pistonRod = new T.Mesh(new T.CylinderGeometry(0.021, 0.021, 0.21, 20), castIronMat);
    pistonRod.name = "scionPistonRod";
    pistonRod.position.y = 1.265;
    pistonRod.userData.baseY = 1.265;
    pistonRod.castShadow = true;
    standpipe.add(pistonRod);

    // Articulated Pump Handle Lever extending LEFT (-X) at shoulder height (`fulcrumY = 1.050`) terminating in a SPHERICAL BALL-KNOB!
    const fulcrumY = 1.050;
    const leverSocket = new T.Mesh(new T.CylinderGeometry(0.030, 0.030, 0.048, 16), castIronMat);
    leverSocket.rotation.z = Math.PI * 0.5;
    leverSocket.position.set(-0.098, fulcrumY, 0);
    standpipe.add(leverSocket);

    const leverPivot = new T.Group();
    leverPivot.name = "scionLeverPivot";
    leverPivot.position.set(-0.098, fulcrumY, 0);
    standpipe.add(leverPivot);

    const leverLen = 0.52;
    const leverBarGeo = new T.CylinderGeometry(0.0165, 0.0205, leverLen, 20);
    leverBarGeo.rotateZ(Math.PI * 0.5);
    leverBarGeo.translate(-leverLen * 0.5, 0, 0);
    const leverBar = new T.Mesh(leverBarGeo, castIronMat);
    leverBar.castShadow = true; leverBar.receiveShadow = true;
    leverPivot.add(leverBar);

    // Distinct Spherical Ball-Knob at lever end (r = 0.038m, matching 0bc287c6.jpg & 32b99d8c.jpg!)
    const ballKnob = new T.Mesh(new T.SphereGeometry(0.038, 24, 18), castIronMat);
    ballKnob.name = "pumpBallKnob";
    ballKnob.position.set(-leverLen - 0.020, 0, 0);
    ballKnob.castShadow = true; ballKnob.receiveShadow = true;
    leverPivot.add(ballKnob);

    // Exact World-Space Hand Grip Anchors on TOP of the lever right behind the spherical ball-knob!
    const gripFar = new T.Object3D();
    gripFar.name = "pumpGripFar";
    gripFar.position.set(-leverLen + 0.056, 0.010, 0);
    leverPivot.add(gripFar);

    const gripNear = new T.Object3D();
    gripNear.name = "pumpGripNear";
    gripNear.position.set(-leverLen + 0.092, 0.010, 0);
    leverPivot.add(gripNear);

    const gripCenter = new T.Object3D();
    gripCenter.name = "pumpGripCenter";
    gripCenter.position.set(-leverLen + 0.072, 0.010, 0);
    leverPivot.add(gripCenter);

    const gripTip = new T.Object3D();
    gripTip.name = "pumpGripTip";
    gripTip.position.set(-leverLen - 0.020, 0, 0);
    leverPivot.add(gripTip);

    leverPivot.rotation.z = 0.06;

    // Smooth Outward-Angled Cast-Iron Spout extending RIGHT (+X) from between lower & middle collar rings (y = 0.76m -> 0.65m)!
    const spoutCurve = new T.CatmullRomCurve3([
      new T.Vector3(0.082, 0.760, 0),
      new T.Vector3(0.165, 0.755, 0),
      new T.Vector3(0.240, 0.722, 0),
      new T.Vector3(0.296, 0.658, 0)
    ]);
    const spoutMesh = new T.Mesh(new T.TubeGeometry(spoutCurve, 20, 0.035, 20, false), castIronMat);
    spoutMesh.castShadow = true; spoutMesh.receiveShadow = true;
    standpipe.add(spoutMesh);

    const spoutCollar = new T.Mesh(new T.TorusGeometry(0.040, 0.0080, 10, 20), castIronMat);
    spoutCollar.rotation.y = Math.PI * 0.5;
    spoutCollar.position.set(0.094, 0.760, 0);
    standpipe.add(spoutCollar);

    const spoutRim = new T.Mesh(new T.TorusGeometry(0.035, 0.0048, 8, 20), castIronMat);
    spoutRim.position.set(0.296, 0.658, 0);
    spoutRim.rotation.set(0, Math.PI * 0.5, 0.66);
    standpipe.add(spoutRim);

    const spoutNozzleAnchor = new T.Object3D();
    spoutNozzleAnchor.position.set(0.300, 0.654, 0);
    standpipe.add(spoutNozzleAnchor);

    // 3. Taller, Rounder Hemispherical Wheel-Thrown Horizontal-Ribbed Terracotta *Shekla* Basin (`0bc287c6.jpg` & `32b99d8c.jpg` 1:1!)
    const terracottaMat = new T.MeshPhysicalMaterial({
      color: 0xa86b4a,
      vertexColors: true,
      side: T.DoubleSide,
      roughness: 0.78,
      metalness: 0.0,
      sheen: 0.24,
      sheenRoughness: 0.84,
      normalMap: assets.terracottaNormal,
      normalScale: new T.Vector2(1.18, 1.18)
    });
    terracottaMat.userData = { surfaceTag: "terracotta" };

    const basin = new T.Group();
    basin.name = "sheklaBasin";
    const basinX = opts.basinOffsetX !== undefined ? opts.basinOffsetX : 0.48;
    const basinH = 0.215;
    const basinTopR = 0.312;
    basin.position.set(basinX, plinthH, 0.02);
    group.add(basin);

    // Wide Shallow Rounded Ribbed *Shekla* Bowl (`belly radius ~0.31m, depth ~0.21m, wide flat foot ~0.22m` — ZERO martini-cone taper!)
    {
      const lathePts = [];
      const nProf = 52;
      for (let i = 0; i <= nProf; i++) {
        const u = i / nProf;
        let r, y;
        if (u <= 0.16) {
          const t = u / 0.16;
          r = lerp(0.001, basinTopR - 0.036, t);
          y = lerp(0.045, basinH - 0.026, Math.pow(t, 1.35));
        } else if (u <= 0.34) {
          const t = (u - 0.16) / 0.18;
          const ang = lerp(Math.PI, 0, t);
          r = (basinTopR - 0.018) - Math.cos(ang) * 0.018;
          y = (basinH - 0.015) + Math.sin(ang) * 0.015;
        } else if (u <= 0.88) {
          const t = (u - 0.34) / 0.54;
          y = lerp(basinH - 0.016, 0.028, t);
          // Full quarter-ellipse rounded clay belly (`cos(t * PI * 0.46)` keeps upper 60% vertical/convex, curving smoothly into wide 0.218m foot!)
          const belly = Math.cos(t * Math.PI * 0.47);
          const curveR = lerp(0.218, basinTopR, Math.pow(belly, 0.58)) + 0.014 * Math.sin(t * Math.PI * 0.65);
          // 4 Crisp Horizontal Wheel-Thrown Rib Grooves on upper exterior (0bc287c6.jpg!)
          const inRibZone = smooth(0.03, 0.11, t) * (1 - smooth(0.52, 0.64, t));
          const ribWave = Math.sin(t * Math.PI * 15.0) * 0.0065 * inRibZone;
          r = curveR + ribWave;
        } else {
          const t = (u - 0.88) / 0.12;
          r = lerp(0.218, 0.226, Math.sin(t * Math.PI * 0.75));
          y = lerp(0.028, 0.000, t);
        }
        lathePts.push(new T.Vector2(Math.max(0.001, r), y));
      }
      const bGeo = new T.LatheGeometry(lathePts, 56);
      const P = bGeo.attributes.position;
      const cArr = new Float32Array(P.count * 3);
      for (let k = 0; k < P.count; k++) {
        const py = P.getY(k), pr = Math.hypot(P.getX(k), P.getZ(k));
        const grooveAO = (py > 0.09 && py < 0.205 && pr > 0.28)
          ? (0.85 + 0.17 * Math.sin(py * 210.0))
          : 1.0;
        const baseShade = clamp((0.76 + 0.24 * (py / basinH)) * grooveAO, 0.52, 1.08);
        cArr[k * 3] = baseShade;
        cArr[k * 3 + 1] = baseShade * 0.98;
        cArr[k * 3 + 2] = baseShade * 0.95;
      }
      bGeo.setAttribute("color", new T.BufferAttribute(cArr, 3));
      bGeo.computeVertexNormals();
      const basinMesh = new T.Mesh(bGeo, terracottaMat);
      basinMesh.castShadow = true;
      basinMesh.receiveShadow = true;
      basin.add(basinMesh);
    }

    // Medium-Dark Slate Water Surface Disc with Subtle Sheen (`0bc287c6.jpg` — NEVER pure black void!)
    const waterYLocal = basinH - 0.022;
    const waterSurfMat = new T.MeshStandardMaterial({
      color: 0x76828a,
      roughness: 0.34,
      metalness: 0.05
    });
    waterSurfMat.userData = { surfaceTag: "stone" };
    const waterSurface = new T.Mesh(new T.CircleGeometry(basinTopR - 0.022, 48), waterSurfMat);
    waterSurface.rotation.x = -Math.PI * 0.5;
    waterSurface.position.y = waterYLocal;
    waterSurface.receiveShadow = true;
    basin.add(waterSurface);

    // Exact Rim Touch Anchors ON TOP of the wide grooved rim!
    const rimAnchorEnsembleL = new T.Object3D();
    rimAnchorEnsembleL.position.set(-basinTopR * 0.65, basinH + 0.008, basinTopR * 0.74);
    basin.add(rimAnchorEnsembleL);

    const rimAnchorEnsembleR = new T.Object3D();
    rimAnchorEnsembleR.position.set(-basinTopR * 0.50, basinH + 0.008, basinTopR * 0.84);
    basin.add(rimAnchorEnsembleR);

    const rimAnchorCloseupR = new T.Object3D();
    rimAnchorCloseupR.position.set(basinTopR * 0.64, basinH + 0.012, basinTopR * 0.64);
    basin.add(rimAnchorCloseupR);

    const rimAnchorCloseupL = new T.Object3D();
    rimAnchorCloseupL.position.set(basinTopR * 0.80, basinH + 0.012, basinTopR * 0.44);
    basin.add(rimAnchorCloseupL);

    // 4. Round Cylindrical 3D Parabolic `#28d8f0` Cyan Stream + Thin Concentric Ripple Rings (`0bc287c6.jpg` 1:1!)
    const pourGroup = new T.Group();
    pourGroup.name = "scionPourGroup";
    standpipe.add(pourGroup);

    const streamMat = new T.MeshPhysicalMaterial({
      color: 0x28d8f0,
      emissive: 0x109cc4,
      emissiveIntensity: 0.62,
      roughness: 0.12,
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.96
    });
    streamMat.userData = { isWaterCyan: true, surfaceTag: "cyan_water" };

    const streamCoreMat = new T.MeshBasicMaterial({
      color: 0xd8fcff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    streamCoreMat.userData = { isWaterCyan: true };

    const makeStreamTubeGeo = (segS, segR) => {
      const cols = segR + 1, vCnt = (segS + 1) * cols;
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(new Float32Array(vCnt * 3), 3));
      geo.setAttribute("normal", new T.BufferAttribute(new Float32Array(vCnt * 3), 3));
      const uvs = new Float32Array(vCnt * 2);
      const idx = [];
      for (let i = 0; i <= segS; i++) {
        for (let j = 0; j <= segR; j++) {
          const k = (i * cols + j) * 2;
          uvs[k] = j / segR; uvs[k + 1] = i / segS;
        }
      }
      for (let i = 0; i < segS; i++) {
        for (let j = 0; j < segR; j++) {
          const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      geo.setAttribute("uv", new T.BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.boundingSphere = new T.Sphere(new T.Vector3(0.35, 0.45, 0), 1.2);
      return geo;
    };

    const streamMesh = new T.Mesh(makeStreamTubeGeo(26, 14), streamMat);
    streamMesh.name = "scionStream";
    streamMesh.frustumCulled = false;
    pourGroup.add(streamMesh);

    const streamCoreMesh = new T.Mesh(makeStreamTubeGeo(18, 10), streamCoreMat);
    streamCoreMesh.name = "scionStreamCore";
    streamCoreMesh.frustumCulled = false;
    streamCoreMesh.renderOrder = 2;
    pourGroup.add(streamCoreMesh);

    // 4 Subtle, Tight Liquid White-and-Cyan Concentric Ripple Rings localized around impact (`0bc287c6.jpg` 1:1!)
    const rippleRings = [];
    for (let r = 0; r < 4; r++) {
      const outerCyanMat = new T.MeshBasicMaterial({
        color: 0x33ccf2,
        transparent: true,
        opacity: 0.42,
        side: T.DoubleSide,
        depthWrite: false
      });
      outerCyanMat.userData = { isWaterCyan: true };
      const innerWhiteMat = new T.MeshBasicMaterial({
        color: 0xebfcff,
        transparent: true,
        opacity: 0.68,
        side: T.DoubleSide,
        depthWrite: false
      });

      const rGrp = new T.Group();
      rGrp.renderOrder = 4 + r;
      const cyanRing = new T.Mesh(new T.RingGeometry(0.025, 0.029, 48), outerCyanMat);
      cyanRing.rotation.x = -Math.PI * 0.5;
      const whiteRing = new T.Mesh(new T.RingGeometry(0.0264, 0.0276, 48), innerWhiteMat);
      whiteRing.rotation.x = -Math.PI * 0.5;
      whiteRing.position.y = 0.0005;
      rGrp.add(cyanRing);
      rGrp.add(whiteRing);
      basin.add(rGrp);
      rippleRings.push({ group: rGrp, cyanMat: outerCyanMat, whiteMat: innerWhiteMat, phaseOffset: r / 4 });
    }

    const impactHalo = new T.Mesh(
      new T.RingGeometry(0.009, 0.016, 32),
      new T.MeshBasicMaterial({ color: 0xbafaff, transparent: true, opacity: 0.78, side: T.DoubleSide, depthWrite: false })
    );
    impactHalo.rotation.x = -Math.PI * 0.5;
    impactHalo.renderOrder = 9;
    basin.add(impactHalo);

    function stepPump(nowSec = 0, stepOpts = {}) {
      const gentle = stepOpts.gentle !== false;
      const amp = stepOpts.leverAmp !== undefined ? stepOpts.leverAmp : (gentle ? 0.022 : 0.18);
      const baseAngle = stepOpts.baseAngle !== undefined ? stepOpts.baseAngle : 0.06;
      const leverYaw = stepOpts.leverYaw !== undefined ? stepOpts.leverYaw : 0.0;
      const cyc = Math.sin(nowSec * (gentle ? 1.85 : 3.4));
      leverPivot.rotation.set(0, leverYaw, baseAngle + cyc * amp);
      pistonRod.position.y = 1.265 + cyc * amp * 0.075;

      // Round 3D Parabolic `#28d8f0` Cyan Stream plunging cleanly into basin center (`>= 0.36m` vertical drop so it NEVER skims flat!)
      const x0 = 0.296, y0 = 0.656, z0 = 0.0;
      const hitY = (basin.position.y - standpipe.position.y) + waterYLocal;
      const targetHitX = (basin.position.x - standpipe.position.x) - 0.015;
      const targetHitZ = (basin.position.z - standpipe.position.z);

      const gAcc = 9.81;
      const vy0 = -0.36;
      const dyDrop = Math.max(0.06, y0 - hitY);
      const tFlight = (vy0 + Math.sqrt(vy0 * vy0 + 2.0 * gAcc * dyDrop)) / gAcc;
      const vx = (targetHitX - x0) / tFlight;
      const vz = (targetHitZ - z0) / tFlight;
      const flowPulse = 1.0 + 0.04 * Math.sin(nowSec * 3.7);

      const writeArc = (mesh, segS, segR, radScale) => {
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

          let bx = 0, by = 0, bz = 1;
          const nx0 = by * tz - bz * ty, ny0 = bz * tx - bx * tz, nz0 = bx * ty - by * tx;

          const baseR = 0.0155 * radScale * flowPulse * lerp(1.0, 0.76, Math.pow(u, 0.75));
          for (let j = 0; j <= segR; j++) {
            const th = (j / segR) * TAU;
            const c = Math.cos(th), s = Math.sin(th);
            const rip = 1.0 + 0.036 * Math.sin(2.0 * th + u * 18.0 - nowSec * 14.0) * u;
            const r = baseR * rip;
            const rnx = nx0 * c + bx * s, rny = ny0 * c + by * s, rnz = nz0 * c + bz * s;
            const k3 = (i * cols + j) * 3;
            pos[k3]     = px + rnx * r;
            pos[k3 + 1] = py + rny * r;
            pos[k3 + 2] = pz + rnz * r;
            nrm[k3]     = rnx; nrm[k3 + 1] = rny; nrm[k3 + 2] = rnz;
          }
        }
        mesh.geometry.attributes.position.needsUpdate = true;
        mesh.geometry.attributes.normal.needsUpdate = true;
      };

      writeArc(streamMesh, 26, 14, 1.0);
      writeArc(streamCoreMesh, 18, 10, 0.46);

      const impLocalX = standpipe.position.x + targetHitX - basin.position.x;
      const impLocalZ = standpipe.position.z + targetHitZ - basin.position.z;
      impactHalo.position.set(impLocalX, waterYLocal + 0.0020, impLocalZ);
      impactHalo.scale.setScalar(0.92 + 0.08 * Math.sin(nowSec * 9.0));

      for (let r = 0; r < rippleRings.length; r++) {
        const rp = rippleRings[r];
        const ph = frac(nowSec * 0.50 + rp.phaseOffset);
        const sc = lerp(0.48, 2.25, ph);
        rp.group.position.set(impLocalX, waterYLocal + 0.0014 + r * 0.0003, impLocalZ);
        rp.group.scale.set(sc, 1, sc);
        const fade = (1.0 - ph) * smooth(0.0, 0.14, ph);
        rp.cyanMat.opacity = fade * 0.42;
        rp.whiteMat.opacity = fade * 0.68;
      }

      group.updateMatrixWorld(true);
    }

    stepPump(0.25, { gentle: true });

    return {
      group,
      plinth,
      standpipe,
      basin,
      leverPivot,
      ballKnob,
      gripFar,
      gripNear,
      gripCenter,
      gripTip,
      rimAnchorEnsembleL,
      rimAnchorEnsembleR,
      rimAnchorCloseupR,
      rimAnchorCloseupL,
      waterSurface,
      streamMesh,
      rippleRings,
      plinthHeight: plinthH,
      stepPump
    };
  }

  /* ============================================================================
     7. STONE SEMICIRCULAR-ARCH CHAPEL FACADE (`32b99d8c.jpg`, `0bc287c6.jpg`, `735822c2.jpg` 1:1!)
        - Cool slate-blue-grey irregular highland fieldstone masonry wall (#5d6d7e)
        - Stepped stone baseboard plinth
        - Central sculpted semicircular mortar/limestone arch surround + vertical timber plank doors
        - Flanking twin semicircular-arch shuttered windows
        - Vertical warm cedar corner post on right edge + sloped overhanging roof eaves!
     ============================================================================ */
  function buildStoneArchChapel(T, opts = {}) {
    const assets = getAssets(T);
    const chapel = new T.Group();
    chapel.name = "stoneArchChapel";

    const wallW = opts.width !== undefined ? opts.width : 3.20;
    const wallH = opts.height !== undefined ? opts.height : 2.58;
    const wallD = 0.34;

    const stoneMat = new T.MeshStandardMaterial({
      map: assets.stoneWallAlbedo,
      normalMap: assets.stoneWallNormal,
      normalScale: new T.Vector2(1.35, 1.35),
      color: 0xc2ccd8,
      roughness: 0.88,
      metalness: 0.02
    });
    stoneMat.userData = { surfaceTag: "stone" };

    const archMortarMat = new T.MeshStandardMaterial({
      map: assets.concreteAlbedo,
      normalMap: assets.concreteNormal,
      normalScale: new T.Vector2(0.65, 0.65),
      color: 0xdedad0,
      roughness: 0.84
    });
    archMortarMat.userData = { surfaceTag: "mortar" };

    const timberMat = new T.MeshStandardMaterial({
      map: assets.woodPlankAlbedo,
      normalMap: assets.woodPlankNormal,
      normalScale: new T.Vector2(1.05, 1.05),
      color: 0xc29874,
      roughness: 0.82
    });
    timberMat.userData = { surfaceTag: "wood" };

    const darkShutterMat = new T.MeshStandardMaterial({
      map: assets.woodPlankAlbedo,
      normalMap: assets.woodPlankNormal,
      normalScale: new T.Vector2(0.85, 0.85),
      color: 0x584c44,
      roughness: 0.86
    });
    darkShutterMat.userData = { surfaceTag: "shutter" };

    // Main Stone Wall (origin x=0 is at the RIGHT corner of the chapel so placing xRight behind Imani is exact!)
    const mainWall = new T.Mesh(new T.BoxGeometry(wallW, wallH, wallD), stoneMat);
    mainWall.position.set(-wallW * 0.5, wallH * 0.5, -wallD * 0.5);
    mainWall.castShadow = true;
    mainWall.receiveShadow = true;
    chapel.add(mainWall);

    // Coursed Baseboard Plinth Molding along bottom of wall (32b99d8c.jpg left!)
    const basePlinth = new T.Mesh(new T.BoxGeometry(wallW + 0.04, 0.24, 0.08), archMortarMat);
    basePlinth.position.set(-wallW * 0.5, 0.12, 0.02);
    basePlinth.receiveShadow = true;
    chapel.add(basePlinth);

    const plinthLip = new T.Mesh(new T.BoxGeometry(wallW + 0.05, 0.032, 0.10), archMortarMat);
    plinthLip.position.set(-wallW * 0.5, 0.245, 0.025);
    chapel.add(plinthLip);

    // Right Vertical Timber Corner Post (warm brown cedar planks right at x = -0.09m, 32b99d8c.jpg & 735822c2.jpg!)
    const cornerPost = new T.Mesh(new T.BoxGeometry(0.18, wallH - 0.18, 0.09), timberMat);
    cornerPost.position.set(-0.09, (wallH - 0.18) * 0.5, 0.035);
    cornerPost.castShadow = true;
    cornerPost.receiveShadow = true;
    chapel.add(cornerPost);

    // Sloped Overhanging Roof Eaves + Rafter Ends jutting out at top-right corner (~36° pitch, solid wall behind with zero sky gap!)
    const eaveGrp = new T.Group();
    eaveGrp.position.set(-0.38, wallH + 0.04, 0.06);
    eaveGrp.rotation.z = -0.62;
    const roofDeck = new T.Mesh(new T.BoxGeometry(1.24, 0.060, wallD + 0.34), darkShutterMat);
    eaveGrp.add(roofDeck);
    for (let r = 0; r < 5; r++) {
      const rafter = new T.Mesh(new T.BoxGeometry(1.18, 0.048, 0.048), timberMat);
      rafter.position.set(0.02, -0.048, -0.22 + r * 0.12);
      eaveGrp.add(rafter);
    }
    chapel.add(eaveGrp);

    // Central Semicircular Stone/Mortar Arch Surround + Vertical Weathered Plank Double Doors!
    const doorX = -1.46;
    const springY = 1.54;
    const archR = 0.49;

    const archTorus = new T.Mesh(new T.TorusGeometry(archR, 0.078, 16, 40, Math.PI), archMortarMat);
    archTorus.position.set(doorX, springY, 0.035);
    archTorus.scale.set(1.0, 1.0, 0.65);
    archTorus.castShadow = true;
    archTorus.receiveShadow = true;
    chapel.add(archTorus);

    // Recessed Lunette Tympanum + Rectangular Vertical Plank Doorway
    const tympanum = new T.Mesh(new T.CircleGeometry(archR - 0.04, 32, 0, Math.PI), archMortarMat);
    tympanum.position.set(doorX, springY, 0.012);
    chapel.add(tympanum);

    const doorPanel = new T.Mesh(new T.BoxGeometry((archR - 0.03) * 2, springY - 0.24, 0.04), timberMat);
    doorPanel.position.set(doorX, 0.24 + (springY - 0.24) * 0.5, 0.016);
    doorPanel.receiveShadow = true;
    chapel.add(doorPanel);

    const doorSill = new T.Mesh(new T.BoxGeometry(archR * 2 + 0.18, 0.08, 0.11), archMortarMat);
    doorSill.position.set(doorX, 0.26, 0.038);
    chapel.add(doorSill);

    // Twin Flanking Semicircular-Arch Shuttered Windows (`x = -2.38` left & `x = -0.56` right, 32b99d8c.jpg & 0bc287c6.jpg!)
    for (const wx of [-2.38, -0.56]) {
      const wY = 1.92;
      const wR = 0.155;
      const wArch = new T.Mesh(new T.TorusGeometry(wR, 0.036, 12, 28, Math.PI), archMortarMat);
      wArch.position.set(wx, wY, 0.032);
      wArch.scale.set(1, 1, 0.65);
      wArch.castShadow = true;
      chapel.add(wArch);

      const wShutter = new T.Mesh(new T.BoxGeometry(wR * 1.68, 0.58, 0.035), darkShutterMat);
      wShutter.position.set(wx, wY - 0.30, 0.022);
      wShutter.castShadow = true;
      wShutter.receiveShadow = true;
      chapel.add(wShutter);
    }

    return { group: chapel };
  }

  /* ============================================================================
     8. MISTLETOE WITH SOFT CANVAS PANNIERS, BOLD WOODEN X-FRAME SAWBUCK CROSSBARS
        & FLUSH SELECTIVE CYAN SIGHT-WINDOW (`32b99d8c.jpg` & `735822c2.jpg` 1:1!)
     ============================================================================ */
  function buildMistletoeWithSawbuckPack(T, opts = {}) {
    if (typeof window === "undefined" || typeof window.makeDonkey !== "function") return null;
    const assets = getAssets(T);
    const d = window.makeDonkey({
      assetPath: opts.assetPath || "../donkey/",
      shells: opts.shells !== undefined ? opts.shells : 12,
      monochrome: Boolean(opts.monochrome),
      contactShadow: true,
      alwaysHalter: true
    });
    // Use `slot: "T"` for `donkey.js`'s soft rolled canvas top bedroll + halter, and lock `alert` mood (`P.neck = -0.24`) so Mistletoe's head & ears stay HIGH and proud forever!
    d.setCargo([{ kg: 12, slot: "T" }]);
    if (d.mind) d.mind.auto = false;
    if (typeof d.setMood === "function") d.setMood("alert");

    const sawWoodMat = new T.MeshStandardMaterial({
      map: assets.woodPlankAlbedo,
      normalMap: assets.woodPlankNormal,
      normalScale: new T.Vector2(1.10, 1.10),
      color: 0xc89b72,
      roughness: 0.80
    });
    sawWoodMat.userData = { surfaceTag: "wood" };

    const packCanvasMat = makeFabricMaterial(T, 0xa29582, "canvas", assets, null);
    const packStrapMat = makeFabricMaterial(T, 0x362a21, "leather", assets, null);
    const frameBezelMat = new T.MeshStandardMaterial({ color: 0x26292e, roughness: 0.62 });
    const cyanWindowMat = new T.MeshStandardMaterial({
      color: 0x28d8f0,
      emissive: 0x18b6e0,
      emissiveIntensity: 1.15,
      roughness: 0.14
    });
    cyanWindowMat.userData = { isWaterCyan: true, surfaceTag: "cyan_water" };

    if (d.pack) {
      const sawGrp = new T.Group();
      sawGrp.name = "sawbuckXFrame";

      // 1. Sculpted Soft Rounded Canvas Side Panniers + Leather Cinch Straps (replaces boxy crate, matching 32b99d8c.jpg!)
      for (const s of [-1, 1]) {
        const panGeo = new T.SphereGeometry(0.24, 22, 16);
        panGeo.scale(0.54, 1.12, 1.28);
        const P = panGeo.attributes.position;
        const cArr = new Float32Array(P.count * 3);
        for (let k = 0; k < P.count; k++) {
          const px = P.getX(k), py = P.getY(k), pz = P.getZ(k);
          const crease = Math.sin(py * 24.0 + pz * 8.0) * 0.008;
          P.setX(k, px + Math.sign(px || s) * crease);
          const sh = clamp(0.84 + 0.14 * (py / 0.28) + crease * 14.0, 0.48, 1.05);
          cArr[k * 3] = sh; cArr[k * 3 + 1] = sh * 0.99; cArr[k * 3 + 2] = sh * 0.96;
        }
        panGeo.setAttribute("color", new T.BufferAttribute(cArr, 3));
        panGeo.computeVertexNormals();
        const pannier = new T.Mesh(panGeo, packCanvasMat);
        pannier.position.set(s * 0.30, 0.96, 0.06);
        pannier.rotation.z = -s * 0.14;
        pannier.castShadow = true;
        pannier.receiveShadow = true;
        sawGrp.add(pannier);

        // Two dark leather horizontal/vertical cinch straps around each canvas pannier (Hanna ties these!)
        for (const sy of [1.08, 0.90]) {
          const strap = new T.Mesh(new T.BoxGeometry(0.14, 0.028, 0.58), packStrapMat);
          strap.position.set(s * 0.34, sy, 0.06);
          strap.rotation.z = -s * 0.14;
          sawGrp.add(strap);
        }
      }

      // 2. Prominent Chunky Wooden X-Frame Sawbuck Crossbars right behind Mistletoe's front shoulder & rear croup (`32b99d8c.jpg` & `735822c2.jpg` 1:1!)
      for (const zPos of [0.38, -0.22]) {
        for (const s of [-1, 1]) {
          const plank = new T.Mesh(new T.BoxGeometry(0.086, 0.72, 0.042), sawWoodMat);
          plank.position.set(s * 0.17, 1.06, zPos + (s > 0 ? 0.022 : -0.022));
          plank.rotation.z = s * 0.50;
          plank.castShadow = true;
          plank.receiveShadow = true;
          sawGrp.add(plank);
        }
      }
      // Side longitudinal wooden pack rails
      for (const s of [-1, 1]) {
        const rail = new T.Mesh(new T.BoxGeometry(0.036, 0.064, 0.70), sawWoodMat);
        rail.position.set(s * 0.28, 1.06, 0.08);
        rail.castShadow = true;
        sawGrp.add(rail);
      }

      // 3. Recessed Flush `#28d8f0` Cyan Sight-Window nestled cleanly into the sloped upper canvas bedroll behind the ear (`32b99d8c.jpg` & `735822c2.jpg`!)
      for (const s of [1, -1]) {
        const winBezel = new T.Mesh(new T.BoxGeometry(0.022, 0.125, 0.110), frameBezelMat);
        winBezel.position.set(s * 0.392, 1.255, -0.02);
        winBezel.rotation.set(0.04, s * 0.08, -s * 0.36);
        sawGrp.add(winBezel);

        const winPane = new T.Mesh(new T.BoxGeometry(0.026, 0.098, 0.085), cyanWindowMat);
        winPane.position.set(s * 0.396, 1.255, -0.02);
        winPane.rotation.set(0.04, s * 0.08, -s * 0.36);
        sawGrp.add(winPane);
      }

      // World-space strap touch anchors for Hanna's left & right hands on Mistletoe's outer left (+X) canvas pack straps!
      const hannaGripUpper = new T.Object3D();
      hannaGripUpper.name = "hannaPackGripUpper";
      hannaGripUpper.position.set(0.41, 1.12, 0.02);
      sawGrp.add(hannaGripUpper);

      const hannaGripLower = new T.Object3D();
      hannaGripLower.name = "hannaPackGripLower";
      hannaGripLower.position.set(0.42, 0.96, 0.16);
      sawGrp.add(hannaGripLower);

      d.pack.add(sawGrp);
      d.hannaGripUpper = hannaGripUpper;
      d.hannaGripLower = hannaGripLower;
    }

    d.group.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return d;
  }

  /* ============================================================================
     9. CLOSED-LOOP TWO-SHOT PUMP & BOWL MACRO POSER (`posePumpCloseup` — `0bc287c6.jpg` 1:1!)
        & MASTER ENSEMBLE TABLEAU (`buildMasterTableau` — `32b99d8c.jpg` 1:1!)
     ============================================================================ */
  const ENSEMBLE_CAMERA_HINT = {
    fov: 30,
    position: [0.00, 1.15, 4.66],
    target: [0.00, 1.08, 0.00],
    dist: 4.66,
    yaw: 0.00,
    pitch: 0.015,
    targetX: 0.00,
    targetY: 1.08,
    targetZ: 0.00
  };

  const PUMP_CLOSEUP_CAMERA_HINT = {
    fov: 30,
    position: [0.02, 1.05, 2.00],
    target: [0.01, 0.96, 0.04],
    dist: 1.96,
    yaw: 0.004,
    pitch: 0.044,
    targetX: 0.01,
    targetY: 0.96,
    targetZ: 0.04
  };

  function setClayMode(targetRoot, enabled) {
    const V6 = typeof window !== "undefined" ? window.HumanPhysicalV6 : null;
    if (V6 && typeof V6.setClayMode === "function") {
      return V6.setClayMode(targetRoot, enabled);
    }
    const root = targetRoot && (targetRoot.group || targetRoot.root || targetRoot);
    if (!root || typeof root.traverse !== "function") return targetRoot;
    const T = typeof window !== "undefined" ? window.THREE : null;
    if (!T) return targetRoot;

    root.traverse(obj => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return;
      if (enabled) {
        if (!obj.userData._preClayMat) obj.userData._preClayMat = obj.material;
        if (!obj.userData._claySculptMat) {
          obj.userData._claySculptMat = new T.MeshPhysicalMaterial({
            color: 0x7d7770,
            roughness: 0.82,
            metalness: 0.0,
            sheen: 0.16,
            sheenRoughness: 0.86,
            sheenColor: new T.Color(0x9b948c),
            normalMap: obj.userData._preClayMat?.normalMap || null,
            normalScale: new T.Vector2(0.45, 0.45),
            vertexColors: false
          });
        }
        obj.material = obj.userData._claySculptMat;
      } else if (obj.userData._preClayMat) {
        obj.material = obj.userData._preClayMat;
      }
    });
    return targetRoot;
  }

  function posePumpCloseup(tableau, dt = 0.016, nowSec = 0, opts = {}) {
    if (!tableau || !tableau.byId || !tableau.standpipeRig) return;
    const T = tableau.THREE || (typeof window !== "undefined" ? window.THREE : null);
    if (!T) return;

    const rig = tableau.standpipeRig;
    const makeda = tableau.byId.makeda;
    const june = tableau.byId.june;
    const makedaCloseupGround = () => -0.18;
    const juneCloseupGround = () => -0.06;

    // Position Standpipe, Wide Shallow Ribbed *Shekla* Bowl & Lever angled +22° toward camera-left (`0bc287c6.jpg` 1:1 — knob ~0.38m in front of Makeda's chest!)
    rig.group.position.set(0.06, -0.18, 0.12);
    rig.group.rotation.set(0, 0, 0);
    rig.basin.position.set(0.46, rig.plinthHeight + 0.06, 0.06);
    if (tableau.chapel) {
      tableau.chapel.position.set(1.16, -0.36, -1.35);
      tableau.chapel.visible = true;
    }
    if (tableau.donkey) tableau.donkey.group.visible = false;
    for (const id of ["imani", "elder", "hanna"]) {
      if (tableau.byId[id]) tableau.byId[id].group.visible = false;
    }

    rig.stepPump(nowSec, { gentle: true, leverAmp: 0.018, baseAngle: 0.09, leverYaw: 0.36 });
    tableau.group.updateMatrixWorld(true);
    rig.group.updateMatrixWorld(true);

    const tmpGripR = new T.Vector3();
    const tmpPalmR = new T.Vector3();
    const tmpFDirR = new T.Vector3();
    const tmpRimR = new T.Vector3();

    // 1. Makeda (`x = -0.88, y = -0.10, z = -0.12, heading = +1.05 rad` ~60° 3/4-right):
    //    Ball-knob sits ~0.38m FORWARD-LEFT in front of her chest; right arm extends forward with fist OVER knob, head UP looking across at water/June!
    if (makeda) {
      makeda.group.visible = true;
      makeda.place(-0.88, -0.12, 1.05, makedaCloseupGround);
      rig.gripNear.getWorldPosition(tmpGripR);

      tmpPalmR.set(0.08, -0.94, -0.32).normalize();
      tmpFDirR.set(0.24, -0.30, 0.92).normalize();

      makeda.update(dt, nowSec, Object.assign({
        pose: "tableauCustom",
        spinePitch: 0.22,
        chestPitch: 0.05,
        chestYaw: -0.06,
        pelDrop: -0.03,
        worldHandR: tmpGripR,
        palmWorldR: tmpPalmR,
        fDirWorldR: tmpFDirR,
        gripModeR: "pumpBar",
        curlR: 1.08,
        pocketPullR: 0.048,
        localHandL: [0.20, 0.82, -0.02],
        lookAt: { x: 0.50, y: 1.04, z: 0.16 },
        neckLean: { yaw: -0.08, pitch: -0.08, roll: 0.03 },
        emotion: "calm_neutral",
        emotionIntensity: 0.22,
        speaking: false,
        visemeAmount: 0.0,
        lodDist: 1.4
      }, opts.makedaOpts));
    }

    // 2. June (`x = +0.76, y = -0.06, z = -0.04, heading = -0.58 rad` standing BEHIND-RIGHT of bowl so body/left arm NEVER enter bowl!):
    //    Calm closed-mouth attentive look at ripples; right palm DOWN & fingers resting horizontally ON TOP of the grooved clay rim!
    if (june) {
      june.group.visible = true;
      june.place(0.76, -0.04, -0.58, juneCloseupGround);
      rig.rimAnchorCloseupR.getWorldPosition(tmpRimR);

      const palmRimR = new T.Vector3(-0.08, -0.98, -0.16).normalize();
      const fDirRimR = new T.Vector3(-0.52, -0.08, 0.85).normalize();

      june.update(dt, nowSec, Object.assign({
        pose: "tableauCustom",
        spinePitch: 0.18,
        chestPitch: 0.05,
        pelDrop: -0.02,
        worldHandR: tmpRimR,
        palmWorldR: palmRimR,
        fDirWorldR: fDirRimR,
        gripModeR: "bowlRim",
        curlR: 0.42,
        pocketPullR: 0.032,
        localHandL: [0.16, 0.72, -0.02],
        lookAt: { x: 0.48, y: 0.52, z: 0.16 },
        neckLean: { pitch: 0.24, yaw: 0.12, roll: -0.03 },
        emotion: "calm_neutral",
        emotionIntensity: 0.20,
        speaking: false,
        visemeAmount: 0.0,
        lodDist: 1.4
      }, opts.juneOpts));
    }
  }

  function buildMasterTableau(T, opts = {}) {
    const group = new T.Group();
    group.name = "scionMasterTableau";
    const assetPath = opts.assetPath || opts.textureBase || "../donkey/";
    let mode = opts.mode === "pump_closeup" ? "pump_closeup" : "ensemble";

    let ground = null;
    if (opts.includeGround) {
      ground = new T.Mesh(
        new T.PlaneGeometry(18, 12),
        new T.MeshStandardMaterial({ color: 0xbfb8ac, roughness: 0.92 })
      );
      ground.rotation.x = -Math.PI * 0.5;
      ground.receiveShadow = true;
      group.add(ground);
    }

    // 1. Stone Semicircular-Arch Chapel (Left Background of 32b99d8c.jpg & Background of 0bc287c6.jpg)
    const chapelBundle = buildStoneArchChapel(T);
    const chapel = chapelBundle.group;
    chapel.position.set(0.04, 0.0, -1.35);
    group.add(chapel);

    // 2. Concrete Plinth Step & 1.32x Standpipe (`x = -0.88`, `basinOffsetX: 0.48` -> long +22cm outward parabolic cyan arc into rounder bowl!)
    const standpipeRig = buildStandpipeAndBasin(T, {
      plinthWidth: 1.52,
      plinthHeight: 0.36,
      plinthDepth: 0.66,
      pumpOffsetX: 0.00,
      basinOffsetX: 0.48
    });
    standpipeRig.basin.position.z = 0.04;
    standpipeRig.group.position.set(-0.88, 0.0, -0.22);
    group.add(standpipeRig.group);

    // 3. Mistletoe with Soft Canvas Panniers, Bold Wooden X-Frame Sawbuck & Recessed #28d8f0 Cyan Window (~-35° 3/4 yaw, Elder 100% clear!)
    const flatGround = () => 0;
    const donkey = buildMistletoeWithSawbuckPack(T, { assetPath, shells: 12, monochrome: false });
    if (donkey) {
      donkey.group.scale.setScalar(0.90);
      donkey.place(1.58, -0.10, -0.61, flatGround);
      group.add(donkey.group);
    }

    // 4. All 5 Canonical Cast Members (Left -> Right in 32b99d8c.jpg: Makeda, June, Imani, Elder, Hanna)
    const makeChar = window.makeExpeditionCharacter;
    const castSpecs = [
      {
        id: "makeda", name: "Makeda", role: "Wellhead Operator · Cornrows & Shamma",
        scale: 0.98, build: 1.00, fem: 0.82,
        skinHex: 0x3c271c, hair: "cornrowBraids", hairHex: 0x151210,
        outer: "shamma", satchel: true, assetPath
      },
      {
        id: "june", name: "June", role: "Young Listener · Short Locs & Patched Knees",
        scale: 0.77, build: 0.96, fem: 0.56,
        skinHex: 0x3f291e, hair: "shortLocs", hairHex: 0x161311,
        outer: "none", patchedKnees: true, assetPath
      },
      {
        id: "imani", name: "Imani", role: "Lead Carrier · 4C Coils & Notched Lapel Duster",
        scale: 1.02, build: 1.01, fem: 0.76,
        skinHex: 0x3b261b, hair: "croppedCoily", hairHex: 0x151210,
        outer: "duster", toolBelt: true, assetPath
      },
      {
        id: "elder", name: "Elder Berhanu", role: "Highland Elder · Diagonal Turban & Gabi",
        scale: 1.01, build: 1.04, fem: 0.10,
        skinHex: 0x3e281c, hair: "turban", wrapHex: 0x7c634c, beard: true, hairHex: 0x181513,
        outer: "shamma", assetPath
      },
      {
        id: "hanna", name: "Hanna", role: "Pack Specialist · Braided Ponytail & Cargo",
        scale: 0.97, build: 0.98, fem: 0.82,
        skinHex: 0x7c5b46, hair: "ponytail", hairHex: 0x1c1612,
        outer: "none", rolledSleeves: true, assetPath
      }
    ];

    const actors = [];
    const byId = {};
    if (typeof makeChar === "function") {
      for (const sp of castSpecs) {
        const ch = makeChar(T, sp);
        ch.label.sprite.visible = false;
        group.add(ch.group);
        actors.push({ id: sp.id, name: sp.name, role: sp.role, ch });
        byId[sp.id] = ch;
      }
    }

    const vGripMakeda = new T.Vector3();
    const vFootMakedaL = new T.Vector3();
    const vFootMakedaR = new T.Vector3();
    const vRimJuneL = new T.Vector3();
    const vRimJuneR = new T.Vector3();
    const vPackUpper = new T.Vector3();
    const vPackLower = new T.Vector3();

    function stepEnsemble(dt, nowSec, stepOpts = {}) {
      chapel.position.set(0.04, 0.0, -1.35);
      chapel.visible = true;
      standpipeRig.group.position.set(-0.88, 0.0, -0.22);
      standpipeRig.basin.position.set(0.46, standpipeRig.plinthHeight, 0.04);
      standpipeRig.stepPump(nowSec, { gentle: true, leverAmp: 0.018, baseAngle: 0.05, leverYaw: 0.0 });
      group.updateMatrixWorld(true);
      standpipeRig.group.updateMatrixWorld(true);

      if (donkey) {
        donkey.group.visible = true;
        if (donkey.mind) donkey.mind.auto = false;
        if (typeof donkey.setMood === "function") donkey.setMood("alert");
        if (donkey.state) donkey.state.moodT = 0.0;
        donkey.group.scale.setScalar(0.90);
        // -0.61 rad (~-35° 3/4 face + X-sawbuck) at x=1.58 so Mistletoe's head & pack 100% clear Elder (`x=0.58`)!
        donkey.place(1.58, -0.10, -0.61, flatGround);
        donkey.update(clamp(dt || 0.016, 0.002, 0.04), { throttle: 0, steer: 0, pace: 0 }, flatGround);
        donkey.group.scale.setScalar(0.90);
        donkey.group.updateMatrixWorld(true);
      }

      // 1. MAKEDA (Far Left `x = -1.74`: calm composed 3/4-right upward gaze toward Imani — zero wide laughing mouth!)
      if (byId.makeda) {
        const m = byId.makeda;
        m.group.visible = true;
        m.place(-1.74, -0.14, 1.18, flatGround);
        standpipeRig.gripFar.getWorldPosition(vGripMakeda);
        vFootMakedaL.set(-1.50, 0.36 + 0.085 * 0.98, -0.12).applyMatrix4(group.matrixWorld);
        vFootMakedaR.set(-1.82, 0.085 * 0.98, -0.18).applyMatrix4(group.matrixWorld);

        m.update(dt, nowSec, {
          pose: "tableauCustom",
          pelDrop: -0.02,
          spinePitch: 0.04,
          chestYaw: -0.06,
          worldFootL: vFootMakedaL,
          worldFootR: vFootMakedaR,
          worldHandL: vGripMakeda,
          palmWorldL: new T.Vector3(0.10, -0.94, 0.32).normalize(),
          fDirWorldL: new T.Vector3(0.16, -0.26, -0.95).normalize(),
          gripModeL: "pumpBar",
          curlL: 1.08,
          pocketPullL: 0.046,
          localHandR: [-0.20, 0.82, 0.04],
          neckLean: { yaw: 0.04, pitch: 0.02, roll: 0.02 },
          emotion: "calm_neutral",
          emotionIntensity: 0.25,
          speaking: false,
          lodDist: 3.5
        });
      }

      // 2. JUNE (`x = -1.04, z = +0.24, heading = +0.90 rad`: 3/4 front-right so BOTH stitched knee patches & laced boots read clearly, natural bent-elbow right hand on left basin rim while standpipe column & cyan stream remain 100% UNOBSTRUCTED!)
      if (byId.june) {
        const j = byId.june;
        j.group.visible = true;
        j.place(-1.00, 0.15, 0.98, flatGround);
        standpipeRig.rimAnchorEnsembleL.getWorldPosition(vRimJuneL);

        j.update(dt, nowSec, {
          pose: "tableauCustom",
          pelDrop: -0.02,
          spinePitch: 0.12,
          localFootL: [ 0.085, 0.085, -0.03],
          localFootR: [-0.085, 0.085,  0.04],
          worldHandR: vRimJuneL,
          palmWorldR: new T.Vector3(0.18, -0.96, -0.18).normalize(),
          fDirWorldR: new T.Vector3(0.86, -0.30, 0.40).normalize(),
          gripModeR: "bowlRim",
          curlR: 0.46,
          pocketPullR: 0.034,
          localHandL: [0.145, 0.78, 0.05],
          neckLean: { pitch: -0.18, yaw: 0.24, roll: 0.05 },
          emotion: "happy_joy",
          emotionIntensity: 0.55,
          lodDist: 3.2
        });
      }

      // 3. IMANI (Center Hero: Open V-notched lapel duster, charismatic +12° head-lean & warm joyful smile toward June/Makeda — zero gaping dark mouth!)
      if (byId.imani) {
        const im = byId.imani;
        im.group.visible = true;
        im.place(-0.02, 0.24, -0.08, flatGround);
        const talkPulse = Boolean(stepOpts.enableDialogue) && Math.sin(nowSec * 0.7) > 0.35;
        im.update(dt, nowSec, {
          pose: "tableauCustom",
          pelSwayX: 0.018,
          spineRoll: -0.030,
          localFootL: [ 0.095, 0.085, -0.035],
          localFootR: [-0.095, 0.085,  0.065],
          footYawR: -0.32,
          localHandL: [ 0.240, 0.845, 0.055],
          localHandR: [-0.240, 0.855, 0.065],
          neckLean: { roll: 0.21, yaw: -0.28, pitch: 0.04 },
          emotion: "happy_joy",
          emotionIntensity: 0.72,
          speaking: talkPulse,
          lodDist: 2.8
        });
      }

      // 4. ELDER (Center-Right `x = +0.58`: ~22° turned left toward Imani, snug diagonal *gabi* wrap 100% clear of Mistletoe!)
      if (byId.elder) {
        const el = byId.elder;
        el.group.visible = true;
        el.place(0.58, 0.06, -0.38, flatGround);
        el.update(dt, nowSec, {
          pose: "tableauCustom",
          localFootL: [ 0.105, 0.085, 0.02],
          localFootR: [-0.105, 0.085, -0.02],
          localHandL: [ 0.105, 1.045, 0.220],
          palmLocalL: [-0.35, -0.88, -0.30],
          fDirLocalL: [-0.18, -0.82,  0.54],
          curlL: 0.38,
          localHandR: [-0.235, 0.855, 0.045],
          neckLean: { yaw: -0.22, roll: -0.07, pitch: -0.03 },
          emotion: "happy_joy",
          emotionIntensity: 0.48,
          viseme: "IH",
          visemeAmount: 0.10,
          lodDist: 3.2
        });
      }

      // 5. HANNA (Far Right `x = +2.02`: Sleek braided ponytail, dark charcoal-olive rolled-cuff top, cargo trousers, tying Mistletoe's canvas pack straps!)
      if (byId.hanna) {
        const ha = byId.hanna;
        ha.group.visible = true;
        ha.place(2.02, 0.02, -1.52, flatGround);
        if (donkey && donkey.hannaGripUpper && donkey.hannaGripLower) {
          donkey.hannaGripUpper.getWorldPosition(vPackUpper);
          donkey.hannaGripLower.getWorldPosition(vPackLower);
          ha.update(dt, nowSec, {
            pose: "tableauCustom",
            spinePitch: 0.14,
            chestPitch: 0.06,
            localFootL: [ 0.09, 0.085,  0.08],
            localFootR: [-0.09, 0.085, -0.08],
            worldHandR: vPackUpper,
            worldHandL: vPackLower,
            palmWorldR: new T.Vector3(-0.22, -0.92, -0.32).normalize(),
            palmWorldL: new T.Vector3(-0.22, -0.88,  0.42).normalize(),
            fDirWorldR: new T.Vector3(-0.94, -0.22, -0.24).normalize(),
            fDirWorldL: new T.Vector3(-0.94, -0.18, -0.28).normalize(),
            gripModeR: "pinch",
            gripModeL: "pinch",
            curlR: 0.62,
            curlL: 0.68,
            pocketPullR: 0.032,
            pocketPullL: 0.032,
            neckLean: { pitch: 0.28, yaw: 0.06, roll: 0.04 },
            emotion: "determined_focus",
            emotionIntensity: 0.52,
            lodDist: 3.4
          });
        }
      }
    }

    const tableauObj = {
      THREE: T,
      root: group,
      group,
      get mode() { return mode; },
      actors,
      byId,
      donkey,
      standpipeRig,
      standpipe: standpipeRig.standpipe,
      basin: standpipeRig.basin,
      plinth: standpipeRig.plinth,
      chapel,
      ground,
      get cameraHint() {
        return mode === "pump_closeup"
          ? Object.assign({}, PUMP_CLOSEUP_CAMERA_HINT)
          : Object.assign({}, ENSEMBLE_CAMERA_HINT);
      },
      ensembleCameraHint: ENSEMBLE_CAMERA_HINT,
      pumpCloseupCameraHint: PUMP_CLOSEUP_CAMERA_HINT,
      setMode(newMode) {
        mode = newMode === "pump_closeup" ? "pump_closeup" : "ensemble";
        tableauObj.update(0.016, 0.25);
        return tableauObj;
      },
      setClayMode(flag) {
        setClayMode(group, flag);
        return tableauObj;
      },
      posePumpCloseup(dt, nowSec, subOpts) {
        posePumpCloseup(tableauObj, dt, nowSec, subOpts);
        return tableauObj;
      },
      update(dt = 0.016, nowSec = 0, stepOpts = {}) {
        group.updateMatrixWorld(true);
        const activeMode = stepOpts.mode || mode;
        if (activeMode === "pump_closeup") {
          posePumpCloseup(tableauObj, dt, nowSec, stepOpts);
        } else {
          stepEnsemble(dt, nowSec, stepOpts);
        }
        group.updateMatrixWorld(true);
      }
    };

    tableauObj.update(0.016, 0.25);
    return tableauObj;
  }

  if (typeof window !== "undefined") {
    window.ScionGroomGarments = {
      version: "6.0.0",
      getAssets,
      createBustEvaluator,
      createSpringBoneChain,
      buildHair,
      buildGarmentsAndBoots,
      buildStandpipeAndBasin,
      buildStoneArchChapel,
      buildMistletoeWithSawbuckPack,
      buildMasterTableau,
      posePumpCloseup,
      setClayMode,
      ENSEMBLE_CAMERA_HINT,
      PUMP_CLOSEUP_CAMERA_HINT
    };
  }
})();
