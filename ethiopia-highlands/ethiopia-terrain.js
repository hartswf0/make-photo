/* Ethiopian Highlands Real-DEM Landscape & Geological Shader Pack (`window.EthiopiaHighlandsPack`)
 * Exclusively owned by `ethiopia-dem-geology` (Squad B).
 *
 * Streams real AWS Open Data Terrarium satellite elevation grids (`terrain-pack/*.dem16.bin` +
 * `*.horizon16.bin` + `manifest.json`) across the 4 canonical Abyssinian Massif regions:
 *   1. `simien_imet_gogo`       — Simien Mountains & Imet Gogo Promontory (13.2167°N, 38.0833°E, 3,926 m)
 *   2. `gheralta_spires`        — Gheralta Mountains, Tigray (13.9722°N, 39.4286°E, 2,588 m Adigrat Sandstone Spires)
 *   3. `blue_nile_gorge`        — Blue Nile (Abay) Gorge (10.0750°N, 38.1917°E, Dejen–Goha Tsion 1,532 m Canyon)
 *   4. `gerd_belaya_escarpment` — GERD Western Escarpment -> Mt. Belaya Highland Wall (11.2153°N, 35.0931°E)
 *
 * Features:
 *   - Triangle-exact `sampleHeight(x, z)` matching `THREE.PlaneGeometry` diagonals (< 0.1 mm error, zero float/sink)
 *   - Real-meter `sampleElevationMeters(x, z)`, `sampleNormal(x, z)`, `sampleSlope(x, z)`, `sampleBiome(x, z)`,
 *     `worldToLatLon(x, z)`, `latLonToWorld(lat, lon)`, and `sampleUpdraft(x, z, windDir)` for Rogallo ridge-soaring
 *   - Seamless 16.8 km outer massif horizon skirt edge-welded 1:1 to the 384x384 playable inner terrain
 *   - Custom Triplanar Geological `MeshStandardMaterial.onBeforeCompile` shader:
 *       * Oligocene flood-basalt strata + vertical hex-columnar cliff jointing, ochre lichen & wurch tussock moss
 *       * Cross-bedded golden-vermilion Adigrat sandstone towers, desert varnish & sandy talus aprons
 *       * Blue Nile 3-tier canyon stratigraphy (Upper Basalt -> Antalo Cream Limestone -> Inner Red Sandstone)
 *       * Contour-following ancient highland dry-stone teff agricultural terraces
 *   - Animated Valley Cloud-Sea, Monsoon Escarpment Mist & Electric-Cyan / Sediment Abay & GERD Water Plane
 */
