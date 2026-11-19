/* 2086 Donkey Water World Architecture, Hidmo Compounds, Domed Cross-Beacon Sanctuary,
   Wet Cyan Server-Cooling Vault, Wire-Glass Registry, Cottonwood Film Grove & Hill REC PPC Set.
   Uses Donkey-Method orthographic photographic textures (`donkey/textures/*`) blended with
   procedural relief/roughness maps, lathe-thrown terracotta vessels, GPU wind-billowing linen,
   and terrain-hugging Delaunay cyan network lines.
   Exposes window.buildWorldArchitecture(THREE, env). */
(function () {
  "use strict";

  const ARCH_SCRIPT_SRC =
    typeof document !== "undefined" && document.currentScript && document.currentScript.src
      ? document.currentScript.src
      : "";

  function resolveDonkeyTexUrl(filename) {
    try {
      const base = ARCH_SCRIPT_SRC || (typeof window !== "undefined" ? window.location.href : "");
      return new URL("../donkey/textures/" + filename, base).href;
    } catch (_) {
      return "../donkey/textures/" + filename;
    }
  }

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const frac = x => x - Math.floor(x);
  const hash2 = (x, y) => frac(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
  };
  const fbm = (x, y, oct = 4) => {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.02; a *= 0.5; }
    return s;
  };

  let archCache = null;

  function makeWindLinenMaterial(T, colorHex, bumpTex, windUniforms, opacity = 1.0) {
    const mat = new T.MeshStandardMaterial({
      color: colorHex,
      bumpMap: bumpTex,
      bumpScale: 0.012,
      roughness: 0.88,
      metalness: 0.0,
      side: T.DoubleSide,
      transparent: opacity < 0.999,
      opacity
    });
    mat.customProgramCacheKey = () => "npArchWindLinen_v1";
    mat.onBeforeCompile = shader => {
      shader.uniforms.uWindTime = windUniforms.uWindTime;
      shader.vertexShader =
        "uniform float uWindTime;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          [
            "#include <begin_vertex>",
            "#ifdef USE_UV",
            "  float npLoose = clamp(1.0 - uv.y, 0.0, 1.0);",
            "  float npEdge = 0.35 + 0.65 * sin(uv.x * 3.14159265);",
            "  float npGust = sin(uWindTime * 1.85 + position.x * 2.4 + uv.y * 3.1) * 0.055",
            "               + sin(uWindTime * 3.40 - uv.x * 5.2 + uv.y * 4.6) * 0.024;",
            "  float npLift = (0.5 + 0.5 * sin(uWindTime * 1.15 + position.x * 1.3)) * 0.045;",
            "  transformed.z += (npGust + npLift) * npLoose * (0.45 + 0.55 * npEdge);",
            "  transformed.x += sin(uWindTime * 1.55 + uv.y * 4.0) * 0.018 * npLoose * npLoose;",
            "#endif"
          ].join("\n")
        );
    };
    return mat;
  }

  function getArchMaterials(T) {
    if (archCache) return archCache;

    const windUniforms = { uWindTime: { value: 0 } };

    const makeDataTex = (w, h, fn, rx = 2, ry = 2, srgb = true, alpha = false) => {
      const data = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const res = fn(x / w, y / h);
          if (Array.isArray(res)) {
            data[i]     = clamp(res[0] * 255, 0, 255) | 0;
            data[i + 1] = clamp(res[1] * 255, 0, 255) | 0;
            data[i + 2] = clamp(res[2] * 255, 0, 255) | 0;
            data[i + 3] = res.length > 3 ? (clamp(res[3] * 255, 0, 255) | 0) : 255;
          } else {
            const b = clamp(res * 255, 0, 255) | 0;
            data[i] = data[i + 1] = data[i + 2] = b;
            data[i + 3] = 255;
          }
        }
      }
      const tex = new T.DataTexture(data, w, h, T.RGBAFormat);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(rx, ry);
      tex.magFilter = T.LinearFilter;
      tex.minFilter = T.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      if (srgb && !alpha && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    // Procedural relief & fallback textures
    const stoneColor = makeDataTex(256, 256, (u, v) => {
      const rows = 11;
      const ry = v * rows, rowIdx = Math.floor(ry), fy = ry - rowIdx;
      const cols = 5 + (rowIdx % 2);
      const stagger = (rowIdx % 2) * 0.47 + (hash2(rowIdx, 3) - 0.5) * 0.14;
      const rx = (u + stagger) * cols, colIdx = Math.floor(rx), fx = rx - colIdx;
      const wobbleY = (vnoise(u * 28, rowIdx * 3.1) - 0.5) * 0.14;
      const wobbleX = (vnoise(colIdx * 4.3, v * 28) - 0.5) * 0.12;
      const edgeY = Math.min(fy + wobbleY, 1 - (fy + wobbleY));
      const edgeX = Math.min(fx + wobbleX, 1 - (fx + wobbleX));
      const mortar = smooth(0.03, 0.11, edgeY) * smooth(0.025, 0.095, edgeX);
      const stoneTint = 0.30 + 0.24 * hash2(colIdx % cols, rowIdx) + 0.14 * fbm(u * 36, v * 36, 3);
      const val = lerp(0.56, stoneTint, mortar);
      return [val * 1.04, val * 1.00, val * 0.93];
    }, 2.4, 1.8, true);

    const stoneBump = makeDataTex(256, 256, (u, v) => {
      const rows = 11, ry = v * rows, rowIdx = Math.floor(ry), fy = ry - rowIdx;
      const cols = 5 + (rowIdx % 2), stagger = (rowIdx % 2) * 0.47;
      const rx = (u + stagger) * cols, fx = rx - Math.floor(rx);
      const mortar = smooth(0.02, 0.13, Math.min(fy, 1 - fy)) * smooth(0.02, 0.11, Math.min(fx, 1 - fx));
      const rough = fbm(u * 48, v * 48, 3);
      return mortar * (0.62 + 0.38 * rough);
    }, 2.4, 1.8, false);

    const plasterBump = makeDataTex(256, 256, (u, v) => {
      const trowel = fbm(u * 14 + 1.7, v * 12 + 3.1, 4);
      const grit = fbm(u * 56, v * 56, 2) * 0.28;
      return clamp(0.38 + trowel * 0.45 + grit, 0, 1);
    }, 2, 2, false);

    const plasterColor = makeDataTex(256, 256, (u, v) => {
      const damp = (1 - smooth(0.0, 0.28, v)) * 0.20 * fbm(u * 14, v * 16, 3);
      const stain = fbm(u * 9 + 2, v * 11 + 5, 4);
      const b = clamp(0.72 - damp - (stain - 0.5) * 0.18, 0.32, 0.88);
      return [b * 1.06, b * 0.94, b * 0.78];
    }, 2, 1.5, true);

    const corrColor = makeDataTex(256, 256, (u, v) => {
      const rib = 0.5 + 0.5 * Math.sin(u * TAU * 34);
      const seam = Math.abs(frac(v * 3) - 0.5) > 0.47 ? -0.14 : 0;
      const rust = Math.max(0, fbm(u * 12 + 4, v * 10 + 1, 4) - 0.54) * 0.85;
      const g = clamp(0.44 + 0.16 * rib + seam + (fbm(u * 26, v * 18, 3) - 0.5) * 0.14, 0.18, 0.78);
      return [g + rust * 0.22, g - rust * 0.04, g - rust * 0.12];
    }, 2, 2, true);

    const corrBump = makeDataTex(256, 256, (u, v) => {
      const rib = 0.5 + 0.5 * Math.sin(u * TAU * 34);
      const seam = frac(v * 3) < 0.04 ? 0.15 : 0;
      return clamp(rib * 0.82 + seam, 0, 1);
    }, 2, 2, false);

    const timberColor = makeDataTex(192, 192, (u, v) => {
      const plank = Math.abs(frac(u * 7) - 0.5) > 0.47 ? -0.15 : 0;
      const grain = fbm(u * 18, v * 90, 3);
      const b = clamp(0.28 + 0.16 * grain + plank, 0.10, 0.54);
      return [b * 1.12, b * 0.95, b * 0.76];
    }, 2, 2, true);

    const concreteBump = makeDataTex(256, 256, (u, v) => {
      const panelX = Math.abs(frac(u * 4) - 0.5) > 0.485 ? -0.16 : 0;
      const panelY = Math.abs(frac(v * 3) - 0.5) > 0.485 ? -0.14 : 0;
      const pit = fbm(u * 38, v * 24, 4);
      return clamp(0.52 + (pit - 0.5) * 0.45 + panelX + panelY, 0, 1);
    }, 2.5, 2.0, false);

    const concreteColor = makeDataTex(256, 256, (u, v) => {
      const panelX = Math.abs(frac(u * 4) - 0.5) > 0.485 ? -0.10 : 0;
      const panelY = Math.abs(frac(v * 3) - 0.5) > 0.485 ? -0.09 : 0;
      const streak = fbm(u * 16, v * 6, 4);
      const b = clamp(0.48 + (streak - 0.5) * 0.22 + panelX + panelY, 0.22, 0.70);
      return [b * 0.99, b * 1.00, b * 1.00];
    }, 3, 2, true);

    const wireGlassTex = makeDataTex(192, 192, (u, v) => {
      const d1 = Math.abs(frac((u + v) * 14) - 0.5);
      const d2 = Math.abs(frac((u - v) * 14) - 0.5);
      const wire = d1 < 0.042 || d2 < 0.042 ? 1 : 0;
      const smudge = fbm(u * 12, v * 12, 3);
      const drip = (1 - smooth(0.0, 0.24, v)) * fbm(u * 26, v * 8, 2);
      if (wire) return [0.22, 0.27, 0.29, 0.78];
      return [0.54 + 0.18 * drip, 0.84 + 0.14 * drip, 0.90 + 0.10 * drip, clamp(0.16 + smudge * 0.14 + drip * 0.22, 0.14, 0.46)];
    }, 2, 1.4, false, true);

    const chainTex = makeDataTex(128, 128, (u, v) => {
      const d1 = Math.abs(frac((u + v) * 16) - 0.5);
      const d2 = Math.abs(frac((u - v) * 16) - 0.5);
      const hit = d1 < 0.065 || d2 < 0.065;
      return hit ? [0.56, 0.59, 0.60, 0.92] : [0, 0, 0, 0];
    }, 6, 2, false, true);

    const linenWeaveBump = makeDataTex(128, 128, (u, v) => {
      const warp = 0.5 + 0.5 * Math.sin(u * TAU * 48);
      const weft = 0.5 + 0.5 * Math.sin(v * TAU * 48);
      const fold = fbm(u * 8, v * 5, 3);
      return clamp(0.35 + warp * 0.22 + weft * 0.22 + fold * 0.21, 0, 1);
    }, 3, 3, false);

    const terracottaRibBump = makeDataTex(128, 128, (u, v) => {
      const throwRib = 0.5 + 0.5 * Math.sin(v * TAU * 22);
      const grain = fbm(u * 32, v * 18, 3);
      return clamp(0.35 + throwRib * 0.42 + grain * 0.23, 0, 1);
    }, 1, 1, false);

    // Server rack LED faceplate DataTexture (`kf07`!)
    const serverFaceTex = makeDataTex(128, 256, (u, v) => {
      const slot = frac(v * 10);
      const inBlade = slot > 0.12 && slot < 0.88 && u > 0.08 && u < 0.92;
      if (!inBlade) return [0.04, 0.05, 0.06];
      const row = Math.floor(v * 10);
      if (slot > 0.56 && slot < 0.76 && u > 0.14 && u < 0.34 && row % 3 === 1) {
        return [0.22, 0.68, 0.88]; // mini LCD telemetry readout
      }
      const col = Math.floor(u * 22);
      const ledOn = hash2(col, row * 7 + Math.floor(slot * 4)) > 0.58;
      if (ledOn && slot > 0.24 && slot < 0.42 && u > 0.42 && u < 0.86) {
        return col % 5 === 0 ? [0.95, 0.62, 0.18] : col % 2 === 0 ? [0.18, 0.95, 0.58] : [0.25, 0.88, 1.0];
      }
      return [0.08, 0.10, 0.12];
    }, 1, 1, true);

    // REC PPC HUD overlay canvas texture for Hill Archive monitor (`kf08`!)
    const makeRecPpcOverlayTex = () => {
      if (typeof document === "undefined") return null;
      const c = document.createElement("canvas");
      c.width = 512; c.height = 288;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, 512, 288);
      ctx.strokeStyle = "rgba(246, 250, 252, 0.92)";
      ctx.lineWidth = 2.6;
      const m = 18, b = 34;
      // 4 viewfinder corner brackets
      for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [512 - m, m, -1, 1], [m, 288 - m, 1, -1], [512 - m, 288 - m, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + sy * b);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + sx * b, cy);
        ctx.stroke();
      }
      // REC PPC header + red/white dot
      ctx.fillStyle = "rgba(246, 250, 252, 0.95)";
      ctx.font = "700 17px ui-monospace, Menlo, monospace";
      ctx.fillText("REC PPC", 34, 42);
      ctx.fillStyle = "#ff4638";
      ctx.beginPath(); ctx.arc(124, 36, 4.2, 0, TAU); ctx.fill();
      // Left exposure scale ticks (`kf02` & `kf08`)
      ctx.strokeStyle = "rgba(246, 250, 252, 0.80)";
      ctx.lineWidth = 1.6;
      for (let i = 0; i <= 14; i++) {
        const y = 92 + i * 7.5;
        const w = i % 3 === 0 ? 11 : 6;
        ctx.beginPath(); ctx.moveTo(22, y); ctx.lineTo(22 + w, y); ctx.stroke();
      }
      // Right range ticks
      for (let i = 0; i < 5; i++) {
        const y = 108 + i * 18;
        ctx.beginPath(); ctx.moveTo(480, y); ctx.lineTo(490, y); ctx.stroke();
      }
      // Bottom-left battery icon + bottom-right timecode
      ctx.strokeRect(34, 246, 28, 13);
      ctx.fillStyle = "rgba(246, 250, 252, 0.90)";
      ctx.fillRect(37, 249, 20, 7);
      ctx.fillRect(62, 249, 3, 7);
      ctx.font = "600 16px ui-monospace, Menlo, monospace";
      ctx.fillText("01:19:28", 404, 258);
      const tex = new T.CanvasTexture(c);
      if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    // Load Donkey-Method Photographic Ortho Plates (`donkey/textures/*`)
    const loader = new T.TextureLoader();
    const loadOrthoTex = (file, cfg) => {
      const tex = loader.load(resolveDonkeyTexUrl(file));
      tex.wrapS = cfg.wrapS || T.RepeatWrapping;
      tex.wrapT = cfg.wrapT || T.RepeatWrapping;
      if (cfg.repeat) tex.repeat.set(cfg.repeat[0], cfg.repeat[1]);
      if (cfg.offset) tex.offset.set(cfg.offset[0], cfg.offset[1]);
      if (cfg.srgb !== false && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    };

    // 1. arch_mudwall.jpg: full elevation (basalt plinth v∈[0,0.29] + sun-baked mud-plaster v∈[0.29,1.0])
    const mudWallFullTex = loadOrthoTex("arch_mudwall.jpg", {
      wrapS: T.RepeatWrapping, wrapT: T.ClampToEdgeWrapping, repeat: [2.2, 1.0], offset: [0, 0]
    });
    // Pure mud-plaster crop (excludes basalt bottom band so upper walls/parapets never repeat stones mid-wall)
    const mudPlasterPhotoTex = loadOrthoTex("arch_mudwall.jpg", {
      wrapS: T.RepeatWrapping, wrapT: T.ClampToEdgeWrapping, repeat: [2.0, 0.64], offset: [0, 0.33]
    });
    // Pure basalt plinth crop (v∈[0.02, 0.27])
    const basaltPlinthPhotoTex = loadOrthoTex("arch_mudwall.jpg", {
      wrapS: T.RepeatWrapping, wrapT: T.ClampToEdgeWrapping, repeat: [2.4, 0.25], offset: [0, 0.02]
    });

    // 2. arch_chapel.jpg: pure highland coursed limestone sub-patch (excludes window & #424242 surround) + full ortho plate
    const chapelStonePhotoTex = loadOrthoTex("arch_chapel.jpg", {
      wrapS: T.MirroredRepeatWrapping, wrapT: T.MirroredRepeatWrapping, repeat: [0.11, 0.35], offset: [0.35, 0.05]
    });
    const chapelOrthoTex = loadOrthoTex("arch_chapel.jpg", {
      wrapS: T.ClampToEdgeWrapping, wrapT: T.ClampToEdgeWrapping
    });

    // 3. arch_cooling.jpg: weathered concrete sub-patch + full ortho conduit facade plate
    const coolingConcretePhotoTex = loadOrthoTex("arch_cooling.jpg", {
      wrapS: T.MirroredRepeatWrapping, wrapT: T.MirroredRepeatWrapping, repeat: [0.14, 0.68], offset: [0.01, 0.26]
    });
    const coolingOrthoTex = loadOrthoTex("arch_cooling.jpg", {
      wrapS: T.ClampToEdgeWrapping, wrapT: T.ClampToEdgeWrapping
    });

    // 4. prop_terracotta.jpg: wheel-thrown clay (LatheGeometry UVs clamped away from bottom-left corner)
    const terracottaPhotoTex = loadOrthoTex("prop_terracotta.jpg", {
      wrapS: T.ClampToEdgeWrapping, wrapT: T.ClampToEdgeWrapping
    });

    // 5. jug_wifi_decal.png: `WATER = WIFI / SIGNAL OF GOD` alpha stencil
    const jugWifiDecalTex = loadOrthoTex("jug_wifi_decal.png", {
      wrapS: T.ClampToEdgeWrapping, wrapT: T.ClampToEdgeWrapping
    });

    // Blend photographic highland limestone grain with procedural coursed stone mortar & relief!
    const makeBlendedStoneMat = (tintHex, stoneRepeatX = 2.4, stoneRepeatY = 1.8) => {
      const m = new T.MeshStandardMaterial({
        color: tintHex,
        map: stoneColor,
        bumpMap: stoneBump,
        bumpScale: 0.062,
        roughness: 0.91
      });
      m.customProgramCacheKey = () => "npArchPhotoStone_v1_" + stoneRepeatX;
      m.onBeforeCompile = sh => {
        sh.uniforms.tPhotoStone = { value: chapelStonePhotoTex };
        sh.fragmentShader =
          "uniform sampler2D tPhotoStone;\n" +
          sh.fragmentShader.replace(
            "#include <map_fragment>",
            [
              "#include <map_fragment>",
              "#ifdef USE_MAP",
              "  vec2 npStUv = vec2(0.355 + abs(fract(vMapUv.x * 0.85) * 2.0 - 1.0) * 0.095,",
              "                    0.055 + abs(fract(vMapUv.y * 0.85) * 2.0 - 1.0) * 0.34);",
              "  vec3 npPhotoSt = texture2D(tPhotoStone, npStUv).rgb;",
              "  diffuseColor.rgb = mix(diffuseColor.rgb, npPhotoSt * (0.68 + 0.62 * diffuseColor.rgb), 0.76);",
              "#endif"
            ].join("\n")
          );
      };
      return m;
    };

    // Blend photographic board-formed pitted concrete (`arch_cooling.jpg`) with procedural concrete seams & bump!
    const makeBlendedConcreteMat = () => {
      const m = new T.MeshStandardMaterial({
        color: 0xd8dcde,
        map: concreteColor,
        bumpMap: concreteBump,
        bumpScale: 0.036,
        roughness: 0.85
      });
      m.customProgramCacheKey = () => "npArchPhotoConcrete_v1";
      m.onBeforeCompile = sh => {
        sh.uniforms.tPhotoConc = { value: coolingConcretePhotoTex };
        sh.fragmentShader =
          "uniform sampler2D tPhotoConc;\n" +
          sh.fragmentShader.replace(
            "#include <map_fragment>",
            [
              "#include <map_fragment>",
              "#ifdef USE_MAP",
              "  vec2 npCcUv = vec2(0.015 + abs(fract(vMapUv.x * 0.65) * 2.0 - 1.0) * 0.068,",
              "                    0.26 + abs(fract(vMapUv.y * 0.65) * 2.0 - 1.0) * 0.66);",
              "  vec3 npPhotoCc = texture2D(tPhotoConc, npCcUv).rgb;",
              "  diffuseColor.rgb = mix(diffuseColor.rgb, npPhotoCc * (0.66 + 0.68 * diffuseColor.rgb), 0.78);",
              "#endif"
            ].join("\n")
          );
      };
      return m;
    };

    const recPpcHudTex = makeRecPpcOverlayTex();

    archCache = {
      windUniforms,
      chapelOrthoTex,
      coolingOrthoTex,
      terracottaPhotoTex,
      jugWifiDecalTex,
      stoneBump,
      terracottaRibBump,

      stoneMat: makeBlendedStoneMat(0xd6cfc2, 2.4, 1.8),
      chapelStoneMat: makeBlendedStoneMat(0xe5ddd0, 2.8, 2.2),
      chapelOrthoMat: new T.MeshStandardMaterial({
        map: chapelOrthoTex, bumpMap: stoneBump, bumpScale: 0.048, roughness: 0.89
      }),
      basaltPlinthMat: new T.MeshStandardMaterial({
        color: 0xc8c2ba, map: basaltPlinthPhotoTex, bumpMap: stoneBump, bumpScale: 0.068, roughness: 0.94
      }),
      hidmoWallMat: new T.MeshStandardMaterial({
        color: 0xf2eadf, map: mudWallFullTex, bumpMap: plasterBump, bumpScale: 0.042, roughness: 0.93
      }),
      mudPlasterMat: new T.MeshStandardMaterial({
        color: 0xeee4d5, map: mudPlasterPhotoTex, bumpMap: plasterBump, bumpScale: 0.036, roughness: 0.92
      }),
      plasterMat: new T.MeshStandardMaterial({
        color: 0xf4eee4, map: mudPlasterPhotoTex, bumpMap: plasterBump, bumpScale: 0.024, roughness: 0.90
      }),
      terracottaMat: new T.MeshStandardMaterial({
        color: 0xf6ece4, map: terracottaPhotoTex, bumpMap: terracottaRibBump, bumpScale: 0.026, roughness: 0.74, side: T.DoubleSide
      }),
      terracottaWetMat: new T.MeshStandardMaterial({
        color: 0x9e684c, map: terracottaPhotoTex, bumpMap: terracottaRibBump, bumpScale: 0.018, roughness: 0.34, side: T.DoubleSide
      }),
      roofMat: new T.MeshStandardMaterial({
        map: corrColor, bumpMap: corrBump, bumpScale: 0.038, roughness: 0.58, metalness: 0.42, side: T.DoubleSide
      }),
      timberMat: new T.MeshStandardMaterial({ map: timberColor, bumpMap: timberColor, bumpScale: 0.028, roughness: 0.88 }),
      timberDark: new T.MeshStandardMaterial({ color: 0x35291f, bumpMap: timberColor, bumpScale: 0.024, roughness: 0.90 }),
      vigaMat: new T.MeshStandardMaterial({ color: 0x4b3828, bumpMap: timberColor, bumpScale: 0.032, roughness: 0.88 }),
      sisalRopeMat: new T.MeshStandardMaterial({ color: 0xb89e72, bumpMap: linenWeaveBump, bumpScale: 0.032, roughness: 0.92 }),
      concreteMat: makeBlendedConcreteMat(),
      coolingOrthoMat: new T.MeshStandardMaterial({
        map: coolingOrthoTex, bumpMap: concreteBump, bumpScale: 0.032, roughness: 0.82
      }),
      steelMat: new T.MeshStandardMaterial({ color: 0x5c6368, roughness: 0.44, metalness: 0.70 }),
      rustedTowerMat: new T.MeshStandardMaterial({ color: 0x5d4436, roughness: 0.68, metalness: 0.52 }),
      ironDarkMat: new T.MeshStandardMaterial({ color: 0x22272b, roughness: 0.46, metalness: 0.66 }),
      serverRackMat: new T.MeshStandardMaterial({
        color: 0xffffff, map: serverFaceTex, emissive: 0xffffff, emissiveMap: serverFaceTex, emissiveIntensity: 0.95, roughness: 0.42, metalness: 0.55
      }),
      copperPipeMat: new T.MeshStandardMaterial({ color: 0x7b6552, roughness: 0.38, metalness: 0.74 }),
      rubberHoseMat: new T.MeshStandardMaterial({ color: 0x161a1d, roughness: 0.68, metalness: 0.16 }),
      cyanTubeMat: new T.MeshPhysicalMaterial({
        color: 0x3ad6f5, emissive: 0x0b8ed4, emissiveIntensity: 0.95,
        roughness: 0.08, metalness: 0.04, clearcoat: 1.0, clearcoatRoughness: 0.05, transparent: true, opacity: 0.78
      }),
      cyanTubeCoreMat: new T.MeshBasicMaterial({
        color: 0xcffbff
      }),
      wetVaultFloorMat: new T.MeshPhysicalMaterial({
        color: 0x041a2b, emissive: 0x074b78, emissiveIntensity: 0.88,
        roughness: 0.05, metalness: 0.36, clearcoat: 1.0, clearcoatRoughness: 0.04
      }),
      litWhiteCrossMat: new T.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xf4fbff, emissiveIntensity: 3.1, roughness: 0.12
      }),
      reflectedCrossMat: new T.MeshBasicMaterial({
        color: 0x9ef4ff, transparent: true, opacity: 0.48, depthWrite: false
      }),
      jugShellGlowMat: new T.MeshPhysicalMaterial({
        color: 0x58dcf5, emissive: 0x1498d8, emissiveIntensity: 1.15,
        roughness: 0.18, metalness: 0.04, clearcoat: 0.85, transparent: true, opacity: 0.88
      }),
      jugCapBlueMat: new T.MeshStandardMaterial({ color: 0x164fa8, roughness: 0.35, metalness: 0.12 }),
      jugWifiDecalMat: new T.MeshStandardMaterial({
        map: jugWifiDecalTex, emissive: 0xa8f8ff, emissiveMap: jugWifiDecalTex, emissiveIntensity: 1.55,
        transparent: true, depthWrite: false, roughness: 0.35, side: T.FrontSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      }),
      wireGlassMat: new T.MeshStandardMaterial({
        map: wireGlassTex, transparent: true, roughness: 0.16, metalness: 0.15, side: T.DoubleSide, depthWrite: false
      }),
      chainLinkMat: new T.MeshStandardMaterial({
        map: chainTex, transparent: true, alphaTest: 0.35, roughness: 0.52, metalness: 0.65, side: T.DoubleSide
      }),
      billowLinenMat: makeWindLinenMaterial(T, 0xeae4d7, linenWeaveBump, windUniforms, 1.0),
      billowWarmLinenMat: makeWindLinenMaterial(T, 0xe2dac9, linenWeaveBump, windUniforms, 1.0),
      laundryLightMat: new T.MeshStandardMaterial({ color: 0xd8d3c6, bumpMap: linenWeaveBump, bumpScale: 0.01, roughness: 0.92, side: T.DoubleSide }),
      laundryMidMat: new T.MeshStandardMaterial({ color: 0x7d807c, bumpMap: linenWeaveBump, bumpScale: 0.01, roughness: 0.92, side: T.DoubleSide }),
      laundryDarkMat: new T.MeshStandardMaterial({ color: 0x2c3032, roughness: 0.92, side: T.DoubleSide }),
      barkMat: new T.MeshStandardMaterial({ color: 0x58534b, bumpMap: timberColor, bumpScale: 0.048, roughness: 0.94 }),
      counterChipMat: new T.MeshStandardMaterial({ map: plasterColor, bumpMap: stoneBump, bumpScale: 0.022, roughness: 0.78 }),
      officePanelMat: new T.MeshStandardMaterial({ color: 0xc9ced2, bumpMap: linenWeaveBump, bumpScale: 0.006, roughness: 0.84 }),
      officeDeskMat: new T.MeshStandardMaterial({ color: 0xb6bcc2, roughness: 0.50, metalness: 0.16 }),
      recPpcHudMat: recPpcHudTex ? new T.MeshBasicMaterial({
        map: recPpcHudTex, transparent: true, depthWrite: false, opacity: 0.94
      }) : null,
      darkInteriorMat: new T.MeshStandardMaterial({ color: 0x120f0c, roughness: 0.96, side: T.DoubleSide }),
      warmInteriorMat: new T.MeshStandardMaterial({ color: 0xf4dfb4, emissive: 0xd9a85b, emissiveIntensity: 0.78, roughness: 0.4 }),
      cyanInteriorMat: new T.MeshStandardMaterial({ color: 0x62e8f8, emissive: 0x1ba8cc, emissiveIntensity: 1.05, roughness: 0.28 }),
      filmLeafMat: new T.MeshPhysicalMaterial({
        color: 0x4ee2ec, emissive: 0x169ab4, emissiveIntensity: 0.78,
        roughness: 0.18, transparent: true, opacity: 0.86, side: T.DoubleSide
      }),
      networkLineMat: new T.LineBasicMaterial({
        color: 0x38ecff, transparent: true, opacity: 0.86, blending: T.AdditiveBlending, depthWrite: false
      }),
      networkNodeMat: new T.MeshBasicMaterial({
        color: 0x8cf8ff
      })
    };
    return archCache;
  }

  /* ---------- Prop 1: Wheel-Thrown Ribbed Terracotta Watering Bowl (`kf16` & `atlas`!) ---------- */
  function makeTerracottaWateringBowl(T, mats, cyanWaterMat, outerR = 0.44, rimH = 0.30, withWater = true) {
    const g = new T.Group();
    const footR = outerR * 0.52;
    const wallT = outerR * 0.085;
    // Closed double-wall lathe profile: center inner floor -> inner wall -> rolled lip -> ribbed outer wall -> foot ring
    const pts = [];
    const nInner = 7, nLip = 5, nOuter = 10;
    pts.push(new T.Vector2(0.001, wallT * 0.85));
    for (let i = 1; i <= nInner; i++) {
      const t = i / nInner;
      const r = lerp(footR * 0.82, outerR - wallT * 0.95, Math.pow(t, 0.78)) * (i === 1 ? 0.55 : 1);
      const y = lerp(wallT * 0.88, rimH - wallT * 0.55, t * t * (0.4 + 0.6 * t));
      pts.push(new T.Vector2(r, y));
    }
    // Thick rolled potter's rim (`kf16`!)
    const lipCx = outerR - wallT * 0.32, lipCy = rimH - wallT * 0.42, lipR = wallT * 0.62;
    for (let i = 0; i <= nLip; i++) {
      const ang = lerp(Math.PI * 0.85, -Math.PI * 0.35, i / nLip);
      pts.push(new T.Vector2(lipCx + Math.cos(ang) * lipR * 1.15, lipCy + Math.sin(ang) * lipR * 0.72));
    }
    // Outer wall with 3 wheel-thrown horizontal groove ribs (`kf16`!)
    for (let i = 1; i <= nOuter; i++) {
      const t = i / nOuter; // 0 at under-lip, 1 at foot
      const y = lerp(rimH - wallT * 0.95, 0.018, t);
      let r = lerp(outerR - wallT * 0.15, footR, Math.pow(t, 1.25));
      if (t > 0.10 && t < 0.42) {
        r += Math.sin((t - 0.10) / 0.32 * TAU * 3.0) * 0.0075;
      }
      pts.push(new T.Vector2(r, y));
    }
    pts.push(new T.Vector2(footR * 0.88, 0.0));
    pts.push(new T.Vector2(0.001, 0.0));

    const segs = 32;
    const geo = new T.LatheGeometry(pts, segs);
    // Clamp UVs strictly inside clean terracotta region u∈[0.10, 0.90], v∈[0.18, 0.93] (zero #424242 corner bleed!)
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const rawU = uv.getX(i), rawV = uv.getY(i);
      const symU = 1 - Math.abs(frac(rawU) * 2 - 1);
      uv.setXY(i, lerp(0.10, 0.90, symU), lerp(0.18, 0.93, clamp(rawV, 0, 1)));
    }
    geo.computeVertexNormals();
    const bowlMesh = new T.Mesh(geo, mats.terracottaMat);
    bowlMesh.castShadow = true;
    bowlMesh.receiveShadow = true;
    g.add(bowlMesh);

    if (withWater && cyanWaterMat) {
      const waterY = rimH * 0.765;
      const waterR = outerR - wallT * 1.05;
      const meniscus = new T.Mesh(new T.CircleGeometry(waterR, 28), cyanWaterMat);
      meniscus.rotation.x = -Math.PI * 0.5;
      meniscus.position.y = waterY;
      g.add(meniscus);
      // Concentric water ripple highlight ring
      const ripple = new T.Mesh(
        new T.RingGeometry(waterR * 0.52, waterR * 0.57, 28),
        new T.MeshBasicMaterial({ color: 0xb8fbff, transparent: true, opacity: 0.52, side: T.DoubleSide, depthWrite: false })
      );
      ripple.rotation.x = -Math.PI * 0.5;
      ripple.position.y = waterY + 0.004;
      g.add(ripple);
    }
    return g;
  }

  /* ---------- Prop 2: Coursed-Stone Circular Courtyard Well (`study_sheet` panel a & `atlas`!) ---------- */
  function makeCoursedStoneWell(T, mats, cyanWaterMat, outerR = 0.90, curbH = 0.56) {
    const g = new T.Group();
    const innerR = outerR * 0.64;
    // Inner dark stone shaft cylinder
    const innerWall = new T.Mesh(
      new T.CylinderGeometry(innerR, innerR * 0.96, curbH + 0.45, 22, 1, true),
      mats.basaltPlinthMat
    );
    innerWall.position.y = curbH * 0.5 - 0.18;
    g.add(innerWall);

    // Mortar core ring so joints between stones read as recessed mortar
    const core = new T.Mesh(new T.CylinderGeometry(outerR * 0.95, outerR * 0.98, curbH * 0.96, 24), mats.stoneMat);
    core.position.y = curbH * 0.48;
    g.add(core);

    // 3 staggered courses of individual sculpted wedge curb stones (`atlas` bottom-right!)
    const courses = 3, perCourse = 11;
    const cH = curbH / courses;
    const blockW = (TAU * outerR) / perCourse * 0.90;
    const blockD = outerR - innerR + 0.04;
    const blockGeo = new T.BoxGeometry(blockW, cH * 0.88, blockD);
    for (let row = 0; row < courses; row++) {
      const stagger = (row % 2) * (TAU / perCourse) * 0.5;
      for (let k = 0; k < perCourse; k++) {
        const ang = stagger + (k / perCourse) * TAU;
        const rMid = (innerR + outerR) * 0.5 + (hash2(k, row) - 0.5) * 0.018;
        const blk = new T.Mesh(blockGeo, row === 0 ? mats.basaltPlinthMat : mats.chapelStoneMat);
        blk.position.set(Math.sin(ang) * rMid, (row + 0.5) * cH, Math.cos(ang) * rMid);
        blk.rotation.y = ang;
        blk.scale.set(0.94 + hash2(row, k) * 0.10, 0.95 + hash2(k, row + 5) * 0.08, 1.0);
        blk.castShadow = true;
        blk.receiveShadow = true;
        g.add(blk);
      }
    }

    // Glowing cyan water meniscus inside the well-curb (`study_sheet_architecture.jpg` panel a!)
    if (cyanWaterMat) {
      const pool = new T.Mesh(new T.CircleGeometry(innerR * 0.98, 24), cyanWaterMat);
      pool.rotation.x = -Math.PI * 0.5;
      pool.position.y = curbH * 0.78;
      g.add(pool);
      const glow = new T.PointLight(0x2ee6ff, 1.15, 3.6, 1.8);
      glow.position.set(0, curbH + 0.24, 0);
      g.add(glow);
    }
    return g;
  }

  /* ---------- Prop 3: Wooden Donkey Sawbuck Pack Frame with Braided Sisal-Rope (`study_sheet` d!) ---------- */
  function makeSawbuckPackFrame(T, mats, scale = 1.0) {
    const g = new T.Group();
    const alpha = 0.46; // X-crossbuck angle: inverted-V legs below y=0.445, open V-horns above y=0.445
    const strapMat = new T.MeshStandardMaterial({ color: 0x3b2e22, roughness: 0.84 });

    // Front & rear X-crossed hardwood trestles (intersecting dead-center at x=0, y=0.445, z=sz)
    for (const sz of [-0.25, 0.25]) {
      for (const sx of [-1, 1]) {
        const leg = new T.Mesh(new T.BoxGeometry(0.050, 0.72, 0.036), mats.timberMat);
        leg.position.set(sx * 0.0517, 0.3406, sz + sx * 0.017);
        leg.rotation.z = sx * alpha;
        leg.castShadow = true;
        leg.receiveShadow = true;
        g.add(leg);
      }
      // Hardwood/iron through-bolt + crossed figure-8 braided sisal lashing seated flush on the X-crotch
      const pin = new T.Mesh(new T.CylinderGeometry(0.010, 0.010, 0.086, 10), mats.ironDarkMat);
      pin.rotation.x = Math.PI * 0.5;
      pin.position.set(0, 0.445, sz);
      g.add(pin);
      for (const sgn of [-1, 1]) {
        const lash = new T.Mesh(new T.TorusGeometry(0.036, 0.011, 8, 18), mats.sisalRopeMat);
        lash.position.set(0, 0.445, sz);
        lash.rotation.set(0.56, sgn * 0.62, sgn * alpha);
        lash.scale.set(0.86, 1.14, 1.0);
        g.add(lash);
      }
    }

    // Center longitudinal ridge spar seated inside the X-crotch
    const ridgeSpar = new T.Mesh(new T.BoxGeometry(0.036, 0.036, 0.58), mats.timberDark);
    ridgeSpar.position.set(0, 0.422, 0);
    ridgeSpar.castShadow = true;
    g.add(ridgeSpar);

    // 4 lower saddle-skirt slats + 2 upper horn cradle rails + flush cinch straps & iron cinch rings
    for (const sx of [-1, 1]) {
      for (const [bx, by] of [[0.088, 0.355], [0.150, 0.229]]) {
        const bar = new T.Mesh(new T.BoxGeometry(0.026, 0.060, 0.68), mats.timberMat);
        bar.position.set(sx * bx, by, 0);
        bar.rotation.z = sx * alpha;
        bar.castShadow = true;
        g.add(bar);
      }
      const upperRail = new T.Mesh(new T.BoxGeometry(0.024, 0.050, 0.66), mats.timberMat);
      upperRail.position.set(sx * 0.086, 0.548, 0);
      upperRail.rotation.z = -sx * alpha;
      upperRail.castShadow = true;
      g.add(upperRail);

      // Woven leather/canvas cinch collar wrapped flush around lower side-bar + sisal keeper + iron cinch ring
      const cinchStrap = new T.Mesh(new T.BoxGeometry(0.036, 0.070, 0.064), strapMat);
      cinchStrap.position.set(sx * 0.150, 0.229, 0);
      cinchStrap.rotation.z = sx * alpha;
      g.add(cinchStrap);

      const keeper = new T.Mesh(new T.TorusGeometry(0.024, 0.0065, 6, 14), mats.sisalRopeMat);
      keeper.position.set(sx * 0.162, 0.200, 0);
      keeper.rotation.z = sx * alpha;
      g.add(keeper);

      const cinchRing = new T.Mesh(new T.TorusGeometry(0.026, 0.006, 8, 16), mats.ironDarkMat);
      cinchRing.position.set(sx * 0.170, 0.176, 0);
      cinchRing.rotation.y = Math.PI * 0.5;
      cinchRing.rotation.z = sx * 0.22;
      g.add(cinchRing);
    }

    // Coiled braided sisal pack rope wound flush around the right upper wooden horn rail + hanging tails
    for (let c = 0; c < 5; c++) {
      const wrap = new T.Mesh(new T.TorusGeometry(0.034, 0.0095, 7, 16), mats.sisalRopeMat);
      wrap.position.set(0.086, 0.548, -0.09 + c * 0.022);
      wrap.rotation.set(0.08, 0.06, -alpha);
      wrap.scale.set(0.78, 1.15, 1.0);
      g.add(wrap);
    }
    for (const [tz, xSpread] of [[-0.08, 1.08], [-0.01, 1.16]]) {
      const tailCrv = new T.CatmullRomCurve3([
        new T.Vector3(0.098, 0.525, tz),
        new T.Vector3(0.118 * xSpread, 0.36, tz + 0.02),
        new T.Vector3(0.168 * xSpread, 0.21, tz - 0.01),
        new T.Vector3(0.178 * xSpread, 0.06, tz + 0.015)
      ]);
      g.add(new T.Mesh(new T.TubeGeometry(tailCrv, 12, 0.0085, 6, false), mats.sisalRopeMat));
    }
    g.scale.setScalar(scale);
    return g;
  }

  /* ---------- Prop 4: Hero Stenciled `WATER = WIFI / SIGNAL OF GOD` 20L Roped Jerrycan (`kf11`!) ---------- */
  function makeHeroWifiJerikan(T, mats, scale = 1.0, withRope = true) {
    const g = new T.Group();
    const w = 0.25, h = 0.38, d = 0.185;
    const body = new T.Mesh(new T.BoxGeometry(w, h, d), mats.jugShellGlowMat);
    body.position.y = h * 0.5 + 0.01;
    body.castShadow = true;
    g.add(body);

    // Molded X-ribs on broad front/back faces (`atlas` bottom-right!)
    for (const sz of [-1, 1]) {
      for (const ang of [0.62, -0.62]) {
        const rib = new T.Mesh(new T.BoxGeometry(0.19, 0.016, 0.010), mats.jugShellGlowMat);
        rib.position.set(0, h * 0.48, sz * (d * 0.5 + 0.003));
        rib.rotation.z = ang;
        g.add(rib);
      }
      // Crisp `WATER = WIFI / SIGNAL OF GOD` glowing stencil decal (`jug_wifi_decal.png`!)
      const decal = new T.Mesh(new T.PlaneGeometry(w * 0.88, h * 0.82), mats.jugWifiDecalMat);
      decal.position.set(0, h * 0.50, sz * (d * 0.5 + 0.008));
      if (sz < 0) decal.rotation.y = Math.PI;
      g.add(decal);
    }

    // Top molded handle & blue screw cap (`kf11` & `kf15`!)
    const handle = new T.Mesh(new T.BoxGeometry(0.13, 0.036, 0.048), mats.jugShellGlowMat);
    handle.position.set(-0.03, h + 0.028, 0);
    g.add(handle);
    const spout = new T.Mesh(new T.CylinderGeometry(0.028, 0.034, 0.042, 12), mats.jugShellGlowMat);
    spout.position.set(0.068, h + 0.022, 0);
    spout.rotation.z = -0.18;
    g.add(spout);
    const cap = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.028, 14), mats.jugCapBlueMat);
    cap.position.set(0.074, h + 0.048, 0);
    cap.rotation.z = -0.18;
    g.add(cap);

    // Braided sisal-rope lashing harness (`atlas` bottom-right!)
    if (withRope) {
      const hw = w * 0.5 + 0.009, hd = d * 0.5 + 0.009;
      const beltPts = [
        new T.Vector3(-hw, h * 0.52, -hd), new T.Vector3(hw, h * 0.52, -hd),
        new T.Vector3(hw, h * 0.52, hd),   new T.Vector3(-hw, h * 0.52, hd),
        new T.Vector3(-hw, h * 0.52, -hd)
      ];
      g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(beltPts), 20, 0.0075, 6, false), mats.sisalRopeMat));
      const diagPts = [
        new T.Vector3(-hw, 0.08, hd), new T.Vector3(0, h * 0.52, hd + 0.005),
        new T.Vector3(hw, h * 0.92, hd), new T.Vector3(hw, h * 0.92, -hd),
        new T.Vector3(-hw, 0.08, -hd)
      ];
      g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(diagPts), 18, 0.007, 6, false), mats.sisalRopeMat));
    }
    g.scale.setScalar(scale);
    return g;
  }

  /* ---------- Shared Articulated Standpipe Lever & World-Space Hand-Grip Rig (`kf02`!) ---------- */
  function attachStandpipeLeverRig(T, mats, pumpRoot, fulcrumY = 1.15) {
    // Twin forged clevis ears bolted to pump bonnet
    for (const sz of [-0.024, 0.024]) {
      const ear = new T.Mesh(new T.BoxGeometry(0.056, 0.15, 0.012), mats.ironDarkMat);
      ear.position.set(-0.085, fulcrumY - 0.03, sz);
      ear.rotation.z = -0.18;
      pumpRoot.add(ear);
    }
    const fulcrumPin = new T.Mesh(new T.CylinderGeometry(0.013, 0.013, 0.072, 10), mats.steelMat);
    fulcrumPin.rotation.x = Math.PI * 0.5;
    fulcrumPin.position.set(-0.085, fulcrumY, 0);
    pumpRoot.add(fulcrumPin);

    const leverPivot = new T.Group();
    leverPivot.name = "pumpLeverPivot";
    leverPivot.position.set(-0.085, fulcrumY, 0);

    // Forged cast-iron rocker & round grip bar sloping gently (-0.18 rad) from fulcrum to operator hands
    const shaftCrv = new T.CatmullRomCurve3([
      new T.Vector3( 0.085,  0.020, 0),
      new T.Vector3( 0.000,  0.000, 0),
      new T.Vector3(-0.180, -0.028, 0),
      new T.Vector3(-0.380, -0.068, 0),
      new T.Vector3(-0.560, -0.100, 0)
    ]);
    const leverMesh = new T.Mesh(new T.TubeGeometry(shaftCrv, 16, 0.019, 10, false), mats.ironDarkMat);
    leverMesh.castShadow = true;
    leverPivot.add(leverMesh);

    const endKnob = new T.Mesh(new T.SphereGeometry(0.023, 10, 8), mats.ironDarkMat);
    endKnob.position.set(-0.565, -0.101, 0);
    leverPivot.add(endKnob);

    // Authoritative world-space hand-grip anchors parented directly to leverPivot (preserved across .clone()!)
    const gripNear = new T.Object3D();
    gripNear.name = "pumpGripNear";
    gripNear.position.set(-0.370, -0.066, 0.004);
    leverPivot.add(gripNear);

    const gripFar = new T.Object3D();
    gripFar.name = "pumpGripFar";
    gripFar.position.set(-0.480, -0.086, -0.004);
    leverPivot.add(gripFar);

    const gripCenter = new T.Object3D();
    gripCenter.name = "pumpGripCenter";
    gripCenter.position.set(-0.425, -0.076, 0);
    leverPivot.add(gripCenter);

    const gripTip = new T.Object3D();
    gripTip.name = "pumpGripTip";
    gripTip.position.set(-0.565, -0.101, 0);
    leverPivot.add(gripTip);

    pumpRoot.add(leverPivot);
    pumpRoot.setPumpPhase = (phase, out, opts) => stepStandpipePump(T, pumpRoot, phase, out, opts);
    pumpRoot.getGripWorld = out => {
      pumpRoot.updateWorldMatrix(true, true);
      return gripCenter.getWorldPosition(out || new T.Vector3());
    };
    return leverPivot;
  }

  /* ---------- Ballistic Parabolic Water Stream, Helical Surface Waves, Aerated Core & Splash Droplets ---------- */
  function buildBallisticPumpPour(T, cyanWaterMat, cfg = {}) {
    const pourGrp = new T.Group();
    pourGrp.name = "pumpPourGroup";
    const x0 = cfg.x0 !== undefined ? cfg.x0 : 0.345;
    const y0 = cfg.y0 !== undefined ? cfg.y0 : 0.790;
    const z0 = cfg.z0 !== undefined ? cfg.z0 : 0.0;
    const dirX = cfg.dirX !== undefined ? cfg.dirX : 0.78;
    const dirY = cfg.dirY !== undefined ? cfg.dirY : -0.625;
    const dirZ = cfg.dirZ !== undefined ? cfg.dirZ : 0.0;
    const hitY = cfg.hitY !== undefined ? cfg.hitY : 0.276;
    const baseR = cfg.baseR !== undefined ? cfg.baseR : 0.024;
    pourGrp.userData.pourCfg = { x0, y0, z0, dirX, dirY, dirZ, hitY, baseR };

    const makeTubularGridGeo = (segS, segR) => {
      const cols = segR + 1;
      const vCount = (segS + 1) * cols;
      const pos = new Float32Array(vCount * 3);
      const nrm = new Float32Array(vCount * 3);
      const uv = new Float32Array(vCount * 2);
      const idx = [];
      for (let i = 0; i <= segS; i++) {
        for (let j = 0; j <= segR; j++) {
          const k = (i * cols + j) * 2;
          uv[k] = j / segR;
          uv[k + 1] = i / segS;
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
      geo.setAttribute("uv", new T.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.boundingSphere = new T.Sphere(new T.Vector3(x0 + 0.14, (y0 + hitY) * 0.5, z0), 0.85);
      return geo;
    };

    const outerMat = cyanWaterMat || new T.MeshPhysicalMaterial({
      color: 0x3adcf2, emissive: 0x1096c0, emissiveIntensity: 0.82,
      roughness: 0.08, transmission: 0.34, transparent: true, opacity: 0.90, side: T.DoubleSide
    });
    const outerJet = new T.Mesh(makeTubularGridGeo(18, 12), outerMat);
    outerJet.name = "pumpStream";
    outerJet.frustumCulled = false;
    pourGrp.add(outerJet);

    const coreMat = new T.MeshBasicMaterial({
      color: 0xdffcff, transparent: true, opacity: 0.78, depthWrite: false
    });
    const innerCore = new T.Mesh(makeTubularGridGeo(14, 8), coreMat);
    innerCore.name = "pumpStreamCore";
    innerCore.frustumCulled = false;
    innerCore.renderOrder = 2;
    pourGrp.add(innerCore);

    for (let r = 0; r < 3; r++) {
      const rMat = new T.MeshBasicMaterial({
        color: r === 0 ? 0xe8ffff : 0x7ef4ff,
        transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false
      });
      const ring = new T.Mesh(new T.RingGeometry(0.036, 0.052, 24), rMat);
      ring.name = "pumpImpactRing_" + r;
      ring.rotation.x = -Math.PI * 0.5;
      ring.renderOrder = 3;
      pourGrp.add(ring);
    }

    const dropGeo = new T.SphereGeometry(0.0085, 6, 5);
    const dropMat = new T.MeshBasicMaterial({ color: 0xd8fcff, transparent: true, opacity: 0.90 });
    for (let d = 0; d < 10; d++) {
      const drop = new T.Mesh(dropGeo, dropMat);
      drop.name = "pumpSplashDrop_" + d;
      pourGrp.add(drop);
    }

    updateBallisticPumpPour(pourGrp, 0.45, 0.72, 1.0);
    return pourGrp;
  }

  function updateBallisticPumpPour(pourGrp, animPhase, flowPulse = 0.72, flowScale = 1.0) {
    if (!pourGrp) return;
    const outerJet = pourGrp.getObjectByName("pumpStream");
    const innerCore = pourGrp.getObjectByName("pumpStreamCore");
    if (!outerJet || !innerCore) return;

    // Ensure cloned pump instances each own independent dynamic vertex buffers & ripple materials
    if (pourGrp.userData.instanceUuid !== pourGrp.uuid) {
      if (pourGrp.userData.instanceUuid !== undefined) {
        outerJet.geometry = outerJet.geometry.clone();
        innerCore.geometry = innerCore.geometry.clone();
        for (let r = 0; r < 3; r++) {
          const rm = pourGrp.getObjectByName("pumpImpactRing_" + r);
          if (rm && rm.material) rm.material = rm.material.clone();
        }
      }
      pourGrp.userData.instanceUuid = pourGrp.uuid;
    }

    pourGrp.visible = flowScale > 0.08;
    if (!pourGrp.visible) return;

    const cfg = pourGrp.userData.pourCfg || {
      x0: 0.345, y0: 0.790, z0: 0.0, dirX: 0.78, dirY: -0.625, dirZ: 0.0, hitY: 0.276, baseR: 0.024
    };
    const dLen = Math.hypot(cfg.dirX, cfg.dirY, cfg.dirZ) || 1;
    const ux = cfg.dirX / dLen, uy = cfg.dirY / dLen, uz = cfg.dirZ / dLen;

    // Ballistic launch speed pulses realistically with pump down-stroke pressure!
    const pulse = clamp(flowPulse, 0, 1.25);
    const vMag = lerp(0.84, 1.18, clamp(pulse, 0, 1)) * clamp(0.65 + 0.35 * flowScale, 0.4, 1.15);
    const vx = ux * vMag, vy0 = uy * vMag, vz = uz * vMag;
    const gAcc = 9.81;
    const dyDrop = Math.max(0.05, cfg.y0 - cfg.hitY);
    const tFlight = (vy0 + Math.sqrt(vy0 * vy0 + 2.0 * gAcc * dyDrop)) / gAcc;

    const hitX = cfg.x0 + vx * tFlight;
    const hitZ = cfg.z0 + vz * tFlight;
    const hitY = cfg.hitY;

    const writeParabolicTube = (mesh, segS, segR, radScale, isCore) => {
      const pos = mesh.geometry.attributes.position.array;
      const nrm = mesh.geometry.attributes.normal.array;
      const cols = segR + 1;
      for (let i = 0; i <= segS; i++) {
        const u = i / segS;
        const ti = u * tFlight;
        const px = cfg.x0 + vx * ti;
        const py = cfg.y0 + vy0 * ti - 0.5 * gAcc * ti * ti;
        const pz = cfg.z0 + vz * ti;

        // Tangent T = normalize(vx, vy0 - g*ti, vz)
        let tx = vx, ty = vy0 - gAcc * ti, tz = vz;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;

        // Binormal B = normalize(T x Up)
        let bx = -tz, by = 0, bz = tx;
        let bl = Math.hypot(bx, by, bz);
        if (bl < 1e-4) { bx = 0; by = 0; bz = 1; bl = 1; }
        bx /= bl; by /= bl; bz /= bl;

        // Normal N = B x T
        const nx0 = by * tz - bz * ty;
        const ny0 = bz * tx - bx * tz;
        const nz0 = bx * ty - by * tx;

        // Vena-contracta gravitational thinning + hydraulic foot flare right at water impact
        const rProfile = cfg.baseR * radScale * (0.76 + 0.36 * pulse) * clamp(flowScale, 0.3, 1.1)
          * (1.0 - 0.28 * u + 0.24 * Math.pow(u, 4));

        for (let j = 0; j <= segR; j++) {
          const th = (j / segR) * TAU;
          const c = Math.cos(th), s = Math.sin(th);
          const hel1 = Math.sin(2.0 * th + u * 20.0 - animPhase * 3.8);
          const hel2 = Math.cos(3.0 * th - u * 14.0 - animPhase * 2.7);
          const ripple = isCore
            ? (1.0 + 0.14 * hel1 * (0.3 + 0.7 * u))
            : (1.0 + (0.045 + 0.11 * u) * hel1 + 0.055 * u * hel2);
          const r = Math.max(0.002, rProfile * ripple);

          const rnx = nx0 * c + bx * s;
          const rny = ny0 * c + by * s;
          const rnz = nz0 * c + bz * s;
          const idx3 = (i * cols + j) * 3;
          pos[idx3]     = px + rnx * r;
          pos[idx3 + 1] = py + rny * r;
          pos[idx3 + 2] = pz + rnz * r;
          nrm[idx3]     = rnx;
          nrm[idx3 + 1] = rny;
          nrm[idx3 + 2] = rnz;
        }
      }
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.attributes.normal.needsUpdate = true;
    };

    writeParabolicTube(outerJet, 18, 12, 1.00, false);
    writeParabolicTube(innerCore, 14, 8, 0.44, true);

    // Expanding concentric impact rings on the water surface
    for (let r = 0; r < 3; r++) {
      const ring = pourGrp.getObjectByName("pumpImpactRing_" + r);
      if (!ring) continue;
      const ph = frac(animPhase * 0.38 + r / 3);
      const sc = lerp(0.35, 3.10, ph) * (0.78 + 0.32 * pulse);
      ring.position.set(hitX, hitY + 0.004 + r * 0.0005, hitZ);
      ring.scale.set(sc, sc, 1);
      if (ring.material) {
        ring.material.opacity = (1 - ph) * smooth(0.0, 0.16, ph) * 0.80 * clamp(flowScale, 0, 1);
      }
    }

    // Ballistic crown splash droplets arcing up & outward from impact meniscus
    for (let d = 0; d < 10; d++) {
      const drop = pourGrp.getObjectByName("pumpSplashDrop_" + d);
      if (!drop) continue;
      const dPh = frac(animPhase * 0.62 + d * 0.137);
      const az = d * 2.39996 + Math.sin(animPhase * 0.25 + d) * 0.22;
      const vr = (0.16 + 0.09 * (d % 3)) * (0.68 + 0.50 * pulse);
      const vyD = (0.76 + 0.34 * ((d * 5) % 4) / 3) * (0.68 + 0.52 * pulse);
      const dtD = dPh * 0.23;
      const dyD = Math.max(0.004, vyD * dtD - 0.5 * gAcc * dtD * dtD);
      drop.position.set(
        hitX + Math.cos(az) * vr * dtD,
        hitY + dyD,
        hitZ + Math.sin(az) * vr * dtD
      );
      const dSc = Math.max(0.18, (1.0 - dPh * 0.72) * (0.72 + 0.48 * pulse));
      drop.scale.setScalar(dSc);
    }
  }

  function stepStandpipePump(T, pumpOrKey, phase, out = null, opts = null) {
    const root = typeof pumpOrKey === "string"
      ? (typeof window !== "undefined" && window.__npStandpipePumps ? window.__npStandpipePumps[pumpOrKey] : null)
      : pumpOrKey;
    if (!root) return out;

    const leverPivot = root.getObjectByName("pumpLeverPivot") || root.userData?.leverPivot;
    if (!leverPivot) return out;

    const rawSign = Boolean(opts && opts.rawLeverSign);
    const amp = (opts && opts.amp !== undefined) ? opts.amp : (rawSign ? 0.35 : 0.33);
    const flowScale = (opts && opts.flowScale !== undefined) ? opts.flowScale : 1.0;
    const rotZ = (rawSign ? Math.sin(phase) : -Math.sin(phase)) * amp * flowScale;
    leverPivot.rotation.z = rotZ;

    const strokeUp = -rotZ / Math.max(0.05, amp);
    const pistonRod = root.getObjectByName("pumpPistonRod");
    if (pistonRod) {
      const baseY = pistonRod.userData.baseY !== undefined ? pistonRod.userData.baseY : 1.24;
      pistonRod.position.y = baseY - strokeUp * 0.032;
    }
    const pourGrp = root.getObjectByName("pumpPourGroup");
    if (pourGrp) {
      const downSurge = 0.34 + 0.66 * clamp(0.5 - 0.5 * strokeUp, 0, 1);
      updateBallisticPumpPour(pourGrp, phase, downSurge, flowScale);
    } else {
      const stream = root.getObjectByName("pumpStream");
      if (stream) {
        const s = 0.84 + 0.22 * Math.max(0, -strokeUp);
        stream.scale.set(s, 1, s);
      }
    }

    root.updateWorldMatrix(true, true);

    if (out) {
      const gNear = leverPivot.getObjectByName("pumpGripNear");
      const gFar = leverPivot.getObjectByName("pumpGripFar");
      const gCenter = leverPivot.getObjectByName("pumpGripCenter");
      const gTip = leverPivot.getObjectByName("pumpGripTip");
      if (!out.pumpGripL) out.pumpGripL = new T.Vector3();
      if (!out.pumpGripR) out.pumpGripR = new T.Vector3();
      if (!out.pumpGripWorld) out.pumpGripWorld = new T.Vector3();
      if (!out.pumpBarDir) out.pumpBarDir = new T.Vector3();
      if (gFar) gFar.getWorldPosition(out.pumpGripL);
      if (gNear) gNear.getWorldPosition(out.pumpGripR);
      if (gCenter) gCenter.getWorldPosition(out.pumpGripWorld);
      else out.pumpGripWorld.copy(out.pumpGripL).add(out.pumpGripR).multiplyScalar(0.5);
      if (gTip && gNear) {
        gTip.getWorldPosition(out.pumpBarDir).sub(out.pumpGripR);
        if (out.pumpBarDir.lengthSq() > 1e-6) out.pumpBarDir.normalize();
        else out.pumpBarDir.set(-1, 0, 0);
      }
      out.pumpPhase = rawSign ? -phase : phase;
    }
    return out;
  }

  /* ---------- Prop 5: Cast-Iron Standpipe Hand Pump + Bolted Flange + Cyan Hose (`kf02` & `atlas`!) ---------- */
  function makeCastIronStandpipePump(T, mats, cyanWaterMat, hosePtsLocal = null) {
    const g = new T.Group();
    // Concrete pad + bolted cast-iron square flange (`kf02`!)
    const pad = new T.Mesh(new T.BoxGeometry(0.76, 0.20, 0.72), mats.concreteMat);
    pad.position.y = 0.10;
    pad.receiveShadow = true;
    g.add(pad);

    const basePlate = new T.Mesh(new T.BoxGeometry(0.36, 0.034, 0.36), mats.ironDarkMat);
    basePlate.position.y = 0.215;
    g.add(basePlate);
    for (const bx of [-0.13, 0.13]) {
      for (const bz of [-0.13, 0.13]) {
        const bolt = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.038, 6), mats.ironDarkMat);
        bolt.position.set(bx, 0.242, bz);
        g.add(bolt);
      }
    }

    // Cast-iron standpipe barrel with flanged bead collars (`kf02`!)
    const barrel = new T.Mesh(new T.CylinderGeometry(0.095, 0.112, 0.98, 16), mats.ironDarkMat);
    barrel.position.y = 0.71;
    barrel.castShadow = true;
    g.add(barrel);
    for (const ry of [0.46, 0.78, 1.06]) {
      const collar = new T.Mesh(new T.TorusGeometry(0.106, 0.016, 8, 18), mats.ironDarkMat);
      collar.rotation.x = Math.PI * 0.5;
      collar.position.y = ry;
      g.add(collar);
    }
    const topCup = new T.Mesh(new T.CylinderGeometry(0.128, 0.105, 0.18, 16), mats.ironDarkMat);
    topCup.position.y = 1.16;
    g.add(topCup);
    const pistonRod = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.26, 8), mats.steelMat);
    pistonRod.name = "pumpPistonRod";
    pistonRod.userData.baseY = 1.24;
    pistonRod.position.y = 1.24;
    g.add(pistonRod);

    // Curved cast-iron spout + articulated fulcrum pump lever (`kf02`!)
    const spoutCrv = new T.CatmullRomCurve3([
      new T.Vector3(0.06, 0.92, 0),
      new T.Vector3(0.22, 0.93, 0),
      new T.Vector3(0.29, 0.84, 0)
    ]);
    g.add(new T.Mesh(new T.TubeGeometry(spoutCrv, 10, 0.038, 10, false), mats.ironDarkMat));

    attachStandpipeLeverRig(T, mats, g, 1.19);

    // Threaded lower hose coupling + glowing cyan supply hose (`kf02`!)
    const tee = new T.Mesh(new T.CylinderGeometry(0.056, 0.056, 0.14, 14), mats.steelMat);
    tee.rotation.x = Math.PI * 0.5;
    tee.position.set(0, 0.38, 0.11);
    g.add(tee);

    const defaultHose = hosePtsLocal || [
      [0, 0.38, 0.16], [0, 0.24, 0.48], [0.18, 0.10, 0.92], [0.52, 0.08, 1.35]
    ];
    const hCrv = new T.CatmullRomCurve3(defaultHose.map(p => new T.Vector3(p[0], p[1], p[2])));
    g.add(new T.Mesh(new T.TubeGeometry(hCrv, 18, 0.038, 10, false), cyanWaterMat || mats.cyanTubeMat));
    return g;
  }

  /* ---------- Prop 6: Wind-Billowing Hidmo Doorway Curtain + Recessed Timber Doorway (`atlas` top-left!) ---------- */
  function makeHidmoDoorwayWithCurtain(T, mats, w = 1.24, h = 2.18) {
    const g = new T.Group();
    // Deep shadowed interior vestibule box so looking past the billowing curtain shows a real dark room (`atlas` top-left!)
    const vest = new T.Mesh(new T.BoxGeometry(w + 0.12, h + 0.06, 1.35), mats.darkInteriorMat);
    vest.position.set(0, h * 0.5 + 0.02, -0.72);
    g.add(vest);

    // Stone threshold step
    const step = new T.Mesh(new T.BoxGeometry(w + 0.42, 0.16, 0.58), mats.basaltPlinthMat);
    step.position.set(0, 0.08, 0.16);
    step.receiveShadow = true;
    g.add(step);

    // Heavy projecting rough-hewn cedar timber lintel & recessed timber jambs (`atlas` top-left & `kf15`!)
    const lintel = new T.Mesh(new T.BoxGeometry(w + 0.62, 0.16, 0.34), mats.vigaMat);
    lintel.position.set(0, h + 0.09, 0.06);
    lintel.castShadow = true;
    g.add(lintel);
    for (const sx of [-1, 1]) {
      const jamb = new T.Mesh(new T.BoxGeometry(0.12, h, 0.28), mats.timberDark);
      jamb.position.set(sx * (w * 0.5 + 0.04), h * 0.5, -0.02);
      g.add(jamb);
    }

    // Half-open weathered plank door swung inward on right jamb (`atlas` top-left!)
    const doorLeaf = new T.Mesh(new T.BoxGeometry(w * 0.72, h * 0.94, 0.06), mats.timberMat);
    doorLeaf.position.set(w * 0.22, h * 0.48, -0.34);
    doorLeaf.rotation.y = -0.82;
    g.add(doorLeaf);

    // Sculpted asymmetric off-white woven linen curtain pegged to lintel corners, swept & billowing (`atlas` top-left!)
    const cw = w * 1.04, ch = h * 0.94;
    const cGeo = new T.PlaneGeometry(cw, ch, 18, 22);
    const pos = cGeo.attributes.position;
    const uv = cGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i), v = uv.getY(i); // v=1 at lintel pegs, v=0 at bottom hem
      const drop = 1 - v;
      // Top-edge catenary sag between the left (u=0,v=1) and right (u=1,v=1) lintel pegs
      const topSag = Math.sin(u * Math.PI) * 0.14 * (1 - drop * 0.45);
      // Asymmetric breeze/tie gather pulling the left edge diagonally across to reveal the dark doorway (`atlas` top-left!)
      const sweepX = (1 - u) * Math.pow(drop, 1.15) * cw * 0.46;
      const liftY = (1 - u) * Math.pow(drop, 1.4) * 0.22;
      // Deep cloth pleats & forward wind belly
      const pleat = Math.sin((u * 5.2 + drop * 1.8) * Math.PI) * 0.042 * Math.sin(drop * Math.PI * 0.85 + 0.15);
      const bellyZ = Math.sin(drop * Math.PI * 0.9) * (0.14 + 0.10 * (1 - Math.abs(u - 0.58) * 1.6)) + pleat;
      pos.setXYZ(i, pos.getX(i) + sweepX, pos.getY(i) - topSag + liftY, Math.max(0.01, bellyZ));
    }
    cGeo.computeVertexNormals();
    const curtain = new T.Mesh(cGeo, mats.billowLinenMat);
    curtain.position.set(0, h - ch * 0.5 + 0.03, 0.15);
    curtain.castShadow = true;
    g.add(curtain);

    // Two iron/wood pegs securing top corners of linen curtain into the timber lintel
    for (const sx of [-1, 1]) {
      const peg = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.08, 8), mats.timberMat);
      peg.rotation.x = Math.PI * 0.5;
      peg.position.set(sx * cw * 0.49, h + 0.04, 0.22);
      g.add(peg);
    }
    return { group: g, curtain };
  }

  /* ---------- Build a Recessed Multi-Pane Highland Timber Window ---------- */
  function makeFramedWindow(T, mats, w, h, glassMat, hasShutters = true) {
    const g = new T.Group();
    const frameT = 0.065, depth = 0.14;
    const sill = new T.Mesh(new T.BoxGeometry(w + 0.18, 0.08, depth + 0.10), mats.stoneMat);
    sill.position.set(0, -h * 0.5 - 0.04, 0.02);
    g.add(sill);
    const lintel = new T.Mesh(new T.BoxGeometry(w + 0.26, 0.12, depth + 0.10), mats.vigaMat);
    lintel.position.set(0, h * 0.5 + 0.06, 0.02);
    g.add(lintel);

    for (const sx of [-1, 1]) {
      const jamb = new T.Mesh(new T.BoxGeometry(frameT, h, depth), mats.timberDark);
      jamb.position.set(sx * (w * 0.5 - frameT * 0.5), 0, 0);
      g.add(jamb);
    }
    const vMul = new T.Mesh(new T.BoxGeometry(0.036, h, depth * 0.7), mats.timberDark);
    g.add(vMul);
    const hMul = new T.Mesh(new T.BoxGeometry(w, 0.034, depth * 0.7), mats.timberDark);
    hMul.position.y = h * 0.08;
    g.add(hMul);

    const glass = new T.Mesh(new T.PlaneGeometry(w - frameT * 1.4, h - 0.06), glassMat);
    glass.position.z = -0.02;
    g.add(glass);

    if (hasShutters) {
      for (const sx of [-1, 1]) {
        const sh = new T.Mesh(new T.BoxGeometry(w * 0.44, h * 0.96, 0.035), mats.timberMat);
        sh.position.set(sx * (w * 0.5 + w * 0.22 + 0.02), 0, 0.04);
        sh.rotation.y = -sx * 0.24;
        g.add(sh);
      }
    }
    return { group: g, glass };
  }

  /* ---------- Build a Pitched Corrugated-Iron Gable Roof with Rafters & Overhang ---------- */
  function makeGableRoof(T, mats, spanX, pitchH, lenZ, withRoofStones = true) {
    const g = new T.Group();
    const halfW = spanX * 0.5 + 0.36;
    const slopeLen = Math.hypot(halfW, pitchH);
    const slopeAng = Math.atan2(pitchH, halfW);
    const roofZ = lenZ + 0.56;

    const triShape = new T.Shape();
    triShape.moveTo(-spanX * 0.5, 0);
    triShape.lineTo( spanX * 0.5, 0);
    triShape.lineTo(0, pitchH - 0.04);
    triShape.closePath();
    const triGeo = new T.ExtrudeGeometry(triShape, { depth: 0.22, bevelEnabled: false });
    triGeo.translate(0, 0, -0.11);
    for (const sz of [-1, 1]) {
      const tymp = new T.Mesh(triGeo, mats.stoneMat);
      tymp.position.z = sz * (lenZ * 0.5 - 0.11);
      g.add(tymp);
    }

    for (const sx of [-1, 1]) {
      const sheet = new T.Mesh(new T.BoxGeometry(slopeLen, 0.032, roofZ), mats.roofMat);
      sheet.position.set(sx * halfW * 0.5, pitchH * 0.5 + 0.02, 0);
      sheet.rotation.z = -sx * slopeAng;
      sheet.castShadow = true;
      sheet.receiveShadow = true;
      g.add(sheet);

      const nRafters = Math.max(4, Math.round(lenZ / 1.05));
      for (let r = 0; r <= nRafters; r++) {
        const rz = lerp(-lenZ * 0.48, lenZ * 0.48, r / nRafters);
        const raf = new T.Mesh(new T.BoxGeometry(slopeLen + 0.08, 0.075, 0.065), mats.timberDark);
        raf.position.set(sx * halfW * 0.5, pitchH * 0.5 - 0.03, rz);
        raf.rotation.z = -sx * slopeAng;
        g.add(raf);
      }

      if (withRoofStones) {
        for (let k = 0; k < 3; k++) {
          const u = 0.25 + k * 0.28;
          const st = new T.Mesh(new T.DodecahedronGeometry(0.13 + (k % 2) * 0.03, 0), mats.stoneMat);
          st.scale.set(1.2, 0.55, 0.95);
          st.position.set(sx * halfW * (0.35 + (k % 2) * 0.32), pitchH * (1 - (0.35 + (k % 2) * 0.32)) + 0.06, (u - 0.5) * lenZ * 0.8);
          g.add(st);
        }
      }
    }

    const ridge = new T.Mesh(new T.BoxGeometry(0.24, 0.065, roofZ + 0.04), mats.steelMat);
    ridge.position.y = pitchH + 0.03;
    g.add(ridge);
    return g;
  }

  /* ---------- Build Projecting Cedar/Juniper Viga Roof Beams + Parapet (`study_sheet` a & `kf15`!) ---------- */
  function addHidmoVigasAndParapet(T, mats, parent, w, roofY, d, vigasFront = true, vigasSides = false) {
    // Stone-coped mud parapet around flat earth roof
    const pH = 0.28, pT = 0.24;
    for (const sz of [-1, 1]) {
      const fb = new T.Mesh(new T.BoxGeometry(w + 0.08, pH, pT), mats.mudPlasterMat);
      fb.position.set(0, roofY + pH * 0.5, sz * (d * 0.5 - pT * 0.5));
      parent.add(fb);
      const cap = new T.Mesh(new T.BoxGeometry(w + 0.14, 0.06, pT + 0.06), mats.chapelStoneMat);
      cap.position.set(0, roofY + pH + 0.03, sz * (d * 0.5 - pT * 0.5));
      parent.add(cap);
    }
    for (const sx of [-1, 1]) {
      const sb = new T.Mesh(new T.BoxGeometry(pT, pH, d), mats.mudPlasterMat);
      sb.position.set(sx * (w * 0.5 - pT * 0.5), roofY + pH * 0.5, 0);
      parent.add(sb);
      const cap = new T.Mesh(new T.BoxGeometry(pT + 0.06, 0.06, d + 0.08), mats.chapelStoneMat);
      cap.position.set(sx * (w * 0.5 - pT * 0.5), roofY + pH + 0.03, 0);
      parent.add(cap);
    }
    // Compacted earth roof deck
    const deck = new T.Mesh(new T.BoxGeometry(w - 0.12, 0.08, d - 0.12), mats.mudPlasterMat);
    deck.position.y = roofY - 0.02;
    parent.add(deck);

    // Projecting round cedar/juniper viga beam ends (`study_sheet` a!)
    if (vigasFront) {
      const nV = Math.max(5, Math.round(w / 0.82));
      for (let i = 0; i < nV; i++) {
        const vx = lerp(-w * 0.43, w * 0.43, i / (nV - 1));
        for (const sz of [1, -1]) {
          const viga = new T.Mesh(new T.CylinderGeometry(0.068, 0.076, 0.58, 9), mats.vigaMat);
          viga.rotation.x = Math.PI * 0.5;
          viga.position.set(vx, roofY - 0.24, sz * (d * 0.5 + 0.17));
          viga.castShadow = true;
          parent.add(viga);
        }
      }
    }
    if (vigasSides) {
      const nS = Math.max(4, Math.round(d / 0.88));
      for (let i = 0; i < nS; i++) {
        const vz = lerp(-d * 0.42, d * 0.42, i / (nS - 1));
        const viga = new T.Mesh(new T.CylinderGeometry(0.068, 0.076, 0.56, 9), mats.vigaMat);
        viga.rotation.z = Math.PI * 0.5;
        viga.position.set(w * 0.5 + 0.16, roofY - 0.24, vz);
        viga.castShadow = true;
        parent.add(viga);
      }
    }
  }

  /* ---------- Build Highland Stone / Hidmo Mud-Plaster Dwelling (`village.jpg` & `kf15`!) ---------- */
  function makeHighlandHouse(T, mats, cfg, winList, dishList, darkWinMat, antennaMat) {
    const { w, h, d, twoStory, hasPorch, hasChimney, seed } = cfg;
    const grp = new T.Group();
    const isHidmoFlat = !twoStory && (seed % 2 === 1);

    // Deep battered basalt-and-fieldstone plinth so every dwelling seats rock-solid on mountain grades
    const plinth = new T.Mesh(new T.BoxGeometry(w + 0.34, 2.35, d + 0.34), isHidmoFlat ? mats.basaltPlinthMat : mats.stoneMat);
    plinth.position.y = -0.82;
    plinth.receiveShadow = true;
    grp.add(plinth);

    const gfH = twoStory ? h * 0.58 : h;
    const gf = new T.Mesh(new T.BoxGeometry(w, gfH, d), isHidmoFlat ? mats.hidmoWallMat : mats.stoneMat);
    gf.position.y = gfH * 0.5;
    gf.castShadow = true;
    gf.receiveShadow = true;
    grp.add(gf);

    let roofBaseY = gfH;
    if (twoStory) {
      const belt = new T.Mesh(new T.BoxGeometry(w + 0.16, 0.14, d + 0.16), mats.vigaMat);
      belt.position.y = gfH;
      grp.add(belt);

      const ufH = h * 0.56;
      const uf = new T.Mesh(new T.BoxGeometry(w * 0.98, ufH, d * 0.98), mats.mudPlasterMat);
      uf.position.y = gfH + ufH * 0.5;
      uf.castShadow = true;
      uf.receiveShadow = true;
      grp.add(uf);
      roofBaseY = gfH + ufH;

      for (const sx of [-0.30, 0, 0.30]) {
        const uw = makeFramedWindow(T, mats, 0.78, 0.92, darkWinMat, sx !== 0);
        uw.group.position.set(sx * w, gfH + ufH * 0.52, d * 0.49 + 0.02);
        grp.add(uw.group);
        winList.push(uw.glass);
      }
      for (const sx of [-1, 1]) {
        const sw = makeFramedWindow(T, mats, 0.72, 0.86, darkWinMat, false);
        sw.group.position.set(sx * (w * 0.49 + 0.02), gfH + ufH * 0.52, 0);
        sw.group.rotation.y = sx * Math.PI * 0.5;
        grp.add(sw.group);
        winList.push(sw.glass);
      }
    }

    if (isHidmoFlat) {
      // Authentic flat-roofed *hidmo* house with projecting cedar vigas & wind-billowing linen doorway curtain (`kf15` & `atlas`!)
      addHidmoVigasAndParapet(T, mats, grp, w, roofBaseY, d, true, false);
      const hidmoDoor = makeHidmoDoorwayWithCurtain(T, mats, 1.12, 2.04);
      hidmoDoor.group.position.set(0, 0, d * 0.5);
      grp.add(hidmoDoor.group);
    } else {
      const pitchH = clamp(w * 0.24, 0.95, 1.48);
      const roof = makeGableRoof(T, mats, w, pitchH, d, true);
      roof.position.y = roofBaseY;
      grp.add(roof);

      if (hasChimney) {
        const chim = new T.Mesh(new T.BoxGeometry(0.52, pitchH + 0.85, 0.52), mats.stoneMat);
        chim.position.set(-w * 0.30, roofBaseY + (pitchH + 0.85) * 0.45, -d * 0.22);
        grp.add(chim);
      }
      if (twoStory && antennaMat) {
        const mast = new T.Mesh(new T.CylinderGeometry(0.024, 0.032, 1.85, 6), antennaMat);
        mast.position.set(w * 0.26, roofBaseY + pitchH + 0.75, -d * 0.18);
        grp.add(mast);
        for (let a = 0; a < 3; a++) {
          const bar = new T.Mesh(new T.BoxGeometry(0.68 - a * 0.14, 0.018, 0.018), antennaMat);
          bar.position.set(w * 0.26, roofBaseY + pitchH + 1.25 + a * 0.18, -d * 0.18);
          grp.add(bar);
        }
        const beaconNode = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), darkWinMat);
        beaconNode.position.set(w * 0.26, roofBaseY + pitchH + 1.72, -d * 0.18);
        grp.add(beaconNode);
        dishList.push(beaconNode);
      }

      if (seed === 0 || seed === 3) {
        const hidmoDoor = makeHidmoDoorwayWithCurtain(T, mats, 1.10, 2.00);
        hidmoDoor.group.position.set(0, 0, d * 0.5);
        grp.add(hidmoDoor.group);
      } else {
        const doorFrame = new T.Mesh(new T.BoxGeometry(1.16, 2.02, 0.16), mats.timberDark);
        doorFrame.position.set(0, 1.01, d * 0.5 + 0.01);
        grp.add(doorFrame);
        const doorLeaf = new T.Mesh(new T.BoxGeometry(0.98, 1.90, 0.08), mats.timberMat);
        doorLeaf.position.set(0, 0.96, d * 0.5 + 0.03);
        grp.add(doorLeaf);
        for (const hy of [0.45, 1.48]) {
          const strap = new T.Mesh(new T.BoxGeometry(0.52, 0.045, 0.02), mats.ironDarkMat);
          strap.position.set(-0.20, hy, d * 0.5 + 0.075);
          grp.add(strap);
        }
        const step = new T.Mesh(new T.BoxGeometry(1.48, 0.22, 0.62), mats.stoneMat);
        step.position.set(0, 0.08, d * 0.5 + 0.30);
        grp.add(step);
      }
    }

    // Flanking ground-floor framed windows
    for (const sx of [-1, 1]) {
      const gw = makeFramedWindow(T, mats, 0.80, 0.90, darkWinMat, true);
      gw.group.position.set(sx * w * 0.31, 1.28, d * 0.5 + 0.02);
      grp.add(gw.group);
      winList.push(gw.glass);
    }

    if (hasPorch && !isHidmoFlat) {
      const pDepth = 1.55, pW = w * 0.88;
      const shed = new T.Mesh(new T.BoxGeometry(pW + 0.2, 0.035, pDepth + 0.25), mats.roofMat);
      shed.position.set(0, 2.22, d * 0.5 + pDepth * 0.5);
      shed.rotation.x = 0.24;
      grp.add(shed);
      for (const px of [-pW * 0.45, 0, pW * 0.45]) {
        const post = new T.Mesh(new T.CylinderGeometry(0.055, 0.065, 2.15, 8), mats.timberDark);
        post.position.set(px, 1.02, d * 0.5 + pDepth - 0.12);
        grp.add(post);
      }
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const log = new T.Mesh(new T.CylinderGeometry(0.055, 0.06, 0.58, 7), mats.timberMat);
          log.rotation.z = Math.PI * 0.5;
          log.position.set(-pW * 0.28 + c * 0.12, 0.08 + r * 0.105, d * 0.5 + 0.36);
          grp.add(log);
        }
      }
    }
    return grp;
  }

  /* ---------- Build Clothesline with Wind-Billowing Shirts, Trousers & Sheets (`village.jpg`) ---------- */
  function makeClothesline(T, mats, len = 7.4) {
    const g = new T.Group();
    for (const sx of [-1, 1]) {
      const pole = new T.Mesh(new T.CylinderGeometry(0.048, 0.065, 2.35, 8), mats.timberDark);
      pole.position.set(sx * len * 0.5, 1.10, 0);
      pole.rotation.z = sx * 0.04;
      g.add(pole);
    }
    const sagPts = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      sagPts.push(new T.Vector3(lerp(-len * 0.5, len * 0.5, u), 2.12 - Math.sin(u * Math.PI) * 0.22, 0));
    }
    const ropeCrv = new T.CatmullRomCurve3(sagPts);
    g.add(new T.Mesh(new T.TubeGeometry(ropeCrv, 20, 0.008, 5, false), mats.ironDarkMat));

    const clothMats = [mats.billowLinenMat, mats.laundryMidMat, mats.laundryDarkMat];
    const items = [
      [0.12, 0.85, 0.92, 0], [0.26, 0.72, 1.05, 1], [0.40, 0.52, 1.18, 2],
      [0.53, 0.95, 0.88, 0], [0.68, 0.68, 0.96, 1], [0.82, 0.78, 0.84, 0]
    ];
    const drapedMeshes = [];
    for (let k = 0; k < items.length; k++) {
      const [u, cw, ch, mIdx] = items[k];
      const anchor = ropeCrv.getPointAt(u);
      const geo = new T.PlaneGeometry(cw, ch, 8, 8);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i);
        const drop = 0.5 - vy / ch;
        const pleat = Math.sin(vx * 18 + k * 2) * 0.035 * drop;
        p.setZ(i, pleat + drop * drop * 0.06);
      }
      geo.computeVertexNormals();
      const m = new T.Mesh(geo, clothMats[mIdx]);
      m.position.set(anchor.x, anchor.y - ch * 0.5 + 0.02, anchor.z);
      m.castShadow = true;
      g.add(m);
      drapedMeshes.push({ mesh: m, baseRotX: 0, phase: k * 1.1 });
    }
    return { group: g, drapedMeshes };
  }

  /* ---------- Build Wooden Yard / Screening Chair ---------- */
  function makeWoodenChair(T, mats) {
    const g = new T.Group();
    const seat = new T.Mesh(new T.BoxGeometry(0.48, 0.035, 0.46), mats.timberMat);
    seat.position.y = 0.45;
    g.add(seat);
    for (const lx of [-0.20, 0.20]) {
      for (const lz of [-0.19, 0.19]) {
        const leg = new T.Mesh(new T.BoxGeometry(0.042, 0.45, 0.042), mats.timberDark);
        leg.position.set(lx, 0.225, lz);
        g.add(leg);
      }
    }
    for (const lx of [-0.20, 0.20]) {
      const post = new T.Mesh(new T.BoxGeometry(0.042, 0.48, 0.042), mats.timberDark);
      post.position.set(lx, 0.69, -0.20);
      post.rotation.x = -0.08;
      g.add(post);
    }
    for (const by of [0.64, 0.84]) {
      const slat = new T.Mesh(new T.BoxGeometry(0.46, 0.075, 0.028), mats.timberMat);
      slat.position.set(0, by, -0.215);
      g.add(slat);
    }
    return g;
  }

  /* ---------- ZZlDs10FCZk Film-Matched Architectural & Water-Hardware Pieces ---------- */

  // 1. Wheel-Thrown Terracotta Clay Watering Bowl (`shekla`) on Wet Bedrock (kf16 02:03 & Study Sheet d!)
  function makeTerracottaDonkeyBowl(T, mats, cyanWaterMat) {
    const g = new T.Group();
    const clayMat = new T.MeshStandardMaterial({
      color: 0x9b5a3c, roughness: 0.78, bumpMap: mats.plasterMat.map, bumpScale: 0.016, side: T.DoubleSide
    });
    const wetRockMat = new T.MeshStandardMaterial({ color: 0x262523, roughness: 0.34, metalness: 0.08 });
    // Wet splashed stone slab under the clay basin
    const slab = new T.Mesh(new T.CylinderGeometry(0.62, 0.70, 0.07, 18), wetRockMat);
    slab.position.y = 0.035;
    slab.receiveShadow = true;
    g.add(slab);

    // Lathe profile: flat foot -> flaring terracotta wall with 3 incised throwing rings -> rolled rim!
    const prof = [
      new T.Vector2(0.00, 0.07),
      new T.Vector2(0.24, 0.07),
      new T.Vector2(0.29, 0.14),
      new T.Vector2(0.34, 0.22),
      new T.Vector2(0.38, 0.28),
      new T.Vector2(0.415, 0.315),
      new T.Vector2(0.395, 0.328),
      new T.Vector2(0.365, 0.295),
      new T.Vector2(0.23, 0.09),
      new T.Vector2(0.00, 0.09)
    ];
    const bowl = new T.Mesh(new T.LatheGeometry(prof, 32), clayMat);
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    g.add(bowl);
    for (const ry of [0.21, 0.24, 0.27]) {
      const ring = new T.Mesh(new T.TorusGeometry(0.33 + (ry - 0.21) * 0.82, 0.006, 6, 30), clayMat);
      ring.rotation.x = Math.PI * 0.5;
      ring.position.y = ry;
      g.add(ring);
    }
    const water = new T.Mesh(new T.CircleGeometry(0.365, 28), cyanWaterMat);
    water.rotation.x = -Math.PI * 0.5;
    water.position.y = 0.275;
    g.add(water);
    return g;
  }

  // 2. Wooden X-Frame Donkey Sawbuck Pack Frame + Braided Sisal Lashing + Embossed-X 20L Jerrycan (kf14 & Study Sheet d!)
  function makeSawbuckAndRibbedCan(T, mats, cyanWaterMat) {
    const g = new T.Group();
    const saw = makeSawbuckPackFrame(T, mats, 1.06);
    saw.name = "sawbuckFrame";
    g.add(saw);

    // Translucent Embossed-X 20L Jerrycan resting beside sawbuck (named so Study Plate 2 can hide it while sharing one 20L can)
    const canG = new T.Group();
    canG.name = "restingCan";
    canG.position.set(0.52, 0, 0.08);
    canG.rotation.y = -0.35;
    const shellMat = new T.MeshPhysicalMaterial({
      color: 0xcfe8ee, roughness: 0.26, transmission: 0.35, transparent: true, opacity: 0.88
    });
    const body = new T.Mesh(new T.BoxGeometry(0.20, 0.38, 0.28), shellMat);
    body.position.y = 0.19;
    body.castShadow = true;
    canG.add(body);
    const fill = new T.Mesh(new T.BoxGeometry(0.178, 0.27, 0.258), cyanWaterMat);
    fill.position.y = 0.145;
    canG.add(fill);
    for (const sx of [-1, 1]) {
      for (const rz of [-0.64, 0.64]) {
        const rib = new T.Mesh(new T.BoxGeometry(0.014, 0.26, 0.024), shellMat);
        rib.position.set(sx * 0.102, 0.18, 0);
        rib.rotation.x = rz;
        canG.add(rib);
      }
    }
    const hdl = new T.Mesh(new T.BoxGeometry(0.038, 0.045, 0.15), shellMat);
    hdl.position.set(0, 0.40, -0.02);
    canG.add(hdl);
    const cap = new T.Mesh(new T.CylinderGeometry(0.028, 0.030, 0.036, 12), mats.ironDarkMat);
    cap.position.set(0, 0.40, 0.09);
    canG.add(cap);
    // Stenciled "WATER = WIFI / SIGNAL OF GOD / +" front badge (kf11 00:58!)
    if (typeof document !== "undefined") {
      const cnv = document.createElement("canvas");
      cnv.width = 256; cnv.height = 256;
      const ctx = cnv.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 256, 256);
        ctx.strokeStyle = "#eafcff"; ctx.fillStyle = "#eafcff"; ctx.lineWidth = 7;
        for (const r of [24, 42, 60]) {
          ctx.beginPath(); ctx.arc(128, 86, r, -Math.PI * 0.78, -Math.PI * 0.22); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(128, 92, 7, 0, TAU); ctx.fill();
        ctx.textAlign = "center";
        ctx.font = "700 26px Inter, system-ui, sans-serif";
        ctx.fillText("WATER = WIFI", 128, 138);
        ctx.font = "600 18px Inter, system-ui, sans-serif";
        ctx.fillText("SIGNAL OF GOD", 128, 166);
        ctx.fillRect(122, 184, 12, 48);
        ctx.fillRect(106, 198, 44, 12);
        const stTex = new T.CanvasTexture(cnv);
        if (T.SRGBColorSpace) stTex.colorSpace = T.SRGBColorSpace;
        const stMat = new T.MeshBasicMaterial({ map: stTex, transparent: true, opacity: 0.92, depthWrite: false });
        const stPlane = new T.Mesh(new T.PlaneGeometry(0.16, 0.22), stMat);
        stPlane.position.set(0, 0.19, 0.142);
        canG.add(stPlane);
      }
    }
    g.add(canG);
    return g;
  }

  // 3. Cast-Iron Standpipe Hand Pump on Concrete Pad (kf02 00:02 & Study Sheet d!)
  function makeStandpipePump(T, mats, cyanWaterMat) {
    const g = new T.Group();
    const pad = new T.Mesh(new T.BoxGeometry(0.56, 0.16, 0.56), mats.concreteMat);
    pad.position.y = 0.08;
    pad.receiveShadow = true;
    g.add(pad);
    const flange = new T.Mesh(new T.BoxGeometry(0.34, 0.036, 0.34), mats.ironDarkMat);
    flange.position.y = 0.178;
    g.add(flange);
    for (const bx of [-0.125, 0.125]) {
      for (const bz of [-0.125, 0.125]) {
        const bolt = new T.Mesh(new T.CylinderGeometry(0.019, 0.019, 0.034, 6), mats.ironDarkMat);
        bolt.position.set(bx, 0.202, bz);
        g.add(bolt);
      }
    }
    const col = new T.Mesh(new T.CylinderGeometry(0.088, 0.104, 0.94, 16), mats.ironDarkMat);
    col.position.y = 0.67;
    col.castShadow = true;
    g.add(col);
    for (const ry of [0.44, 0.76, 1.04]) {
      const collar = new T.Mesh(new T.TorusGeometry(0.098, 0.014, 8, 18), mats.ironDarkMat);
      collar.rotation.x = Math.PI * 0.5;
      collar.position.y = ry;
      g.add(collar);
    }
    const topCup = new T.Mesh(new T.CylinderGeometry(0.118, 0.098, 0.16, 16), mats.ironDarkMat);
    topCup.position.y = 1.13;
    g.add(topCup);
    const pistonRod = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.26, 8), mats.steelMat);
    pistonRod.name = "pumpPistonRod";
    pistonRod.userData.baseY = 1.22;
    pistonRod.position.y = 1.22;
    g.add(pistonRod);
    const spout = new T.Mesh(
      new T.TubeGeometry(new T.CatmullRomCurve3([
        new T.Vector3(0.06, 0.90, 0),
        new T.Vector3(0.24, 0.89, 0),
        new T.Vector3(0.345, 0.79, 0)
      ]), 12, 0.034, 10, false),
      mats.ironDarkMat
    );
    g.add(spout);
    attachStandpipeLeverRig(T, mats, g, 1.15);
    g.add(buildBallisticPumpPour(T, cyanWaterMat, {
      x0: 0.345, y0: 0.790, z0: 0.0,
      dirX: 0.78, dirY: -0.625, dirZ: 0.0,
      hitY: 0.276, baseR: 0.024
    }));
    return g;
  }

  // 4. Ethiopian Highland L-Shaped Flat-Roofed Hidmo Compound House + Cyan Courtyard Well (kf15 01:53 & Study Sheet a!)
  function makeHidmoCompoundHouse(T, mats, cyanWaterMat, darkWinMat) {
    const g = new T.Group();
    const winMat = darkWinMat || mats.ironDarkMat;

    // Main Stone-and-Mud Wing (left/back) + Lower Porch Wing (right)
    const wingA = new T.Mesh(new T.BoxGeometry(5.8, 3.05, 3.8), mats.stoneMat);
    wingA.position.set(-1.2, 1.52, -1.2);
    wingA.castShadow = true; wingA.receiveShadow = true;
    g.add(wingA);
    // Flat earthen roof parapet coping + protruding cedar vigas!
    const copA = new T.Mesh(new T.BoxGeometry(5.96, 0.24, 3.96), mats.plasterMat);
    copA.position.set(-1.2, 3.12, -1.2);
    g.add(copA);
    for (let i = 0; i < 8; i++) {
      const viga = new T.Mesh(new T.CylinderGeometry(0.055, 0.06, 4.35, 7), mats.timberDark);
      viga.rotation.x = Math.PI * 0.5;
      viga.position.set(-3.65 + i * 0.70, 2.76, -1.05);
      viga.castShadow = true;
      g.add(viga);
    }

    const wingB = new T.Mesh(new T.BoxGeometry(3.4, 2.55, 4.2), mats.plasterMat);
    wingB.position.set(2.8, 1.27, 0.4);
    wingB.castShadow = true; wingB.receiveShadow = true;
    g.add(wingB);
    const copB = new T.Mesh(new T.BoxGeometry(3.56, 0.22, 4.36), mats.stoneMat);
    copB.position.set(2.8, 2.64, 0.4);
    g.add(copB);
    for (let i = 0; i < 6; i++) {
      const viga = new T.Mesh(new T.CylinderGeometry(0.05, 0.055, 3.85, 7), mats.timberDark);
      viga.rotation.z = Math.PI * 0.5;
      viga.position.set(2.65, 2.32, -1.25 + i * 0.66);
      g.add(viga);
    }

    // Recessed plank doorway + framed windows into courtyard
    const door = new T.Mesh(new T.BoxGeometry(0.98, 1.92, 0.12), mats.timberMat);
    door.position.set(-2.4, 0.98, 0.72);
    g.add(door);
    for (const wx of [-0.8, 0.6]) {
      const fw = makeFramedWindow(T, mats, 0.76, 0.86, winMat, false);
      fw.group.position.set(wx, 1.52, 0.72);
      g.add(fw.group);
    }
    const fwSide = makeFramedWindow(T, mats, 0.74, 0.84, winMat, false);
    fwSide.group.position.set(1.08, 1.42, 0.95);
    fwSide.group.rotation.y = -Math.PI * 0.5;
    g.add(fwSide.group);

    // Circular Coursed-Stone Cyan Courtyard Well (`study_sheet_architecture.jpg` panel a!)
    const wellWall = new T.Mesh(new T.CylinderGeometry(0.78, 0.82, 0.46, 22, 1, true), mats.stoneMat);
    wellWall.position.set(-0.25, 0.23, 1.75);
    wellWall.castShadow = true;
    g.add(wellWall);
    const wellCoping = new T.Mesh(new T.TorusGeometry(0.79, 0.075, 8, 24), mats.stoneMat);
    wellCoping.rotation.x = Math.PI * 0.5;
    wellCoping.position.set(-0.25, 0.46, 1.75);
    g.add(wellCoping);
    const wellPool = new T.Mesh(new T.CircleGeometry(0.74, 22), cyanWaterMat);
    wellPool.rotation.x = -Math.PI * 0.5;
    wellPool.position.set(-0.25, 0.38, 1.75);
    g.add(wellPool);
    return g;
  }

  // 5. Gabled Coursed-Stone Highland Chapel / Archive with Arched Door, Lancets & Rooftop Cross (kf06 00:20 & Study Sheet b!)
  function makeStoneCrossChapel(T, mats, darkWinMat) {
    const g = new T.Group();
    const w = 5.4, h = 3.65, d = 6.6;
    const winMat = darkWinMat || mats.ironDarkMat;

    // Stepped stone plinth
    const plinth = new T.Mesh(new T.BoxGeometry(w + 0.5, 0.34, d + 0.5), mats.stoneMat);
    plinth.position.y = 0.17;
    plinth.receiveShadow = true;
    g.add(plinth);

    const body = new T.Mesh(new T.BoxGeometry(w, h, d), mats.stoneMat);
    body.position.y = 0.34 + h * 0.5;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    // Corner masonry pilasters + eave finials (`kf06`!)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pil = new T.Mesh(new T.BoxGeometry(0.28, h + 0.1, 0.28), mats.plasterMat);
        pil.position.set(sx * (w * 0.5 - 0.06), 0.34 + h * 0.5, sz * (d * 0.5 - 0.06));
        g.add(pil);
      }
      const finial = new T.Mesh(new T.ConeGeometry(0.13, 0.42, 6), mats.stoneMat);
      finial.position.set(sx * (w * 0.5 + 0.05), 0.34 + h + 0.22, d * 0.5 - 0.12);
      g.add(finial);
    }

    // Steep pitched gable roof + stone rooftop Latin Cross!
    const pitchH = 1.95;
    const roof = makeGableRoof(T, mats, w, pitchH, d, false);
    roof.position.y = 0.34 + h;
    g.add(roof);

    const crossV = new T.Mesh(new T.BoxGeometry(0.11, 0.92, 0.11), mats.stoneMat);
    crossV.position.set(0, 0.34 + h + pitchH + 0.48, d * 0.5 - 0.16);
    g.add(crossV);
    const crossH = new T.Mesh(new T.BoxGeometry(0.56, 0.10, 0.10), mats.stoneMat);
    crossH.position.set(0, 0.34 + h + pitchH + 0.66, d * 0.5 - 0.16);
    g.add(crossH);

    // Semicircular Arched Plank Doorway + Flanking Arched Lancet Windows + Gable Belfry Lancet (`study_sheet_architecture.jpg` b!)
    const doorRect = new T.Mesh(new T.BoxGeometry(1.18, 1.85, 0.14), mats.timberMat);
    doorRect.position.set(0, 0.34 + 0.925, d * 0.5 + 0.02);
    g.add(doorRect);
    const doorArch = new T.Mesh(new T.CylinderGeometry(0.59, 0.59, 0.14, 18, 1, false, 0, Math.PI), mats.timberMat);
    doorArch.rotation.z = -Math.PI * 0.5;
    doorArch.rotation.y = Math.PI * 0.5;
    doorArch.position.set(0, 0.34 + 1.85, d * 0.5 + 0.02);
    g.add(doorArch);
    const stoneArch = new T.Mesh(new T.TorusGeometry(0.66, 0.085, 8, 18, Math.PI), mats.plasterMat);
    stoneArch.position.set(0, 0.34 + 1.85, d * 0.5 + 0.05);
    g.add(stoneArch);

    // Flanking front lancets + upper gable lancet
    for (const [lx, ly, lw, lh] of [[-1.65, 1.85, 0.38, 1.05], [1.65, 1.85, 0.38, 1.05], [0, h + 0.72, 0.34, 0.82]]) {
      const lan = new T.Mesh(new T.BoxGeometry(lw, lh, 0.12), winMat);
      lan.position.set(lx, 0.34 + ly, d * 0.5 + 0.03);
      g.add(lan);
      const lFrame = new T.Mesh(new T.TorusGeometry(lw * 0.54, 0.045, 6, 12, Math.PI), mats.plasterMat);
      lFrame.position.set(lx, 0.34 + ly + lh * 0.5, d * 0.5 + 0.05);
      g.add(lFrame);
    }
    return g;
  }

  // 6. Cutaway Liquid-Cooled Cross Server Sanctuary & Wire-Glass Registry Bay (kf07 00:24 & Study Sheet c!)
  function makeCyanServerSanctuary(T, mats, cyanWaterMat) {
    const g = new T.Group();
    // Cutaway concrete floor, rear wall with glowing white Cross & left diamond wire-glass wall!
    const floor = new T.Mesh(new T.BoxGeometry(4.6, 0.18, 4.4), mats.concreteMat);
    floor.position.y = 0.09;
    floor.receiveShadow = true;
    g.add(floor);
    const slateFloorMat = new T.MeshStandardMaterial({ color: 0x12191e, roughness: 0.16, metalness: 0.38 });
    const wetFilm = new T.Mesh(new T.PlaneGeometry(4.3, 4.1), slateFloorMat);
    wetFilm.rotation.x = -Math.PI * 0.5;
    wetFilm.position.y = 0.184;
    wetFilm.receiveShadow = true;
    g.add(wetFilm);
    // Glowing cyan floor cooling channel loop (`kf07`!)
    for (const [cx, cz, cw, cd] of [[0, -1.65, 1.45, 0.04], [0, 1.35, 1.45, 0.04], [-0.72, -0.15, 0.04, 3.04], [0.72, -0.15, 0.04, 3.04]]) {
      const ch = new T.Mesh(new T.PlaneGeometry(cw, cd), cyanWaterMat);
      ch.rotation.x = -Math.PI * 0.5;
      ch.position.set(cx, 0.188, cz);
      g.add(ch);
    }

    const backWall = new T.Mesh(new T.BoxGeometry(4.6, 3.1, 0.22), mats.concreteMat);
    backWall.position.set(0, 1.64, -2.09);
    g.add(backWall);

    // Luminous white Cross at end of server aisle (`kf07`!)
    const whiteGlow = new T.MeshBasicMaterial({ color: 0xf7fbff });
    const cV = new T.Mesh(new T.BoxGeometry(0.09, 0.86, 0.05), whiteGlow);
    cV.position.set(0, 2.12, -1.95);
    g.add(cV);
    const cH = new T.Mesh(new T.BoxGeometry(0.52, 0.09, 0.05), whiteGlow);
    cH.position.set(0, 2.28, -1.95);
    g.add(cH);
    const aisleLight = new T.PointLight(0x46e6ff, 1.85, 6.5, 1.5);
    aisleLight.position.set(0, 1.65, -0.2);
    g.add(aisleLight);
    const clerkLight = new T.PointLight(0xfff0d4, 1.25, 4.2, 1.6);
    clerkLight.position.set(-1.65, 2.25, 0.35);
    g.add(clerkLight);

    // Left cutaway concrete wall with Georgian diamond wire-glass Registry pass-through window + counter!
    const leftLow = new T.Mesh(new T.BoxGeometry(0.24, 0.98, 4.4), mats.concreteMat);
    leftLow.position.set(-2.18, 0.58, 0);
    g.add(leftLow);
    const leftHigh = new T.Mesh(new T.BoxGeometry(0.24, 0.55, 4.4), mats.concreteMat);
    leftHigh.position.set(-2.18, 2.92, 0);
    g.add(leftHigh);
    const counter = new T.Mesh(new T.BoxGeometry(0.58, 0.07, 2.6), mats.counterChipMat);
    counter.position.set(-2.22, 1.08, 0.25);
    g.add(counter);
    const wg = new T.Mesh(new T.PlaneGeometry(2.5, 1.32), mats.wireGlassMat);
    wg.rotation.y = Math.PI * 0.5;
    wg.position.set(-2.18, 1.88, 0.25);
    g.add(wg);

    // Twin rows of 19-inch black server racks + 1U blade faceplates + glowing cyan floor-to-rack cooling tubes (`kf07`!)
    const ledCyan = new T.MeshBasicMaterial({ color: 0x56f0ff });
    for (const sx of [-1, 1]) {
      for (let r = 0; r < 2; r++) {
        const rz = -1.05 + r * 1.35;
        const rack = new T.Mesh(new T.BoxGeometry(0.72, 2.28, 0.88), mats.ironDarkMat);
        rack.position.set(sx * 1.38, 1.32, rz);
        rack.castShadow = true;
        g.add(rack);
        // Brushed steel corner rails & 1U blade bays with cyan status LEDs facing center aisle
        for (let u = 0; u < 7; u++) {
          const uy = 0.42 + u * 0.27;
          const bay = new T.Mesh(new T.BoxGeometry(0.02, 0.19, 0.74), mats.steelMat);
          bay.position.set(sx * 1.015, uy, rz);
          g.add(bay);
          const led = new T.Mesh(new T.BoxGeometry(0.024, 0.022, 0.16), ledCyan);
          led.position.set(sx * 1.012, uy + 0.05, rz - 0.22);
          g.add(led);
        }
        // Glowing cyan liquid-cooling tube arching out of floor port into rack collar!
        const collar = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.08, 12), mats.steelMat);
        collar.rotation.z = Math.PI * 0.5;
        collar.position.set(sx * 0.99, 1.48 - r * 0.22, rz);
        g.add(collar);
        const tubeCrv = new T.CatmullRomCurve3([
          new T.Vector3(sx * 0.55, 0.18, rz + 0.18),
          new T.Vector3(sx * 0.62, 0.92, rz + 0.10),
          new T.Vector3(sx * 0.84, 1.44 - r * 0.22, rz),
          new T.Vector3(sx * 1.02, 1.48 - r * 0.22, rz)
        ]);
        g.add(new T.Mesh(new T.TubeGeometry(tubeCrv, 18, 0.046, 10, false), cyanWaterMat));
      }
    }
    return g;
  }
  /* ---------- Build Ergonomic Swivel Task Chair for Hill Archive `REC PPC` (`kf08`!) ---------- */
  function makeOfficeTaskChair(T, mats) {
    const g = new T.Group();
    const hub = new T.Mesh(new T.CylinderGeometry(0.032, 0.036, 0.36, 10), mats.ironDarkMat);
    hub.position.y = 0.24;
    g.add(hub);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      const leg = new T.Mesh(new T.BoxGeometry(0.036, 0.026, 0.28), mats.ironDarkMat);
      leg.position.set(Math.sin(a) * 0.13, 0.06, Math.cos(a) * 0.13);
      leg.rotation.y = a;
      g.add(leg);
    }
    const cushion = new T.Mesh(new T.BoxGeometry(0.48, 0.055, 0.46), mats.laundryDarkMat);
    cushion.position.y = 0.44;
    g.add(cushion);
    const spine = new T.Mesh(new T.BoxGeometry(0.06, 0.46, 0.035), mats.ironDarkMat);
    spine.position.set(0, 0.66, -0.23);
    spine.rotation.x = -0.10;
    g.add(spine);
    const backrest = new T.Mesh(new T.BoxGeometry(0.44, 0.44, 0.032), mats.laundryDarkMat);
    backrest.position.set(0, 0.75, -0.245);
    backrest.rotation.x = -0.08;
    g.add(backrest);
    return g;
  }

  /* ---------- Attach Cyan Sight-Windows + `WATER = WIFI / SIGNAL OF GOD` Stencil to Mistletoe (`saddle.jpg` & `kf11`!) ---------- */
  function attachSaddleSightWindows(T, donkey, mats) {
    if (!donkey || !donkey.pack || donkey.pack.userData.hasSightWindows) return;
    donkey.pack.userData.hasSightWindows = true;
    const frameMat = new T.MeshStandardMaterial({ color: 0x1a1613, roughness: 0.68 });
    const glowWindowMat = new T.MeshStandardMaterial({
      color: 0x3ae8ff, emissive: 0x16b8df, emissiveIntensity: 1.55, roughness: 0.16
    });
    donkey.pack.traverse(obj => {
      if (obj.isGroup && Math.abs(Math.abs(obj.position.x) - 0.095) < 0.01 && Math.abs(obj.position.y + 0.225) < 0.02) {
        const s = Math.sign(obj.position.x) || 1;
        // 4 L cyan chalk sight-window on front flank of pannier (`saddle.jpg`)
        const winGrp = new T.Group();
        winGrp.position.set(s * 0.105, 0.02, 0.095);
        const bezel = new T.Mesh(new T.BoxGeometry(0.016, 0.215, 0.158), frameMat);
        winGrp.add(bezel);
        const pouch = new T.Mesh(new T.BoxGeometry(0.022, 0.172, 0.122), glowWindowMat);
        pouch.position.x = s * 0.003;
        winGrp.add(pouch);
        // White 4 L reserve chalk line across sight-window
        const chalk = new T.Mesh(new T.BoxGeometry(0.025, 0.010, 0.128), mats.litWhiteCrossMat);
        chalk.position.set(s * 0.004, -0.045, 0);
        winGrp.add(chalk);
        obj.add(winGrp);

        // `WATER = WIFI / SIGNAL OF GOD` glowing stencil decal on rear flank of pannier (`kf11`!)
        const stencil = new T.Mesh(new T.PlaneGeometry(0.22, 0.28), mats.jugWifiDecalMat);
        stencil.position.set(s * 0.106, -0.005, -0.105);
        stencil.rotation.y = s * Math.PI * 0.5;
        obj.add(stencil);
      }
    });
  }

  /* ---------- Build Monumental Domed Stone Cross-Beacon Sanctuary (`beacon` — `kf10` & `atlas` top-right!) ---------- */
  function buildCrossBeaconSanctuary(T, mats, cyanWaterMat) {
    const g = new T.Group();

    // Helper for recessed round-arched highland church windows (`atlas` top-right & `kf06`!)
    const makeArchedWindow = (w, h, d, glowMat) => {
      const wg = new T.Group();
      const rectH = Math.max(0.2, h - w * 0.5);
      const sill = new T.Mesh(new T.BoxGeometry(w + 0.22, 0.10, d + 0.12), mats.chapelStoneMat);
      sill.position.y = -h * 0.5 - 0.04;
      wg.add(sill);
      const archRing = new T.Mesh(new T.TorusGeometry(w * 0.5 + 0.05, 0.075, 8, 16, Math.PI), mats.chapelStoneMat);
      archRing.position.set(0, h * 0.5 - w * 0.5, d * 0.35);
      wg.add(archRing);
      for (const sx of [-1, 1]) {
        const jamb = new T.Mesh(new T.BoxGeometry(0.11, rectH, d), mats.chapelStoneMat);
        jamb.position.set(sx * (w * 0.5 + 0.03), -w * 0.25, 0);
        wg.add(jamb);
      }
      const paneShape = new T.Shape();
      paneShape.moveTo(-w * 0.5, -h * 0.5);
      paneShape.lineTo(w * 0.5, -h * 0.5);
      paneShape.lineTo(w * 0.5, h * 0.5 - w * 0.5);
      paneShape.absarc(0, h * 0.5 - w * 0.5, w * 0.5, 0, Math.PI, false);
      paneShape.closePath();
      const pane = new T.Mesh(new T.ShapeGeometry(paneShape, 14), glowMat);
      pane.position.z = -0.04;
      wg.add(pane);
      return wg;
    };

    // Centered at local z = -4.6 so front facade sits at z = -1.6 (open stone forecourt in front for Aunt Lemlem!)
    const cz = -4.6;

    // Deep stepped highland stone podium & forecourt terrace
    const podium = new T.Mesh(new T.BoxGeometry(12.8, 3.4, 9.2), mats.stoneMat);
    podium.position.set(0, -1.65, cz + 0.8);
    podium.receiveShadow = true;
    g.add(podium);

    for (let st = 0; st < 3; st++) {
      const step = new T.Mesh(new T.BoxGeometry(4.2 - st * 0.45, 0.18, 0.95 - st * 0.22), mats.chapelStoneMat);
      step.position.set(0, 0.06 + st * 0.14, cz + 3.25 - st * 0.26);
      step.receiveShadow = true;
      g.add(step);
    }

    // Central Sanctuary Nave (`5.2m × 5.1m × 6.0m`) + Left & Right Stone Wings (`3.2m × 4.0m × 4.8m`)
    const naveW = 5.2, naveH = 5.1, naveD = 6.0;
    const nave = new T.Mesh(new T.BoxGeometry(naveW, naveH, naveD), mats.chapelStoneMat);
    nave.position.set(0, naveH * 0.5, cz);
    nave.castShadow = true;
    nave.receiveShadow = true;
    g.add(nave);

    // Orthographic `arch_chapel.jpg` stone masonry projection panel on upper nave & wings (pure stone UVs!)
    const makeStoneCourseBand = (bw, bh, bd, u0, v0, u1, v1) => {
      const geo = new T.BoxGeometry(bw, bh, bd);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)));
      }
      return new T.Mesh(geo, mats.chapelOrthoMat);
    };

    // Corner ashlar buttresses & arched central cornice (`atlas` top-right!)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const but = new T.Mesh(new T.BoxGeometry(0.46, naveH + 0.15, 0.48), mats.chapelStoneMat);
        but.position.set(sx * (naveW * 0.5 + 0.06), naveH * 0.5, cz + sz * (naveD * 0.5 - 0.12));
        but.castShadow = true;
        g.add(but);
      }
      // Flanking side wings
      const wingW = 3.2, wingH = 4.05, wingD = 4.8;
      const wing = new T.Mesh(new T.BoxGeometry(wingW, wingH, wingD), mats.chapelStoneMat);
      wing.position.set(sx * (naveW * 0.5 + wingW * 0.5 - 0.08), wingH * 0.5, cz - 0.15);
      wing.castShadow = true;
      wing.receiveShadow = true;
      g.add(wing);
      // Stone slab pitched roof + end parapet on each wing (`atlas` top-right!)
      const wRoof = new T.Mesh(new T.BoxGeometry(wingW + 0.16, 0.36, wingD + 0.24), mats.chapelStoneMat);
      wRoof.position.set(sx * (naveW * 0.5 + wingW * 0.5 - 0.08), wingH + 0.18, cz - 0.15);
      g.add(wRoof);
      const endParapet = new T.Mesh(new T.BoxGeometry(0.32, 0.58, wingD + 0.28), mats.chapelStoneMat);
      endParapet.position.set(sx * (naveW * 0.5 + wingW - 0.16), wingH + 0.36, cz - 0.15);
      g.add(endParapet);

      // Arched lancet window on each front wing (`atlas` top-right & `kf10` warm sanctuary glow!)
      const wWin = makeArchedWindow(0.82, 1.55, 0.24, mats.warmInteriorMat);
      wWin.position.set(sx * (naveW * 0.5 + wingW * 0.5), 2.15, cz + wingD * 0.5 - 0.12);
      g.add(wWin);
    }

    // Arched stone molding & upper central niche over front nave (`atlas` top-right!)
    const frontZ = cz + naveD * 0.5;
    const corniceArch = new T.Mesh(new T.TorusGeometry(2.35, 0.12, 8, 24, Math.PI * 0.72), mats.chapelStoneMat);
    corniceArch.rotation.z = Math.PI * 0.14;
    corniceArch.position.set(0, naveH - 1.55, frontZ + 0.06);
    g.add(corniceArch);

    const upperNiche = makeArchedWindow(0.68, 1.05, 0.22, mats.cyanInteriorMat);
    upperNiche.position.set(0, naveH - 0.92, frontZ + 0.02);
    g.add(upperNiche);

    // Grand Recessed Round-Arched Sanctuary Portal (`kf06` & `study_sheet` b!)
    const portal = makeArchedWindow(1.56, 2.72, 0.34, mats.warmInteriorMat);
    portal.position.set(0, 1.68, frontZ + 0.02);
    g.add(portal);
    // Double carved timber sanctuary doors slightly ajar with warm golden sanctuary light spilling out
    for (const sx of [-1, 1]) {
      const dLeaf = new T.Mesh(new T.BoxGeometry(0.72, 2.05, 0.08), mats.timberDark);
      dLeaf.position.set(sx * 0.38, 1.34, frontZ - 0.02);
      dLeaf.rotation.y = sx * 0.22;
      g.add(dLeaf);
    }

    // Coursed-stone cylindrical/octagonal Drum (`y = 5.05..7.25`) + 8 Arched Clerestory Windows (`atlas` top-right!)
    const drumR = 2.38, drumH = 2.25, drumBaseY = naveH - 0.05;
    const drumPedestal = new T.Mesh(new T.BoxGeometry(naveW * 0.92, 0.42, naveD * 0.86), mats.chapelStoneMat);
    drumPedestal.position.set(0, drumBaseY + 0.18, cz);
    g.add(drumPedestal);

    const drum = new T.Mesh(new T.CylinderGeometry(drumR, drumR * 1.03, drumH, 16), mats.chapelStoneMat);
    drum.position.set(0, drumBaseY + drumH * 0.5 + 0.22, cz);
    drum.castShadow = true;
    g.add(drum);

    const drumCornice = new T.Mesh(new T.CylinderGeometry(drumR + 0.14, drumR + 0.10, 0.16, 18), mats.chapelStoneMat);
    drumCornice.position.set(0, drumBaseY + drumH + 0.28, cz);
    g.add(drumCornice);

    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * TAU;
      const dWin = makeArchedWindow(0.54, 1.02, 0.22, k % 2 === 0 ? mats.warmInteriorMat : mats.cyanInteriorMat);
      dWin.position.set(Math.sin(ang) * (drumR - 0.02), drumBaseY + drumH * 0.52 + 0.22, cz + Math.cos(ang) * (drumR - 0.02));
      dWin.rotation.y = ang;
      g.add(dWin);
    }

    // Hemispherical Coursed-Stone Sanctuary Dome (`y = 7.55..9.85`) mapped to `arch_chapel.jpg` dome stone courses!
    const domeBaseY = drumBaseY + drumH + 0.32;
    const domeGeo = new T.SphereGeometry(drumR * 0.96, 28, 16, 0, TAU, 0, Math.PI * 0.50);
    const dUv = domeGeo.attributes.uv;
    for (let i = 0; i < dUv.count; i++) {
      const symU = 1 - Math.abs(frac(dUv.getX(i) * 2) * 2 - 1);
      dUv.setXY(i, lerp(0.39, 0.61, symU), lerp(0.71, 0.88, 1 - dUv.getY(i)));
    }
    const dome = new T.Mesh(domeGeo, mats.chapelOrthoMat);
    dome.position.set(0, domeBaseY, cz);
    dome.castShadow = true;
    g.add(dome);

    // Stone finial base + Luminous Glowing White Rooftop Cross + Towering Cyan-White Sky Beam (`kf10`!)
    const crossBaseY = domeBaseY + drumR * 0.95;
    const finial = new T.Mesh(new T.CylinderGeometry(0.24, 0.34, 0.28, 12), mats.chapelStoneMat);
    finial.position.set(0, crossBaseY + 0.10, cz);
    g.add(finial);

    const crossVert = new T.Mesh(new T.BoxGeometry(0.18, 1.68, 0.18), mats.litWhiteCrossMat);
    crossVert.position.set(0, crossBaseY + 1.02, cz);
    g.add(crossVert);
    const crossHoriz = new T.Mesh(new T.BoxGeometry(1.06, 0.18, 0.18), mats.litWhiteCrossMat);
    crossHoriz.position.set(0, crossBaseY + 1.32, cz);
    g.add(crossHoriz);

    const crossHaloLight = new T.PointLight(0x74ecff, 3.6, 48, 1.35);
    crossHaloLight.position.set(0, crossBaseY + 1.4, cz);
    g.add(crossHaloLight);
    const portalWarmLight = new T.PointLight(0xffdca0, 2.8, 28, 1.45);
    portalWarmLight.position.set(0, 3.8, frontZ + 2.8);
    g.add(portalWarmLight);
    const domeWarmLight = new T.PointLight(0xffe6b8, 2.2, 26, 1.5);
    domeWarmLight.position.set(0, domeBaseY + 1.4, frontZ + 1.5);
    g.add(domeWarmLight);

    // Dual-layer vertical sky beacon beam (`kf10`!)
    const innerCoreBeam = new T.Mesh(
      new T.CylinderGeometry(0.18, 0.12, 72, 12, 1, true),
      new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })
    );
    innerCoreBeam.position.set(0, crossBaseY + 37.5, cz);
    g.add(innerCoreBeam);

    const outerCyanBeam = new T.Mesh(
      new T.CylinderGeometry(1.45, 0.36, 72, 16, 1, true),
      new T.MeshBasicMaterial({ color: 0x1ec8ff, transparent: true, opacity: 0.34, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })
    );
    outerCyanBeam.position.set(0, crossBaseY + 37.5, cz);
    g.add(outerCyanBeam);

    // Tapered Rusted-Iron 4-Leg X-Braced Lattice Radio Mast beside Left Wing (`atlas` top-right!)
    const mastX = -4.25, mastZ = cz + 2.55, mastH = 9.8;
    const mastPad = new T.Mesh(new T.BoxGeometry(1.45, 0.28, 1.45), mats.chapelStoneMat);
    mastPad.position.set(mastX, 0.14, mastZ);
    g.add(mastPad);
    const bHalf = 0.52, tHalf = 0.22;
    for (const lx of [-1, 1]) {
      for (const lz of [-1, 1]) {
        const legCrv = new T.LineCurve3(
          new T.Vector3(mastX + lx * bHalf, 0.25, mastZ + lz * bHalf),
          new T.Vector3(mastX + lx * tHalf, mastH, mastZ + lz * tHalf)
        );
        g.add(new T.Mesh(new T.TubeGeometry(legCrv, 2, 0.032, 6, false), mats.rustedTowerMat));
      }
    }
    const bays = 8;
    for (let b = 0; b < bays; b++) {
      const t0 = b / bays, t1 = (b + 1) / bays;
      const y0 = lerp(0.35, mastH - 0.1, t0), y1 = lerp(0.35, mastH - 0.1, t1);
      const r0 = lerp(bHalf, tHalf, t0), r1 = lerp(bHalf, tHalf, t1);
      // Horizontal frame + X-diagonals on front/side faces
      for (const f of [0, 1, 2, 3]) {
        const a0 = (f * Math.PI) * 0.5, a1 = ((f + 1) * Math.PI) * 0.5;
        const c0 = [Math.cos(a0) - Math.sin(a0), Math.sin(a0) + Math.cos(a0)];
        const c1 = [Math.cos(a1) - Math.sin(a1), Math.sin(a1) + Math.cos(a1)];
        const p00 = new T.Vector3(mastX + c0[0] * r0 * 0.707, y0, mastZ + c0[1] * r0 * 0.707);
        const p10 = new T.Vector3(mastX + c1[0] * r0 * 0.707, y0, mastZ + c1[1] * r0 * 0.707);
        const p01 = new T.Vector3(mastX + c0[0] * r1 * 0.707, y1, mastZ + c0[1] * r1 * 0.707);
        const p11 = new T.Vector3(mastX + c1[0] * r1 * 0.707, y1, mastZ + c1[1] * r1 * 0.707);
        g.add(new T.Mesh(new T.TubeGeometry(new T.LineCurve3(p01, p11), 1, 0.016, 4, false), mats.rustedTowerMat));
        g.add(new T.Mesh(new T.TubeGeometry(new T.LineCurve3(p00, p11), 1, 0.013, 4, false), mats.rustedTowerMat));
        g.add(new T.Mesh(new T.TubeGeometry(new T.LineCurve3(p10, p01), 1, 0.013, 4, false), mats.rustedTowerMat));
      }
    }
    // Cellular/Wi-Fi white sector antennas near top of lattice mast (`atlas` top-right!)
    for (const [ay, axOff] of [[mastH - 1.6, 0.34], [mastH - 2.9, 0.38]]) {
      const sector = new T.Mesh(new T.BoxGeometry(0.10, 0.92, 0.22), mats.laundryLightMat);
      sector.position.set(mastX + axOff, ay, mastZ);
      g.add(sector);
    }
    const whip = new T.Mesh(new T.CylinderGeometry(0.008, 0.014, 1.45, 6), mats.rustedTowerMat);
    whip.position.set(mastX - tHalf, mastH + 0.70, mastZ);
    g.add(whip);

    // Forecourt props: Aunt Lemlem's chair, coursed stone well-curb, and stenciled `WATER = WIFI` sanctuary jugs!
    const auntChair = makeWoodenChair(T, mats);
    auntChair.position.set(-2.95, 0, 0.95);
    auntChair.rotation.y = 0.25;
    g.add(auntChair);

    const foreWell = makeCoursedStoneWell(T, mats, cyanWaterMat, 0.78, 0.48);
    foreWell.position.set(3.65, 0, 0.55);
    g.add(foreWell);

    for (const [jx, jz, jry] of [[2.15, -0.95, -0.35], [2.52, -0.78, 0.22], [-2.15, -1.05, 0.42]]) {
      const jug = makeHeroWifiJerikan(T, mats, 1.02, true);
      jug.position.set(jx, 0, jz);
      jug.rotation.y = jry;
      g.add(jug);
    }

    return g;
  }

  /* ---------- Build Radiating Delaunay Cyan Ground Network Mesh across Ahiya (`kf10`!) ---------- */
  function buildAhiyaGroundNetworkMesh(T, mats, driveSurfaceAt, worldProps) {
    const hubX = -1610, hubZ = 590;
    const nodes = [{ x: hubX, z: hubZ, hero: true }];

    // 1. Dense triangulated web down the SE-S convoy ridge (`x ∈ [-1638..-1528], z ∈ [575..695]`) so low-angle dolly sees glowing mesh right under hooves & sandals!
    const rings = [
      { r: 14, n: 8 },
      { r: 28, n: 11 },
      { r: 46, n: 13 },
      { r: 68, n: 14 },
      { r: 96, n: 14 },
      { r: 132, n: 12 }
    ];
    for (let ri = 0; ri < rings.length; ri++) {
      const { r, n } = rings[ri];
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * TAU + ri * 0.29 + (hash2(ri, k) - 0.5) * 0.22;
        const rad = r * (0.86 + hash2(k, ri + 11) * 0.28);
        const nx = hubX + Math.sin(ang) * rad;
        const nz = hubZ + Math.cos(ang) * rad;
        nodes.push({ x: nx, z: nz, hero: ri <= 2 });
      }
    }

    // 2. Arterial relay spine nodes linking Cross-Beacon (-1610,590) -> Convoy (-1582,622) -> Basalt (-1460,760), Compound (-1680,775), Hill Archive (-1765,540)
    const spineWaypoints = [
      [-1598, 604], [-1586, 618], [-1573, 634], [-1556, 654], [-1532, 682], [-1502, 715], [-1476, 742], [-1460, 760],
      [-1628, 628], [-1646, 672], [-1664, 722], [-1680, 775],
      [-1645, 578], [-1685, 565], [-1726, 552], [-1765, 540],
      [-1590, 642], [-1612, 652], [-1564, 616], [-1545, 640]
    ];
    for (const [sx, sz] of spineWaypoints) {
      nodes.push({ x: sx, z: sz, hero: true });
    }

    // Build clean non-crossing Delaunay-like neighbor graph (planar segment intersection filter!)
    const candEdges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z);
        const maxD = (nodes[i].hero && nodes[j].hero) ? 54 : 44;
        if (d > 6 && d < maxD) candEdges.push({ i, j, d });
      }
    }
    candEdges.sort((a, b) => a.d - b.d);

    const segCross = (a, b, c, d) => {
      const ccw = (p1, p2, p3) => (p3.z - p1.z) * (p2.x - p1.x) > (p2.z - p1.z) * (p3.x - p1.x);
      return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
    };

    const accepted = [];
    const deg = new Int32Array(nodes.length);
    for (const e of candEdges) {
      if (deg[e.i] >= 6 || deg[e.j] >= 6) continue;
      const A = nodes[e.i], B = nodes[e.j];
      let crosses = false;
      for (const ex of accepted) {
        if (ex.i === e.i || ex.i === e.j || ex.j === e.i || ex.j === e.j) continue;
        if (segCross(A, B, nodes[ex.i], nodes[ex.j])) { crosses = true; break; }
      }
      if (!crosses) {
        accepted.push(e);
        deg[e.i]++;
        deg[e.j]++;
      }
    }

    // Subdivide every accepted edge into 8 terrain-hugging segments at `driveSurfaceAt(x, z) + 0.16`
    const subSteps = 8;
    const lineCoords = [];
    for (const e of accepted) {
      const A = nodes[e.i], B = nodes[e.j];
      for (let s = 0; s < subSteps; s++) {
        const t0 = s / subSteps, t1 = (s + 1) / subSteps;
        const x0 = lerp(A.x, B.x, t0), z0 = lerp(A.z, B.z, t0);
        const x1 = lerp(A.x, B.x, t1), z1 = lerp(A.z, B.z, t1);
        lineCoords.push(
          x0, driveSurfaceAt(x0, z0) + 0.16, z0,
          x1, driveSurfaceAt(x1, z1) + 0.16, z1
        );
      }
    }
    const lineGeo = new T.BufferGeometry();
    lineGeo.setAttribute("position", new T.Float32BufferAttribute(lineCoords, 3));
    const meshLines = new T.LineSegments(lineGeo, mats.networkLineMat);
    meshLines.frustumCulled = false;
    worldProps.add(meshLines);

    // Hero thicker glowing cyan feeder artery tubes along the SE convoy trail (`kf10` foreground veins!)
    const mainVeins = [
      [[-1610, 590], [-1599, 603], [-1586, 618], [-1573, 634], [-1556, 654]],
      [[-1610, 590], [-1612, 612], [-1602, 632], [-1586, 648]],
      [[-1610, 590], [-1592, 598], [-1572, 612], [-1552, 632]]
    ];
    for (const vein of mainVeins) {
      const pts = [];
      for (let k = 0; k < vein.length - 1; k++) {
        for (let s = 0; s < 6; s++) {
          const t = s / 6;
          const vx = lerp(vein[k][0], vein[k + 1][0], t);
          const vz = lerp(vein[k][1], vein[k + 1][1], t);
          pts.push(new T.Vector3(vx, driveSurfaceAt(vx, vz) + 0.14, vz));
        }
      }
      const last = vein[vein.length - 1];
      pts.push(new T.Vector3(last[0], driveSurfaceAt(last[0], last[1]) + 0.14, last[1]));
      const vMesh = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 28, 0.045, 5, false), mats.cyanInteriorMat);
      worldProps.add(vMesh);
    }

    // Batched InstancedMesh for glowing cyan network node pins + vertical micro-spikes (`kf10`!)
    const pinGeo = new T.SphereGeometry(0.24, 8, 6);
    const pinInst = new T.InstancedMesh(pinGeo, mats.networkNodeMat, nodes.length);
    pinInst.frustumCulled = false;
    const spikeGeo = new T.CylinderGeometry(0.03, 0.09, 0.95, 6);
    const spikeMat = new T.MeshBasicMaterial({ color: 0x3ae8ff, transparent: true, opacity: 0.62, blending: T.AdditiveBlending, depthWrite: false });
    const spikeInst = new T.InstancedMesh(spikeGeo, spikeMat, nodes.length);
    spikeInst.frustumCulled = false;

    const dummy = new T.Object3D();
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      const ny = driveSurfaceAt(nd.x, nd.z);
      const sc = nd.hero ? 1.25 : 0.85;
      dummy.position.set(nd.x, ny + 0.18, nd.z);
      dummy.scale.set(sc, sc * 0.65, sc);
      dummy.updateMatrix();
      pinInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(nd.x, ny + 0.58, nd.z);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      spikeInst.setMatrixAt(i, dummy.matrix);
    }
    pinInst.instanceMatrix.needsUpdate = true;
    spikeInst.instanceMatrix.needsUpdate = true;
    worldProps.add(pinInst);
    worldProps.add(spikeInst);
  }

  /* ---------- Master World Architecture Builder ---------- */
  function buildWorldArchitecture(T, env) {
    const {
      worldProps, groundAt, driveSurfaceAt, donkey, mw,
      cinemaMat, cyanWaterMat, beaconCyanMat, puebloDarkWinMat, antennaMat,
      makeJerikan, hasNightPostSets = false
    } = env;

    const mats = getArchMaterials(T);
    const puebloWinMeshes = [];
    const puebloDishes = [];
    const npSpinFans = [];
    const inWorldScreens = [];
    const laundrySway = [];
    const pumpRegistry = {};
    let oxbowSheetFront = null, oxbowSheetRear = null, oxbowWindBase = null;

    // 0. Upgrade Mistletoe's canvas panniers with the 4 L cyan sight-window + `WATER = WIFI / SIGNAL OF GOD` stencil!
    attachSaddleSightWindows(T, donkey, mats);

    // 0b. Enrich Overlook Wellhead (`-22.2, -6.2`) with bolted cast-iron flange collar, glowing cyan hose (`kf02`),
    // wheel-thrown terracotta bowl (`kf16`), wooden sawbuck pack frame, stenciled `WATER = WIFI` hero jugs,
    // and authoritative world-space hand-grip anchors on the live Overlook `leverPivot`!
    {
      const wx = -22.2, wz = -6.2, wy = groundAt(wx, wz);
      // Upgrade the existing Overlook Wellhead standpipe lever in `worldProps` (`kf02` ergonomic downward-sloped forged iron bar + 0.000m IK grips!)
      for (const child of worldProps.children) {
        if (child.isGroup && Math.hypot(child.position.x - wx, child.position.z - wz) < 0.35) {
          const ovLeverPivot = child.children.find(ch => ch.isGroup && Math.abs(ch.position.y - 1.18) < 0.08);
          if (ovLeverPivot && !ovLeverPivot.getObjectByName("pumpGripCenter")) {
            ovLeverPivot.name = "pumpLeverPivot";
            const boxArm = ovLeverPivot.children[0];
            if (boxArm) {
              boxArm.position.set(-0.20, -0.036, 0);
              boxArm.rotation.z = 0.18;
              boxArm.scale.set(0.50, 0.72, 0.72);
            }
            const roundShaft = new T.Mesh(new T.CylinderGeometry(0.0155, 0.0185, 0.44, 12), mats.ironDarkMat);
            roundShaft.rotation.z = Math.PI * 0.5 + 0.18;
            roundShaft.position.set(-0.33, -0.060, 0);
            roundShaft.castShadow = true;
            ovLeverPivot.add(roundShaft);
            const tipKnob = new T.Mesh(new T.SphereGeometry(0.022, 10, 8), mats.ironDarkMat);
            tipKnob.position.set(-0.545, -0.099, 0);
            ovLeverPivot.add(tipKnob);

            const fulcrumPin = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.095, 10), mats.steelMat);
            fulcrumPin.rotation.x = Math.PI * 0.5;
            fulcrumPin.position.set(0, 1.18, 0);
            child.add(fulcrumPin);

            const gNear = new T.Object3D(); gNear.name = "pumpGripNear"; gNear.position.set(-0.380, -0.069, 0.004); ovLeverPivot.add(gNear);
            const gFar = new T.Object3D(); gFar.name = "pumpGripFar"; gFar.position.set(-0.486, -0.088, -0.004); ovLeverPivot.add(gFar);
            const gCenter = new T.Object3D(); gCenter.name = "pumpGripCenter"; gCenter.position.set(-0.433, -0.078, 0); ovLeverPivot.add(gCenter);
            const gTip = new T.Object3D(); gTip.name = "pumpGripTip"; gTip.position.set(-0.545, -0.099, 0); ovLeverPivot.add(gTip);

            child.userData.leverPivot = ovLeverPivot;
            // Replace legacy straight hose/cylinder stream on Overlook wellhead with dynamic ballistic spout-to-shekla-bowl arc!
            for (const sub of child.children) {
              if (sub.isMesh && Math.abs(sub.position.x - 1.75) < 0.08 && Math.abs(sub.position.z - 1.75) < 0.08 && Math.abs(sub.position.y - 0.46) < 0.12) {
                sub.geometry = new T.BufferGeometry();
              } else if (sub.isMesh && sub.geometry && sub.geometry.type === "TubeGeometry") {
                sub.visible = false;
              }
            }
            if (!child.getObjectByName("pumpPourGroup")) {
              // Parabolic cyan water arc pouring directly out of the Overlook standpipe spout (+X=0.41, Y=0.62) into ovBowl (X=0.76, Z=0.00)!
              child.add(buildBallisticPumpPour(T, cyanWaterMat || mats.cyanTubeMat, {
                x0: 0.41, y0: 0.62, z0: 0.00,
                dirX: 0.90, dirY: -0.43, dirZ: 0.00,
                hitY: 0.205, baseR: 0.024
              }));
            }
            child.setPumpPhase = (phase, out, opts) => stepStandpipePump(T, child, phase, out, Object.assign({ rawLeverSign: true }, opts));
            child.getGripWorld = out => {
              child.updateWorldMatrix(true, true);
              return gCenter.getWorldPosition(out || new T.Vector3());
            };
            pumpRegistry.overlook = child;
          }
          break;
        }
      }

      const ovWellExtras = new T.Group();
      ovWellExtras.position.set(wx, wy, wz);

      // Bolted cast-iron pump base flange + 4 hex nuts right on top of the Overlook concrete pad (`kf02`!)
      const flange = new T.Mesh(new T.BoxGeometry(0.42, 0.036, 0.42), mats.ironDarkMat);
      flange.position.set(0, 0.295, 0);
      ovWellExtras.add(flange);
      for (const bx of [-0.15, 0.15]) {
        for (const bz of [-0.15, 0.15]) {
          const nut = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.042, 6), mats.ironDarkMat);
          nut.position.set(bx, 0.325, bz);
          ovWellExtras.add(nut);
        }
      }
      // Ground-hugging cyan manifold supply hose routed cleanly from the lower base flange to the side basin (never blocking spout pour!)
      const ovCyanHose = new T.CatmullRomCurve3([
        new T.Vector3(0.18, 0.28, 0.18), new T.Vector3(0.55, 0.08, 0.48),
        new T.Vector3(1.08, 0.06, 0.92), new T.Vector3(1.52, 0.12, 1.34), new T.Vector3(1.75, 0.34, 1.62)
      ]);
      ovWellExtras.add(new T.Mesh(new T.TubeGeometry(ovCyanHose, 18, 0.028, 10, false), cyanWaterMat || mats.cyanTubeMat));

      // Wheel-thrown terracotta watering bowl positioned directly under the Overlook standpipe spout's parabolic arc!
      const ovBowl = makeTerracottaWateringBowl(T, mats, cyanWaterMat, 0.38, 0.26, true);
      ovBowl.position.set(0.76, 0, 0.00);
      ovWellExtras.add(ovBowl);

      const ovSawbuck = makeSawbuckPackFrame(T, mats, 0.96);
      ovSawbuck.position.set(-1.55, 0, -0.85);
      ovSawbuck.rotation.y = 0.48;
      ovWellExtras.add(ovSawbuck);

      const ovWifiJug = makeHeroWifiJerikan(T, mats, 1.0, true);
      ovWifiJug.position.set(-1.12, 0, 0.82);
      ovWifiJug.rotation.y = 0.65;
      ovWellExtras.add(ovWifiJug);

      worldProps.add(ovWellExtras);
    }

    /* =========================================================================
       1. HIGHLAND PUEBLO VILLAGE: 14 Coursed-Stone & Hidmo Mud-Plaster Dwellings,
          Billowing Doorway Curtains, Sanctuary Portal & Clothesline
       ========================================================================= */
    const PuebloHouses = [
      [-770, -18.5, 5.4, 4.4, 4.6,  0.32, true,  true,  true],
      [-767, -42.5, 4.8, 3.2, 4.2, -0.22, false, true,  false],
      [-783, -15.0, 6.0, 4.8, 4.8,  0.14, true,  false, true],
      [-797, -23.5, 6.4, 5.0, 5.2, -0.42, true,  true,  true],
      [-798, -44.5, 5.4, 3.6, 4.6,  0.52, false, true,  true],
      [-785, -48.5, 5.0, 3.3, 4.4, -0.14, false, false, true],
      [-763, -32.0, 4.7, 3.2, 4.2,  0.68, false, true,  false],
      [-804, -35.0, 5.6, 4.5, 4.6,  0.24, true,  false, true],
      [-792, -56.0, 5.2, 4.4, 4.6,  0.18, true,  true,  false],
      [-771, -52.5, 4.6, 3.1, 4.0, -0.40, false, false, true],
      [-808, -21.5, 5.8, 4.6, 4.8,  0.60, true,  true,  true],
      [-776, -10.5, 4.9, 3.3, 4.2, -0.16, false, true,  false],
      [-790, -9.5,  4.8, 3.5, 4.2,  0.30, false, false, true],
      [-775, -60.5, 5.2, 4.3, 4.4, -0.52, true,  true,  true]
    ];
    for (let i = 0; i < PuebloHouses.length; i++) {
      const [hx, hz, w, h, d, ry, twoStory, hasPorch, hasChimney] = PuebloHouses[i];
      const hy = groundAt(hx, hz);
      const hGrp = makeHighlandHouse(T, mats, { w, h, d, twoStory, hasPorch, hasChimney, seed: i }, puebloWinMeshes, puebloDishes, puebloDarkWinMat, antennaMat);
      hGrp.position.set(hx, hy, hz);
      hGrp.rotation.y = ry;
      worldProps.add(hGrp);
    }

    // Dry-stone basalt boundary walls & village clothesline with wind-swaying garments
    {
      const clX = -771.8, clZ = -26.8, clY = groundAt(clX, clZ);
      const cl = makeClothesline(T, mats, 5.8);
      cl.group.position.set(clX, clY, clZ);
      cl.group.rotation.y = 1.48;
      worldProps.add(cl.group);
      laundrySway.push(...cl.drapedMeshes);

      for (const [wx, wz, wl, wyaw] of [[-768.5, -23.5, 5.4, 0.35], [-786.5, -20.0, 6.2, -0.25], [-780.0, -44.0, 5.8, 0.12]]) {
        const wall = new T.Mesh(new T.BoxGeometry(wl, 1.05, 0.48), mats.basaltPlinthMat);
        wall.position.set(wx, groundAt(wx, wz) + 0.42, wz);
        wall.rotation.y = wyaw;
        worldProps.add(wall);
      }

      // Pueblo courtyard wheel-thrown terracotta bowl + sawbuck frame at `(-774.95, -26.18)` for `/zones/` Act II unload!
      const pAct2Bowl = makeTerracottaWateringBowl(T, mats, cyanWaterMat, 0.42, 0.29, true);
      pAct2Bowl.position.set(-774.95, driveSurfaceAt(-774.95, -26.18) + 0.02, -26.18);
      worldProps.add(pAct2Bowl);
    }

    // Sanctuary Stone Steps & Carved Basalt Blue-Lit Portal on Upper Pueblo Terrace (-812, -34)
    {
      const sx = -812, sz = -34, sy = groundAt(sx, sz);
      const dg = new T.Group();
      dg.position.set(sx, sy, sz);
      dg.rotation.y = Math.PI * 0.5;
      for (let i = 0; i < 8; i++) {
        const st = new T.Mesh(new T.BoxGeometry(3.6, 0.28, 0.76), mats.chapelStoneMat);
        st.position.set(0, 0.14 + i * 0.26, 3.6 - i * 0.58);
        dg.add(st);
      }
      const lintel = new T.Mesh(new T.BoxGeometry(4.4, 0.88, 1.45), mats.chapelStoneMat);
      lintel.position.set(0, 5.38, -0.5);
      dg.add(lintel);
      for (const s of [-1.72, 1.72]) {
        const pil = new T.Mesh(new T.BoxGeometry(0.92, 5.2, 1.35), mats.chapelStoneMat);
        pil.position.set(s, 2.6, -0.5);
        dg.add(pil);
      }
      const bdoor = new T.Mesh(new T.BoxGeometry(2.45, 4.35, 0.24), beaconCyanMat);
      bdoor.position.set(0, 2.48, -0.5);
      dg.add(bdoor);
      worldProps.add(dg);
    }

    /* =========================================================================
       2. HIGHLAND PUEBLO COOLING PLANT, DIAMOND WIRE-GLASS REGISTRY &
          DEEP WET CYAN SERVER-COOLING VAULT + LIT WHITE CROSS (`kf07` & `arch_cooling.jpg`!)
       ========================================================================= */
    {
      const px = -776.0, pz = -30.0, py = groundAt(px, pz);
      const pGrp = new T.Group();
      pGrp.position.set(px, py, pz);
      pGrp.rotation.y = 0.30;

      // 2a. Reinforced-concrete Cooling Plant (`arch_cooling.jpg` concrete!)
      const plantW = 6.2, plantH = 3.2, plantD = 4.2;
      const plantPlinth = new T.Mesh(new T.BoxGeometry(plantW + 0.4, 2.2, plantD + 0.4), mats.concreteMat);
      plantPlinth.position.set(-3.4, -1.05, -3.2);
      pGrp.add(plantPlinth);

      const plantBody = new T.Mesh(new T.BoxGeometry(plantW, plantH, plantD), mats.concreteMat);
      plantBody.position.set(-3.4, plantH * 0.5, -3.2);
      plantBody.castShadow = true;
      pGrp.add(plantBody);

      for (let k = -2; k <= 2; k++) {
        const pil = new T.Mesh(new T.BoxGeometry(0.32, plantH + 0.12, 0.38), mats.concreteMat);
        pil.position.set(-3.4 + k * 1.32, plantH * 0.5, -3.2 + plantD * 0.5 + 0.12);
        pil.rotation.x = -0.05;
        pGrp.add(pil);
      }

      for (const fx of [-5.1, -3.4, -1.7]) {
        const ring = new T.Mesh(new T.TorusGeometry(0.56, 0.065, 8, 22), mats.ironDarkMat);
        ring.position.set(fx, 1.85, -3.2 + plantD * 0.5 + 0.05);
        pGrp.add(ring);
        const hub = new T.Group();
        hub.position.set(fx, 1.85, -3.2 + plantD * 0.5 + 0.03);
        for (let b = 0; b < 4; b++) {
          const blade = new T.Mesh(new T.BoxGeometry(0.96, 0.12, 0.025), mats.steelMat);
          blade.rotation.z = (b * Math.PI) / 4;
          hub.add(blade);
        }
        pGrp.add(hub);

        const shroud = new T.Mesh(new T.CylinderGeometry(0.76, 0.80, 0.42, 20, 1, true), mats.concreteMat);
        shroud.position.set(fx, plantH + 0.21, -3.2);
        pGrp.add(shroud);
        const rFan = new T.Group();
        rFan.position.set(fx, plantH + 0.26, -3.2);
        for (let b = 0; b < 3; b++) {
          const rBlade = new T.Mesh(new T.BoxGeometry(1.32, 0.03, 0.18), beaconCyanMat);
          rBlade.rotation.y = (b * Math.PI) / 3;
          rFan.add(rBlade);
        }
        pGrp.add(rFan);
        npSpinFans.push(rFan);
      }

      // Parabolic satellite dish & steel lattice microwave mast
      const dishPole = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 2.2, 8), mats.steelMat);
      dishPole.position.set(-5.4, plantH + 1.0, -4.2);
      pGrp.add(dishPole);
      const dishBowl = new T.Mesh(
        new T.SphereGeometry(0.95, 18, 12, 0, TAU, 0, Math.PI * 0.36),
        new T.MeshStandardMaterial({ color: 0x8b9196, roughness: 0.48, metalness: 0.55, side: T.DoubleSide })
      );
      dishBowl.position.set(-5.4, plantH + 2.05, -4.1);
      dishBowl.rotation.x = 2.25;
      pGrp.add(dishBowl);

      const towerH = 6.8;
      for (const tx of [-0.32, 0.32]) {
        for (const tz of [-0.32, 0.32]) {
          const leg = new T.Mesh(new T.CylinderGeometry(0.032, 0.048, towerH, 6), mats.steelMat);
          leg.position.set(-0.9 + tx, plantH + towerH * 0.45, -4.5 + tz);
          pGrp.add(leg);
        }
      }
      for (let ty = 0; ty < 6; ty++) {
        const brace = new T.Mesh(new T.BoxGeometry(0.68, 0.035, 0.68), mats.steelMat);
        brace.position.set(-0.9, plantH + 0.6 + ty * 1.05, -4.5);
        pGrp.add(brace);
      }

      // Chain-link perimeter security fence
      for (const [fx, fz, flen, fyaw] of [[-6.8, -0.75, 4.4, 0], [-6.8, -3.2, 5.0, Math.PI * 0.5]]) {
        const fPanel = new T.Mesh(new T.PlaneGeometry(flen, 2.15), mats.chainLinkMat);
        fPanel.position.set(fx + (fyaw === 0 ? flen * 0.5 : 0), 1.08, fz);
        fPanel.rotation.y = fyaw;
        pGrp.add(fPanel);
        const nP = Math.round(flen / 1.5);
        for (let k = 0; k <= nP; k++) {
          const post = new T.Mesh(new T.CylinderGeometry(0.032, 0.036, 2.35, 6), mats.steelMat);
          const off = (k / nP) * flen;
          post.position.set(fx + (fyaw === 0 ? off : 0), 1.15, fz + (fyaw !== 0 ? (off - flen * 0.5) : 0));
          pGrp.add(post);
        }
      }

      // Circular Corrugated-Steel Cyan Cooling Reservoir
      const resX = -6.6, resZ = 2.4;
      const resWall = new T.Mesh(new T.CylinderGeometry(2.15, 2.18, 0.88, 28, 1, true), mats.roofMat);
      resWall.position.set(resX, 0.36, resZ);
      pGrp.add(resWall);
      const resRim = new T.Mesh(new T.TorusGeometry(2.16, 0.045, 8, 28), mats.steelMat);
      resRim.rotation.x = Math.PI * 0.5;
      resRim.position.set(resX, 0.80, resZ);
      pGrp.add(resRim);
      const resPool = new T.Mesh(new T.CircleGeometry(2.12, 28), cyanWaterMat);
      resPool.rotation.x = -Math.PI * 0.5;
      resPool.position.set(resX, 0.68, resZ);
      pGrp.add(resPool);

      // 2b. Registry House + Deep Wet Cyan Server-Cooling Vault (`kf07` & `arch_cooling.jpg`!)
      // Sightline lock (#57): regX = 2.45, front window at z = -0.79, Tess at (3.11, -0.92),
      // unobstructed center aisle along x = 2.45 all the way to the lit white cross at (2.45, 1.70, -7.35)!
      const regX = 2.45, frontWallZ = -0.80, vaultBackZ = -7.50;
      const vaultLen = frontWallZ - vaultBackZ; // 6.70 m deep corridor!
      const vaultCenterZ = (frontWallZ + vaultBackZ) * 0.5; // -4.15
      const vaultW = 4.6, vaultH = 3.15;

      const regPlinth = new T.Mesh(new T.BoxGeometry(vaultW + 0.3, 2.1, vaultLen + 0.4), mats.stoneMat);
      regPlinth.position.set(regX, -1.03, vaultCenterZ);
      pGrp.add(regPlinth);

      // Dark concrete vault end-wall (`z = -7.50`), side walls & roof ceiling
      const regBack = new T.Mesh(new T.BoxGeometry(vaultW, vaultH, 0.28), mats.concreteMat);
      regBack.position.set(regX, vaultH * 0.5, vaultBackZ);
      pGrp.add(regBack);
      // Darker inner sanctuary end-panel so the glowing white cross pops with maximum contrast (`kf07`!)
      const darkEndPanel = new T.Mesh(
        new T.PlaneGeometry(2.6, 2.75),
        new T.MeshStandardMaterial({ color: 0x151c22, bumpMap: mats.stoneBump, bumpScale: 0.02, roughness: 0.82 })
      );
      darkEndPanel.position.set(regX, 1.52, vaultBackZ + 0.15);
      pGrp.add(darkEndPanel);

      for (const sx of [-1, 1]) {
        const regSide = new T.Mesh(new T.BoxGeometry(0.28, vaultH, vaultLen), mats.concreteMat);
        regSide.position.set(regX + sx * (vaultW * 0.5 - 0.14), vaultH * 0.5, vaultCenterZ);
        pGrp.add(regSide);
      }
      const vaultCeiling = new T.Mesh(new T.BoxGeometry(vaultW, 0.22, vaultLen), mats.concreteMat);
      vaultCeiling.position.set(regX, vaultH - 0.08, vaultCenterZ);
      pGrp.add(vaultCeiling);

      // Front wall framing around the diamond wire-glass Registry window (`arch_cooling.jpg`!)
      const regLowerFront = new T.Mesh(new T.BoxGeometry(vaultW, 1.02, 0.28), mats.concreteMat);
      regLowerFront.position.set(regX, 0.51, frontWallZ);
      pGrp.add(regLowerFront);
      const regHeader = new T.Mesh(new T.BoxGeometry(vaultW, 0.55, 0.28), mats.concreteMat);
      regHeader.position.set(regX, 2.875, frontWallZ);
      pGrp.add(regHeader);
      for (const [ cheekX, cheekW ] of [[regX - 1.91, 0.78], [regX + 1.91, 0.78]]) {
        const cheek = new T.Mesh(new T.BoxGeometry(cheekW, 1.60, 0.28), mats.concreteMat);
        cheek.position.set(cheekX, 1.81, frontWallZ);
        pGrp.add(cheek);
      }

      // Exterior 3D Steel Coolant Manifold Headers + Glowing Cyan Conduit Triplets on Concrete Wall (`arch_cooling.jpg`!)
      const extZ = frontWallZ + 0.16;
      for (const [mhx, mhy, mhw] of [[regX + 1.88, 1.62, 0.52], [regX + 1.85, 1.36, 0.46]]) {
        const mHdr = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, mhw, 12), mats.steelMat);
        mHdr.rotation.z = Math.PI * 0.5;
        mHdr.position.set(mhx, mhy, extZ + 0.03);
        pGrp.add(mHdr);
      }
      const vManifold = new T.Mesh(new T.CylinderGeometry(0.068, 0.068, 0.48, 12), mats.steelMat);
      vManifold.position.set(regX + 1.60, 1.48, extZ + 0.04);
      pGrp.add(vManifold);
      for (let c = 0; c < 3; c++) {
        const off = c * 0.095;
        const cPts = [
          new T.Vector3(regX + 1.80 + off, 3.05, extZ),
          new T.Vector3(regX + 1.80 + off, 1.66, extZ),
          new T.Vector3(regX + 1.70 + off * 0.7, 1.32, extZ),
          new T.Vector3(regX + 1.64 + off * 0.6, 0.62 - c * 0.08, extZ),
          new T.Vector3(regX - 1.15 - c * 0.08, 0.62 - c * 0.08, extZ),
          new T.Vector3(regX - 1.15 - c * 0.08, 0.04, extZ)
        ];
        pGrp.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(cPts), 24, 0.022, 7, false), mats.cyanTubeMat));
      }

      const regRoof = makeGableRoof(T, mats, vaultW, 0.82, vaultLen, false);
      regRoof.position.set(regX, vaultH, vaultCenterZ);
      pGrp.add(regRoof);

      // Raised interior concrete floor slab + Glossy Wet Cyan Cooling Floor at `local y = 0.38`
      // Completely clears sloped hillside terrain across the entire 6.7m server corridor (`#65`!)
      const vFloorY = 0.38;
      const vaultSubSlab = new T.Mesh(new T.BoxGeometry(vaultW - 0.34, vFloorY, vaultLen - 0.24), mats.concreteMat);
      vaultSubSlab.position.set(regX, vFloorY * 0.5 - 0.005, vaultCenterZ);
      pGrp.add(vaultSubSlab);

      const wetFloor = new T.Mesh(new T.PlaneGeometry(vaultW - 0.46, vaultLen - 0.34), mats.wetVaultFloorMat);
      wetFloor.rotation.x = -Math.PI * 0.5;
      wetFloor.position.set(regX, vFloorY, vaultCenterZ);
      pGrp.add(wetFloor);

      // Glowing cyan water sheen bands across the wet corridor floor
      for (const fz of [-2.2, -3.5, -4.9, -6.3]) {
        const glowBand = new T.Mesh(
          new T.PlaneGeometry(1.95, 0.14),
          new T.MeshBasicMaterial({ color: 0x48f2ff, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending })
        );
        glowBand.rotation.x = -Math.PI * 0.5;
        glowBand.position.set(regX, vFloorY + 0.006, fz);
        pGrp.add(glowBand);
      }

      // Luminous Lit White Cross on the far sanctuary vault wall (`local 2.45, 1.84, -7.31` — `kf07`!)
      const vCrossV = new T.Mesh(new T.BoxGeometry(0.13, 1.16, 0.08), mats.litWhiteCrossMat);
      vCrossV.position.set(regX, 1.84, vaultBackZ + 0.19);
      pGrp.add(vCrossV);
      const vCrossH = new T.Mesh(new T.BoxGeometry(0.72, 0.13, 0.08), mats.litWhiteCrossMat);
      vCrossH.position.set(regX, 2.02, vaultBackZ + 0.19);
      pGrp.add(vCrossH);

      // Specular floor reflection of the glowing white cross (`kf07` bottom center!)
      const refCrossV = new T.Mesh(new T.PlaneGeometry(0.16, 1.35), mats.reflectedCrossMat);
      refCrossV.rotation.x = -Math.PI * 0.5;
      refCrossV.position.set(regX, vFloorY + 0.008, -5.85);
      pGrp.add(refCrossV);
      const refCrossH = new T.Mesh(new T.PlaneGeometry(0.78, 0.16), mats.reflectedCrossMat);
      refCrossH.rotation.x = -Math.PI * 0.5;
      refCrossH.position.set(regX, vFloorY + 0.009, -6.08);
      pGrp.add(refCrossH);

      // Cyan & white interior vault lights illuminating the curved hoses and wet floor
      const vaultCrossLight = new T.PointLight(0xdffaff, 2.4, 7.5, 1.5);
      vaultCrossLight.position.set(regX, 1.98, vaultBackZ + 0.65);
      pGrp.add(vaultCrossLight);
      const vaultFloorLight = new T.PointLight(0x18d4ff, 2.1, 6.8, 1.6);
      vaultFloorLight.position.set(regX, vFloorY + 0.55, -3.6);
      pGrp.add(vaultFloorLight);

      // Overhead heavy steel chilled-water main ducts along both sides of corridor ceiling (`kf07` top!)
      for (const sx of [-1, 1]) {
        const duct = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, vaultLen - 0.8, 14), mats.steelMat);
        duct.rotation.x = Math.PI * 0.5;
        duct.position.set(regX + sx * 0.92, 2.82, vaultCenterZ - 0.2);
        pGrp.add(duct);
      }

      // 8 Dark Steel Server Racks + Curved Glowing Cyan `TubeGeometry` Liquid-Cooling Hoses plunging into `y = 0.38` wet floor (`kf07`!)
      const rackZList = [-2.30, -3.60, -4.90, -6.20];
      for (let ri = 0; ri < rackZList.length; ri++) {
        const rz = rackZList[ri];
        for (const sx of [-1, 1]) {
          const rx = regX + sx * 1.42;
          const cabinet = new T.Mesh(new T.BoxGeometry(0.76, 2.32, 0.96), mats.ironDarkMat);
          cabinet.position.set(rx, vFloorY + 1.16, rz);
          pGrp.add(cabinet);

          const face = new T.Mesh(new T.PlaneGeometry(0.84, 2.14), mats.serverRackMat);
          face.position.set(rx - sx * 0.39, vFloorY + 1.16, rz);
          face.rotation.y = -sx * Math.PI * 0.5;
          pGrp.add(face);

          const portY = vFloorY + 0.94 + (ri % 2) * 0.26;
          const portX = rx - sx * 0.40;
          const collar = new T.Mesh(new T.CylinderGeometry(0.068, 0.068, 0.09, 12), mats.steelMat);
          collar.rotation.z = Math.PI * 0.5;
          collar.position.set(portX, portY, rz + 0.12);
          pGrp.add(collar);

          const entryX = regX + sx * (0.58 + (ri % 2) * 0.16);
          const hoseCrv = new T.CatmullRomCurve3([
            new T.Vector3(portX, portY, rz + 0.12),
            new T.Vector3(portX - sx * 0.34, portY - 0.03, rz + 0.18),
            new T.Vector3(entryX, lerp(vFloorY, portY, 0.52), rz + 0.22),
            new T.Vector3(entryX - sx * 0.05, vFloorY + 0.005, rz + 0.20)
          ]);
          pGrp.add(new T.Mesh(new T.TubeGeometry(hoseCrv, 18, 0.048, 10, false), mats.cyanTubeMat));
          pGrp.add(new T.Mesh(new T.TubeGeometry(hoseCrv, 18, 0.018, 8, false), mats.cyanTubeCoreMat));
          const floorHalo = new T.Mesh(
            new T.CircleGeometry(0.18, 16),
            new T.MeshBasicMaterial({ color: 0x58f4ff, transparent: true, opacity: 0.52, depthWrite: false, blending: T.AdditiveBlending })
          );
          floorHalo.rotation.x = -Math.PI * 0.5;
          floorHalo.position.set(entryX - sx * 0.05, vFloorY + 0.007, rz + 0.20);
          pGrp.add(floorHalo);

          if (ri % 2 === 0) {
            const retCrv = new T.CatmullRomCurve3([
              new T.Vector3(portX, vFloorY + 0.48, rz - 0.18),
              new T.Vector3(regX + sx * 0.65, vFloorY + 0.12, rz - 0.05),
              new T.Vector3(regX - sx * 0.35, vFloorY + 0.02, rz + 0.32)
            ]);
            pGrp.add(new T.Mesh(new T.TubeGeometry(retCrv, 14, 0.026, 7, false), mats.rubberHoseMat));
          }
        }
      }
      // Ceiling-to-floor sweeping cyan umbilical tube near far cross (`kf07` center-top curve!)
      const ceilTubeCrv = new T.CatmullRomCurve3([
        new T.Vector3(regX - 0.28, 2.98, -4.65),
        new T.Vector3(regX - 0.16, 1.98, -5.55),
        new T.Vector3(regX + 0.12, 1.05, -6.35),
        new T.Vector3(regX + 0.48, vFloorY + 0.02, -6.85)
      ]);
      pGrp.add(new T.Mesh(new T.TubeGeometry(ceilTubeCrv, 20, 0.034, 8, false), mats.cyanTubeMat));

      // Chipped-paint Registry service counter + Ration Ledger + Sample Cup aligned to Tess's right bay (`lx = 3.56`)
      const counter = new T.Mesh(new T.BoxGeometry(3.16, 0.085, 0.68), mats.counterChipMat);
      counter.position.set(regX, 1.04, frontWallZ + 0.03);
      pGrp.add(counter);
      const ledger = new T.Mesh(new T.BoxGeometry(0.36, 0.048, 0.28), new T.MeshStandardMaterial({ color: 0x4b3f32, roughness: 0.86 }));
      ledger.position.set(regX + 1.05, 1.105, frontWallZ - 0.04);
      ledger.rotation.y = 0.18;
      pGrp.add(ledger);
      const sampleCup = new T.Mesh(new T.CylinderGeometry(0.042, 0.034, 0.09, 14), new T.MeshStandardMaterial({ color: 0xdcd7cb, roughness: 0.45 }));
      sampleCup.position.set(regX + 0.76, 1.128, frontWallZ + 0.05);
      pGrp.add(sampleCup);

      // Steel-mullioned Georgian diamond wire-glass Registry window (`winW = 3.04, winH = 1.44`, mullions at `[-1.52, -0.60, +0.60, +1.52]`):
      // Center corridor `[1.85..3.05]` AND right Tess bay `[3.05..3.97]` (centered at `lx = 3.51`, top bar `y = 2.60`) are 100% mullion-free!
      const winW = 3.04, winH = 1.44, winY = 1.88, winZ = frontWallZ + 0.01;
      const wgPane = new T.Mesh(new T.PlaneGeometry(winW, winH), mats.wireGlassMat);
      wgPane.position.set(regX, winY, winZ);
      pGrp.add(wgPane);
      for (const mx of [-winW * 0.5, -0.60, 0.60, winW * 0.5]) {
        const mul = new T.Mesh(new T.BoxGeometry(0.038, winH + 0.18, 0.052), mats.ironDarkMat);
        mul.position.set(regX + mx, winY - 0.06, winZ);
        pGrp.add(mul);
      }
      for (const my of [winY - winH * 0.5, winY + winH * 0.5]) {
        const bar = new T.Mesh(new T.BoxGeometry(winW + 0.08, 0.045, 0.06), mats.ironDarkMat);
        bar.position.set(regX, my, winZ);
        pGrp.add(bar);
      }

      const wChair = makeWoodenChair(T, mats);
      wChair.position.set(1.05, 0, 0.55);
      wChair.rotation.y = -0.4;
      pGrp.add(wChair);

      // Hero `WATER = WIFI / SIGNAL OF GOD` stenciled jugs & terracotta watering bowl outside Registry!
      const regWifiJug = makeHeroWifiJerikan(T, mats, 1.04, true);
      regWifiJug.position.set(3.65, 0, 0.35);
      regWifiJug.rotation.y = -0.28;
      pGrp.add(regWifiJug);

      const puebBowl = makeTerracottaWateringBowl(T, mats, cyanWaterMat, 0.40, 0.27, true);
      puebBowl.position.set(0.35, 0.01, 3.15);
      pGrp.add(puebBowl);

      // 2c. Foreground 3-Branch Intake Box & Snaking Black + Glowing-Cyan Manifold Hoses
      const intakeBox = new T.Mesh(new T.BoxGeometry(0.92, 0.66, 0.68), mats.steelMat);
      intakeBox.position.set(1.85, 0.34, 2.35);
      intakeBox.rotation.y = -0.35;
      pGrp.add(intakeBox);

      const tapStone = new T.Mesh(new T.BoxGeometry(0.95, 0.22, 0.78), mats.stoneMat);
      tapStone.position.set(-1.35, 0.11, 3.25);
      pGrp.add(tapStone);
      const tinMug = new T.Mesh(new T.CylinderGeometry(0.068, 0.064, 0.15, 16), mats.steelMat);
      tinMug.position.set(-1.32, 0.295, 3.28);
      pGrp.add(tinMug);

      const hosePaths = [
        { mat: mats.cyanTubeMat, r: 0.036, pts: [[1.42, 0.26, 2.42], [0.92, 0.18, 2.78], [0.48, 0.30, 3.08]] },
        { mat: mats.rubberHoseMat, r: 0.052, pts: [[1.38, 0.32, 2.18], [0.10, 0.14, 1.65], [-2.4, 0.09, 1.85], [-4.55, 0.42, 2.25]] },
        { mat: mats.cyanTubeMat, r: 0.040, pts: [[-4.48, 0.62, 2.05], [-2.8, 0.11, 1.15], [-3.4, 0.48, -1.05]] },
        { mat: mats.rubberHoseMat, r: 0.034, pts: [[0.55, 0.18, 2.15], [-0.35, 0.22, 2.65], [-1.08, 0.38, 3.18]] },
        { mat: cyanWaterMat, r: 0.020, pts: [[-1.08, 0.38, 3.18], [-1.22, 0.40, 3.24], [-1.32, 0.34, 3.28]] },
        { mat: mats.rubberHoseMat, r: 0.044, pts: [[1.55, 0.22, 2.02], [0.65, 0.36, 1.55], [-0.45, 0.10, 2.15], [0.18, 0.14, 2.95]] }
      ];
      for (const hp of hosePaths) {
        const crv = new T.CatmullRomCurve3(hp.pts.map(p => new T.Vector3(p[0], p[1], p[2])));
        pGrp.add(new T.Mesh(new T.TubeGeometry(crv, 20, hp.r, 8, false), hp.mat));
      }
      for (const [vx, vy, vz] of [[0.15, 0.16, 2.15], [-0.55, 0.26, 2.85]]) {
        const flange = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 0.12, 12), mats.steelMat);
        flange.rotation.z = Math.PI * 0.5;
        flange.position.set(vx, vy, vz);
        pGrp.add(flange);
      }

      // Pueblo Timber Projection Screen
      const pScrX = -775.0, pScrZ = -28.0;
      const pScrGrp = new T.Group();
      pScrGrp.position.set(pScrX, groundAt(pScrX, pScrZ), pScrZ);
      pScrGrp.rotation.y = 0.30;
      for (const sx of [-2.4, 2.4]) {
        const post = new T.Mesh(new T.CylinderGeometry(0.075, 0.095, 4.0, 8), mats.timberDark);
        post.position.set(sx, 1.9, -0.05);
        pScrGrp.add(post);
      }
      const pBar = new T.Mesh(new T.BoxGeometry(5.1, 0.12, 0.14), mats.timberDark);
      pBar.position.set(0, 3.65, -0.05);
      pScrGrp.add(pBar);
      const pCloth = new T.Mesh(new T.PlaneGeometry(4.5, 2.53), cinemaMat);
      pCloth.position.set(0, 2.18, 0);
      pScrGrp.add(pCloth);
      worldProps.add(pScrGrp);
      inWorldScreens.push({ id: "pueblo", label: "Highland Pueblo Screen", mesh: pCloth, w: 4.5, h: 2.53, stand: { x: -772.5, z: -19.5, yaw: 0.32 } });

      worldProps.add(pGrp);
    }

    /* =========================================================================
       3. COTTONWOOD OXBOW LIVING FILM GROVE, GNARLED ROOT-BOWL + TERRACOTTA BASIN,
          35MM FILMSTRIP BRANCHES & PEGGED MULTI-SHEET CINEMA (`grove.jpg` & `kf16`!)
       ========================================================================= */
    {
      const oxX = -510.0, oxZ = 96.0, oxY = groundAt(oxX, oxZ);
      const oxGrp = new T.Group();
      oxGrp.position.set(oxX, oxY, oxZ);
      oxGrp.rotation.y = 0.45;

      const treeX = -2.85, treeZ = 1.65;
      const trunkPts = [
        new T.Vector3(treeX, -0.3, treeZ + 0.15),
        new T.Vector3(treeX - 0.08, 1.4, treeZ + 0.05),
        new T.Vector3(treeX + 0.06, 3.4, treeZ - 0.08),
        new T.Vector3(treeX - 0.12, 6.2, treeZ - 0.18)
      ];
      const trunkGeo = new T.TubeGeometry(new T.CatmullRomCurve3(trunkPts), 18, 0.56, 12, false);
      const tp = trunkGeo.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const vx = tp.getX(i) - treeX, vy = tp.getY(i), vz = tp.getZ(i) - treeZ;
        const flare = vy < 1.2 ? (1 + (1.2 - vy) * 0.52) : Math.max(0.45, 1 - (vy - 1.2) * 0.09);
        const furrow = 1 + 0.08 * Math.sin(Math.atan2(vx, vz) * 9 + vy * 2.5);
        tp.setXYZ(i, treeX + vx * flare * furrow, vy, treeZ + vz * flare * furrow);
      }
      trunkGeo.computeVertexNormals();
      oxGrp.add(new T.Mesh(trunkGeo, mats.barkMat));

      for (let r = 0; r < 5; r++) {
        const ang = -0.65 + r * 0.58;
        const rCrv = new T.CatmullRomCurve3([
          new T.Vector3(treeX + Math.cos(ang) * 0.42, 0.72, treeZ + Math.sin(ang) * 0.42),
          new T.Vector3(treeX + Math.cos(ang) * 1.05, 0.24, treeZ + Math.sin(ang) * 1.05),
          new T.Vector3(treeX + Math.cos(ang) * 1.85, -0.06, treeZ + Math.sin(ang) * 1.85)
        ]);
        oxGrp.add(new T.Mesh(new T.TubeGeometry(rCrv, 10, 0.13, 7, false), mats.barkMat));
      }

      // Wheel-thrown ribbed terracotta watering bowl nestled directly in the gnarled root-bowl beside Makeda!
      const bowlX = treeX + 0.92, bowlZ = treeZ + 0.48;
      const rootClayBowl = makeTerracottaWateringBowl(T, mats, cyanWaterMat, 0.48, 0.29, true);
      rootClayBowl.position.set(bowlX, 0.02, bowlZ);
      oxGrp.add(rootClayBowl);

      const bowlLight = new T.PointLight(0x3ce4f5, 1.45, 3.8, 1.8);
      bowlLight.position.set(bowlX, 0.58, bowlZ);
      oxGrp.add(bowlLight);
      const trickle = new T.Mesh(
        new T.TubeGeometry(new T.CatmullRomCurve3([
          new T.Vector3(bowlX + 0.42, 0.24, bowlZ + 0.12),
          new T.Vector3(bowlX + 0.64, 0.08, bowlZ + 0.28),
          new T.Vector3(bowlX + 0.95, 0.03, bowlZ + 0.45)
        ]), 10, 0.032, 6, false),
        cyanWaterMat
      );
      oxGrp.add(trickle);

      const limbCrv = new T.CatmullRomCurve3([
        new T.Vector3(treeX + 0.15, 2.55, treeZ),
        new T.Vector3(treeX + 1.25, 3.15, treeZ - 0.15),
        new T.Vector3(treeX + 2.35, 3.45, treeZ - 0.35)
      ]);
      oxGrp.add(new T.Mesh(new T.TubeGeometry(limbCrv, 14, 0.085, 7, false), mats.barkMat));
      for (let lf = 0; lf < 6; lf++) {
        const pt = limbCrv.getPointAt(0.32 + lf * 0.12);
        const strip = new T.Mesh(new T.PlaneGeometry(0.16, 0.52, 2, 6), mats.filmLeafMat);
        const sp = strip.geometry.attributes.position;
        for (let k = 0; k < sp.count; k++) sp.setZ(k, Math.sin(sp.getY(k) * 8) * 0.06);
        strip.geometry.computeVertexNormals();
        strip.position.set(pt.x + (lf % 2 ? 0.14 : -0.14), pt.y - 0.22, pt.z + (lf - 2.5) * 0.08);
        strip.rotation.set(0.35, lf * 0.6, (lf % 2 ? 1 : -1) * 0.28);
        oxGrp.add(strip);
      }

      // Forest Support Trunks + Clothesline Ropes + Pegged Billowing Linen Cinema Sheets
      for (const [tx, tz] of [[-2.65, 0], [2.65, 0], [-2.65, -1.85], [2.65, -1.85]]) {
        const fTrunk = new T.Mesh(new T.CylinderGeometry(0.18, 0.26, 5.6, 10), mats.barkMat);
        fTrunk.position.set(tx, 2.65, tz);
        oxGrp.add(fTrunk);
      }
      for (const rz of [0.02, -1.83]) {
        const line = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 5.4, 6), mats.ironDarkMat);
        line.rotation.z = Math.PI * 0.5;
        line.position.set(0, 3.74, rz);
        oxGrp.add(line);
        for (const px of [-2.05, -0.8, 0.8, 2.05]) {
          const peg = new T.Mesh(new T.BoxGeometry(0.025, 0.09, 0.025), mats.timberMat);
          peg.position.set(px, 3.74, rz);
          oxGrp.add(peg);
        }
      }

      const shGeoF = new T.PlaneGeometry(4.5, 2.53, 12, 8);
      oxbowWindBase = Float32Array.from(shGeoF.attributes.position.array);
      oxbowSheetFront = new T.Mesh(shGeoF, cinemaMat);
      oxbowSheetFront.position.set(0, 2.45, 0);
      oxGrp.add(oxbowSheetFront);

      oxbowSheetRear = new T.Mesh(new T.PlaneGeometry(4.5, 2.53, 8, 6), cinemaMat);
      oxbowSheetRear.position.set(0, 2.45, -1.85);
      oxGrp.add(oxbowSheetRear);
      inWorldScreens.push({ id: "oxbow", label: "Cottonwood Oxbow Double Linen Screen", mesh: oxbowSheetFront, w: 4.5, h: 2.53, stand: { x: -504.5, z: 106.5, yaw: 0.48 } });

      // Wind-billowing side linen banner (`billowLinenMat`!)
      const sideSheet = new T.Mesh(new T.PlaneGeometry(1.15, 2.15, 10, 12), mats.billowLinenMat);
      sideSheet.position.set(-2.95, 2.25, -0.55);
      sideSheet.rotation.y = 0.28;
      oxGrp.add(sideSheet);

      const spkBox = new T.Mesh(new T.BoxGeometry(0.62, 0.48, 0.42), mats.timberDark);
      spkBox.position.set(1.35, 0.24, 1.45);
      oxGrp.add(spkBox);

      const frontChair = makeWoodenChair(T, mats);
      frontChair.position.set(-1.05, 0, 2.52);
      frontChair.rotation.y = Math.PI;
      oxGrp.add(frontChair);

      worldProps.add(oxGrp);

      // Oxbow Stone & Corrugated-Tin Tea/Reel Kiosk (-514, 90) + `WATER = WIFI` hero cans!
      const kx = -514, kz = 90, ky = groundAt(kx, kz);
      const kg = new T.Group();
      kg.position.set(kx, ky, kz);
      kg.rotation.y = 1.1;
      const kPlinth = new T.Mesh(new T.BoxGeometry(4.1, 1.4, 2.7), mats.stoneMat);
      kPlinth.position.y = -0.65;
      kg.add(kPlinth);
      const kBody = new T.Mesh(new T.BoxGeometry(3.8, 2.25, 2.4), mats.hidmoWallMat);
      kBody.position.y = 1.12;
      kg.add(kBody);
      const kCounter = new T.Mesh(new T.BoxGeometry(2.6, 0.08, 0.58), mats.timberMat);
      kCounter.position.set(0, 1.08, 1.28);
      kg.add(kCounter);
      const kAwning = new T.Mesh(new T.BoxGeometry(4.4, 0.04, 3.2), mats.roofMat);
      kAwning.position.set(0, 2.42, 0.42);
      kAwning.rotation.x = 0.22;
      kg.add(kAwning);
      for (const px of [-1.95, 1.95]) {
        const kp = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 2.25, 8), mats.timberDark);
        kp.position.set(px, 1.10, 1.75);
        kg.add(kp);
      }
      const kDeck = new T.Mesh(new T.BoxGeometry(0.68, 0.24, 0.36), beaconCyanMat);
      kDeck.position.set(0, 1.22, 1.24);
      kg.add(kDeck);
      for (const [cx, cz, ry] of [[-1.5, 1.4, 0.2], [1.4, 1.3, -0.4]]) {
        const cj = makeHeroWifiJerikan(T, mats, 0.96, true);
        cj.position.set(cx, 0, cz);
        cj.rotation.y = ry;
        kg.add(cj);
      }
      worldProps.add(kg);
    }

    /* =========================================================================
       4. SNAKE RIVER OVERLOOK SCREEN + SILVER FORD FERRY + WHALE FLUKE + SWITCHBACK
       ========================================================================= */
    {
      const ovX = -28.5, ovZ = -0.8, ovY = groundAt(ovX, ovZ);
      const ovGrp = new T.Group();
      ovGrp.position.set(ovX, ovY, ovZ);
      ovGrp.rotation.y = 1.53;
      for (const px of [-2.55, 2.55]) {
        const post = new T.Mesh(new T.CylinderGeometry(0.085, 0.105, 4.15, 8), mats.timberDark);
        post.position.set(px, 2.0, -0.05);
        ovGrp.add(post);
      }
      const ovCross = new T.Mesh(new T.BoxGeometry(5.35, 0.13, 0.15), mats.timberDark);
      ovCross.position.set(0, 3.68, -0.05);
      ovGrp.add(ovCross);
      const ovFoot = new T.Mesh(new T.BoxGeometry(5.2, 0.11, 0.13), mats.timberDark);
      ovFoot.position.set(0, 0.72, -0.05);
      ovGrp.add(ovFoot);
      const ovCloth = new T.Mesh(new T.PlaneGeometry(4.80, 2.70), cinemaMat);
      ovCloth.position.set(0, 2.20, 0);
      ovGrp.add(ovCloth);
      worldProps.add(ovGrp);
      inWorldScreens.push({ id: "overlook", label: "Snake River Overlook Screen", mesh: ovCloth, w: 4.80, h: 2.70, stand: { x: -19.5, z: -0.4, yaw: 1.68 } });

      // Silver Ford Ferry Landing Stage, Flood-Marked Gauge Post & Wet Ferry Cable
      const p1y = driveSurfaceAt(-255, -54), p2y = driveSurfaceAt(-236, -64);
      const post1 = new T.Mesh(new T.CylinderGeometry(0.14, 0.18, 3.4, 10), mats.timberDark);
      post1.position.set(-255, p1y + 1.5, -54);
      worldProps.add(post1);
      for (const cy of [0.6, 1.1, 1.6]) {
        const mark = new T.Mesh(new T.TorusGeometry(0.158, 0.014, 6, 16), mats.laundryLightMat);
        mark.rotation.x = Math.PI * 0.5;
        mark.position.set(-255, p1y + cy, -54);
        worldProps.add(mark);
      }
      const post2 = new T.Mesh(new T.CylinderGeometry(0.14, 0.18, 3.4, 10), mats.timberDark);
      post2.position.set(-236, p2y + 1.5, -64);
      worldProps.add(post2);
      const ropeCrv = new T.CatmullRomCurve3([
        new T.Vector3(-255, p1y + 2.55, -54),
        new T.Vector3(-245.5, Math.min(p1y, p2y) + 1.95, -59),
        new T.Vector3(-236, p2y + 2.55, -64)
      ]);
      worldProps.add(new T.Mesh(new T.TubeGeometry(ropeCrv, 22, 0.032, 6, false), cyanWaterMat));

      const dock = new T.Group();
      dock.position.set(-250.5, driveSurfaceAt(-250.5, -53.5) + 0.12, -53.5);
      dock.rotation.y = 0.52;
      for (let p = 0; p < 8; p++) {
        const plk = new T.Mesh(new T.BoxGeometry(2.4, 0.065, 0.28), mats.timberMat);
        plk.position.set(0, 0, (p - 3.5) * 0.32);
        dock.add(plk);
      }
      worldProps.add(dock);

      // Whale Fluke Wreck Screen + Two Wooden Comedy Chairs
      const fY = groundAt(-1070, -28);
      const fGrp = new T.Group();
      fGrp.position.set(-1070, fY, -28);
      fGrp.rotation.y = 0.45;
      for (const sx of [-2.25, 2.25]) {
        const fp = new T.Mesh(new T.CylinderGeometry(0.075, 0.095, 3.8, 8), mats.timberDark);
        fp.position.set(sx, 1.85, -0.05);
        fGrp.add(fp);
      }
      const fSheet = new T.Mesh(new T.PlaneGeometry(4.2, 2.36), cinemaMat);
      fSheet.position.set(0, 2.18, 0);
      fGrp.add(fSheet);
      worldProps.add(fGrp);
      inWorldScreens.push({ id: "fluke", label: "Whale Fluke Screen", mesh: fSheet, w: 4.2, h: 2.36, stand: { x: -1064.0, z: -18.5, yaw: 0.56 } });
      for (const s of [-0.75, 0.75]) {
        const ch = makeWoodenChair(T, mats);
        ch.position.set(-1068 + s, groundAt(-1068 + s, -25.2), -25.2);
        ch.rotation.y = Math.PI + 0.45;
        worldProps.add(ch);
      }

      // Moraine Switchback Baker's Stone Dome Oven & Tack Table (-46.2, -163.8)
      const swY = groundAt(-46.2, -163.8);
      const swGrp = new T.Group();
      swGrp.position.set(-46.2, swY, -163.8);
      swGrp.rotation.y = 0.55;
      const ovenBase = new T.Mesh(new T.BoxGeometry(1.55, 0.85, 1.45), mats.basaltPlinthMat);
      ovenBase.position.set(-1.3, 0.42, -0.6);
      swGrp.add(ovenBase);
      const ovenDome = new T.Mesh(new T.SphereGeometry(0.68, 16, 12, 0, TAU, 0, Math.PI * 0.52), mats.mudPlasterMat);
      ovenDome.position.set(-1.3, 0.84, -0.6);
      swGrp.add(ovenDome);
      const tackBench = new T.Mesh(new T.BoxGeometry(1.85, 0.78, 0.72), mats.timberMat);
      tackBench.position.set(1.15, 0.39, 0.2);
      swGrp.add(tackBench);
      const swSawbuck = makeSawbuckPackFrame(T, mats, 0.88);
      swSawbuck.position.set(1.15, 0.78, 0.2);
      swGrp.add(swSawbuck);
      worldProps.add(swGrp);

      // Half Dome East Apron Cast-Iron Standpipe Pump (`kf02`!) + Teton High Cairn
      const apY = groundAt(438, 34);
      const seepPump = makeCastIronStandpipePump(T, mats, cyanWaterMat);
      seepPump.position.set(438, apY, 34);
      worldProps.add(seepPump);
      pumpRegistry.seep = seepPump;
      if (mw && mw.tetonRange) {
        const tcY = groundAt(mw.tetonRange.x, mw.tetonRange.z);
        const tcCairn = new T.Mesh(new T.ConeGeometry(0.88, 1.65, 8), mats.stoneMat);
        tcCairn.position.set(mw.tetonRange.x, tcY + 0.8, mw.tetonRange.z);
        worldProps.add(tcCairn);
      }
      // Place ZZlDs10FCZk Wheel-Thrown Terracotta Donkey Watering Bowls (`shekla`, kf16!) & Highland Stone Chapel!
      for (const [bx, bz] of [[-24.2, -5.2], [-49.6, -166.2], [-246.2, -53.2]]) {
        const bowl = makeTerracottaDonkeyBowl(T, mats, cyanWaterMat);
        bowl.position.set(bx, groundAt(bx, bz), bz);
        worldProps.add(bowl);
      }
      const upperChapel = makeStoneCrossChapel(T, mats, puebloDarkWinMat);
      upperChapel.position.set(-816, groundAt(-816, -22), -22);
      upperChapel.rotation.y = Math.PI * 0.48;
      worldProps.add(upperChapel);

      const hidmo = makeHidmoCompoundHouse(T, mats, cyanWaterMat, puebloDarkWinMat);
      hidmo.position.set(-786, groundAt(-786, -38), -38);
      hidmo.rotation.y = 0.22;
      worldProps.add(hidmo);
    }

    /* =========================================================================
       5. AHIYA HIGHLANDS PRODUCTION SETS (`hasNightPostSets = true`):
          - Basalt Standpipe Pump & Stenciled Cans (`-1460, 760`)
          - Domed Stone Cross-Beacon Sanctuary & Delaunay Ground Network Mesh (`-1610, 590`)
          - Hill Archive `REC PPC` Surveillance Cubicle (`-1765, 540`)
          - Daylight Hidmo Compound, Billowing Doorway Curtain & Terracotta Bowl (`-1680, 775`)
       ========================================================================= */
    if (hasNightPostSets) {
      // Terracotta donkey bowl at Basalt Pump + Gabled Stone Chapel crowning Cross-Beacon Watch!
      const bBowl = makeTerracottaDonkeyBowl(T, mats, cyanWaterMat);
      bBowl.position.set(-1457.8, groundAt(-1457.8, 761.2), 761.2);
      worldProps.add(bBowl);

      const beaconChapel = makeStoneCrossChapel(T, mats, puebloDarkWinMat);
      beaconChapel.position.set(-1610, groundAt(-1610, 585.5), 585.5);
      worldProps.add(beaconChapel);
      // 5a. Basalt Column Cast-Iron Standpipe Pump, Gauge-Thread Trough & `WATER = WIFI` Cans (-1460, 760)
      const by = groundAt(-1460, 760);
      const bGrp = new T.Group();
      bGrp.position.set(-1460, by, 760);
      for (let i = 0; i < 8; i++) {
        const colH = 1.15 + (i % 3) * 0.55;
        const col = new T.Mesh(new T.CylinderGeometry(0.46, 0.50, colH, 6), mats.basaltPlinthMat);
        col.position.set(Math.cos(i * 0.78) * 3.9, colH * 0.45, Math.sin(i * 0.78) * 3.9);
        bGrp.add(col);
      }
      const bStandpipe = makeCastIronStandpipePump(T, mats, cyanWaterMat, [
        [0, 0.38, 0.16], [0.45, 0.24, 0.32], [1.10, 0.22, 0.52], [1.55, 0.44, 0.62]
      ]);
      bGrp.add(bStandpipe);
      pumpRegistry.basalt = bStandpipe;
      const bThread = new T.Mesh(new T.TorusGeometry(0.118, 0.016, 6, 18), new T.MeshBasicMaterial({ color: 0xff5a5a }));
      bThread.rotation.x = Math.PI * 0.5;
      bThread.position.set(0, 0.92, 0);
      bGrp.add(bThread);

      const bTrough = new T.Mesh(new T.BoxGeometry(2.2, 0.44, 0.94), mats.basaltPlinthMat);
      bTrough.position.set(1.65, 0.22, 0.62);
      bGrp.add(bTrough);
      const bWater = new T.Mesh(new T.PlaneGeometry(1.92, 0.70), cyanWaterMat);
      bWater.rotation.x = -Math.PI * 0.5;
      bWater.position.set(1.65, 0.45, 0.62);
      bGrp.add(bWater);

      for (const [jx, jz, jry] of [[-0.95, 0.68, 0.35], [-1.32, 0.42, -0.22]]) {
        const bj = makeHeroWifiJerikan(T, mats, 1.0, true);
        bj.position.set(jx, 0, jz);
        bj.rotation.y = jry;
        bGrp.add(bj);
      }
      worldProps.add(bGrp);

      // 5b. Domed Stone Cross-Beacon Sanctuary (`-1610, 590`, `rot.y = 0.62` facing SE convoy!)
      // + Radiating Cyan Delaunay Ground Network Mesh hugging `driveSurfaceAt(x, z)` (`kf10`!)
      const bcy = groundAt(-1610, 590);
      const bcSanctuary = buildCrossBeaconSanctuary(T, mats, cyanWaterMat);
      bcSanctuary.position.set(-1610, bcy, 590);
      bcSanctuary.rotation.y = 0.62;
      worldProps.add(bcSanctuary);

      buildAhiyaGroundNetworkMesh(T, mats, driveSurfaceAt, worldProps);

      // 5c. Hill Archive `REC PPC` Surveillance Cubicle & Operator Desk (-1765, 540 — exact `kf08`!)
      const hy = groundAt(-1765, 540);
      const hGrp = new T.Group();
      hGrp.position.set(-1765, hy, 540);

      const hPlinth = new T.Mesh(new T.BoxGeometry(7.8, 2.0, 5.6), mats.concreteMat);
      hPlinth.position.y = -0.95;
      hGrp.add(hPlinth);
      const hFloor = new T.Mesh(new T.BoxGeometry(7.4, 0.06, 5.2), new T.MeshStandardMaterial({ color: 0x2c3035, roughness: 0.85 }));
      hFloor.position.y = 0.01;
      hGrp.add(hFloor);
      const hRoof = new T.Mesh(new T.BoxGeometry(8.0, 0.32, 5.8), mats.concreteMat);
      hRoof.position.y = 3.55;
      hGrp.add(hRoof);

      for (const sx of [-1, 1]) {
        const sideW = new T.Mesh(new T.BoxGeometry(0.35, 3.5, 5.4), mats.concreteMat);
        sideW.position.set(sx * 3.72, 1.75, 0);
        hGrp.add(sideW);

        const shroud = new T.Mesh(new T.CylinderGeometry(0.66, 0.70, 0.34, 18, 1, true), mats.concreteMat);
        shroud.position.set(sx * 2.3, 3.78, 0);
        hGrp.add(shroud);
        const hFan = new T.Group();
        hFan.position.set(sx * 2.3, 3.84, 0);
        for (let b = 0; b < 3; b++) {
          const bl = new T.Mesh(new T.BoxGeometry(1.18, 0.03, 0.16), beaconCyanMat);
          bl.rotation.y = (b * Math.PI) / 3;
          hFan.add(bl);
        }
        hGrp.add(hFan);
        npSpinFans.push(hFan);
      }

      // L-shaped acoustic office cubicle partition walls with brushed aluminum rails (`kf08`!)
      const cubWall = new T.Mesh(new T.BoxGeometry(6.8, 3.2, 0.12), mats.officePanelMat);
      cubWall.position.set(0, 1.60, -0.15);
      hGrp.add(cubWall);
      for (const px of [-3.35, -1.55, 0, 1.55, 3.35]) {
        const seam = new T.Mesh(new T.BoxGeometry(0.042, 3.2, 0.15), mats.steelMat);
        seam.position.set(px, 1.60, -0.15);
        hGrp.add(seam);
      }
      for (const pyRail of [2.85, 1.62]) {
        const hRail = new T.Mesh(new T.BoxGeometry(6.8, 0.038, 0.145), mats.steelMat);
        hRail.position.set(0, pyRail, -0.15);
        hGrp.add(hRail);
      }
      // Side cubicle return panels (`kf08` right-side partition + yellow sticky note + left duty roster!)
      for (const sx of [-1, 1]) {
        const sideCub = new T.Mesh(new T.BoxGeometry(0.10, 2.85, 2.45), mats.officePanelMat);
        sideCub.position.set(sx * 1.95, 1.42, 1.02);
        hGrp.add(sideCub);
      }
      const rosterSheet = new T.Mesh(new T.PlaneGeometry(0.32, 0.44), mats.laundryLightMat);
      rosterSheet.position.set(-1.32, 1.48, -0.08);
      hGrp.add(rosterSheet);
      const stickyNote = new T.Mesh(
        new T.PlaneGeometry(0.14, 0.14),
        new T.MeshStandardMaterial({ color: 0xdfd46b, roughness: 0.85, side: T.DoubleSide })
      );
      stickyNote.position.set(1.89, 2.02, 1.38);
      stickyNote.rotation.y = -Math.PI * 0.5;
      hGrp.add(stickyNote);

      // Wall-mounted / pedestal `REC PPC` Widescreen Monitor + crisp Viewfinder HUD Frame (`kf08`!)
      const monStandBase = new T.Mesh(new T.BoxGeometry(0.56, 0.025, 0.34), mats.ironDarkMat);
      monStandBase.position.set(-0.08, 0.798, 0.58);
      hGrp.add(monStandBase);
      const monStandNeck = new T.Mesh(new T.BoxGeometry(0.12, 0.42, 0.06), mats.ironDarkMat);
      monStandNeck.position.set(-0.08, 1.00, 0.48);
      hGrp.add(monStandNeck);

      const bezel = new T.Mesh(new T.BoxGeometry(2.44, 1.42, 0.075), mats.ironDarkMat);
      bezel.position.set(0, 1.78, 0.02);
      hGrp.add(bezel);
      const archMon = new T.Mesh(new T.PlaneGeometry(2.30, 1.30), cinemaMat);
      archMon.position.set(0, 1.78, 0.064);
      hGrp.add(archMon);
      if (mats.recPpcHudMat) {
        const hudOverlay = new T.Mesh(new T.PlaneGeometry(2.28, 1.28), mats.recPpcHudMat);
        hudOverlay.position.set(0, 1.78, 0.072);
        hGrp.add(hudOverlay);
      }
      // Inside-cubicle wall cooling fan rotor (`npSpinFans`)
      const wallFanRing = new T.Mesh(new T.TorusGeometry(0.24, 0.028, 8, 18), mats.steelMat);
      wallFanRing.position.set(1.52, 2.42, -0.07);
      hGrp.add(wallFanRing);
      const wallFanPivot = new T.Group();
      wallFanPivot.position.set(1.52, 2.42, -0.06);
      wallFanPivot.rotation.x = Math.PI * 0.5;
      const wallFanRotor = new T.Group();
      for (let b = 0; b < 3; b++) {
        const wb = new T.Mesh(new T.BoxGeometry(0.40, 0.015, 0.065), beaconCyanMat);
        wb.rotation.y = (b * Math.PI) / 3;
        wallFanRotor.add(wb);
      }
      wallFanPivot.add(wallFanRotor);
      hGrp.add(wallFanPivot);
      npSpinFans.push(wallFanRotor);

      inWorldScreens.push({ id: "hill", label: "Hill Archive REC PPC Monitor", mesh: archMon, w: 2.30, h: 1.30, stand: { x: -1765.0, z: 547.5, yaw: 0.00 } });

      // Wide gray steel operator desk at z = +0.92 + laptop + red-LED radio box + clipboards + gooseneck lamps (`kf08`!)
      const deskTop = new T.Mesh(new T.BoxGeometry(3.10, 0.052, 1.08), mats.officeDeskMat);
      deskTop.position.set(0, 0.76, 0.92);
      hGrp.add(deskTop);
      for (const lx of [-1.38, 1.38]) {
        for (const lz of [0.46, 1.36]) {
          const dLeg = new T.Mesh(new T.BoxGeometry(0.055, 0.76, 0.055), mats.steelMat);
          dLeg.position.set(lx, 0.38, lz);
          hGrp.add(dLeg);
        }
      }

      // Open laptop in center of desk (`kf08`!)
      const lapBase = new T.Mesh(new T.BoxGeometry(0.38, 0.014, 0.26), mats.ironDarkMat);
      lapBase.position.set(0.08, 0.794, 0.92);
      lapBase.rotation.y = -0.14;
      hGrp.add(lapBase);
      const lapScrFrame = new T.Mesh(new T.BoxGeometry(0.38, 0.24, 0.012), mats.ironDarkMat);
      lapScrFrame.position.set(0.06, 0.91, 0.79);
      lapScrFrame.rotation.set(-0.24, -0.14, 0);
      hGrp.add(lapScrFrame);
      const lapDocPane = new T.Mesh(
        new T.PlaneGeometry(0.34, 0.20),
        new T.MeshStandardMaterial({ color: 0x9ad8ee, emissive: 0x2c789e, emissiveIntensity: 0.95, roughness: 0.3 })
      );
      lapDocPane.position.set(0.062, 0.91, 0.798);
      lapDocPane.rotation.set(-0.24, -0.14, 0);
      hGrp.add(lapDocPane);

      // Left telemetry patch box with glowing red indicator LED (`kf08`!) + stacked log binders
      const patchBox = new T.Mesh(new T.BoxGeometry(0.28, 0.068, 0.16), mats.ironDarkMat);
      patchBox.position.set(-0.98, 0.82, 0.62);
      hGrp.add(patchBox);
      const redLed = new T.Mesh(new T.SphereGeometry(0.011, 8, 6), new T.MeshBasicMaterial({ color: 0xff3b2f }));
      redLed.position.set(-0.92, 0.825, 0.705);
      hGrp.add(redLed);
      const binder = new T.Mesh(new T.BoxGeometry(0.36, 0.045, 0.28), mats.laundryLightMat);
      binder.position.set(-0.84, 0.808, 0.86);
      hGrp.add(binder);

      // Operator clipboards + blue pen (`kf08`!)
      for (const [cx, cz, cyaw] of [[-0.64, 1.18, -0.18], [0.58, 1.16, 0.22]]) {
        const board = new T.Mesh(new T.BoxGeometry(0.28, 0.010, 0.36), new T.MeshStandardMaterial({ color: 0x6e4f35, roughness: 0.85 }));
        board.position.set(cx, 0.792, cz);
        board.rotation.y = cyaw;
        hGrp.add(board);
        const paper = new T.Mesh(new T.PlaneGeometry(0.25, 0.32), mats.laundryLightMat);
        paper.rotation.x = -Math.PI * 0.5;
        paper.rotation.z = cyaw;
        paper.position.set(cx, 0.799, cz);
        hGrp.add(paper);
      }

      // Handheld VHF dispatch radio on desk charger
      const radio = new T.Mesh(new T.BoxGeometry(0.065, 0.14, 0.045), mats.ironDarkMat);
      radio.position.set(0.76, 0.86, 0.74);
      hGrp.add(radio);
      const rAnt = new T.Mesh(new T.CylinderGeometry(0.005, 0.007, 0.19, 6), mats.ironDarkMat);
      rAnt.position.set(0.77, 1.01, 0.74);
      hGrp.add(rAnt);

      // Two articulated curved gooseneck desk lamps with glowing warm bulbs (`kf08`!)
      for (const [sx, lampH, lampZ] of [[-1.16, 1.18, 0.68], [1.06, 1.48, 0.66]]) {
        const lBase = new T.Mesh(new T.CylinderGeometry(0.085, 0.095, 0.024, 14), mats.ironDarkMat);
        lBase.position.set(sx, 0.798, lampZ - 0.08);
        hGrp.add(lBase);
        const neckCrv = new T.CatmullRomCurve3([
          new T.Vector3(sx, 0.81, lampZ - 0.08),
          new T.Vector3(sx + Math.sign(sx) * 0.06, (0.81 + lampH) * 0.55, lampZ - 0.12),
          new T.Vector3(sx - Math.sign(sx) * 0.08, lampH + 0.08, lampZ + 0.02),
          new T.Vector3(sx - Math.sign(sx) * 0.14, lampH, lampZ + 0.10)
        ]);
        hGrp.add(new T.Mesh(new T.TubeGeometry(neckCrv, 14, 0.011, 7, false), mats.ironDarkMat));
        const shade = new T.Mesh(new T.ConeGeometry(0.115, 0.15, 16, 1, true), mats.steelMat);
        shade.position.set(sx - Math.sign(sx) * 0.14, lampH - 0.05, lampZ + 0.11);
        shade.rotation.z = Math.sign(sx) * 0.22;
        hGrp.add(shade);
        const bulb = new T.Mesh(new T.SphereGeometry(0.048, 10, 8), mats.warmInteriorMat);
        bulb.position.set(sx - Math.sign(sx) * 0.14, lampH - 0.09, lampZ + 0.11);
        hGrp.add(bulb);
      }
      const deskLampLight = new T.PointLight(0xfff2dc, 1.95, 6.2, 1.5);
      deskLampLight.position.set(0.15, 2.05, 1.25);
      hGrp.add(deskLampLight);
      const monGlowLight = new T.PointLight(0x6ae4ff, 1.15, 4.5, 1.7);
      monGlowLight.position.set(0, 1.72, 0.75);
      hGrp.add(monGlowLight);

      // Two ergonomic swivel task chairs under ppc_op_male (-0.85, 1.55) & ppc_op_female (+0.85, 1.55)
      for (const cx of [-0.85, 0.85]) {
        const ch = makeOfficeTaskChair(T, mats);
        ch.position.set(cx, 0, 1.60);
        ch.rotation.y = cx < 0 ? -0.35 : 0.35;
        hGrp.add(ch);
      }
      worldProps.add(hGrp);

      // 5d. Daylight Hidmo Compound (`-1680, 775`, `rot.y = 0` — locked to `COMPOUND_PAD_Y = groundAt(-1680, 775) + 0.52` in #65!):
      const cy = groundAt(-1680, 775) + 0.52;
      const cGrp = new T.Group();
      cGrp.position.set(-1680, cy, 775);

      // Level earthen & coursed-basalt compound terrace (`14.5 × 2.2 × 12.0` centered at `y = -1.10` so flat top face = `local y = 0.0`,
      // completely above the coarse GPU terrain chord so Mistletoe's hooves, carriers' sandals & terracotta bowl stand cleanly on earth!)
      const courtPad = new T.Mesh(new T.BoxGeometry(14.5, 2.2, 12.0), mats.basaltPlinthMat);
      courtPad.position.set(0.2, -1.10, -0.6);
      courtPad.receiveShadow = true;
      cGrp.add(courtPad);
      const courtEarth = new T.Mesh(new T.BoxGeometry(14.1, 0.04, 11.6), mats.mudPlasterMat);
      courtEarth.position.set(0.2, -0.018, -0.6);
      courtEarth.receiveShadow = true;
      cGrp.add(courtEarth);

      // 1) Left (NW) Hidmo House (`local x ∈ [-5.65, -0.35]`, front wall at `local z = -3.40`)
      const nwW = 5.30, nwH = 3.38, nwD = 3.80, nwX = -3.00, nwZ = -5.30;
      const nwGrp = new T.Group();
      nwGrp.position.set(nwX, 0, nwZ);
      const nwPlinth = new T.Mesh(new T.BoxGeometry(nwW + 0.24, 0.88, nwD + 0.24), mats.basaltPlinthMat);
      nwPlinth.position.y = 0.40;
      nwGrp.add(nwPlinth);
      const nwBody = new T.Mesh(new T.BoxGeometry(nwW, nwH, nwD), mats.hidmoWallMat);
      nwBody.position.y = nwH * 0.5;
      nwBody.castShadow = true;
      nwBody.receiveShadow = true;
      nwGrp.add(nwBody);
      addHidmoVigasAndParapet(T, mats, nwGrp, nwW, nwH, nwD, true, false);
      cGrp.add(nwGrp);

      // HERO Recessed Timber-Lintel Doorway + Wind-Billowing White Linen Curtain at `local (-2.15, 0, -3.38)`!
      const heroDoorway = makeHidmoDoorwayWithCurtain(T, mats, 1.28, 2.22);
      heroDoorway.group.position.set(-2.15, 0, -3.38);
      cGrp.add(heroDoorway.group);

      // Flanking recessed shuttered timber window on NW Hidmo facade (`local -4.35, 1.42, -3.38`)
      const compWin1 = makeFramedWindow(T, mats, 0.84, 0.94, puebloDarkWinMat, true);
      compWin1.group.position.set(-4.35, 1.42, -3.38);
      cGrp.add(compWin1.group);

      // Low coursed-basalt compound threshold sill across the center sightline notch (`x ∈ [-0.35, +2.45]`, `h = 0.58m`)
      const notchWall = new T.Mesh(new T.BoxGeometry(2.85, 0.58, 0.48), mats.basaltPlinthMat);
      notchWall.position.set(1.05, 0.29, -4.15);
      cGrp.add(notchWall);

      // 2) Right (NE) Hidmo House (`local x ∈ [+2.45, +6.85]`, front wall at `local z = -3.30`)
      const neW = 4.40, neH = 3.16, neD = 3.70, neX = 4.65, neZ = -5.15;
      const neGrp = new T.Group();
      neGrp.position.set(neX, 0, neZ);
      const nePlinth = new T.Mesh(new T.BoxGeometry(neW + 0.24, 0.84, neD + 0.24), mats.basaltPlinthMat);
      nePlinth.position.y = 0.38;
      neGrp.add(nePlinth);
      const neBody = new T.Mesh(new T.BoxGeometry(neW, neH, neD), mats.hidmoWallMat);
      neBody.position.y = neH * 0.5;
      neBody.castShadow = true;
      neBody.receiveShadow = true;
      neGrp.add(neBody);
      addHidmoVigasAndParapet(T, mats, neGrp, neW, neH, neD, true, false);
      cGrp.add(neGrp);

      // 3) West Hidmo Return Wing (`inner courtyard wall at x = -4.65`, `z ∈ [-3.40, +3.40]`)
      const wWingW = 2.6, wWingH = 2.92, wWingD = 6.8, wWingX = -5.95, wWingZ = 0.0;
      const wPlinth = new T.Mesh(new T.BoxGeometry(wWingW + 0.24, 0.82, wWingD + 0.24), mats.basaltPlinthMat);
      wPlinth.position.set(wWingX, 0.38, wWingZ);
      cGrp.add(wPlinth);
      const wBody = new T.Mesh(new T.BoxGeometry(wWingW, wWingH, wWingD), mats.hidmoWallMat);
      wBody.position.set(wWingX, wWingH * 0.5, wWingZ);
      wBody.castShadow = true;
      wBody.receiveShadow = true;
      cGrp.add(wBody);
      for (let i = 0; i < 8; i++) {
        const vz = lerp(-wWingD * 0.42, wWingD * 0.42, i / 7);
        const viga = new T.Mesh(new T.CylinderGeometry(0.066, 0.074, 0.56, 9), mats.vigaMat);
        viga.rotation.z = Math.PI * 0.5;
        viga.position.set(wWingX + wWingW * 0.5 + 0.16, wWingH - 0.24, vz);
        viga.castShadow = true;
        cGrp.add(viga);
      }
      const wParapet = new T.Mesh(new T.BoxGeometry(wWingW + 0.08, 0.26, wWingD + 0.08), mats.mudPlasterMat);
      wParapet.position.set(wWingX, wWingH + 0.13, wWingZ);
      cGrp.add(wParapet);
      const compWin2 = makeFramedWindow(T, mats, 0.82, 0.90, puebloDarkWinMat, true);
      compWin2.group.position.set(wWingX + wWingW * 0.5 + 0.02, 1.38, -0.85);
      compWin2.group.rotation.y = Math.PI * 0.5;
      cGrp.add(compWin2.group);

      // Secondary wind-billowing linen curtain in West Wing doorway (`local -4.65, 0, +1.55`)
      const sideDoor = makeHidmoDoorwayWithCurtain(T, mats, 1.08, 2.02);
      sideDoor.group.position.set(wWingX + wWingW * 0.5, 0, 1.55);
      sideDoor.group.rotation.y = Math.PI * 0.5;
      cGrp.add(sideDoor.group);

      // Pegged Cinema Sheet (`id: "compound"`) hung cleanly on the NE Hidmo House front (`local +4.65, 1.88, -3.12`)
      const cRope = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 4.3, 6), mats.sisalRopeMat);
      cRope.rotation.z = Math.PI * 0.5;
      cRope.position.set(4.65, 3.04, -3.12);
      cGrp.add(cRope);
      for (const px of [2.85, 4.05, 5.25, 6.45]) {
        const peg = new T.Mesh(new T.BoxGeometry(0.028, 0.09, 0.028), mats.timberMat);
        peg.position.set(px, 3.04, -3.12);
        cGrp.add(peg);
      }
      const cSheet = new T.Mesh(new T.PlaneGeometry(4.1, 2.31, 8, 6), cinemaMat);
      cSheet.position.set(4.65, 1.86, -3.12);
      cGrp.add(cSheet);
      inWorldScreens.push({ id: "compound", label: "Daylight Compound Pegged Sheet", mesh: cSheet, w: 4.1, h: 2.31, stand: { x: -1679.0, z: 783.5, yaw: 0.09 } });

      // HERO Wheel-Thrown Ribbed Terracotta Watering Bowl (`kf16`) on low `0.06m` flagstone at `local (-0.85, 0, -0.65)`:
      // `bowl rim = local y + 0.30`, `meniscus = local y + 0.23` on flat `COMPOUND_PAD_Y` (`#65`!)
      const bowlFlagstone = new T.Mesh(new T.CylinderGeometry(0.60, 0.64, 0.06, 14), mats.chapelStoneMat);
      bowlFlagstone.position.set(-0.85, -0.02, -0.65);
      bowlFlagstone.receiveShadow = true;
      cGrp.add(bowlFlagstone);

      const heroClayBowl = makeTerracottaWateringBowl(T, mats, cyanWaterMat, 0.44, 0.30, true);
      heroClayBowl.position.set(-0.85, 0.005, -0.65);
      cGrp.add(heroClayBowl);

      // Coursed-Stone Circular Courtyard Well with Glowing Cyan Water (`study_sheet` a!) at `local (+2.35, 0, +0.85)`
      const compWell = makeCoursedStoneWell(T, mats, cyanWaterMat, 0.90, 0.56);
      compWell.position.set(2.35, 0, 0.85);
      cGrp.add(compWell);

      // Wooden donkey sawbuck pack frame + 2 roped `WATER = WIFI / SIGNAL OF GOD` jerrycans beside Hidmo plinth!
      const compSawbuck = makeSawbuckPackFrame(T, mats, 1.02);
      compSawbuck.position.set(-4.15, 0, -2.55);
      compSawbuck.rotation.y = 0.38;
      cGrp.add(compSawbuck);

      for (const [jx, jz, jry] of [[-0.58, -3.05, 0.18], [-0.15, -2.98, -0.32]]) {
        const cj = makeHeroWifiJerikan(T, mats, 1.04, true);
        cj.position.set(jx, 0, jz);
        cj.rotation.y = jry;
        cGrp.add(cj);
      }

      const eastCurb = new T.Mesh(new T.BoxGeometry(0.52, 0.78, 5.4), mats.basaltPlinthMat);
      eastCurb.position.set(6.55, 0.38, -0.4);
      cGrp.add(eastCurb);

      const cChair = makeWoodenChair(T, mats);
      cChair.position.set(4.15, 0, -1.85);
      cChair.rotation.y = -0.55;
      cGrp.add(cChair);

      worldProps.add(cGrp);
    }

    if (typeof window !== "undefined") {
      window.__npStandpipePumps = pumpRegistry;
    }

    function updateArchitecture(nowSec) {
      mats.windUniforms.uWindTime.value = nowSec;
      for (const fan of npSpinFans) fan.rotation.y += 0.16;
      for (const item of laundrySway) {
        item.mesh.rotation.x = Math.sin(nowSec * 1.65 + item.phase) * 0.08;
      }
      if (oxbowSheetFront && oxbowWindBase) {
        const pos = oxbowSheetFront.geometry.attributes.position.array;
        const gust = Math.sin(nowSec * 0.85) * 0.09;
        for (let i = 0; i < pos.length; i += 3) {
          const ox = oxbowWindBase[i], oy = oxbowWindBase[i + 1];
          const corner = smooth(-0.6, 2.2, Math.abs(ox)) * smooth(1.2, -1.2, oy);
          pos[i + 2] = oxbowWindBase[i + 2] - corner * (gust + Math.sin(nowSec * 1.4 + ox) * 0.04);
        }
        oxbowSheetFront.geometry.attributes.position.needsUpdate = true;
      }
    }

    return {
      puebloWinMeshes,
      puebloDishes,
      npSpinFans,
      inWorldScreens,
      oxbowSheetFront,
      oxbowSheetRear,
      oxbowWindBase,
      pumpRegistry,
      updateArchitecture
    };
  }

  function makeArchitectureStudyPiece(T, pieceId) {
    const mats = getArchMaterials(T);
    const cyanWaterMat = new T.MeshPhysicalMaterial({
      color: 0x3fd8e8, emissive: 0x1498b8, emissiveIntensity: 0.75,
      roughness: 0.14, transmission: 0.32, transparent: true, opacity: 0.92
    });
    if (pieceId === "hidmo") return makeHidmoCompoundHouse(T, mats, cyanWaterMat, mats.ironDarkMat);
    if (pieceId === "chapel") return makeStoneCrossChapel(T, mats, mats.ironDarkMat);
    if (pieceId === "sanctuary") return makeCyanServerSanctuary(T, mats, cyanWaterMat);
    if (pieceId === "wifi_can") return makeHeroWifiJerikan(T, mats, 1.0, false);
    if (pieceId === "props") {
      const grp = new T.Group();
      const saw = makeSawbuckAndRibbedCan(T, mats, cyanWaterMat);
      saw.position.set(-1.15, 0, 0);
      grp.add(saw);
      const pump = makeStandpipePump(T, mats, cyanWaterMat);
      pump.position.set(0.32, 0, -0.06);
      grp.add(pump);
      const bowl = makeTerracottaDonkeyBowl(T, mats, cyanWaterMat);
      bowl.position.set(0.88, 0, -0.06);
      grp.add(bowl);
      return grp;
    }
    // Default: Two-story Highland Stone & Corrugated-Iron House + Clothesline
    const winList = [], dishList = [];
    const houseG = new T.Group();
    const h = makeHighlandHouse(T, mats, { w: 5.4, h: 4.4, d: 4.6, twoStory: true, hasPorch: true, hasChimney: true, seed: 1 }, winList, dishList, mats.ironDarkMat, mats.steelMat);
    houseG.add(h);
    return houseG;
  }

  if (typeof window !== "undefined") {
    window.buildWorldArchitecture = buildWorldArchitecture;
    window.makeArchitectureStudyPiece = makeArchitectureStudyPiece;
    window.stepStandpipePump = (pumpOrKey, phase, out, opts) =>
      stepStandpipePump(window.THREE, pumpOrKey, phase, out, opts);
  }
})();
