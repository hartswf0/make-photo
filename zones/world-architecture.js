/* 2086 Donkey Water World Architecture, Settlement Houses, Industrial Cooling Yard,
   Wire-Glass Registry Window, Cottonwood Root-Bowl Film Grove & Ahiya Production Sets.
   Replaces primitive BoxGeometry buildings/props across /zones/ and /night-post/ with
   procedural masonry, corrugated iron, timber framing, wire-glass, and organic lofted forms
   matched directly to the 2086 World Bible plates.
   Exposes window.buildWorldArchitecture(THREE, env). */
(function () {
  "use strict";

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
  function getArchMaterials(T) {
    if (archCache) return archCache;

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

    // 1. Coursed highland fieldstone & mortar masonry (village.jpg!)
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
      const stoneTint = 0.28 + 0.24 * hash2(colIdx % cols, rowIdx) + 0.14 * fbm(u * 36, v * 36, 3);
      const val = lerp(0.56, stoneTint, mortar); // light-gray mortar joints between dark stones
      return [val * 1.02, val * 1.00, val * 0.96];
    }, 2.4, 1.8, true);

    const stoneBump = makeDataTex(256, 256, (u, v) => {
      const rows = 11, ry = v * rows, rowIdx = Math.floor(ry), fy = ry - rowIdx;
      const cols = 5 + (rowIdx % 2), stagger = (rowIdx % 2) * 0.47;
      const rx = (u + stagger) * cols, fx = rx - Math.floor(rx);
      const mortar = smooth(0.02, 0.13, Math.min(fy, 1 - fy)) * smooth(0.02, 0.11, Math.min(fx, 1 - fx));
      const rough = fbm(u * 48, v * 48, 3);
      return mortar * (0.62 + 0.38 * rough);
    }, 2.4, 1.8, false);

    // 2. Weathered limewash plaster over stone (village.jpg 2-story upper facade!)
    const plasterColor = makeDataTex(256, 256, (u, v) => {
      const damp = (1 - smooth(0.0, 0.28, v)) * 0.24 * fbm(u * 14, v * 16, 3);
      const stain = fbm(u * 9 + 2, v * 11 + 5, 4);
      const crack = Math.pow(1 - Math.abs(fbm(u * 22, v * 22, 3) - 0.5) * 2, 8) * 0.18;
      const b = clamp(0.74 - damp - (stain - 0.5) * 0.22 - crack, 0.28, 0.88);
      return [b * 1.02, b * 0.99, b * 0.93];
    }, 2, 1.5, true);

    // 3. Sinusoidal corrugated galvanized iron roof sheets (village.jpg!)
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

    // 4. Rough-sawn weathered timber planks
    const timberColor = makeDataTex(192, 192, (u, v) => {
      const plank = Math.abs(frac(u * 7) - 0.5) > 0.47 ? -0.15 : 0;
      const grain = fbm(u * 18, v * 90, 3);
      const b = clamp(0.28 + 0.16 * grain + plank, 0.10, 0.54);
      return [b * 1.12, b * 0.96, b * 0.78];
    }, 2, 2, true);

    // 5. Industrial board-formed concrete (flight.jpg & village.jpg cooling plant!)
    const concreteColor = makeDataTex(256, 256, (u, v) => {
      const panelX = Math.abs(frac(u * 4) - 0.5) > 0.485 ? -0.10 : 0;
      const panelY = Math.abs(frac(v * 3) - 0.5) > 0.485 ? -0.09 : 0;
      const streak = fbm(u * 16, v * 6, 4);
      const b = clamp(0.46 + (streak - 0.5) * 0.22 + panelX + panelY, 0.22, 0.68);
      return [b * 0.98, b * 1.00, b * 1.01];
    }, 3, 2, true);

    // 6. Georgian diamond wire-mesh safety glass + cyan condensation streaks (window.jpg!)
    const wireGlassTex = makeDataTex(192, 192, (u, v) => {
      const d1 = Math.abs(frac((u + v) * 14) - 0.5);
      const d2 = Math.abs(frac((u - v) * 14) - 0.5);
      const wire = d1 < 0.045 || d2 < 0.045 ? 1 : 0;
      const smudge = fbm(u * 12, v * 12, 3);
      const drip = (1 - smooth(0.0, 0.24, v)) * fbm(u * 26, v * 8, 2);
      if (wire) return [0.24, 0.28, 0.29, 0.88];
      return [0.58 + 0.18 * drip, 0.82 + 0.16 * drip, 0.86 + 0.12 * drip, clamp(0.28 + smudge * 0.22 + drip * 0.35, 0.22, 0.78)];
    }, 2, 1.4, false, true);

    // 7. Diamond chain-link security fence (village.jpg!)
    const chainTex = makeDataTex(128, 128, (u, v) => {
      const d1 = Math.abs(frac((u + v) * 16) - 0.5);
      const d2 = Math.abs(frac((u - v) * 16) - 0.5);
      const hit = d1 < 0.065 || d2 < 0.065;
      return hit ? [0.56, 0.59, 0.60, 0.92] : [0, 0, 0, 0];
    }, 6, 2, false, true);

    archCache = {
      stoneMat: new T.MeshStandardMaterial({ map: stoneColor, bumpMap: stoneBump, bumpScale: 0.055, roughness: 0.93 }),
      plasterMat: new T.MeshStandardMaterial({ map: plasterColor, bumpMap: stoneBump, bumpScale: 0.018, roughness: 0.90 }),
      roofMat: new T.MeshStandardMaterial({ map: corrColor, bumpMap: corrBump, bumpScale: 0.038, roughness: 0.58, metalness: 0.42, side: T.DoubleSide }),
      timberMat: new T.MeshStandardMaterial({ map: timberColor, bumpMap: timberColor, bumpScale: 0.025, roughness: 0.88 }),
      timberDark: new T.MeshStandardMaterial({ color: 0x2c231b, roughness: 0.90 }),
      concreteMat: new T.MeshStandardMaterial({ map: concreteColor, bumpMap: concreteColor, bumpScale: 0.028, roughness: 0.86 }),
      steelMat: new T.MeshStandardMaterial({ color: 0x5c6368, roughness: 0.46, metalness: 0.68 }),
      ironDarkMat: new T.MeshStandardMaterial({ color: 0x222629, roughness: 0.50, metalness: 0.62 }),
      copperPipeMat: new T.MeshStandardMaterial({ color: 0x7b6552, roughness: 0.38, metalness: 0.74 }),
      rubberHoseMat: new T.MeshStandardMaterial({ color: 0x1a1d1f, roughness: 0.72, metalness: 0.12 }),
      wireGlassMat: new T.MeshStandardMaterial({
        map: wireGlassTex, transparent: true, roughness: 0.18, metalness: 0.15, side: T.DoubleSide, depthWrite: false
      }),
      chainLinkMat: new T.MeshStandardMaterial({
        map: chainTex, transparent: true, alphaTest: 0.35, roughness: 0.52, metalness: 0.65, side: T.DoubleSide
      }),
      laundryLightMat: new T.MeshStandardMaterial({ color: 0xd8d3c6, roughness: 0.92, side: T.DoubleSide }),
      laundryMidMat: new T.MeshStandardMaterial({ color: 0x7d807c, roughness: 0.92, side: T.DoubleSide }),
      laundryDarkMat: new T.MeshStandardMaterial({ color: 0x2c3032, roughness: 0.92, side: T.DoubleSide }),
      barkMat: new T.MeshStandardMaterial({ color: 0x58534b, bumpMap: timberColor, bumpScale: 0.048, roughness: 0.94 }),
      counterChipMat: new T.MeshStandardMaterial({ map: plasterColor, bumpMap: stoneBump, bumpScale: 0.022, roughness: 0.78 }),
      officePanelMat: new T.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.82 }),
      officeDeskMat: new T.MeshStandardMaterial({ color: 0xaeb4ba, roughness: 0.55, metalness: 0.18 }),
      warmInteriorMat: new T.MeshStandardMaterial({ color: 0xf4dfb4, emissive: 0xd9a85b, emissiveIntensity: 0.72, roughness: 0.4 }),
      cyanInteriorMat: new T.MeshStandardMaterial({ color: 0x62e4f2, emissive: 0x1b9cb8, emissiveIntensity: 0.95, roughness: 0.3 }),
      filmLeafMat: new T.MeshPhysicalMaterial({
        color: 0x4ee2ec, emissive: 0x169ab4, emissiveIntensity: 0.78,
        roughness: 0.18, transparent: true, opacity: 0.86, side: T.DoubleSide
      })
    };
    return archCache;
  }

  /* ---------- Build a Recessed Multi-Pane Highland Timber Window ---------- */
  function makeFramedWindow(T, mats, w, h, glassMat, hasShutters = true) {
    const g = new T.Group();
    const frameT = 0.065, depth = 0.14;
    // Stone sill & timber lintel
    const sill = new T.Mesh(new T.BoxGeometry(w + 0.18, 0.08, depth + 0.10), mats.stoneMat);
    sill.position.set(0, -h * 0.5 - 0.04, 0.02);
    g.add(sill);
    const lintel = new T.Mesh(new T.BoxGeometry(w + 0.22, 0.11, depth + 0.08), mats.timberDark);
    lintel.position.set(0, h * 0.5 + 0.055, 0.01);
    g.add(lintel);

    // Outer timber jambs & center mullions
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

    // Recessed glass pane
    const glass = new T.Mesh(new T.PlaneGeometry(w - frameT * 1.4, h - 0.06), glassMat);
    glass.position.z = -0.02;
    g.add(glass);

    // Open timber board shutters flanking the window (village.jpg!)
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
    const halfW = spanX * 0.5 + 0.36; // generous eave overhang
    const slopeLen = Math.hypot(halfW, pitchH);
    const slopeAng = Math.atan2(pitchH, halfW);
    const roofZ = lenZ + 0.56;

    // Triangular masonry gable tympanums at front & back (+Z / -Z)
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

    // Left & right corrugated iron roof planes + exposed timber rafters underneath
    for (const sx of [-1, 1]) {
      const sheet = new T.Mesh(new T.BoxGeometry(slopeLen, 0.032, roofZ), mats.roofMat);
      sheet.position.set(sx * halfW * 0.5, pitchH * 0.5 + 0.02, 0);
      sheet.rotation.z = -sx * slopeAng;
      sheet.castShadow = true;
      sheet.receiveShadow = true;
      g.add(sheet);

      // Exposed eave rafter tails (village.jpg!)
      const nRafters = Math.max(4, Math.round(lenZ / 1.05));
      for (let r = 0; r <= nRafters; r++) {
        const rz = lerp(-lenZ * 0.48, lenZ * 0.48, r / nRafters);
        const raf = new T.Mesh(new T.BoxGeometry(slopeLen + 0.08, 0.075, 0.065), mats.timberDark);
        raf.position.set(sx * halfW * 0.5, pitchH * 0.5 - 0.03, rz);
        raf.rotation.z = -sx * slopeAng;
        g.add(raf);
      }

      // Highland wind-weight stones resting on corrugated roof (exact village.jpg detail!)
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

    // Ridge beam & galvanized ridge cap
    const ridge = new T.Mesh(new T.BoxGeometry(0.24, 0.065, roofZ + 0.04), mats.steelMat);
    ridge.position.y = pitchH + 0.03;
    g.add(ridge);
    return g;
  }

  /* ---------- Build One Complete Highland Stone & Timber Dwelling (`village.jpg`) ---------- */
  function makeHighlandHouse(T, mats, cfg, winList, dishList, darkWinMat, antennaMat) {
    const { w, h, d, twoStory, hasPorch, hasChimney, seed } = cfg;
    const grp = new T.Group();

    // Deep sloped stone plinth so building sits rock-solid on mountain grades
    const plinth = new T.Mesh(new T.BoxGeometry(w + 0.28, 2.2, d + 0.28), mats.stoneMat);
    plinth.position.y = -1.05;
    grp.add(plinth);

    // Ground floor coursed stone masonry
    const gfH = twoStory ? h * 0.58 : h;
    const gf = new T.Mesh(new T.BoxGeometry(w, gfH, d), mats.stoneMat);
    gf.position.y = gfH * 0.5;
    gf.castShadow = true;
    gf.receiveShadow = true;
    grp.add(gf);

    let roofBaseY = gfH;
    if (twoStory) {
      // Timber belt-course beam + limewashed plaster second story (exact village.jpg upper-left house!)
      const belt = new T.Mesh(new T.BoxGeometry(w + 0.14, 0.14, d + 0.14), mats.timberDark);
      belt.position.y = gfH;
      grp.add(belt);

      const ufH = h * 0.56;
      const uf = new T.Mesh(new T.BoxGeometry(w * 0.98, ufH, d * 0.98), mats.plasterMat);
      uf.position.y = gfH + ufH * 0.5;
      uf.castShadow = true;
      uf.receiveShadow = true;
      grp.add(uf);
      roofBaseY = gfH + ufH;

      // Upper-story multi-pane windows across front & side facades
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

    // Pitched corrugated-iron gable roof
    const pitchH = clamp(w * 0.24, 0.95, 1.48);
    const roof = makeGableRoof(T, mats, w, pitchH, d, true);
    roof.position.y = roofBaseY;
    grp.add(roof);

    // Optional stone chimney or Yagi rooftop antenna (village.jpg!)
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

    // Ground-floor plank door with timber frame, iron strap hinges & stone threshold step
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

    // Flanking ground-floor framed windows
    for (const sx of [-1, 1]) {
      const gw = makeFramedWindow(T, mats, 0.80, 0.90, darkWinMat, true);
      gw.group.position.set(sx * w * 0.31, 1.28, d * 0.5 + 0.02);
      grp.add(gw.group);
      winList.push(gw.glass);
    }

    // Optional timber lean-to front porch with corrugated shed awning & stacked firewood (village.jpg left!)
    if (hasPorch) {
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
      // Stacked split firewood under porch eave
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

  /* ---------- Build Clothesline with Vertex-Draped Shirts, Trousers & Sheets (`village.jpg`) ---------- */
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

    const clothMats = [mats.laundryLightMat, mats.laundryMidMat, mats.laundryDarkMat];
    const items = [
      [0.12, 0.85, 0.92, 0], [0.26, 0.72, 1.05, 1], [0.40, 0.52, 1.18, 2], // trousers
      [0.53, 0.95, 0.88, 0], [0.68, 0.68, 0.96, 1], [0.82, 0.78, 0.84, 2]
    ];
    const drapedMeshes = [];
    for (let k = 0; k < items.length; k++) {
      const [u, cw, ch, mIdx] = items[k];
      const anchor = ropeCrv.getPointAt(u);
      const geo = new T.PlaneGeometry(cw, ch, 6, 6);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i);
        const drop = 0.5 - vy / ch; // 0 at top rope, 1 at bottom hem
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

  /* ---------- Attach World Bible Page 1 (`saddle.jpg`) Cyan Sight-Windows to Mistletoe's Panniers ---------- */
  function attachSaddleSightWindows(T, donkey, cyanWaterMat) {
    if (!donkey || !donkey.pack || donkey.pack.userData.hasSightWindows) return;
    donkey.pack.userData.hasSightWindows = true;
    const frameMat = new T.MeshStandardMaterial({ color: 0x1a1613, roughness: 0.68 });
    const glowWindowMat = new T.MeshStandardMaterial({
      color: 0x3ae8ff, emissive: 0x16b8df, emissiveIntensity: 1.55, roughness: 0.16
    });
    donkey.pack.traverse(obj => {
      if (obj.isGroup && Math.abs(Math.abs(obj.position.x) - 0.095) < 0.01 && Math.abs(obj.position.y + 0.225) < 0.02) {
        const s = Math.sign(obj.position.x) || 1;
        const winGrp = new T.Group();
        winGrp.position.set(s * 0.105, 0.02, 0.085);
        const bezel = new T.Mesh(new T.BoxGeometry(0.016, 0.215, 0.162), frameMat);
        winGrp.add(bezel);
        const pouch = new T.Mesh(new T.BoxGeometry(0.022, 0.172, 0.124), glowWindowMat);
        pouch.position.x = s * 0.003;
        winGrp.add(pouch);
        obj.add(winGrp);
      }
    });
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
    let oxbowSheetFront = null, oxbowSheetRear = null, oxbowWindBase = null;

    // 0. Upgrade Mistletoe's canvas panniers with the Page 1 cyan sight-window!
    attachSaddleSightWindows(T, donkey, cyanWaterMat);

    /* =========================================================================
       1. HIGHLAND PUEBLO VILLAGE: 14 Coursed-Stone & Corrugated-Iron Dwellings,
          Courtyard Stone Walls, Sanctuary Portal & Clothesline (`village.jpg`!)
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

    // Dry-stone boundary walls & village clothesline with draped shirts/trousers (`village.jpg` foreground left!)
    {
      const clX = -771.8, clZ = -26.8, clY = groundAt(clX, clZ);
      const cl = makeClothesline(T, mats, 5.8);
      cl.group.position.set(clX, clY, clZ);
      cl.group.rotation.y = 1.48;
      worldProps.add(cl.group);
      laundrySway.push(...cl.drapedMeshes);

      for (const [wx, wz, wl, wyaw] of [[-768.5, -23.5, 5.4, 0.35], [-786.5, -20.0, 6.2, -0.25], [-780.0, -44.0, 5.8, 0.12]]) {
        const wall = new T.Mesh(new T.BoxGeometry(wl, 1.05, 0.48), mats.stoneMat);
        wall.position.set(wx, groundAt(wx, wz) + 0.42, wz);
        wall.rotation.y = wyaw;
        worldProps.add(wall);
      }
    }

    // Sanctuary Stone Steps & Carved Basalt Blue-Lit Portal on Upper Pueblo Terrace (-812, -34)
    {
      const sx = -812, sz = -34, sy = groundAt(sx, sz);
      const dg = new T.Group();
      dg.position.set(sx, sy, sz);
      dg.rotation.y = Math.PI * 0.5;
      for (let i = 0; i < 8; i++) {
        const st = new T.Mesh(new T.BoxGeometry(3.6, 0.28, 0.76), mats.stoneMat);
        st.position.set(0, 0.14 + i * 0.26, 3.6 - i * 0.58);
        dg.add(st);
      }
      const lintel = new T.Mesh(new T.BoxGeometry(4.4, 0.88, 1.45), mats.stoneMat);
      lintel.position.set(0, 5.38, -0.5);
      dg.add(lintel);
      for (const s of [-1.72, 1.72]) {
        const pil = new T.Mesh(new T.BoxGeometry(0.92, 5.2, 1.35), mats.stoneMat);
        pil.position.set(s, 2.6, -0.5);
        dg.add(pil);
      }
      const bdoor = new T.Mesh(new T.BoxGeometry(2.45, 4.35, 0.24), beaconCyanMat);
      bdoor.position.set(0, 2.48, -0.5);
      dg.add(bdoor);
      worldProps.add(dg);
    }

    /* =========================================================================
       2. HIGHLAND PUEBLO INDUSTRIAL COOLING PLANT, CHAIN-LINK FENCE,
          WIRE-GLASS REGISTRY WINDOW & 3-BRANCH SNAKING HOSE MANIFOLD
          (`flight.jpg`, `village.jpg`, `window.jpg`!)
       ========================================================================= */
    {
      const px = -776.0, pz = -30.0, py = groundAt(px, pz);
      const pGrp = new T.Group();
      pGrp.position.set(px, py, pz);
      pGrp.rotation.y = 0.30;

      // 2a. Reinforced-concrete Cooling Plant with sloped pilasters, circular louver bays & rooftop fan shrouds (`flight.jpg`!)
      const plantW = 6.2, plantH = 3.2, plantD = 4.2;
      const plantPlinth = new T.Mesh(new T.BoxGeometry(plantW + 0.4, 2.2, plantD + 0.4), mats.concreteMat);
      plantPlinth.position.set(-3.4, -1.05, -3.2);
      pGrp.add(plantPlinth);

      const plantBody = new T.Mesh(new T.BoxGeometry(plantW, plantH, plantD), mats.concreteMat);
      plantBody.position.set(-3.4, plantH * 0.5, -3.2);
      plantBody.castShadow = true;
      pGrp.add(plantBody);

      // Sloped concrete buttress pilasters along front & sides (`flight.jpg`!)
      for (let k = -2; k <= 2; k++) {
        const pil = new T.Mesh(new T.BoxGeometry(0.32, plantH + 0.12, 0.38), mats.concreteMat);
        pil.position.set(-3.4 + k * 1.32, plantH * 0.5, -3.2 + plantD * 0.5 + 0.12);
        pil.rotation.x = -0.05;
        pGrp.add(pil);
      }

      // Front circular fan louver grilles + rooftop shrouded cooling-tower fans
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
        // npSpinFans rotates around .y in night-post, so put rooftop horizontal fan rotors into npSpinFans
        pGrp.add(hub);

        // Rooftop shrouded cooling fan (`flight.jpg`!)
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

      // Parabolic satellite dish & steel lattice microwave mast behind fence (`village.jpg` upper right!)
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

      // Chain-link perimeter security fence on steel posts (`village.jpg`!)
      const fenceSegs = [
        [-6.8, -0.75, 4.4, 0],
        [-6.8, -3.2,  5.0, Math.PI * 0.5]
      ];
      for (const [fx, fz, flen, fyaw] of fenceSegs) {
        const fPanel = new T.Mesh(new T.PlaneGeometry(flen, 2.15), mats.chainLinkMat);
        fPanel.position.set(fx + (fyaw === 0 ? flen * 0.5 : 0), 1.08, fz - (fyaw !== 0 ? 0 : 0));
        fPanel.rotation.y = fyaw;
        pGrp.add(fPanel);
        const nP = Math.round(flen / 1.5);
        for (let k = 0; k <= nP; k++) {
          const post = new T.Mesh(new T.CylinderGeometry(0.032, 0.036, 2.35, 6), mats.steelMat);
          const off = (k / nP) * flen;
          post.position.set(
            fx + (fyaw === 0 ? off : 0),
            1.15,
            fz + (fyaw !== 0 ? (off - flen * 0.5) : 0)
          );
          pGrp.add(post);
        }
      }

      // Circular Corrugated-Steel Cyan Cooling Reservoir (`flight.jpg` lower right!)
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

      // 2b. Registry House & Diamond Wire-Glass Clerk Window (`window.jpg`!)
      // Positioned so Tess (-773.3, -31.8) stands cleanly inside behind the counter!
      const regX = 2.45, regZ = -2.35;
      const regPlinth = new T.Mesh(new T.BoxGeometry(4.4, 2.0, 3.6), mats.stoneMat);
      regPlinth.position.set(regX, -0.95, regZ);
      pGrp.add(regPlinth);

      // Back wall, side walls & roof (hollow front window bay so you actually see Tess & cooling racks inside!)
      const regBack = new T.Mesh(new T.BoxGeometry(4.2, 3.05, 0.28), mats.concreteMat);
      regBack.position.set(regX, 1.52, regZ - 1.55);
      pGrp.add(regBack);
      for (const sx of [-1, 1]) {
        const regSide = new T.Mesh(new T.BoxGeometry(0.28, 3.05, 3.3), mats.concreteMat);
        regSide.position.set(regX + sx * 1.96, 1.52, regZ);
        pGrp.add(regSide);
      }
      const regLowerFront = new T.Mesh(new T.BoxGeometry(4.2, 1.02, 0.28), mats.concreteMat);
      regLowerFront.position.set(regX, 0.51, regZ + 1.55);
      pGrp.add(regLowerFront);
      const regHeader = new T.Mesh(new T.BoxGeometry(4.2, 0.55, 0.28), mats.concreteMat);
      regHeader.position.set(regX, 2.78, regZ + 1.55);
      pGrp.add(regHeader);
      const regRoof = makeGableRoof(T, mats, 4.2, 0.78, 3.4, false);
      regRoof.position.set(regX, 3.05, regZ);
      pGrp.add(regRoof);

      // Interior server racks + glowing cyan copper/steel cooling pipes visible BEHIND Tess (`window.jpg`!)
      for (const rx of [regX - 0.95, regX + 0.95]) {
        const rack = new T.Mesh(new T.BoxGeometry(1.15, 2.35, 0.45), mats.ironDarkMat);
        rack.position.set(rx, 1.25, regZ - 1.15);
        pGrp.add(rack);
        const cyanStrip = new T.Mesh(new T.BoxGeometry(0.08, 1.95, 0.48), mats.cyanInteriorMat);
        cyanStrip.position.set(rx - 0.52, 1.25, regZ - 1.12);
        pGrp.add(cyanStrip);
      }
      for (let p = 0; p < 4; p++) {
        const pipe = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 2.4, 8), p % 2 ? mats.copperPipeMat : cyanWaterMat);
        pipe.position.set(regX - 0.25 + p * 0.16, 1.35, regZ - 0.92);
        pGrp.add(pipe);
      }

      // Chipped-paint service counter + Ration Ledger + Stamp + Sample Cup (`window.jpg`!)
      const counter = new T.Mesh(new T.BoxGeometry(2.85, 0.085, 0.68), mats.counterChipMat);
      counter.position.set(regX, 1.04, regZ + 1.58);
      pGrp.add(counter);
      const ledger = new T.Mesh(new T.BoxGeometry(0.36, 0.048, 0.28), new T.MeshStandardMaterial({ color: 0x4b3f32, roughness: 0.86 }));
      ledger.position.set(regX + 0.26, 1.105, regZ + 1.54);
      ledger.rotation.y = 0.18;
      pGrp.add(ledger);
      const receipt = new T.Mesh(new T.PlaneGeometry(0.18, 0.24), new T.MeshStandardMaterial({ color: 0xebe6d8, roughness: 0.9, side: T.DoubleSide }));
      receipt.rotation.x = -Math.PI * 0.5;
      receipt.rotation.z = -0.35;
      receipt.position.set(regX - 0.34, 1.088, regZ + 1.62);
      pGrp.add(receipt);
      const sampleCup = new T.Mesh(new T.CylinderGeometry(0.042, 0.034, 0.09, 14), new T.MeshStandardMaterial({ color: 0xdcd7cb, roughness: 0.45 }));
      sampleCup.position.set(regX - 0.04, 1.128, regZ + 1.60);
      pGrp.add(sampleCup);

      // Steel-mullioned Georgian diamond wire-glass window with pass-through slot at bottom (`window.jpg`!)
      const winW = 2.65, winH = 1.28, winY = 1.84, winZ = regZ + 1.56;
      const wgPane = new T.Mesh(new T.PlaneGeometry(winW, winH), mats.wireGlassMat);
      wgPane.position.set(regX, winY, winZ);
      pGrp.add(wgPane);
      for (const mx of [-winW * 0.5, -winW * 0.17, winW * 0.17, winW * 0.5]) {
        const mul = new T.Mesh(new T.BoxGeometry(0.042, winH + 0.22, 0.055), mats.ironDarkMat);
        mul.position.set(regX + mx, winY - 0.08, winZ);
        pGrp.add(mul);
      }
      for (const my of [winY - winH * 0.5, winY + winH * 0.5]) {
        const bar = new T.Mesh(new T.BoxGeometry(winW + 0.08, 0.045, 0.06), mats.ironDarkMat);
        bar.position.set(regX, my, winZ);
        pGrp.add(bar);
      }

      // Wooden witness chair outside Registry window
      const wChair = makeWoodenChair(T, mats);
      wChair.position.set(1.15, 0, 0.55);
      wChair.rotation.y = -0.4;
      pGrp.add(wChair);

      // 2c. Foreground 3-Branch Intake Box & Snaking Black + Glowing-Cyan Manifold Hoses (`village.jpg` foreground!)
      const intakeBox = new T.Mesh(new T.BoxGeometry(0.92, 0.66, 0.68), mats.steelMat);
      intakeBox.position.set(1.85, 0.34, 2.35);
      intakeBox.rotation.y = -0.35;
      pGrp.add(intakeBox);

      // Public stone slab + stainless tin mug catching a live cyan stream (`village.jpg` bottom left!)
      const tapStone = new T.Mesh(new T.BoxGeometry(0.95, 0.22, 0.78), mats.stoneMat);
      tapStone.position.set(-1.35, 0.11, 3.25);
      pGrp.add(tapStone);
      const tinMug = new T.Mesh(new T.CylinderGeometry(0.068, 0.064, 0.15, 16), mats.steelMat);
      tinMug.position.set(-1.32, 0.295, 3.28);
      pGrp.add(tinMug);

      // Glowing cyan root-pit in foreground mud (`village.jpg` bottom center!)
      const rootPit = new T.Mesh(new T.CircleGeometry(0.68, 18), cyanWaterMat);
      rootPit.rotation.x = -Math.PI * 0.5;
      rootPit.position.set(0.35, 0.05, 3.15);
      pGrp.add(rootPit);

      // 6 intertwining black rubber & glowing-cyan splitter hoses with flanged couplings
      const hosePaths = [
        // Cyan intake from pump box into root pit
        { mat: cyanWaterMat, r: 0.036, pts: [[1.42, 0.26, 2.42], [0.92, 0.12, 2.78], [0.45, 0.08, 3.08]] },
        // Black manifold trunk to cooling reservoir
        { mat: mats.rubberHoseMat, r: 0.052, pts: [[1.38, 0.32, 2.18], [0.10, 0.14, 1.65], [-2.4, 0.09, 1.85], [-4.55, 0.42, 2.25]] },
        // Secondary cyan cooling return line
        { mat: cyanWaterMat, r: 0.040, pts: [[-4.48, 0.62, 2.05], [-2.8, 0.11, 1.15], [-3.4, 0.48, -1.05]] },
        // Branch 2 hose snaking over stones to public tin mug + cyan pour arc!
        { mat: mats.rubberHoseMat, r: 0.034, pts: [[0.55, 0.18, 2.15], [-0.35, 0.22, 2.65], [-1.08, 0.38, 3.18]] },
        { mat: cyanWaterMat, r: 0.020, pts: [[-1.08, 0.38, 3.18], [-1.22, 0.40, 3.24], [-1.32, 0.34, 3.28]] },
        // Cross-looping pressure hose (`village.jpg`!)
        { mat: mats.rubberHoseMat, r: 0.044, pts: [[1.55, 0.22, 2.02], [0.65, 0.36, 1.55], [-0.45, 0.10, 2.15], [0.18, 0.14, 2.95]] }
      ];
      for (const hp of hosePaths) {
        const crv = new T.CatmullRomCurve3(hp.pts.map(p => new T.Vector3(p[0], p[1], p[2])));
        pGrp.add(new T.Mesh(new T.TubeGeometry(crv, 20, hp.r, 8, false), hp.mat));
      }
      // Flanged iron valve couplings at manifold junction
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
       3. COTTONWOOD OXBOW LIVING FILM GROVE, GNARLED ROOT-BOWL,
          35MM FILMSTRIP BRANCHES & PEGGED MULTI-SHEET CINEMA (`grove.jpg`!)
       ========================================================================= */
    {
      const oxX = -510.0, oxZ = 96.0, oxY = groundAt(oxX, oxZ);
      const oxGrp = new T.Group();
      oxGrp.position.set(oxX, oxY, oxZ);
      oxGrp.rotation.y = 0.45;

      // 3a. Ancient Gnarled Cottonwood Trunk + Flared Buttress Roots + Hollowed Cyan Root-Bowl (`grove.jpg` left!)
      // Positioned in oxGrp so world-space root-bowl sits right beside Makeda (-511.6, 98.0)!
      const treeX = -2.85, treeZ = 1.65;
      const trunkPts = [
        new T.Vector3(treeX, -0.3, treeZ + 0.15),
        new T.Vector3(treeX - 0.08, 1.4, treeZ + 0.05),
        new T.Vector3(treeX + 0.06, 3.4, treeZ - 0.08),
        new T.Vector3(treeX - 0.12, 6.2, treeZ - 0.18)
      ];
      const trunkGeo = new T.TubeGeometry(new T.CatmullRomCurve3(trunkPts), 18, 0.56, 12, false);
      // Taper trunk upward + bark furrow relief
      const tp = trunkGeo.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const vx = tp.getX(i) - treeX, vy = tp.getY(i), vz = tp.getZ(i) - treeZ;
        const flare = vy < 1.2 ? (1 + (1.2 - vy) * 0.52) : Math.max(0.45, 1 - (vy - 1.2) * 0.09);
        const furrow = 1 + 0.08 * Math.sin(Math.atan2(vx, vz) * 9 + vy * 2.5);
        tp.setXYZ(i, treeX + vx * flare * furrow, vy, treeZ + vz * flare * furrow);
      }
      trunkGeo.computeVertexNormals();
      oxGrp.add(new T.Mesh(trunkGeo, mats.barkMat));

      // 5 organic spreading buttress roots framing the hollowed root-bowl
      for (let r = 0; r < 5; r++) {
        const ang = -0.65 + r * 0.58;
        const rCrv = new T.CatmullRomCurve3([
          new T.Vector3(treeX + Math.cos(ang) * 0.42, 0.72, treeZ + Math.sin(ang) * 0.42),
          new T.Vector3(treeX + Math.cos(ang) * 1.05, 0.24, treeZ + Math.sin(ang) * 1.05),
          new T.Vector3(treeX + Math.cos(ang) * 1.85, -0.06, treeZ + Math.sin(ang) * 1.85)
        ]);
        oxGrp.add(new T.Mesh(new T.TubeGeometry(rCrv, 10, 0.13, 7, false), mats.barkMat));
      }

      // Carved stone-and-root basin brimming with living cyan water + overflow trickle (`grove.jpg`!)
      const bowlX = treeX + 0.92, bowlZ = treeZ + 0.48;
      const bowlRim = new T.Mesh(new T.TorusGeometry(0.48, 0.11, 10, 20), mats.barkMat);
      bowlRim.rotation.x = Math.PI * 0.5;
      bowlRim.position.set(bowlX, 0.20, bowlZ);
      oxGrp.add(bowlRim);
      const bowlPool = new T.Mesh(new T.CircleGeometry(0.45, 20), cyanWaterMat);
      bowlPool.rotation.x = -Math.PI * 0.5;
      bowlPool.position.set(bowlX, 0.24, bowlZ);
      oxGrp.add(bowlPool);
      const bowlLight = new T.PointLight(0x3ce4f5, 1.4, 3.8, 1.8);
      bowlLight.position.set(bowlX, 0.55, bowlZ);
      oxGrp.add(bowlLight);
      const trickle = new T.Mesh(
        new T.TubeGeometry(new T.CatmullRomCurve3([
          new T.Vector3(bowlX + 0.40, 0.22, bowlZ + 0.12),
          new T.Vector3(bowlX + 0.62, 0.08, bowlZ + 0.28),
          new T.Vector3(bowlX + 0.95, 0.03, bowlZ + 0.45)
        ]), 10, 0.032, 6, false),
        cyanWaterMat
      );
      oxGrp.add(trickle);

      // Overhead gnarled limb sprouting translucent glowing-cyan 35mm filmstrip leaves (`grove.jpg` top!)
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

      // 3b. Forest Support Trunks + Clothesline Ropes + Pegged Billowing Linen Cinema Sheets (`grove.jpg` right!)
      for (const [tx, tz] of [[-2.65, 0], [2.65, 0], [-2.65, -1.85], [2.65, -1.85]]) {
        const fTrunk = new T.Mesh(new T.CylinderGeometry(0.18, 0.26, 5.6, 10), mats.barkMat);
        fTrunk.position.set(tx, 2.65, tz);
        oxGrp.add(fTrunk);
      }
      // Top hanging cords + wooden clothespins
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

      const shGeoF = new T.PlaneGeometry(4.5, 2.53, 8, 6);
      oxbowWindBase = Float32Array.from(shGeoF.attributes.position.array);
      oxbowSheetFront = new T.Mesh(shGeoF, cinemaMat);
      oxbowSheetFront.position.set(0, 2.45, 0);
      oxGrp.add(oxbowSheetFront);

      oxbowSheetRear = new T.Mesh(new T.PlaneGeometry(4.5, 2.53, 4, 4), cinemaMat);
      oxbowSheetRear.position.set(0, 2.45, -1.85);
      oxGrp.add(oxbowSheetRear);
      inWorldScreens.push({ id: "oxbow", label: "Cottonwood Oxbow Double Linen Screen", mesh: oxbowSheetFront, w: 4.5, h: 2.53, stand: { x: -504.5, z: 106.5, yaw: 0.48 } });

      // Side draped linen banner (`grove.jpg` middle!) + wooden speaker box + witness chair under Woyzero Almaz!
      const sideSheet = new T.Mesh(new T.PlaneGeometry(1.15, 2.15, 4, 6), mats.laundryLightMat);
      sideSheet.position.set(-2.95, 2.25, -0.55);
      sideSheet.rotation.y = 0.28;
      oxGrp.add(sideSheet);

      const spkBox = new T.Mesh(new T.BoxGeometry(0.62, 0.48, 0.42), mats.timberDark);
      spkBox.position.set(1.35, 0.24, 1.45);
      oxGrp.add(spkBox);

      const frontChair = makeWoodenChair(T, mats);
      // Matches old_bride at (-509.8, 98.8) -> local in oxGrp is approx (-1.0, 0, 2.6)
      frontChair.position.set(-1.05, 0, 2.52);
      frontChair.rotation.y = Math.PI;
      oxGrp.add(frontChair);

      worldProps.add(oxGrp);

      // 3c. Oxbow Timber & Corrugated-Tin Tea/Reel Kiosk (-514, 90) — replaces plain BoxGeometry stall!
      const kx = -514, kz = 90, ky = groundAt(kx, kz);
      const kg = new T.Group();
      kg.position.set(kx, ky, kz);
      kg.rotation.y = 1.1;
      const kPlinth = new T.Mesh(new T.BoxGeometry(4.1, 1.4, 2.7), mats.stoneMat);
      kPlinth.position.y = -0.65;
      kg.add(kPlinth);
      const kBody = new T.Mesh(new T.BoxGeometry(3.8, 2.25, 2.4), mats.stoneMat);
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
      if (makeJerikan) {
        for (const [cx, cz, ry] of [[-1.5, 1.4, 0.2], [1.4, 1.3, -0.4]]) {
          const cj = makeJerikan(0.92);
          cj.position.set(cx, 0, cz);
          cj.rotation.y = ry;
          kg.add(cj);
        }
      }
      worldProps.add(kg);
    }

    /* =========================================================================
       4. SNAKE RIVER OVERLOOK SCREEN + SILVER FORD FERRY LANDING + WHALE FLUKE
       ========================================================================= */
    {
      // Overlook Timber Field Screen + Chalk Reserve Slate
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
      // White chalk flood-level rings on ferry post
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

      // Timber ferry landing stage planks at (-250.5, -53.5)
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
      const ovenBase = new T.Mesh(new T.BoxGeometry(1.55, 0.85, 1.45), mats.stoneMat);
      ovenBase.position.set(-1.3, 0.42, -0.6);
      swGrp.add(ovenBase);
      const ovenDome = new T.Mesh(new T.SphereGeometry(0.68, 16, 12, 0, TAU, 0, Math.PI * 0.52), mats.plasterMat);
      ovenDome.position.set(-1.3, 0.84, -0.6);
      swGrp.add(ovenDome);
      const tackBench = new T.Mesh(new T.BoxGeometry(1.85, 0.78, 0.72), mats.timberMat);
      tackBench.position.set(1.15, 0.39, 0.2);
      swGrp.add(tackBench);
      worldProps.add(swGrp);

      // Half Dome East Apron Seep Pump + Teton High Cairn
      const apY = groundAt(438, 34);
      const seepPump = new T.Mesh(new T.CylinderGeometry(0.11, 0.15, 1.18, 12), mats.ironDarkMat);
      seepPump.position.set(438, apY + 0.58, 34);
      worldProps.add(seepPump);
      if (mw && mw.tetonRange) {
        const tcY = groundAt(mw.tetonRange.x, mw.tetonRange.z);
        const tcCairn = new T.Mesh(new T.ConeGeometry(0.88, 1.65, 8), mats.stoneMat);
        tcCairn.position.set(mw.tetonRange.x, tcY + 0.8, mw.tetonRange.z);
        worldProps.add(tcCairn);
      }
    }

    /* =========================================================================
       5. AHIYA HIGHLANDS NIGHT ROUTE SETS (`convoy.jpg` & `desk.jpg`!)
          (Built when hasNightPostSets = true — zero primitive stick figures!)
       ========================================================================= */
    if (hasNightPostSets) {
      // 5a. Basalt Column Pump & Gauge-Thread Trough (-1460, 760)
      const by = groundAt(-1460, 760);
      const bGrp = new T.Group();
      bGrp.position.set(-1460, by, 760);
      for (let i = 0; i < 8; i++) {
        const colH = 1.15 + (i % 3) * 0.55;
        const col = new T.Mesh(new T.CylinderGeometry(0.46, 0.50, colH, 6), mats.stoneMat);
        col.position.set(Math.cos(i * 0.78) * 3.9, colH * 0.45, Math.sin(i * 0.78) * 3.9);
        bGrp.add(col);
      }
      const bPump = new T.Mesh(new T.CylinderGeometry(0.13, 0.17, 1.28, 12), mats.ironDarkMat);
      bPump.position.set(0, 0.64, 0);
      bGrp.add(bPump);
      const bThread = new T.Mesh(new T.TorusGeometry(0.155, 0.016, 6, 18), new T.MeshBasicMaterial({ color: 0xff5a5a }));
      bThread.rotation.x = Math.PI * 0.5;
      bThread.position.set(0, 0.84, 0);
      bGrp.add(bThread);
      const bTrough = new T.Mesh(new T.BoxGeometry(2.2, 0.42, 0.92), mats.stoneMat);
      bTrough.position.set(1.65, 0.21, 0.62);
      bGrp.add(bTrough);
      const bWater = new T.Mesh(new T.PlaneGeometry(1.92, 0.70), cyanWaterMat);
      bWater.rotation.x = -Math.PI * 0.5;
      bWater.position.set(1.65, 0.43, 0.62);
      bGrp.add(bWater);
      worldProps.add(bGrp);

      // 5b. Cross-Beacon Congregation Masonry Wall + White Sky Beam (-1610, 590)
      const bcy = groundAt(-1610, 590);
      const bcGrp = new T.Group();
      bcGrp.position.set(-1610, bcy, 590);
      const congWall = new T.Mesh(new T.BoxGeometry(9.2, 4.6, 1.25), mats.stoneMat);
      congWall.position.y = 2.2;
      bcGrp.add(congWall);
      const crossMast = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 4.6, 8), mats.steelMat);
      crossMast.position.set(0, 6.2, 0);
      bcGrp.add(crossMast);
      const crossBar = new T.Mesh(new T.BoxGeometry(2.4, 0.12, 0.12), mats.steelMat);
      crossBar.position.set(0, 7.35, 0);
      bcGrp.add(crossBar);
      const whiteBeam = new T.Mesh(
        new T.CylinderGeometry(1.05, 0.28, 56, 12, 1, true),
        new T.MeshBasicMaterial({ color: 0xf6f9ff, transparent: true, opacity: 0.30, side: T.DoubleSide, depthWrite: false })
      );
      whiteBeam.position.set(0, 35, 0);
      bcGrp.add(whiteBeam);
      const auntChair = makeWoodenChair(T, mats);
      auntChair.position.set(-2.9, 0, 2.0);
      bcGrp.add(auntChair);
      worldProps.add(bcGrp);

      // 5c. Hill Archive `REC PPC` Office Cubicle & Observation Window (-1765, 540 — exact `desk.jpg`!)
      // Positioned so ppc_op_male (-1765.85, 541.55) & ppc_op_female (-1764.15, 541.55) sit at the desk facing the wall monitor!
      const hy = groundAt(-1765, 540);
      const hGrp = new T.Group();
      hGrp.position.set(-1765, hy, 540);

      // Concrete bunker shell with wide open observation bay on +Z
      const hPlinth = new T.Mesh(new T.BoxGeometry(7.8, 2.0, 5.6), mats.concreteMat);
      hPlinth.position.y = -0.95;
      hGrp.add(hPlinth);
      const hRoof = new T.Mesh(new T.BoxGeometry(8.0, 0.32, 5.8), mats.concreteMat);
      hRoof.position.y = 3.55;
      hGrp.add(hRoof);
      for (const sx of [-1, 1]) {
        const sideW = new T.Mesh(new T.BoxGeometry(0.35, 3.5, 5.4), mats.concreteMat);
        sideW.position.set(sx * 3.72, 1.75, 0);
        hGrp.add(sideW);
        // Rooftop cooling fans
        const hFan = new T.Group();
        hFan.position.set(sx * 2.3, 3.82, 0);
        for (let b = 0; b < 3; b++) {
          const bl = new T.Mesh(new T.BoxGeometry(1.15, 0.03, 0.16), beaconCyanMat);
          bl.rotation.y = (b * Math.PI) / 3;
          hFan.add(bl);
        }
        hGrp.add(hFan);
        npSpinFans.push(hFan);
      }

      // Acoustic cubicle partition wall at z = -0.15 (`desk.jpg` background panels!)
      const cubWall = new T.Mesh(new T.BoxGeometry(6.8, 3.2, 0.14), mats.officePanelMat);
      cubWall.position.set(0, 1.60, -0.15);
      hGrp.add(cubWall);
      for (const px of [-2.2, 0, 2.2]) {
        const seam = new T.Mesh(new T.BoxGeometry(0.035, 3.2, 0.16), mats.steelMat);
        seam.position.set(px, 1.60, -0.15);
        hGrp.add(seam);
      }

      // Large wall-mounted `REC PPC` Widescreen Monitor (`desk.jpg` center!)
      const bezel = new T.Mesh(new T.BoxGeometry(2.42, 1.40, 0.08), mats.ironDarkMat);
      bezel.position.set(0, 1.78, 0.02);
      hGrp.add(bezel);
      const archMon = new T.Mesh(new T.PlaneGeometry(2.28, 1.28), cinemaMat);
      archMon.position.set(0, 1.78, 0.068);
      hGrp.add(archMon);
      inWorldScreens.push({ id: "hill", label: "Hill Archive REC PPC Monitor", mesh: archMon, w: 2.28, h: 1.28, stand: { x: -1765.0, z: 547.5, yaw: 0.00 } });

      // Wide gray steel operator desk at z = +0.92 + laptop + clipboards + VHF radio + gooseneck lamps (`desk.jpg`!)
      const deskTop = new T.Mesh(new T.BoxGeometry(2.85, 0.055, 1.05), mats.officeDeskMat);
      deskTop.position.set(0, 0.76, 0.92);
      hGrp.add(deskTop);
      for (const lx of [-1.32, 1.32]) {
        for (const lz of [0.48, 1.34]) {
          const dLeg = new T.Mesh(new T.BoxGeometry(0.055, 0.76, 0.055), mats.steelMat);
          dLeg.position.set(lx, 0.38, lz);
          hGrp.add(dLeg);
        }
      }
      // Open laptop in center of desk (`desk.jpg`!)
      const lapBase = new T.Mesh(new T.BoxGeometry(0.36, 0.015, 0.25), mats.ironDarkMat);
      lapBase.position.set(0.06, 0.795, 0.86);
      hGrp.add(lapBase);
      const lapScr = new T.Mesh(new T.BoxGeometry(0.36, 0.23, 0.012), mats.cyanInteriorMat);
      lapScr.position.set(0.06, 0.90, 0.73);
      lapScr.rotation.x = -0.22;
      hGrp.add(lapScr);
      // Handheld VHF dispatch radio with whip antenna on right
      const radio = new T.Mesh(new T.BoxGeometry(0.065, 0.14, 0.045), mats.ironDarkMat);
      radio.position.set(0.68, 0.86, 0.78);
      hGrp.add(radio);
      const rAnt = new T.Mesh(new T.CylinderGeometry(0.005, 0.007, 0.18, 6), mats.ironDarkMat);
      rAnt.position.set(0.69, 1.01, 0.78);
      hGrp.add(rAnt);
      // Two warm gooseneck desk lamps + interior light illuminating operators & monitor cubicle
      for (const sx of [-1.05, 1.05]) {
        const shade = new T.Mesh(new T.ConeGeometry(0.11, 0.14, 12, 1, true), mats.ironDarkMat);
        shade.position.set(sx, 1.32, 0.65);
        shade.rotation.z = sx * 0.25;
        hGrp.add(shade);
        const clip = new T.Mesh(new T.BoxGeometry(0.28, 0.012, 0.36), mats.laundryLightMat);
        clip.position.set(sx * 0.68, 0.795, 1.05);
        clip.rotation.y = -sx * 0.2;
        hGrp.add(clip);
      }
      const deskLampLight = new T.PointLight(0xfff0d4, 1.45, 5.2, 1.6);
      deskLampLight.position.set(0, 2.25, 1.15);
      hGrp.add(deskLampLight);

      // Two ergonomic task chairs under ppc_op_male (-0.85, 1.55) & ppc_op_female (+0.85, 1.55)
      for (const cx of [-0.85, 0.85]) {
        const ch = makeWoodenChair(T, mats);
        ch.position.set(cx, 0, 1.60);
        ch.rotation.y = cx < 0 ? -0.35 : 0.35;
        hGrp.add(ch);
      }
      worldProps.add(hGrp);

      // 5d. Daylight Compound Terraced Courtyard, Pegged Sheet & Clay Tap (-1680, 775)
      const cy = groundAt(-1680, 775);
      const cGrp = new T.Group();
      cGrp.position.set(-1680, cy, 775);
      for (const [wx, wz, ww, wd] of [[-4.8, 0, 0.55, 8.2], [4.8, 0, 0.55, 8.2], [0, -4.2, 9.8, 0.55]]) {
        const wM = new T.Mesh(new T.BoxGeometry(ww, 2.55, wd), mats.stoneMat);
        wM.position.set(wx, 1.25, wz);
        cGrp.add(wM);
      }
      const cSheet = new T.Mesh(new T.PlaneGeometry(4.6, 2.59), cinemaMat);
      cSheet.position.set(0, 2.2, -3.7);
      cGrp.add(cSheet);
      inWorldScreens.push({ id: "compound", label: "Daylight Compound Pegged Sheet", mesh: cSheet, w: 4.6, h: 2.59, stand: { x: -1679.0, z: 783.5, yaw: 0.09 } });
      const cTap = new T.Mesh(new T.CylinderGeometry(0.44, 0.34, 0.28, 16), mats.plasterMat);
      cTap.position.set(2.2, 0.14, 1.5);
      cGrp.add(cTap);
      const cPool = new T.Mesh(new T.CircleGeometry(0.38, 16), cyanWaterMat);
      cPool.rotation.x = -Math.PI * 0.5;
      cPool.position.set(2.2, 0.29, 1.5);
      cGrp.add(cPool);
      const cChair = makeWoodenChair(T, mats);
      cChair.position.set(-1.6, 0, -0.5);
      cGrp.add(cChair);
      worldProps.add(cGrp);
    }

    function updateArchitecture(nowSec) {
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
      updateArchitecture
    };
  }

  if (typeof window !== "undefined") {
    window.buildWorldArchitecture = buildWorldArchitecture;
  }
})();