(function (root) {
  "use strict";

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  };

  const REGION_STYLE_INDEX = {
    simien_basalt: 0,
    gheralta_sandstone: 1,
    abay_canyon: 2,
    gerd_escarpment: 3
  };

  const BIOME_DEFS = {
    kolla: {
      id: "kolla",
      minElevM: -500,
      maxElevM: 1500,
      short: "Kolla",
      amharic: "ቆላ",
      label: "Kolla · Hot Lowland Gorge (< 1,500 m)"
    },
    woina_dega: {
      id: "woina_dega",
      minElevM: 1500,
      maxElevM: 2300,
      short: "Woina Dega",
      amharic: "ወይና ደጋ",
      label: "Woina Dega · Temperate Mid-Highland (1,500–2,300 m)"
    },
    dega: {
      id: "dega",
      minElevM: 2300,
      maxElevM: 3200,
      short: "Dega",
      amharic: "ደጋ",
      label: "Dega · Cool Escarpment Highland (2,300–3,200 m)"
    },
    wurch: {
      id: "wurch",
      minElevM: 3200,
      maxElevM: 9000,
      short: "Wurch",
      amharic: "ውርጭ",
      label: "Wurch · Afro-Alpine Moorland (> 3,200 m)"
    }
  };

  const CANONICAL_REGION_IDS = [
    "simien_imet_gogo",
    "gheralta_spires",
    "blue_nile_gorge",
    "gerd_belaya_escarpment"
  ];

  const REGION_ALIASES = {
    "1": "simien_imet_gogo",
    simien: "simien_imet_gogo",
    imet_gogo: "simien_imet_gogo",
    imetgogo: "simien_imet_gogo",
    ras_dashen: "simien_imet_gogo",
    "2": "gheralta_spires",
    gheralta: "gheralta_spires",
    tigray: "gheralta_spires",
    hawzen: "gheralta_spires",
    korkor: "gheralta_spires",
    "3": "blue_nile_gorge",
    blue_nile: "blue_nile_gorge",
    abay: "blue_nile_gorge",
    abay_gorge: "blue_nile_gorge",
    gorge: "blue_nile_gorge",
    "4": "gerd_belaya_escarpment",
    gerd: "gerd_belaya_escarpment",
    belaya: "gerd_belaya_escarpment",
    dangur: "gerd_belaya_escarpment",
    escarpment: "gerd_belaya_escarpment"
  };

  function resolveRegionId(input) {
    if (!input && input !== 0) return "simien_imet_gogo";
    const key = String(input).trim().toLowerCase();
    if (CANONICAL_REGION_IDS.includes(key)) return key;
    return REGION_ALIASES[key] || "simien_imet_gogo";
  }

  function classifyBiome(elevM) {
    if (elevM < 1500) return "kolla";
    if (elevM < 2300) return "woina_dega";
    if (elevM < 3200) return "dega";
    return "wurch";
  }

  /* ---------- Triangle-Exact & Analytical Normal Grid Samplers ---------- */
  function sampleTriangleGrid(grid, n, span, x, z) {
    const half = span * 0.5;
    const u = clamp(((x + half) / span) * (n - 1), 0, n - 1.00001);
    const v = clamp(((z + half) / span) * (n - 1), 0, n - 1.00001);
    const ix = u | 0;
    const iy = v | 0;
    const fx = u - ix;
    const fz = v - iy;
    const ix1 = ix + 1 < n ? ix + 1 : n - 1;
    const iy1 = iy + 1 < n ? iy + 1 : n - 1;

    const row0 = iy * n;
    const row1 = iy1 * n;
    const h00 = grid[row0 + ix];
    const h01 = grid[row0 + ix1];
    const h10 = grid[row1 + ix];
    const h11 = grid[row1 + ix1];

    // Matches THREE.PlaneGeometry(span, span, n-1, n-1).rotateX(-PI/2) exact index split:
    // Tri A: [0, 2, 1] (fx + fz <= 1), Tri B: [2, 3, 1] (fx + fz > 1)
    if (fx + fz <= 1.0) {
      return h00 + fx * (h01 - h00) + fz * (h10 - h00);
    }
    return h11 + (1.0 - fx) * (h10 - h11) + (1.0 - fz) * (h01 - h11);
  }

  function sampleBilinearGrid(grid, n, span, x, z) {
    const half = span * 0.5;
    const u = clamp(((x + half) / span) * (n - 1), 0, n - 1.00001);
    const v = clamp(((z + half) / span) * (n - 1), 0, n - 1.00001);
    const ix = u | 0;
    const iy = v | 0;
    const fx = u - ix;
    const fz = v - iy;
    const ix1 = ix + 1 < n ? ix + 1 : n - 1;
    const iy1 = iy + 1 < n ? iy + 1 : n - 1;
    const h00 = grid[iy * n + ix];
    const h01 = grid[iy * n + ix1];
    const h10 = grid[iy1 * n + ix];
    const h11 = grid[iy1 * n + ix1];
    return lerp(lerp(h00, h01, fx), lerp(h10, h11, fx), fz);
  }

  function computeGridNormals(worldYGrid, n, span, outNormals) {
    const cell = span / (n - 1);
    const twoCell = cell * 2.0;
    for (let iy = 0; iy < n; iy++) {
      const ym = iy > 0 ? iy - 1 : 0;
      const yp = iy + 1 < n ? iy + 1 : n - 1;
      const dz = iy > 0 && iy + 1 < n ? twoCell : cell;
      for (let ix = 0; ix < n; ix++) {
        const xm = ix > 0 ? ix - 1 : 0;
        const xp = ix + 1 < n ? ix + 1 : n - 1;
        const dx = ix > 0 && ix + 1 < n ? twoCell : cell;

        const dhdx = (worldYGrid[iy * n + xp] - worldYGrid[iy * n + xm]) / dx;
        const dhdz = (worldYGrid[yp * n + ix] - worldYGrid[ym * n + ix]) / dz;

        let nx = -dhdx;
        let ny = 1.0;
        let nz = -dhdz;
        const inv = 1.0 / Math.hypot(nx, ny, nz);
        const o = (iy * n + ix) * 3;
        outNormals[o] = nx * inv;
        outNormals[o + 1] = ny * inv;
        outNormals[o + 2] = nz * inv;
      }
    }
    return outNormals;
  }

  /* ---------- Build Horizon Geometry with Inner Hole Cutout (Zero Z-Fighting!) ---------- */
  function createHorizonSkirtGeometry(THREE, horizonN, horizonSpan, innerSpan) {
    const geo = new THREE.PlaneGeometry(horizonSpan, horizonSpan, horizonN - 1, horizonN - 1);
    geo.rotateX(-Math.PI / 2);

    const halfInner = innerSpan * 0.5;
    const pos = geo.attributes.position.array;
    const srcIdx = geo.index.array;
    const kept = [];

    // Keep quads unless all 4 corners lie strictly inside the inner terrain mesh footprint
    const margin = 2.0;
    for (let i = 0; i < srcIdx.length; i += 6) {
      let allInside = true;
      for (let k = 0; k < 6; k++) {
        const vi = srcIdx[i + k] * 3;
        const vx = pos[vi];
        const vz = pos[vi + 2];
        if (Math.abs(vx) >= halfInner - margin || Math.abs(vz) >= halfInner - margin) {
          allInside = false;
          break;
        }
      }
      if (!allInside) {
        kept.push(srcIdx[i], srcIdx[i + 1], srcIdx[i + 2], srcIdx[i + 3], srcIdx[i + 4], srcIdx[i + 5]);
      }
    }
    geo.setIndex(kept);
    return geo;
  }

  /* ---------- Custom Geological Triplanar / Strata Shader (`onBeforeCompile`) ---------- */
  function createGeologicalTerrainMaterial(THREE, sharedUniforms, isHorizon, isBoulder) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.42,
      flatShading: false,
      dithering: true
    });
    mat.userData.surfaceTag = "stone";
    mat.userData.isEthiopiaTerrain = true;

    mat.customProgramCacheKey = function () {
      if (isBoulder) return "ethiopia-geo-boulder-v1";
      return isHorizon ? "ethiopia-geo-horizon-v1" : "ethiopia-geo-inner-v1";
    };

    mat.onBeforeCompile = function (shader) {
      Object.assign(shader.uniforms, sharedUniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vEthWorldPos;
          varying vec3 vEthObjNormal;
          `
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
          vec4 ethWp = vec4( transformed, 1.0 );
          vec3 ethOn = objectNormal;
          #ifdef USE_INSTANCING
            ethWp = instanceMatrix * ethWp;
            ethOn = mat3( instanceMatrix ) * ethOn;
          #endif
          ethWp = modelMatrix * ethWp;
          vEthWorldPos = ethWp.xyz;
          vEthObjNormal = normalize( mat3( modelMatrix ) * ethOn );
          `
        );

      const geoCommonGLSL = `
        uniform float uRegionStyle;
        uniform float uDatumElevM;
        uniform float uVertScale;
        uniform float uMinElevM;
        uniform float uMaxElevM;
        uniform float uCloudElevY;
        uniform float uWaterElevY;
        uniform float uHasWater;
        uniform float uMist;
        uniform float uGoldenHour;
        uniform float uTime;
        uniform vec3 uSunDir;

        varying vec3 vEthWorldPos;
        varying vec3 vEthObjNormal;

        float ethHash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        vec2 ethHash22(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.xx + p3.yz) * p3.zy);
        }

        float ethNoise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = ethHash21(i);
          float b = ethHash21(i + vec2(1.0, 0.0));
          float c = ethHash21(i + vec2(0.0, 1.0));
          float d = ethHash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float ethFbm(vec2 p) {
          float s = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
          for (int i = 0; i < 4; i++) {
            s += a * ethNoise2(p);
            p = rot * p * 2.04 + vec2(17.1, 31.7);
            a *= 0.5;
          }
          return s;
        }

        // True 3D vertical polygonal/hexagonal basalt prisms via azimuth-isotropic 2D jittered Voronoi in XZ!
        // Zero crosshatch checkerboard on 45-degree cliffs and zero dependence on triangle normal wn!
        vec2 ethVoronoiColumns(vec2 xz) {
          vec2 n = floor(xz);
          vec2 f = fract(xz);
          float md1 = 8.0;
          float md2 = 8.0;
          float bestId = 0.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 rnd = ethHash22(n + g);
              vec2 o = 0.16 + 0.68 * rnd;
              vec2 r = g + o - f;
              float d = dot(r, r);
              if (d < md1) {
                md2 = md1;
                md1 = d;
                bestId = rnd.x;
              } else if (d < md2) {
                md2 = d;
              }
            }
          }
          float edgeDist = sqrt(md2) - sqrt(md1);
          return vec2(edgeDist, bestId);
        }

        float ethColumnarJoints(vec3 wp) {
          // Slight vertical & lateral geological curvature along Oligocene cooling fronts
          vec2 bend = vec2(
            sin(wp.y * 0.024 + wp.z * 0.011),
            cos(wp.y * 0.021 - wp.x * 0.011)
          ) * 0.42;
          // Authentic 0.75m - 1.7m diameter hexagonal basalt prisms (never oversized polygon tiles on shoulders!)
          vec2 vMid  = ethVoronoiColumns((wp.xz + bend * 1.5) * 0.58);
          vec2 vFine = ethVoronoiColumns((wp.xz + bend) * 1.32);

          float prismMid  = smoothstep(0.04, 0.24, vMid.x);
          float prismFine = smoothstep(0.04, 0.24, vFine.x);
          float colTone   = 0.84 + 0.30 * vMid.y;

          // Per-column staggered horizontal cross-fracture joints & Trap-Series lava benches
          float flowWarp = ethFbm(wp.xz * 0.008) * 15.0;
          float benchMajor = smoothstep(0.05, 0.25, abs(fract((wp.y + flowWarp) / 30.0) - 0.5) * 2.0);
          float crossJoint = smoothstep(0.04, 0.18, abs(fract(wp.y * 0.18 + vMid.y * 0.83) - 0.5) * 2.0);

          return clamp((prismMid * 0.58 + prismFine * 0.42) * colTone * (0.72 + 0.18 * benchMajor + 0.10 * crossJoint), 0.0, 1.0);
        }

        // Azimuth-isotropic 3D Adigrat Sandstone: cragged vertical joint fissures, differential-erosion overhang notches & cross-bedding!
        vec4 ethSandstoneDetail(vec3 wp) {
          float macroWarp = ethFbm(wp.xz * 0.0075) * 22.0;
          float midWarp   = ethFbm(wp.xz * 0.036 + vec2(wp.y * 0.018)) * 6.5;
          float grain     = ethNoise2(wp.xz * 0.85 + wp.y * 0.45);

          // Broad 34m geological formation shifts + sharp 9–16m differential-erosion overhang notches
          float formation = 0.5 + 0.5 * sin((wp.y + macroWarp) * 0.092);
          float ledgeSaw  = fract((wp.y + midWarp * 0.85) / 13.5);
          float minorSaw  = fract((wp.y - midWarp * 0.45) / 5.2);
          // C1-periodic overhang notches across [0, 1] wrap (zero 1px dFdy spike at fract wrap!)
          float overhangNotch = smoothstep(0.0, 0.055, ledgeSaw) * (1.0 - smoothstep(0.075, 0.25, ledgeSaw));
          float minorNotch    = smoothstep(0.0, 0.060, minorSaw) * (1.0 - smoothstep(0.080, 0.24, minorSaw));
          float crossLam      = 0.5 + 0.5 * sin(wp.y * 0.62 + (wp.x * 0.13 - wp.z * 0.11) + midWarp * 1.4);

          // Deep jagged vertical tectonic joint fissures (major ~24m clefts + secondary ~8.5m fractures)
          vec2 jitterXZ = wp.xz + vec2(midWarp * 0.9, (grain - 0.5) * 1.6);
          vec2 vMajor   = ethVoronoiColumns(jitterXZ * 0.044);
          vec2 vMinor   = ethVoronoiColumns(jitterXZ * 0.125 + vec2(7.3, 3.1));
          float deepFissure = (1.0 - smoothstep(0.012, 0.085, vMajor.x)) * 0.85
                            + (1.0 - smoothstep(0.010, 0.065, vMinor.x)) * 0.55;
          deepFissure = clamp(deepFissure, 0.0, 1.0);

          float strataTone = clamp(formation * 0.44 + (1.0 - overhangNotch) * 0.34 + crossLam * 0.22 + (grain - 0.5) * 0.14, 0.0, 1.0);
          float notchShadow = clamp(overhangNotch * 0.78 + minorNotch * 0.36, 0.0, 1.0);
          // Smooth relief scalar (free of high-freq grain so screen-space dFdx/dFdy has zero pixel stair-stepping!)
          float smoothFissure = (1.0 - smoothstep(0.015, 0.11, ethVoronoiColumns(wp.xz * 0.044).x)) * 0.85
                              + (1.0 - smoothstep(0.012, 0.085, ethVoronoiColumns(wp.xz * 0.125 + vec2(7.3, 3.1)).x)) * 0.50;
          float relief = formation * 0.45 - smoothFissure * 1.15 - notchShadow * 0.72;
          return vec4(strataTone, deepFissure, notchShadow, relief);
        }

        float ethSandstoneBedding(vec3 wp) {
          return ethSandstoneDetail(wp).x;
        }

        // Rich close-up ground turf / tussock / pebble / soil micro-detail (1–85 m around camera & characters!)
        void ethCloseGroundDetail(vec2 xz, out float turfClump, out float pebbleSpec, out float microBump) {
          float nTussock = ethNoise2(xz * 0.62);
          float nSub      = ethNoise2(xz * 2.15 + vec2(11.3, 7.9));
          float nGrain    = ethNoise2(xz * 6.40 + vec2(3.7, 19.1));
          turfClump  = nTussock * 0.52 + nSub * 0.33 + nGrain * 0.15;
          pebbleSpec = smoothstep(0.76, 0.93, nSub * 0.45 + nGrain * 0.55);
          microBump  = (nTussock - 0.5) * 0.55 + (nSub - 0.5) * 0.32 + (nGrain - 0.5) * 0.18;
        }

        // Contour-following highland dry-stone agricultural terraces (Dega / Woina Dega)
        void ethTerracePattern(float elevM, vec2 xz, out float riserMask, out float fieldPatch) {
          float wobble = ethNoise2(xz * 0.018) * 3.2;
          float tPhase = fract((elevM + wobble) / 14.5);
          // C1-periodic stone retaining riser wall across [0, 1] contour wrap
          riserMask = smoothstep(0.0, 0.035, tPhase) * (1.0 - smoothstep(0.08, 0.22, tPhase));
          // Alternating gold / emerald teff & barley parcels along contour
          fieldPatch = ethHash21(vec2(floor((elevM + wobble) / 14.5), floor(ethNoise2(xz * 0.008) * 9.0)));
        }
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>\n${geoCommonGLSL}`
      );

      // Compute geological albedo, roughness & micro-relief scalar before lighting
      const mapFragmentInject = `
        #include <map_fragment>
        {
          vec3 wp = vEthWorldPos;
          vec3 wn = normalize(vEthObjNormal);
          float slope = ${isBoulder ? "max(clamp(1.0 - wn.y, 0.0, 1.0), 0.72)" : "clamp(1.0 - wn.y, 0.0, 1.0)"};
          float steep = smoothstep(0.16, 0.48, slope);
          float sheer = smoothstep(0.36, 0.68, slope);
          float elevM = wp.y / max(uVertScale, 0.001) + uDatumElevM;

          float macroN = ethFbm(wp.xz * 0.0065);
          float midN   = ethFbm(wp.xz * 0.038 + vec2(wp.y * 0.02));
          float fineN  = ethNoise2(wp.xz * 0.24 + wp.y * 0.11);

          float camDistMap = length(vViewPosition);
          float closeFade  = 1.0 - smoothstep(18.0, 105.0, camDistMap);
          float turfClump, pebbleMask, closeBump;
          ethCloseGroundDetail(wp.xz, turfClump, pebbleMask, closeBump);

          vec3 geoCol = vec3(0.42, 0.40, 0.35);
          float geoRough = 0.88;
          // Separate cliff & ground relief scalars (both 100% world-space continuous so dFdx/dFdy NEVER jumps at triangle edges!)
          float cliffRelief = 0.0;
          float groundRelief = closeBump * 0.65 + (fineN - 0.5) * 0.25;

          if (uRegionStyle < 0.5) {
            // === 0: SIMIEN MOUNTAINS & IMET GOGO (Oligocene Columnar Basalt + Wurch Moorland) ===
            float cols = ethColumnarJoints(wp);
            float colShow = smoothstep(0.28, 0.52, slope);
            float trapFlow = smoothstep(0.10, 0.36, abs(fract(elevM / 46.0 + macroN * 0.22) - 0.5) * 2.0);
            vec3 basaltDark  = vec3(0.085, 0.10, 0.125);
            vec3 basaltMid   = vec3(0.25, 0.27, 0.31);
            vec3 basaltWarm  = vec3(0.44, 0.33, 0.23);
            vec3 ochreLichen = vec3(0.66, 0.49, 0.22);

            float rockTex = mix(0.45 + 0.45 * fineN, cols, colShow);
            vec3 cliffCol = mix(basaltDark, basaltMid, rockTex * (0.55 + 0.45 * trapFlow));
            cliffCol = mix(cliffCol, basaltWarm, smoothstep(0.52, 0.84, midN) * 0.42);
            float lichenMask = smoothstep(3250.0, 3650.0, elevM) * smoothstep(0.58, 0.84, fineN) * rockTex;
            cliffCol = mix(cliffCol, ochreLichen, lichenMask * 0.48);

            // Afro-alpine Wurch moorland (>3200m): rich close-up Festuca tussock clumps, peat soil & basalt pebbles!
            vec3 tussockEmerald = vec3(0.22, 0.34, 0.15);
            vec3 tussockGold    = vec3(0.54, 0.47, 0.24);
            vec3 helichrysum    = vec3(0.44, 0.51, 0.40);
            vec3 volcanicPeat   = vec3(0.15, 0.13, 0.11);

            vec3 moorCol = mix(tussockEmerald, tussockGold, smoothstep(0.30, 0.70, macroN * 0.55 + midN * 0.45));
            moorCol = mix(moorCol, helichrysum, smoothstep(0.68, 0.90, midN) * 0.42);
            // Inject close-up tussock shadow hollows, dry straw tips & dark basalt pebbles within 105 m!
            vec3 closeMoor = mix(volcanicPeat, moorCol * 1.24, smoothstep(0.24, 0.72, turfClump));
            closeMoor = mix(closeMoor, vec3(0.36, 0.37, 0.39), pebbleMask * 0.55);
            moorCol = mix(moorCol, closeMoor, closeFade * 0.82);
            moorCol = mix(moorCol, volcanicPeat, smoothstep(0.10, 0.26, slope) * 0.34);

            vec3 degaSlope = mix(vec3(0.19, 0.29, 0.15), vec3(0.40, 0.35, 0.22), midN);
            vec3 vegCol = mix(degaSlope, moorCol, smoothstep(3080.0, 3360.0, elevM));

            float ledgeMoss = (1.0 - sheer) * steep * smoothstep(3100.0, 3500.0, elevM);
            geoCol = mix(vegCol, cliffCol, smoothstep(0.11, 0.38, slope));
            geoCol = mix(geoCol, vec3(0.22, 0.37, 0.17), ledgeMoss * 0.42);
            geoRough = mix(0.92 - pebbleMask * closeFade * 0.18, 0.75 + 0.16 * (1.0 - cols), steep);
            cliffRelief = cols * 0.95 + trapFlow * 0.40;

          } else if (uRegionStyle < 1.5) {
            // === 1: GHERALTA SPIRES, TIGRAY (Cragged Fissured Adigrat Sandstone, Manganese Desert Varnish & Talus Scree) ===
            vec4 sd = ethSandstoneDetail(wp);
            float bed          = sd.x;
            float deepFissure  = sd.y;
            float notchShadow  = sd.z;
            float sandGrain    = ethNoise2(wp.xz * 1.8 + wp.y * 0.9);

            vec3 sandGold      = vec3(0.76, 0.48, 0.24);
            vec3 sandVermilion = vec3(0.58, 0.21, 0.12);
            vec3 sandTerracotta= vec3(0.46, 0.17, 0.10);
            vec3 sandBuff      = vec3(0.81, 0.63, 0.41);
            vec3 manganesePatina = vec3(0.14, 0.085, 0.075);
            vec3 fissureCavity = vec3(0.07, 0.035, 0.03);

            vec3 spireCol = mix(sandVermilion, sandGold, bed);
            spireCol = mix(spireCol, sandBuff, smoothstep(0.74, 0.94, bed) * 0.42);
            spireCol = mix(spireCol, sandTerracotta, smoothstep(0.35, 0.75, sandGrain) * 0.28);

            // Dark manganese-iron oxide desert varnish patina concentrated on upper weathered faces & runoff streaks!
            float streakCoord = atan(wp.z + 145.0, wp.x + 55.0) * 28.0 + (wp.x - wp.z) * 0.055;
            float runoffStreak = smoothstep(0.36, 0.76, ethFbm(vec2(streakCoord, wp.y * 0.0065)));
            float upperPatina  = smoothstep(2140.0, 2480.0, elevM) * (0.38 + 0.62 * runoffStreak);
            float lowerStreaks = smoothstep(2010.0, 2260.0, elevM) * smoothstep(0.54, 0.84, runoffStreak) * 0.65;
            float varnishAmt   = clamp(upperPatina + lowerStreaks, 0.0, 0.85) * smoothstep(0.22, 0.52, slope);
            spireCol = mix(spireCol, manganesePatina, varnishAmt * 0.74);

            // Carve dark recessed differential-erosion overhang notches & deep vertical joint fissures!
            spireCol = mix(spireCol, fissureCavity, clamp(notchShadow * sheer * 0.68, 0.0, 0.72));
            spireCol = mix(spireCol, fissureCavity, clamp(deepFissure * steep * 0.86, 0.0, 0.88));

            // Flat Hawzen plain: close-up windblown sand ripples, russet sandstone gravel & dry savanna tufts!
            float stoneWall = 1.0 - smoothstep(0.02, 0.09, abs(fract(wp.x * 0.011 + macroN * 0.4) - 0.5) * 2.0);
            vec3 plainSand  = mix(vec3(0.69, 0.53, 0.34), vec3(0.52, 0.37, 0.24), macroN);
            vec3 savannaDry = vec3(0.39, 0.42, 0.21);
            vec3 plainCol   = mix(plainSand, savannaDry, smoothstep(0.38, 0.74, midN) * 0.58);
            vec3 closeSand  = mix(plainCol * 0.80, plainCol * 1.18, smoothstep(0.25, 0.75, turfClump));
            closeSand       = mix(closeSand, vec3(0.48, 0.24, 0.14), pebbleMask * 0.65);
            plainCol        = mix(plainCol, closeSand, closeFade * 0.82);
            plainCol        = mix(plainCol, vec3(0.40, 0.31, 0.22), stoneWall * 0.32 + smoothstep(0.68, 0.90, fineN) * 0.20);

            // Coarse bouldery red-ochre talus scree apron around tower bases
            float screeClast = ethNoise2(wp.xz * 0.52) * 0.6 + sandGrain * 0.4;
            vec3 talusCol    = mix(vec3(0.38, 0.16, 0.10), vec3(0.68, 0.38, 0.21), smoothstep(0.22, 0.78, screeClast));

            vec3 ambaTop = mix(vec3(0.38, 0.35, 0.20), manganesePatina, 0.36);
            vec3 flatCol = mix(plainCol, ambaTop, smoothstep(2320.0, 2460.0, elevM));

            float talusBand = smoothstep(0.05, 0.22, slope) * (1.0 - sheer);
            geoCol = mix(flatCol, talusCol, talusBand * 0.86);
            geoCol = mix(geoCol, spireCol, smoothstep(0.13, 0.40, slope));
            // Strictly matte granular quartzose sandstone >= 0.91 roughness (ZERO plastic specular!)
            geoRough = clamp(0.93 + 0.05 * (sandGrain - 0.5), 0.89, 0.99);
            cliffRelief = sd.w * 1.45;

          } else if (uRegionStyle < 2.5) {
            // === 2: BLUE NILE (ABAY) GORGE (3-Tier Basalt -> Antalo Limestone -> Red Sandstone) ===
            float warpTier = (macroN - 0.5) * 45.0;
            float eTier = elevM + warpTier;
            float tierLimestone = smoothstep(1440.0, 1540.0, eTier) * (1.0 - smoothstep(2000.0, 2110.0, eTier));
            float tierBasalt    = smoothstep(2000.0, 2110.0, eTier);
            float tierSandstone = 1.0 - smoothstep(1440.0, 1540.0, eTier);

            float cols = ethColumnarJoints(wp);
            float bed  = ethSandstoneBedding(wp * 0.85);

            vec3 upperBasalt   = mix(vec3(0.11, 0.13, 0.16), vec3(0.28, 0.30, 0.34), cols);
            vec3 midLimestone  = mix(vec3(0.56, 0.51, 0.41), vec3(0.84, 0.79, 0.66), smoothstep(0.22, 0.82, bed));
            vec3 lowerRedSand  = mix(vec3(0.46, 0.17, 0.11), vec3(0.74, 0.34, 0.20), bed);

            vec3 rockTier = lowerRedSand * tierSandstone + midLimestone * tierLimestone + upperBasalt * tierBasalt;

            float riserMask, fieldPatch;
            ethTerracePattern(elevM, wp.xz, riserMask, fieldPatch);
            vec3 rimTeff = mix(vec3(0.31, 0.43, 0.19), vec3(0.60, 0.52, 0.26), fieldPatch * 0.7 + macroN * 0.3);
            vec3 kollaScrub = mix(vec3(0.45, 0.36, 0.23), vec3(0.29, 0.35, 0.19), midN);
            vec3 benchGround = mix(kollaScrub, rimTeff, smoothstep(1550.0, 2150.0, elevM));
            benchGround = mix(benchGround, benchGround * (0.78 + 0.44 * turfClump), closeFade * 0.72);
            benchGround = mix(benchGround, vec3(0.22, 0.22, 0.24), riserMask * smoothstep(1600.0, 1950.0, elevM) * 0.50);

            float riverWet = uHasWater * (1.0 - smoothstep(uWaterElevY + 1.5, uWaterElevY + 16.0, wp.y));
            geoCol = mix(benchGround, rockTier, smoothstep(0.09, 0.32, slope));
            geoCol = mix(geoCol, vec3(0.15, 0.17, 0.18), riverWet * 0.72);
            geoRough = mix(0.88, 0.35, riverWet);
            cliffRelief = mix(bed * 0.90, cols * 0.95, tierBasalt);

          } else {
            // === 3: GERD WESTERN ESCARPMENT -> MT. BELAYA WALL (Kolla Gneiss -> Lush Terraced Dega) ===
            float riserMask, fieldPatch;
            ethTerracePattern(elevM, wp.xz, riserMask, fieldPatch);

            vec3 kollaEarth = mix(vec3(0.52, 0.37, 0.23), vec3(0.32, 0.40, 0.19), smoothstep(0.28, 0.72, midN));
            vec3 gneissRock = mix(vec3(0.24, 0.23, 0.26), vec3(0.47, 0.41, 0.35), ethSandstoneBedding(wp * 0.7));

            vec3 degaEmerald = vec3(0.16, 0.35, 0.15);
            vec3 teffGold    = vec3(0.62, 0.53, 0.24);
            vec3 teffGreen   = vec3(0.27, 0.45, 0.18);
            vec3 terraceCrop = mix(teffGreen, teffGold, smoothstep(0.32, 0.74, fieldPatch));
            float terraceZone = smoothstep(1180.0, 1450.0, elevM) * (1.0 - smoothstep(0.56, 0.80, slope));
            vec3 highlandVeg = mix(degaEmerald, terraceCrop, terraceZone * 0.78);
            highlandVeg = mix(highlandVeg, vec3(0.19, 0.20, 0.22), riserMask * terraceZone * 0.65);

            float cols = ethColumnarJoints(wp);
            vec3 highBasalt = mix(vec3(0.14, 0.16, 0.19), vec3(0.31, 0.33, 0.36), cols);
            vec3 cliffRock  = mix(gneissRock, highBasalt, smoothstep(1350.0, 1850.0, elevM));

            vec3 slopeGround = mix(kollaEarth, highlandVeg, smoothstep(920.0, 1380.0, elevM));
            slopeGround = mix(slopeGround, slopeGround * (0.78 + 0.44 * turfClump), closeFade * 0.72);
            float shoreWet = uHasWater * (1.0 - smoothstep(uWaterElevY + 1.0, uWaterElevY + 14.0, wp.y));

            geoCol = mix(slopeGround, cliffRock, smoothstep(0.46, 0.76, slope));
            geoCol = mix(geoCol, vec3(0.17, 0.18, 0.19), shoreWet * 0.75);
            geoRough = mix(0.89, 0.32, shoreWet);
            cliffRelief = cols * 0.90;
          }

          // Subtle golden-hour warm rim bounce on sunlit high faces
          geoCol *= mix(vec3(1.0), vec3(1.10, 0.97, 0.86), uGoldenHour * 0.55);
          diffuseColor.rgb *= geoCol;
          diffuseColor.rgb = max(diffuseColor.rgb, vec3(0.02));
          vEthCliffRelief  = cliffRelief;
          vEthGroundRelief = groundRelief;
          vEthSlope        = slope;
          vEthRough        = geoRough;
        }
      `;

      // Add scoped globals at top of main() for normal & roughness injection
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          `float vEthCliffRelief = 0.0;\nfloat vEthGroundRelief = 0.0;\nfloat vEthSlope = 0.0;\nfloat vEthRough = 0.86;\nvoid main() {`
        )
        .replace("#include <map_fragment>", mapFragmentInject)
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>\nroughnessFactor = vEthRough;`
        );

      if (!isHorizon) {
        // Screen-space derivative micro-normal bump using ONLY world-space continuous scalars (zero triangle-edge derivative seam!)
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          {
            float camDist = length(vViewPosition);
            // Keep cragged fissures & overhang ledges crisp all the way out to 1,850 m!
            float cliffWeight  = smoothstep(0.16, 0.42, vEthSlope) * (1.0 - smoothstep(350.0, 1850.0, camDist)) * 0.56;
            float groundWeight = (1.0 - smoothstep(0.18, 0.40, vEthSlope)) * (1.0 - smoothstep(16.0, 95.0, camDist)) * 0.28;
            if (cliffWeight + groundWeight > 0.004) {
              vec3 dpdx = dFdx(vViewPosition);
              vec3 dpdy = dFdy(vViewPosition);
              float dhdx = dFdx(vEthCliffRelief) * cliffWeight + dFdx(vEthGroundRelief) * groundWeight;
              float dhdy = dFdy(vEthCliffRelief) * cliffWeight + dFdy(vEthGroundRelief) * groundWeight;
              dhdx = clamp(dhdx, -0.16, 0.16);
              dhdy = clamp(dhdy, -0.16, 0.16);
              vec3 r1 = cross(dpdy, normal);
              vec3 r2 = cross(normal, dpdx);
              float det = dot(dpdx, r1);
              if (abs(det) > 1e-6) {
                vec3 surfGrad = sign(det) * (dhdx * r1 + dhdy * r2);
                normal = normalize(abs(det) * normal - 0.26 * surfGrad);
              }
            }
          }`
        );
      }

      // Inject sculpted valley cloud-sea lapping against lower basalt buttresses + crisp aerial perspective
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
        {
          float camDist = length(vViewPosition);
          float aerial = smoothstep(1800.0, 15500.0, camDist) * (0.30 + 0.24 * uMist);
          vec3 hazeDay  = vec3(0.62, 0.74, 0.88);
          vec3 hazeGold = vec3(0.90, 0.68, 0.48);
          vec3 hazeCol  = mix(hazeDay, hazeGold, uGoldenHour * 0.78);

          vec2 drift = vec2(uTime * 0.014, -uTime * 0.009);
          float billow = ethFbm(vEthWorldPos.xz * 0.0024 + drift);
          float fineMist = ethFbm(vEthWorldPos.xz * 0.0075 - drift * 1.3);
          float valleyMist = 0.0;
          vec3 cloudCol = mix(vec3(0.94, 0.96, 1.0), vec3(1.0, 0.86, 0.70), uGoldenHour * 0.68);
          vec3 cloudShade = mix(vec3(0.56, 0.65, 0.78), vec3(0.64, 0.52, 0.56), uGoldenHour * 0.60);

          if (uCloudElevY > -9000.0) {
            float waveTop = uCloudElevY + 85.0 + (billow - 0.5) * 150.0 + (fineMist - 0.5) * 45.0;
            // Bright sunlit cumulus billows lapping right up against the lower dark basalt buttresses!
            float inSea = 1.0 - smoothstep(waveTop - 65.0, waveTop + 42.0, vEthWorldPos.y);
            float shoreFoam = exp(-pow((vEthWorldPos.y - waveTop) / 28.0, 2.0)) * smoothstep(0.35, 0.75, billow);
            valleyMist = clamp(inSea * (0.45 + 0.48 * billow) + shoreFoam * 0.42, 0.0, 0.88) * smoothstep(140.0, 680.0, camDist);
            cloudCol = mix(cloudShade, cloudCol, smoothstep(0.30, 0.74, billow * 0.75 + fineMist * 0.25));
          }
          float upslopeMist = uMist * smoothstep(0.50, 0.86, billow) * smoothstep(750.0, 3400.0, camDist) * 0.28;

          gl_FragColor.rgb = mix(gl_FragColor.rgb, cloudCol, clamp(valleyMist + upslopeMist, 0.0, 0.84));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeCol, clamp(aerial, 0.0, 0.68));
        }`
      );
    };

    return mat;
  }

  /* ---------- Valley Cloud-Sea & Monsoon Escarpment Mist Deck ---------- */
  function createCloudSeaGroup(THREE, sharedUniforms) {
    const group = new THREE.Group();
    group.name = "EthiopiaValleyCloudSea";

    const cloudVert = `
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;

    const cloudFrag = `
      uniform float uTime;
      uniform float uMist;
      uniform float uGoldenHour;
      uniform float uLayerOffset;
      uniform float uOpacityScale;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      float h21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }
      float n2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
                   mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) {
          s += a * n2(p);
          p = p * 2.03 + vec2(13.7, 29.3);
          a *= 0.5;
        }
        return s;
      }

      void main() {
        vec2 drift = vec2(uTime * (0.013 + uLayerOffset * 0.005), -uTime * 0.008);
        float macro  = fbm(vWorldPos.xz * 0.00095 + drift * 0.7 + uLayerOffset * 2.1);
        float billow = fbm(vWorldPos.xz * 0.0024 + drift + uLayerOffset * 3.7);
        float puff   = fbm(vWorldPos.xz * 0.0068 - drift * 1.35);
        float field  = macro * 0.42 + billow * 0.38 + puff * 0.20;
        float density = smoothstep(0.28 - uMist * 0.14, 0.66, field);

        // Radial fade at outer horizon edge so cloud deck never shows a square border
        float rad = length(vUv - 0.5) * 2.0;
        float edgeFade = 1.0 - smoothstep(0.58, 0.98, rad);

        // Sculpted sunlit cumulus tops vs cool slate-indigo cloud-base self-shadowing!
        float sunCrest = smoothstep(0.36, 0.74, billow * 0.68 + puff * 0.32);
        vec3 topLit    = mix(vec3(0.98, 0.99, 1.0), vec3(1.0, 0.87, 0.70), uGoldenHour * 0.78);
        vec3 baseShade = mix(vec3(0.50, 0.60, 0.74), vec3(0.58, 0.46, 0.52), uGoldenHour * 0.65);
        vec3 col = mix(baseShade, topLit, sunCrest);

        float alpha = density * edgeFade * uOpacityScale * (0.68 + 0.38 * uMist);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.88));
      }
    `;

    const planeGeo = new THREE.PlaneGeometry(13600, 13600, 1, 1);
    planeGeo.rotateX(-Math.PI / 2);

    const layers = [
      { dy: 58, opacity: 0.78, offset: 0.0 },
      { dy: 112, opacity: 0.54, offset: 1.0 },
      { dy: 8, opacity: 0.66, offset: 2.0 }
    ];

    group.userData.layers = layers.map((cfg, idx) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: sharedUniforms.uTime,
          uMist: sharedUniforms.uMist,
          uGoldenHour: sharedUniforms.uGoldenHour,
          uLayerOffset: { value: cfg.offset },
          uOpacityScale: { value: cfg.opacity }
        },
        vertexShader: cloudVert,
        fragmentShader: cloudFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.renderOrder = 2 + idx;
      mesh.userData.dy = cfg.dy;
      mesh.userData.surfaceTag = "cloud";
      group.add(mesh);
      return mesh;
    });

    return group;
  }

  /* ---------- Abay River / GERD Reservoir Animated Water Plane ---------- */
  function createWaterMesh(THREE, sharedUniforms) {
    const geo = new THREE.PlaneGeometry(14000, 14000, 64, 64);
    geo.rotateX(-Math.PI / 2);

    const waterVert = `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.y += sin(p.x * 0.06 + uTime * 1.6) * 0.18 + cos(p.z * 0.05 - uTime * 1.25) * 0.14;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;

    const waterFrag = `
      uniform float uTime;
      uniform float uGoldenHour;
      uniform vec3 uSunDir;
      uniform vec3 uWaterShallow;
      uniform vec3 uWaterDeep;
      uniform vec2 uFlowDir;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      void main() {
        vec2 flow = uFlowDir * uTime * 0.55;
        float r1 = noise(vWorldPos.xz * 0.11 + flow);
        float r2 = noise(vWorldPos.xz * 0.27 - flow * 0.7 + vec2(11.3, 7.1));
        float r3 = noise(vWorldPos.xz * 0.65 + flow * 1.4);
        float ripple = r1 * 0.5 + r2 * 0.32 + r3 * 0.18;

        vec3 n = normalize(vec3((r2 - r1) * 0.42, 1.0, (r3 - r1) * 0.42));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 3.2);

        // Signature Donkey Water selective electric-cyan (#28d8f0) highlights + deep Nile teal
        vec3 cyanGlint = vec3(0.16, 0.84, 0.95);
        vec3 baseCol = mix(uWaterDeep, uWaterShallow, clamp(ripple * 0.85 + fresnel * 0.45, 0.0, 1.0));
        baseCol = mix(baseCol, cyanGlint, smoothstep(0.62, 0.90, ripple) * 0.48 + fresnel * 0.38);

        vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
        float spec = pow(max(dot(n, halfVec), 0.0), 96.0);
        vec3 specCol = mix(vec3(0.75, 0.96, 1.0), vec3(1.0, 0.86, 0.62), uGoldenHour);
        vec3 col = baseCol + spec * specCol * 0.85;

        float edgeFade = 1.0 - smoothstep(0.65, 0.99, length(vUv - 0.5) * 2.0);
        gl_FragColor = vec4(col, 0.94 * edgeFade);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedUniforms.uTime,
        uGoldenHour: sharedUniforms.uGoldenHour,
        uSunDir: sharedUniforms.uSunDir,
        uWaterShallow: { value: new THREE.Color("#24c4e4") },
        uWaterDeep: { value: new THREE.Color("#124858") },
        uFlowDir: { value: new THREE.Vector2(-0.95, -0.25) }
      },
      vertexShader: waterVert,
      fragmentShader: waterFrag,
      transparent: true,
      depthWrite: true
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "EthiopiaAbayWaterPlane";
    mesh.visible = false;
    mesh.userData.isWaterCyan = true;
    mesh.userData.surfaceTag = "water";
    return mesh;
  }

  /* ---------- Procedural Abyssinian Highland Sky Dome ---------- */
  function createHighlandSkyDome(THREE, sharedUniforms) {
    const geo = new THREE.SphereGeometry(15200, 32, 20);
    const skyVert = `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;
    const skyFrag = `
      uniform vec3 uSunDir;
      uniform float uGoldenHour;
      uniform float uMist;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.15, 1.0);
        vec3 zenithDay  = vec3(0.16, 0.36, 0.66);
        vec3 horizonDay = vec3(0.74, 0.82, 0.90);
        vec3 zenithGold = vec3(0.18, 0.25, 0.46);
        vec3 horizonGold= vec3(0.95, 0.68, 0.44);

        vec3 zen = mix(zenithDay, zenithGold, uGoldenHour);
        vec3 hor = mix(horizonDay, horizonGold, uGoldenHour);
        hor = mix(hor, vec3(0.85, 0.88, 0.91), uMist * 0.55);

        vec3 col = mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.58));
        float sunAmt = max(dot(d, normalize(uSunDir)), 0.0);
        col += vec3(1.0, 0.84, 0.62) * pow(sunAmt, 18.0) * (0.28 + 0.35 * uGoldenHour);
        col += vec3(1.0, 0.96, 0.88) * smoothstep(0.9985, 0.9998, sunAmt) * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: sharedUniforms.uSunDir,
        uGoldenHour: sharedUniforms.uGoldenHour,
        uMist: sharedUniforms.uMist
      },
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "EthiopiaHighlandSkyDome";
    mesh.renderOrder = -10;
    return mesh;
  }

  /* ---------- Sculpted Weathered Talus Scree Boulders Around Spire & Escarpment Bases ---------- */
  function createFracturedRockGeometry(THREE) {
    const geo = new THREE.IcosahedronGeometry(1.0, 2);
    const pos = geo.attributes.position;
    let seed = 445566;
    const rnd = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296.0;
    };

    // Bevel against 8 geological cleavage planes while keeping indexed smooth-bevel normals (organic weathered sandstone/basalt clasts!)
    const planes = [];
    for (let k = 0; k < 8; k++) {
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(2 * rnd() - 1);
      planes.push({
        nx: Math.sin(ph) * Math.cos(th),
        ny: Math.cos(ph),
        nz: Math.sin(ph) * Math.sin(th),
        d: 0.64 + rnd() * 0.24
      });
    }

    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.x *= 1.24;
      v.y *= 0.72;
      v.z *= 1.08;
      for (let k = 0; k < planes.length; k++) {
        const pl = planes[k];
        const dot = v.x * pl.nx + v.y * pl.ny + v.z * pl.nz;
        if (dot > pl.d) {
          const excess = (dot - pl.d) * 0.76;
          v.x -= pl.nx * excess;
          v.y -= pl.ny * excess;
          v.z -= pl.nz * excess;
        }
      }
      const crag = 1.0 + 0.09 * Math.sin(v.x * 4.7 + v.z * 3.9) * Math.cos(v.y * 5.3);
      v.multiplyScalar(crag);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function populateRegionRockFormations(THREE, talusMesh, entry, worldSpan, innerN) {
    const MAX_TALUS = talusMesh.instanceMatrix.count;
    const meta = entry.meta;
    const wyGrid = entry.worldYGrid;
    const isGheralta = entry.id === "gheralta_spires";

    const avoidPads = [];
    if (meta.landmarks) {
      for (const k of ["standpipeRelay", "monolithCourtPad", "churchCliffLedge", "imetGogoLookout", "gliderLaunchPoint", "abayRiverTerrace", "gerdSaddleOverlook"]) {
        const p = meta.landmarks[k];
        if (p && typeof p.x === "number") avoidPads.push({ x: p.x, z: p.z, r: k === "monolithCourtPad" ? 32 : 22 });
      }
    }
    const isNearPad = (x, z) => {
      for (let i = 0; i < avoidPads.length; i++) {
        if (Math.hypot(x - avoidPads[i].x, z - avoidPads[i].z) < avoidPads[i].r) return true;
      }
      return false;
    };

    let seed = (entry.id.length * 7919 + 104729) >>> 0;
    const rand = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296.0;
    };

    const dummy = new THREE.Object3D();
    const waterY = meta.waterPlane ? meta.waterPlane.worldY : -99999;
    const targetTalus = isGheralta ? MAX_TALUS : Math.floor(MAX_TALUS * 0.42);
    let tCount = 0;

    for (let attempt = 0; attempt < MAX_TALUS * 32 && tCount < targetTalus; attempt++) {
      // In Gheralta, focus 75% of boulders around the central/foreground spire talus aprons (-460..+340, -340..+260) so hero & plain views show rich red sandstone boulder fields!
      let x, z;
      if (isGheralta && rand() < 0.78) {
        x = -460 + rand() * 800;
        z = -320 + rand() * 580;
      } else {
        const half = worldSpan * 0.45;
        x = (rand() * 2 - 1) * half;
        z = (rand() * 2 - 1) * half;
      }
      if (isNearPad(x, z)) continue;

      const y = sampleTriangleGrid(wyGrid, innerN, worldSpan, x, z);
      if (y < waterY + 4.5) continue;

      const eps = 3.0;
      const dhdx = (sampleTriangleGrid(wyGrid, innerN, worldSpan, x + eps, z) - sampleTriangleGrid(wyGrid, innerN, worldSpan, x - eps, z)) / (2 * eps);
      const dhdz = (sampleTriangleGrid(wyGrid, innerN, worldSpan, x, z + eps) - sampleTriangleGrid(wyGrid, innerN, worldSpan, x, z - eps)) / (2 * eps);
      const slopeGrad = Math.hypot(dhdx, dhdz);
      const elevM = y / meta.verticalScale + meta.datumElevM;

      if (isGheralta) {
        // Place boulders strictly on gentle-to-moderate scree aprons (< 28 deg) so outer edges never overhang steep slopes!
        if (slopeGrad < 0.05 || slopeGrad > 0.52 || elevM > 2035) continue;
      } else {
        if (slopeGrad < 0.14 || slopeGrad > 0.55) continue;
      }

      const isMegablock = isGheralta && slopeGrad > 0.16 && rand() < 0.28;
      const sz = isGheralta
        ? (isMegablock ? 4.8 + rand() * 4.6 : 1.5 + Math.pow(rand(), 1.7) * 4.5)
        : 1.1 + Math.pow(rand(), 2.2) * 3.8;

      // Sink deeper proportional to local slopeGrad so downhill rim is 100% buried in talus!
      const sink = sz * (0.38 + 0.42 * slopeGrad);
      dummy.position.set(x, y - sink, z);
      dummy.rotation.set((rand() - 0.5) * 0.48, rand() * Math.PI * 2, (rand() - 0.5) * 0.48);
      dummy.scale.set(sz * (0.85 + rand() * 0.48), sz * (0.58 + rand() * 0.42), sz * (0.85 + rand() * 0.48));
      dummy.updateMatrix();
      talusMesh.setMatrixAt(tCount++, dummy.matrix);
    }
    talusMesh.count = tCount;
    talusMesh.instanceMatrix.needsUpdate = true;
    talusMesh.computeBoundingSphere();
  }

  /* ---------- Binary Heightfield Decoding ---------- */
  async function fetchUint16Grid(url, expectedLen) {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch DEM asset ${url} (HTTP ${resp.status})`);
    }
    const buf = await resp.arrayBuffer();
    const u16 = new Uint16Array(buf);
    if (expectedLen && u16.length !== expectedLen) {
      throw new Error(`DEM buffer size mismatch for ${url}: got ${u16.length}, expected ${expectedLen}`);
    }
    return u16;
  }

  /* ---------- Main Factory: `EthiopiaHighlandsPack.create(THREE, opts)` ---------- */
  async function create(THREE, opts = {}) {
    if (!THREE || !THREE.Group) {
      throw new Error("EthiopiaHighlandsPack.create requires THREE as first argument.");
    }

    const baseUrl = (opts.baseUrl || "./terrain-pack/").replace(/\/?$/, "/");
    const initialRegion = resolveRegionId(opts.region || opts.initialRegion || "simien_imet_gogo");
    const includeSky = opts.includeSky !== false;

    const manifestResp = await fetch(baseUrl + "manifest.json");
    if (!manifestResp.ok) {
      throw new Error(`Failed to load ${baseUrl}manifest.json (HTTP ${manifestResp.status})`);
    }
    const manifest = await manifestResp.json();

    const innerN = manifest.gridSize || 384;
    const horizonN = manifest.horizonGridSize || 129;
    const worldSpan = manifest.worldSpanM || 2400.0;
    const horizonSpan = manifest.horizonSpanM || 16800.0;

    const group = new THREE.Group();
    group.name = "EthiopiaHighlandsPackRoot";

    const sunDir = new THREE.Vector3(0.52, 0.56, 0.64).normalize();
    const sharedUniforms = {
      uRegionStyle: { value: 0 },
      uDatumElevM: { value: 3200.0 },
      uVertScale: { value: 0.6 },
      uMinElevM: { value: 1957.0 },
      uMaxElevM: { value: 3926.5 },
      uCloudElevY: { value: -276.0 },
      uWaterElevY: { value: -9999.0 },
      uHasWater: { value: 0.0 },
      uMist: { value: typeof opts.mist === "number" ? opts.mist : 0.34 },
      uGoldenHour: { value: typeof opts.goldenHour === "number" ? opts.goldenHour : 0.28 },
      uTime: { value: 0.0 },
      uSunDir: { value: sunDir }
    };

    // Build reusable high-resolution inner terrain mesh (384x384)
    const innerGeo = new THREE.PlaneGeometry(worldSpan, worldSpan, innerN - 1, innerN - 1);
    innerGeo.rotateX(-Math.PI / 2);
    const innerMat = createGeologicalTerrainMaterial(THREE, sharedUniforms, false);
    const terrainMesh = new THREE.Mesh(innerGeo, innerMat);
    terrainMesh.name = "EthiopiaInnerDEM";
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = false;
    group.add(terrainMesh);

    // Sculpted 3D InstancedMesh talus scree boulders around tower & escarpment bases
    const talusGeo = createFracturedRockGeometry(THREE);
    const boulderMat = createGeologicalTerrainMaterial(THREE, sharedUniforms, false, true);
    const talusMesh = new THREE.InstancedMesh(talusGeo, boulderMat, 720);
    talusMesh.name = "EthiopiaTalusBoulders";
    talusMesh.castShadow = true;
    talusMesh.receiveShadow = true;
    talusMesh.frustumCulled = false;
    group.add(talusMesh);

    // Build seamless 16.8 km outer massif horizon skirt (hole cut out for [-1200, +1200] inner mesh)
    const horizonGeo = createHorizonSkirtGeometry(THREE, horizonN, horizonSpan, worldSpan);
    const horizonMat = createGeologicalTerrainMaterial(THREE, sharedUniforms, true);
    const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
    horizonMesh.name = "EthiopiaHorizonMassif";
    horizonMesh.receiveShadow = false;
    horizonMesh.castShadow = false;
    group.add(horizonMesh);

    const cloudSeaGroup = createCloudSeaGroup(THREE, sharedUniforms);
    group.add(cloudSeaGroup);

    const waterMesh = createWaterMesh(THREE, sharedUniforms);
    group.add(waterMesh);

    let skyMesh = null;
    if (includeSky) {
      skyMesh = createHighlandSkyDome(THREE, sharedUniforms);
      group.add(skyMesh);
    }

    // Per-region decoded cache so switching back and forth is instantaneous (< 2 ms)
    const regionCache = new Map();
    let activeId = null;
    let activeData = null;

    async function ensureRegionDecoded(regionId) {
      const rid = resolveRegionId(regionId);
      if (regionCache.has(rid)) return regionCache.get(rid);

      const meta = manifest.regions[rid];
      if (!meta) throw new Error(`Unknown Ethiopian Highlands region: ${rid}`);

      const [u16Inner, u16Horizon] = await Promise.all([
        fetchUint16Grid(baseUrl + meta.files.dem16Bin, innerN * innerN),
        fetchUint16Grid(baseUrl + meta.files.horizon16Bin, horizonN * horizonN)
      ]);

      const elevMGrid = new Float32Array(innerN * innerN);
      const worldYGrid = new Float32Array(innerN * innerN);
      const normalGrid = new Float32Array(innerN * innerN * 3);

      const minM = meta.minElevM;
      const rangeM = meta.maxElevM - meta.minElevM;
      const datumM = meta.datumElevM;
      const vScale = meta.verticalScale;

      for (let i = 0; i < u16Inner.length; i++) {
        const em = minM + (u16Inner[i] / 65535.0) * rangeM;
        elevMGrid[i] = em;
        worldYGrid[i] = (em - datumM) * vScale;
      }
      computeGridNormals(worldYGrid, innerN, worldSpan, normalGrid);

      const horizonWorldY = new Float32Array(horizonN * horizonN);
      const hMin = meta.horizonMinElevM;
      const hRange = meta.horizonMaxElevM - meta.horizonMinElevM;
      const halfInner = worldSpan * 0.5;

      // Blend outer horizon smoothly into inner DEM perimeter so seam is 100% invisible!
      for (let iy = 0; iy < horizonN; iy++) {
        const wz = (iy / (horizonN - 1) - 0.5) * horizonSpan;
        for (let ix = 0; ix < horizonN; ix++) {
          const wx = (ix / (horizonN - 1) - 0.5) * horizonSpan;
          const emH = hMin + (u16Horizon[iy * horizonN + ix] / 65535.0) * hRange;
          const wyH = (emH - datumM) * vScale;

          const dx = Math.max(0, Math.abs(wx) - halfInner);
          const dz = Math.max(0, Math.abs(wz) - halfInner);
          const distFromEdge = Math.hypot(dx, dz);
          const edgeBlend = smoothstep(0.0, 950.0, distFromEdge);

          const wyInnerEdge = sampleBilinearGrid(worldYGrid, innerN, worldSpan, clamp(wx, -halfInner, halfInner), clamp(wz, -halfInner, halfInner));
          horizonWorldY[iy * horizonN + ix] = lerp(wyInnerEdge, wyH, edgeBlend);
        }
      }
      const horizonNormals = new Float32Array(horizonN * horizonN * 3);
      computeGridNormals(horizonWorldY, horizonN, horizonSpan, horizonNormals);

      const entry = {
        id: rid,
        meta,
        elevMGrid,
        worldYGrid,
        normalGrid,
        horizonWorldY,
        horizonNormals
      };
      regionCache.set(rid, entry);
      return entry;
    }

    function applyRegionToMeshes(entry) {
      activeId = entry.id;
      activeData = entry;
      const meta = entry.meta;

      // Update inner 384x384 geometry positions & analytical normals
      const posAttr = innerGeo.attributes.position;
      const normAttr = innerGeo.attributes.normal;
      const posArr = posAttr.array;
      const normArr = normAttr.array;
      const wy = entry.worldYGrid;
      const ng = entry.normalGrid;

      for (let i = 0; i < wy.length; i++) {
        const i3 = i * 3;
        posArr[i3 + 1] = wy[i];
        normArr[i3] = ng[i3];
        normArr[i3 + 1] = ng[i3 + 1];
        normArr[i3 + 2] = ng[i3 + 2];
      }
      posAttr.needsUpdate = true;
      normAttr.needsUpdate = true;
      innerGeo.computeBoundingBox();
      innerGeo.computeBoundingSphere();

      // Update outer 16.8km horizon mesh
      const hPosAttr = horizonGeo.attributes.position;
      const hNormAttr = horizonGeo.attributes.normal;
      const hPosArr = hPosAttr.array;
      const hNormArr = hNormAttr.array;
      const hwy = entry.horizonWorldY;
      const hng = entry.horizonNormals;

      for (let i = 0; i < hwy.length; i++) {
        const i3 = i * 3;
        hPosArr[i3 + 1] = hwy[i];
        hNormArr[i3] = hng[i3];
        hNormArr[i3 + 1] = hng[i3 + 1];
        hNormArr[i3 + 2] = hng[i3 + 2];
      }
      hPosAttr.needsUpdate = true;
      hNormAttr.needsUpdate = true;
      horizonGeo.computeBoundingBox();
      horizonGeo.computeBoundingSphere();

      // Update shader uniforms
      sharedUniforms.uRegionStyle.value = REGION_STYLE_INDEX[meta.regionStyle] ?? 0;
      sharedUniforms.uDatumElevM.value = meta.datumElevM;
      sharedUniforms.uVertScale.value = meta.verticalScale;
      sharedUniforms.uMinElevM.value = meta.minElevM;
      sharedUniforms.uMaxElevM.value = meta.maxElevM;

      populateRegionRockFormations(THREE, talusMesh, entry, worldSpan, innerN);

      if (typeof meta.cloudSeaWorldY === "number") {
        sharedUniforms.uCloudElevY.value = meta.cloudSeaWorldY;
        cloudSeaGroup.visible = true;
        cloudSeaGroup.userData.layers.forEach(m => {
          m.position.y = meta.cloudSeaWorldY + m.userData.dy;
        });
      } else {
        sharedUniforms.uCloudElevY.value = -9999.0;
        // Still allow high monsoon mist wisps if mist slider > 0.55
        cloudSeaGroup.visible = sharedUniforms.uMist.value > 0.55;
        cloudSeaGroup.userData.layers.forEach(m => {
          m.position.y = 310 + m.userData.dy;
        });
      }

      if (meta.waterPlane) {
        waterMesh.visible = true;
        waterMesh.position.y = meta.waterPlane.worldY;
        sharedUniforms.uHasWater.value = 1.0;
        sharedUniforms.uWaterElevY.value = meta.waterPlane.worldY;
        waterMesh.material.uniforms.uWaterShallow.value.set(meta.waterPlane.color || "#1ea8c8");
        waterMesh.material.uniforms.uWaterDeep.value.set(meta.waterPlane.deepColor || "#124858");
        if (Array.isArray(meta.waterPlane.flowDir)) {
          waterMesh.material.uniforms.uFlowDir.value.set(meta.waterPlane.flowDir[0], meta.waterPlane.flowDir[1]);
        }
      } else {
        waterMesh.visible = false;
        sharedUniforms.uHasWater.value = 0.0;
        sharedUniforms.uWaterElevY.value = -9999.0;
      }
    }

    async function loadRegion(regionId) {
      const entry = await ensureRegionDecoded(regionId);
      applyRegionToMeshes(entry);
      // Warm remaining regions quietly in idle background if desired
      return pack.getRegionInfo();
    }

    /* ---------- Sampling Contract (`sampleHeight`, `sampleNormal`, `sampleSlope`, `sampleBiome`) ---------- */
    function sampleHeight(x, z) {
      if (!activeData) return 0;
      const half = worldSpan * 0.5;
      if (Math.abs(x) <= half && Math.abs(z) <= half) {
        return sampleTriangleGrid(activeData.worldYGrid, innerN, worldSpan, x, z);
      }
      return sampleTriangleGrid(activeData.horizonWorldY, horizonN, horizonSpan, x, z);
    }

    function sampleWaterHeight(x, z) {
      if (!activeData || !activeData.meta.waterPlane) return null;
      return activeData.meta.waterPlane.worldY;
    }

    function sampleElevationMeters(x, z) {
      if (!activeData) return 2500;
      const wy = sampleHeight(x, z);
      return wy / activeData.meta.verticalScale + activeData.meta.datumElevM;
    }

    function sampleNormal(x, z, targetVec3) {
      const out = targetVec3 || new THREE.Vector3();
      if (!activeData) return out.set(0, 1, 0);

      const eps = 2.2;
      const hL = sampleHeight(x - eps, z);
      const hR = sampleHeight(x + eps, z);
      const hD = sampleHeight(x, z - eps);
      const hU = sampleHeight(x, z + eps);

      const dhdx = (hR - hL) / (2.0 * eps);
      const dhdz = (hU - hD) / (2.0 * eps);
      return out.set(-dhdx, 1.0, -dhdz).normalize();
    }

    const _tmpNorm = new THREE.Vector3();
    function sampleSlope(x, z) {
      // Returns gradient magnitude tan(theta): 0 = flat, 1.0 = 45 deg, >2.0 = sheer cliff!
      sampleNormal(x, z, _tmpNorm);
      const ny = clamp(_tmpNorm.y, 0.001, 1.0);
      return Math.sqrt(Math.max(0, 1.0 - ny * ny)) / ny;
    }

    function sampleSlopeAngle(x, z) {
      sampleNormal(x, z, _tmpNorm);
      return Math.acos(clamp(_tmpNorm.y, -1.0, 1.0));
    }

    function sampleSlopeDegrees(x, z) {
      return (sampleSlopeAngle(x, z) * 180.0) / Math.PI;
    }

    function sampleBiome(x, z) {
      return classifyBiome(sampleElevationMeters(x, z));
    }

    function sampleBiomeInfo(x, z) {
      const elevM = sampleElevationMeters(x, z);
      const id = classifyBiome(elevM);
      return { ...BIOME_DEFS[id], elevM };
    }

    function worldToLatLon(x, z) {
      if (!activeData) {
        return { lat: 13.2167, lon: 38.0833, elevM: 3922, worldY: 0, biome: "wurch", biomeLabel: BIOME_DEFS.wurch.label, slope: 0, slopeDeg: 0 };
      }
      const b = activeData.meta.bounds;
      const u = clamp(x / worldSpan + 0.5, 0, 1);
      const v = clamp(z / worldSpan + 0.5, 0, 1);
      // +X = East (lonWest -> lonEast), +Z = South (latNorth -> latSouth)
      const lon = lerp(b.lonWest, b.lonEast, u);
      const lat = lerp(b.latNorth, b.latSouth, v);
      const worldY = sampleHeight(x, z);
      const elevM = worldY / activeData.meta.verticalScale + activeData.meta.datumElevM;
      const slope = sampleSlope(x, z);
      const slopeDeg = (Math.atan(slope) * 180.0) / Math.PI;
      const biome = classifyBiome(elevM);
      return {
        lat,
        lon,
        elevM,
        worldY,
        slope,
        slopeDeg,
        biome,
        biomeShort: BIOME_DEFS[biome].short,
        biomeLabel: BIOME_DEFS[biome].label
      };
    }

    function latLonToWorld(lat, lon) {
      if (!activeData) return { x: 0, y: 0, z: 0 };
      const b = activeData.meta.bounds;
      const u = (lon - b.lonWest) / (b.lonEast - b.lonWest || 1e-6);
      const v = (b.latNorth - lat) / (b.latNorth - b.latSouth || 1e-6);
      const x = (u - 0.5) * worldSpan;
      const z = (v - 0.5) * worldSpan;
      return { x, y: sampleHeight(x, z), z };
    }

    // Orographic ridge-soaring updraft (m/s) for Rogallo Hang-Glider!
    function sampleUpdraft(x, z, windXZ) {
      sampleNormal(x, z, _tmpNorm);
      // Default prevailing highland anabatic upslope wind blows up-escarpment
      let wx = 0.0, wz = 1.0;
      if (windXZ && typeof windXZ.x === "number") {
        const l = Math.hypot(windXZ.x, windXZ.z) || 1.0;
        wx = windXZ.x / l;
        wz = windXZ.z / l;
      } else if (activeId === "simien_imet_gogo") {
        wx = 0.12; wz = 0.99; // Anabatic wind blowing South up the sheer northern Geech escarpment!
      } else if (activeId === "gheralta_spires") {
        wx = -0.25; wz = -0.96; // Warm plain thermals rising up Korkor sandstone cliff faces!
      } else if (activeId === "blue_nile_gorge") {
        wx = 0.20; wz = -0.98;
      } else if (activeId === "gerd_belaya_escarpment") {
        wx = 0.96; wz = 0.28; // Humid westerly Sudan-basin monsoon hitting Mt. Belaya wall!
      }
      const slopeHorizontal = Math.hypot(_tmpNorm.x, _tmpNorm.z);
      // Updraft occurs when wind blows against rising terrain (`-dot(normalXZ, windXZ) > 0`) or strong cliff thermals
      const windPush = Math.max(0.15, -(_tmpNorm.x * wx + _tmpNorm.z * wz));
      return clamp(slopeHorizontal * 8.5 * windPush + slopeHorizontal * 2.4, 0.0, 11.5);
    }

    // Deterministic biome-aware scatter helper for Afromontane flora & wildlife
    function scatterPoints(scatterOpts = {}) {
      const count = scatterOpts.count || 120;
      const minElevM = scatterOpts.minElevM ?? -500;
      const maxElevM = scatterOpts.maxElevM ?? 9000;
      const minSlope = scatterOpts.minSlope ?? 0.0;
      const maxSlope = scatterOpts.maxSlope ?? 0.55;
      const radius = scatterOpts.radius ?? worldSpan * 0.44;
      const centerX = scatterOpts.centerX ?? 0;
      const centerZ = scatterOpts.centerZ ?? 0;
      const avoidWater = scatterOpts.avoidWater !== false;
      let seed = (scatterOpts.seed ?? 1337) >>> 0;

      const rand = () => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return seed / 4294967296.0;
      };

      const out = [];
      const maxAttempts = count * 18;
      const waterY = sampleWaterHeight(0, 0);

      for (let i = 0; i < maxAttempts && out.length < count; i++) {
        const x = centerX + (rand() * 2 - 1) * radius;
        const z = centerZ + (rand() * 2 - 1) * radius;
        if (Math.abs(x) > worldSpan * 0.48 || Math.abs(z) > worldSpan * 0.48) continue;

        const y = sampleHeight(x, z);
        if (avoidWater && waterY !== null && y < waterY + 3.5) continue;

        const elevM = y / activeData.meta.verticalScale + activeData.meta.datumElevM;
        if (elevM < minElevM || elevM > maxElevM) continue;

        const slope = sampleSlope(x, z);
        if (slope < minSlope || slope > maxSlope) continue;

        out.push({
          x,
          y,
          z,
          elevM,
          slope,
          biome: classifyBiome(elevM),
          scale: 0.78 + rand() * 0.48,
          rotY: rand() * Math.PI * 2
        });
      }
      return out;
    }

    function setGoldenHour(val) {
      const g = clamp(Number(val) || 0, 0, 1);
      sharedUniforms.uGoldenHour.value = g;
      // Sweep sun from bright highland mid-morning (elev 52 deg) to dramatic low golden-hour (elev 13 deg)
      const elevRad = lerp(0.90, 0.23, g);
      const azimRad = lerp(0.72, 2.35, g);
      sunDir.set(
        Math.cos(elevRad) * Math.cos(azimRad),
        Math.sin(elevRad),
        Math.cos(elevRad) * Math.sin(azimRad)
      ).normalize();
      return sunDir;
    }

    function setMist(val) {
      const m = clamp(Number(val) || 0, 0, 1);
      sharedUniforms.uMist.value = m;
      if (activeData && activeData.meta.cloudSeaWorldY === null) {
        cloudSeaGroup.visible = m > 0.55;
      }
    }

    function setSunDirection(dirVec3) {
      if (dirVec3) sunDir.copy(dirVec3).normalize();
    }

    function setAtmosphere(atm = {}) {
      if (typeof atm.goldenHour === "number") setGoldenHour(atm.goldenHour);
      if (typeof atm.mist === "number") setMist(atm.mist);
      if (atm.sunDir) setSunDirection(atm.sunDir);
    }

    function update(dt = 0.016, nowSec) {
      if (typeof nowSec === "number") {
        sharedUniforms.uTime.value = nowSec;
      } else {
        sharedUniforms.uTime.value += dt;
      }
    }

    function getLandmarks(regionId) {
      const rid = regionId ? resolveRegionId(regionId) : activeId;
      const meta = manifest.regions[rid];
      return meta ? meta.landmarks : null;
    }

    function getRegionInfo(regionId) {
      const rid = regionId ? resolveRegionId(regionId) : activeId;
      return manifest.regions[rid] || null;
    }

    const pack = {
      group,
      root: group,
      terrainMesh,
      horizonMesh,
      cloudSeaGroup,
      waterMesh,
      skyMesh,
      manifest,
      uniforms: sharedUniforms,
      worldSpan,
      horizonSpan,
      gridSize: innerN,
      biomes: BIOME_DEFS,
      regionOrder: manifest.regionOrder.slice(),

      get activeRegionId() {
        return activeId;
      },
      get activeRegion() {
        return activeData ? activeData.meta : null;
      },
      get landmarks() {
        return activeData ? activeData.meta.landmarks : null;
      },

      resolveRegionId,
      loadRegion,
      setRegion: loadRegion,
      prefetchAll: () => Promise.all(manifest.regionOrder.map(ensureRegionDecoded)),
      getRegionInfo,
      getLandmarks,

      sampleHeight,
      sampleHeightBilinear: (x, z) =>
        activeData ? sampleBilinearGrid(activeData.worldYGrid, innerN, worldSpan, x, z) : 0,
      sampleWaterHeight,
      sampleElevationMeters,
      sampleNormal,
      sampleSlope,
      sampleSlopeAngle,
      sampleSlopeDegrees,
      sampleBiome,
      sampleBiomeInfo,
      sampleUpdraft,
      worldToLatLon,
      worldToGeo: worldToLatLon,
      latLonToWorld,
      scatterPoints,

      setGoldenHour,
      setMist,
      setSunDirection,
      setAtmosphere,
      update
    };

    // Initialize sun direction for starting goldenHour & load initial region immediately
    setGoldenHour(sharedUniforms.uGoldenHour.value);
    await loadRegion(initialRegion);

    // Non-blocking background prefetch of remaining 3 regions (~960 KB total) for 0ms switcher clicks!
    if (opts.prefetch !== false) {
      setTimeout(() => {
        manifest.regionOrder.forEach(rid => {
          if (rid !== activeId) ensureRegionDecoded(rid).catch(() => {});
        });
      }, 120);
    }

    return pack;
  }

  const EthiopiaHighlandsPack = {
    VERSION: "1.0.0",
    REGIONS: CANONICAL_REGION_IDS,
    REGION_ALIASES,
    BIOMES: BIOME_DEFS,
    resolveRegionId,
    classifyBiome,
    create
  };

  root.EthiopiaHighlandsPack = EthiopiaHighlandsPack;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = EthiopiaHighlandsPack;
  }
})(typeof window !== "undefined" ? window : globalThis);
