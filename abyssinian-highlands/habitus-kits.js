/* ABYSSINIAN HIGHLANDS · Procedural Habitus Kits, Vehicles, Bilingual Ge'ez Signage & Monumental Totems
 * Built directly from the 4 orthographic production sheets in `./sheets/`:
 *   1. `transect_map.jpg`        — 4-Zone GTA Transect, Orbital Field Geometries & Vertical Totems
 *   2. `buna_threshold.jpg`      — Jebena, Rekebot/Sini, Midija/Girgira, Menkeshkesh/Mukecha, Mesob/Ensera, 3-State Jerrycan & Dejaf Plan
 *   3. `street_transit.jpg`      — Line Taxi HiAce, Sky-Blue Bajaj, Isuzu FSR Escarpment Truck, Eucalyptus Utility Pole & Kiosk
 *   4. `decal_signage_atlas.jpg` — ERA Bilingual Ge'ez/Latin Signs, STOP, Tin Buna Sign, Telebirr/Telecom Kiosks, Ambo/PET/20L Jugs
 * Exposes `window.AbyssinianKits`.
 */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  let kitCache = null;

  function makeCanvasTex(T, w, h, drawFn, repeatX = 1, repeatY = 1) {
    const cnv = document.createElement("canvas");
    cnv.width = w;
    cnv.height = h;
    const ctx = cnv.getContext("2d");
    drawFn(ctx, w, h);
    const tex = new T.CanvasTexture(cnv);
    if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    if (repeatX > 1 || repeatY > 1) {
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
    }
    tex.needsUpdate = true;
    return tex;
  }

  function getMaterials(T) {
    if (kitCache) return kitCache;

    // Dry-stone basalt & chika mud-mortar masonry
    const stoneTex = makeCanvasTex(T, 256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#6c675e";
      ctx.fillRect(0, 0, w, h);
      const rows = 9;
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
        const cols = 5 + (r % 2);
        const cw = w / cols;
        const off = (r % 2) * cw * 0.45;
        for (let c = -1; c <= cols; c++) {
          const shade = 72 + ((r * 37 + c * 53) % 48);
          ctx.fillStyle = `rgb(${shade + 6},${shade + 2},${shade - 4})`;
          ctx.beginPath();
          ctx.roundRect(off + c * cw + 2.5, r * rh + 2.5, cw - 5, rh - 5, 4);
          ctx.fill();
        }
      }
    }, 2, 2);

    // Corrugated galvanized sheet metal
    const corrTex = makeCanvasTex(T, 128, 128, (ctx, w, h) => {
      for (let x = 0; x < w; x++) {
        const v = Math.round(138 + 38 * Math.sin((x / w) * TAU * 16));
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
        ctx.fillRect(x, 0, 1, h);
      }
      ctx.fillStyle = "rgba(110,72,45,0.18)";
      ctx.fillRect(0, 88, w, 40);
    }, 2, 1);

    // Woven mesob / straw matot texture
    const weaveTex = makeCanvasTex(T, 128, 128, (ctx, w, h) => {
      const bands = ["#9a845e", "#3b5848", "#8b3e32", "#c8b282", "#35495e"];
      for (let y = 0; y < h; y += 4) {
        ctx.fillStyle = bands[Math.floor(y / 16) % bands.length];
        ctx.fillRect(0, y, w, 3);
        ctx.fillStyle = "rgba(25,20,15,0.28)";
        ctx.fillRect(0, y + 3, w, 1);
      }
    }, 2, 2);

    // 1. ERA Bilingual Royal-Blue Highway Sign (`ባሕር ዳር / BAHIR DAR`, `አባይ / ABAY GORGE`)
    const eraSignTex = makeCanvasTex(T, 512, 256, (ctx, w, h) => {
      ctx.fillStyle = "#164694";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#f5f6f2";
      ctx.lineWidth = 10;
      ctx.strokeRect(12, 12, w - 24, h - 24);
      ctx.fillStyle = "#f5f6f2";
      ctx.font = "700 40px system-ui, sans-serif";
      ctx.fillText("ባሕር ዳር", 34, 72);
      ctx.font = "700 32px Inter, system-ui, sans-serif";
      ctx.fillText("BAHIR DAR", 34, 112);
      ctx.font = "700 40px system-ui, sans-serif";
      ctx.fillText("አባይ", 34, 174);
      ctx.font = "700 32px Inter, system-ui, sans-serif";
      ctx.fillText("ABAY GORGE", 34, 214);
      // Right white directional arrow
      ctx.beginPath();
      ctx.moveTo(356, 116); ctx.lineTo(430, 116); ctx.lineTo(430, 88);
      ctx.lineTo(476, 130); ctx.lineTo(430, 172); ctx.lineTo(430, 144);
      ctx.lineTo(356, 144); ctx.closePath();
      ctx.fill();
    });

    // 2. Bilingual Octagonal `ቆም / STOP` Sign
    const stopSignTex = makeCanvasTex(T, 256, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        pts.push([128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118]);
      }
      ctx.fillStyle = "#f6f5f0";
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#b82222";
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = 128 + (p[0] - 128) * 0.90, y = 128 + (p[1] - 128) * 0.90;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f6f5f0";
      ctx.textAlign = "center";
      ctx.font = "700 58px system-ui, sans-serif";
      ctx.fillText("ቆም", 128, 112);
      ctx.font = "800 52px Inter, system-ui, sans-serif";
      ctx.fillText("STOP", 128, 178);
    });

    // 3. Hand-Painted Weathered Corrugated-Tin `ቡና / SHOP / 0911-00-00` Plaque
    const bunaSignTex = makeCanvasTex(T, 512, 256, (ctx, w, h) => {
      for (let x = 0; x < w; x++) {
        const g = Math.round(182 + 26 * Math.sin((x / w) * TAU * 18));
        ctx.fillStyle = `rgb(${g},${g - 3},${g - 8})`;
        ctx.fillRect(x, 0, 1, h);
      }
      // Rust border patina
      ctx.strokeStyle = "rgba(112, 58, 32, 0.72)";
      ctx.lineWidth = 14;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      // Painted brown Jebena icon on left
      ctx.fillStyle = "#6e3e22";
      ctx.beginPath(); ctx.arc(118, 162, 46, 0, TAU); ctx.fill();
      ctx.fillRect(106, 76, 24, 52);
      ctx.strokeStyle = "#4d2a16"; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(146, 128, 24, -1.2, 1.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(86, 148); ctx.lineTo(48, 108); ctx.stroke();
      // Steam wisps
      ctx.strokeStyle = "#2b2622"; ctx.lineWidth = 4;
      for (const sx of [104, 122]) {
        ctx.beginPath(); ctx.moveTo(sx, 66); ctx.quadraticCurveTo(sx - 8, 48, sx + 4, 32); ctx.stroke();
      }
      ctx.fillStyle = "#24211e";
      ctx.textAlign = "center";
      ctx.font = "800 58px system-ui, sans-serif";
      ctx.fillText("ቡና", 336, 94);
      ctx.font = "800 48px Inter, system-ui, sans-serif";
      ctx.fillText("SHOP", 336, 152);
      ctx.font = "700 34px ui-monospace, Menlo, monospace";
      ctx.fillText("0911-00-00", 336, 206);
    });

    // 4. Lime-Green Telebirr-Style Mobile-Money Booth Front Panel
    const telebirrTex = makeCanvasTex(T, 256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#7ec238";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#f7f8f2";
      ctx.lineWidth = 12;
      for (const dy of [0, 24, 48]) {
        ctx.beginPath();
        ctx.moveTo(0, 168 + dy);
        ctx.bezierCurveTo(85, 206 + dy, 170, 128 + dy, 256, 172 + dy);
        ctx.stroke();
      }
      ctx.fillStyle = "#0e3b68";
      ctx.font = "800 22px Inter, sans-serif";
      ctx.fillText("TELEBIRR · ቴሌብር", 22, 32);
    });

    // 5. Emerald Safaricom-Style Telecom Booth Front Panel
    const telecomEmeraldTex = makeCanvasTex(T, 256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#148c4a";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#f4f7f4";
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 146, w, 30);
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 146); ctx.lineTo(x + 12, 161); ctx.lineTo(x, 176);
        ctx.moveTo(x + 24, 146); ctx.lineTo(x + 12, 161); ctx.lineTo(x + 24, 176);
        ctx.stroke();
      }
      ctx.fillStyle = "#f4f7f4";
      ctx.font = "800 20px Inter, sans-serif";
      ctx.fillText("ሳፋሪኮም · 5G DATA", 22, 32);
    });

    kitCache = {
      stoneMat: new T.MeshStandardMaterial({ map: stoneTex, bumpMap: stoneTex, bumpScale: 0.04, roughness: 0.92 }),
      tuffMat: new T.MeshStandardMaterial({ color: 0x7b5646, bumpMap: stoneTex, bumpScale: 0.05, roughness: 0.94 }),
      plasterMat: new T.MeshStandardMaterial({ color: 0xc9c0b0, roughness: 0.88 }),
      corrMat: new T.MeshStandardMaterial({ map: corrTex, bumpMap: corrTex, bumpScale: 0.025, roughness: 0.55, metalness: 0.42 }),
      timberMat: new T.MeshStandardMaterial({ color: 0x5d4936, roughness: 0.88 }),
      eucalyptusMat: new T.MeshStandardMaterial({ color: 0x8a867c, roughness: 0.86 }),
      jebenaClayMat: new T.MeshStandardMaterial({ color: 0x1c1816, roughness: 0.36, metalness: 0.08 }),
      terracottaMat: new T.MeshStandardMaterial({ color: 0x92583c, roughness: 0.78, side: T.DoubleSide }),
      weaveMat: new T.MeshStandardMaterial({ map: weaveTex, roughness: 0.86 }),
      siniPorcelainMat: new T.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.22 }),
      ironDarkMat: new T.MeshStandardMaterial({ color: 0x222528, roughness: 0.48, metalness: 0.58 }),
      emberMat: new T.MeshStandardMaterial({ color: 0xff6b1a, emissive: 0xff4500, emissiveIntensity: 1.8, roughness: 0.4 }),
      cyanWaterMat: new T.MeshPhysicalMaterial({
        color: 0x28d8f0, emissive: 0x1096b8, emissiveIntensity: 0.85,
        roughness: 0.14, transparent: true, opacity: 0.90
      }),
      coffeeStreamMat: new T.MeshStandardMaterial({ color: 0x241208, roughness: 0.18 }),
      jerikanYellowMat: new T.MeshStandardMaterial({ color: 0xd8a628, roughness: 0.42 }),
      kubetMat: new T.MeshStandardMaterial({ color: 0x4b3f30, roughness: 0.96 }),
      kettamaMat: new T.MeshStandardMaterial({ color: 0x4f7338, roughness: 0.82, side: T.DoubleSide }),
      hiaceBlueMat: new T.MeshStandardMaterial({ color: 0x2674b8, roughness: 0.34, metalness: 0.18 }),
      hiaceWhiteMat: new T.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.36, metalness: 0.12 }),
      bajajBlueMat: new T.MeshStandardMaterial({ color: 0x2b8cd4, roughness: 0.38, metalness: 0.16 }),
      canvasTopMat: new T.MeshStandardMaterial({ color: 0x44423c, roughness: 0.90 }),
      glassDarkMat: new T.MeshStandardMaterial({ color: 0x18242c, roughness: 0.14, metalness: 0.35 }),
      tireMat: new T.MeshStandardMaterial({ color: 0x191a1b, roughness: 0.86 }),
      sackMat: new T.MeshStandardMaterial({ color: 0xb6a27e, roughness: 0.92 }),
      mastRedMat: new T.MeshStandardMaterial({ color: 0xb83228, roughness: 0.52, metalness: 0.45 }),
      mastWhiteMat: new T.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.52, metalness: 0.35 }),
      concreteMat: new T.MeshStandardMaterial({ color: 0x8d918e, roughness: 0.84 }),
      amboGlassMat: new T.MeshPhysicalMaterial({ color: 0x3b7a4a, roughness: 0.12, transmission: 0.55, transparent: true, opacity: 0.86 }),
      petWaterMat: new T.MeshPhysicalMaterial({ color: 0x8ce2f5, roughness: 0.14, transmission: 0.52, transparent: true, opacity: 0.84 }),
      eraSignMat: new T.MeshStandardMaterial({ map: eraSignTex, roughness: 0.38 }),
      stopSignMat: new T.MeshStandardMaterial({ map: stopSignTex, transparent: true, alphaTest: 0.3, roughness: 0.38, side: T.DoubleSide }),
      bunaSignMat: new T.MeshStandardMaterial({ map: bunaSignTex, roughness: 0.62 }),
      telebirrMat: new T.MeshStandardMaterial({ map: telebirrTex, roughness: 0.45 }),
      telecomEmeraldMat: new T.MeshStandardMaterial({ map: telecomEmeraldTex, roughness: 0.45 })
    };
    return kitCache;
  }

  /* =========================================================================
     SHEET 2: BUNA COFFEE CEREMONY & DEJAF THRESHOLD HABITUS KIT
     Supports live 3-round state transitions: 0 = Abol, 1 = Tona, 2 = Baraka
     ========================================================================= */
  function makeJebenaPot(T, mats) {
    const g = new T.Group();
    // Matot woven straw ring base
    const matot = new T.Mesh(new T.TorusGeometry(0.085, 0.022, 8, 20), mats.weaveMat);
    matot.rotation.x = Math.PI * 0.5;
    matot.position.y = 0.022;
    g.add(matot);

    // Lathe spherical belly + tall slender neck + flared rim (`buna_threshold.jpg` top-left!)
    const prof = [
      new T.Vector2(0.00, 0.03),
      new T.Vector2(0.11, 0.06),
      new T.Vector2(0.135, 0.13),
      new T.Vector2(0.115, 0.21),
      new T.Vector2(0.045, 0.26),
      new T.Vector2(0.036, 0.36),
      new T.Vector2(0.048, 0.41),
      new T.Vector2(0.032, 0.41)
    ];
    const body = new T.Mesh(new T.LatheGeometry(prof, 24), mats.jebenaClayMat);
    body.castShadow = true;
    g.add(body);

    // Signature Ethiopian angled side spout + neck-to-belly loop handle
    const spout = new T.Mesh(
      new T.TubeGeometry(new T.CatmullRomCurve3([
        new T.Vector3(0.09, 0.16, 0),
        new T.Vector3(0.16, 0.24, 0),
        new T.Vector3(0.20, 0.33, 0)
      ]), 10, 0.015, 8, false),
      mats.jebenaClayMat
    );
    g.add(spout);

    const handle = new T.Mesh(
      new T.TubeGeometry(new T.CatmullRomCurve3([
        new T.Vector3(-0.038, 0.37, 0),
        new T.Vector3(-0.13, 0.31, 0),
        new T.Vector3(-0.115, 0.18, 0)
      ]), 12, 0.013, 8, false),
      mats.jebenaClayMat
    );
    g.add(handle);
    return g;
  }

  function makeJerrycanReuseStage(T, mats, stage) {
    // stage 0: intact 20L yellow embossed-X carrier
    // stage 1: top-sliced z=0.25m glowing cyan basin
    // stage 2: half-buried soil & enset/herb seedling planter
    const g = new T.Group();
    if (stage === 0) {
      const body = new T.Mesh(new T.BoxGeometry(0.19, 0.37, 0.27), mats.jerikanYellowMat);
      body.position.y = 0.185;
      body.castShadow = true;
      g.add(body);
      for (const sx of [-1, 1]) for (const rz of [-0.62, 0.62]) {
        const rib = new T.Mesh(new T.BoxGeometry(0.012, 0.24, 0.022), mats.jerikanYellowMat);
        rib.position.set(sx * 0.098, 0.18, 0);
        rib.rotation.x = rz;
        g.add(rib);
      }
      const hdl = new T.Mesh(new T.BoxGeometry(0.036, 0.04, 0.14), mats.jerikanYellowMat);
      hdl.position.set(0, 0.39, -0.02);
      g.add(hdl);
      const cap = new T.Mesh(new T.CylinderGeometry(0.026, 0.028, 0.032, 10), mats.ironDarkMat);
      cap.position.set(0, 0.39, 0.085);
      g.add(cap);
    } else {
      const h = stage === 1 ? 0.22 : 0.17;
      const tub = new T.Mesh(new T.BoxGeometry(0.24, h, 0.30), mats.jerikanYellowMat);
      tub.position.y = h * 0.5;
      tub.castShadow = true;
      g.add(tub);
      if (stage === 1) {
        const water = new T.Mesh(new T.BoxGeometry(0.215, 0.03, 0.275), mats.cyanWaterMat);
        water.position.y = h - 0.025;
        g.add(water);
      } else {
        const soil = new T.Mesh(new T.BoxGeometry(0.215, 0.03, 0.275), mats.kubetMat);
        soil.position.y = h - 0.02;
        g.add(soil);
        for (let i = 0; i < 4; i++) {
          const leaf = new T.Mesh(new T.PlaneGeometry(0.07, 0.24), mats.kettamaMat);
          leaf.position.set(Math.cos(i * 1.57) * 0.03, h + 0.10, Math.sin(i * 1.57) * 0.03);
          leaf.rotation.set(0.32 * Math.sin(i * 1.57), i * 1.57, 0.28);
          g.add(leaf);
        }
      }
    }
    return g;
  }

  function makeBunaThresholdSet(T, opts = {}) {
    const mats = getMaterials(T);
    const g = new T.Group();
    const includeWall = opts.includeWall !== false;

    if (includeWall) {
      // Isometric Dejaf dry-stone doorway corner + timber lintel + south-wall kubet fuel discs!
      const wallLeft = new T.Mesh(new T.BoxGeometry(0.38, 2.55, 2.6), mats.stoneMat);
      wallLeft.position.set(-1.15, 1.275, -0.1);
      wallLeft.castShadow = true; wallLeft.receiveShadow = true;
      g.add(wallLeft);
      const wallSouth = new T.Mesh(new T.BoxGeometry(2.5, 2.55, 0.38), mats.stoneMat);
      wallSouth.position.set(0.15, 1.275, -1.25);
      wallSouth.castShadow = true; wallSouth.receiveShadow = true;
      g.add(wallSouth);
      const lintel = new T.Mesh(new T.BoxGeometry(0.44, 0.16, 1.18), mats.timberMat);
      lintel.position.set(-1.15, 2.05, 0.15);
      g.add(lintel);

      // Sun-facing Kubet dung fuel discs (d=0.22m, t=0.03m) plastered on south wall!
      const kubetCoords = [[-0.35, 1.58], [-0.04, 1.66], [0.28, 1.54], [-0.20, 1.28], [0.14, 1.24], [0.48, 1.38]];
      for (const [kx, ky] of kubetCoords) {
        const disc = new T.Mesh(new T.CylinderGeometry(0.11, 0.115, 0.03, 14), mats.kubetMat);
        disc.rotation.x = Math.PI * 0.5;
        disc.position.set(kx, ky, -1.045);
        g.add(disc);
      }

      // 12-degree leaning Ensera bulbous terracotta water jar + Mesob woven basket table
      const enseraProf = [
        new T.Vector2(0.00, 0.00), new T.Vector2(0.14, 0.05), new T.Vector2(0.24, 0.24),
        new T.Vector2(0.21, 0.44), new T.Vector2(0.11, 0.54), new T.Vector2(0.14, 0.60)
      ];
      const ensera = new T.Mesh(new T.LatheGeometry(enseraProf, 20), mats.terracottaMat);
      ensera.position.set(0.95, 0.02, -0.82);
      ensera.rotation.z = 0.21; // 12° lean against plinth!
      ensera.castShadow = true;
      g.add(ensera);

      const mesobProf = [
        new T.Vector2(0.22, 0.00), new T.Vector2(0.13, 0.24), new T.Vector2(0.25, 0.44),
        new T.Vector2(0.26, 0.48), new T.Vector2(0.04, 0.68), new T.Vector2(0.05, 0.73), new T.Vector2(0.00, 0.74)
      ];
      const mesob = new T.Mesh(new T.LatheGeometry(mesobProf, 22), mats.weaveMat);
      mesob.position.set(-0.62, 0, -0.78);
      mesob.castShadow = true;
      g.add(mesob);
    }

    // Scattered fresh Kettama sedge reeds & yellow Adey Abeba daisies across threshold
    const reedGrp = new T.Group();
    const daisyMat = new T.MeshBasicMaterial({ color: 0xe6be2e });
    for (let i = 0; i < 42; i++) {
      const a = (i * 2.39996) % TAU;
      const r = 0.12 + 0.72 * Math.sqrt((i + 0.5) / 42);
      const blade = new T.Mesh(new T.PlaneGeometry(0.022, 0.34), mats.kettamaMat);
      blade.rotation.x = -Math.PI * 0.5;
      blade.rotation.z = (i * 1.9) % Math.PI;
      blade.position.set(Math.cos(a) * r * 1.15 - 0.1, 0.008 + (i % 3) * 0.002, Math.sin(a) * r * 0.95 + 0.25);
      reedGrp.add(blade);
      if (i % 7 === 0) {
        const flower = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.008, 8), daisyMat);
        flower.position.set(blade.position.x + 0.04, 0.016, blade.position.z);
        reedGrp.add(flower);
      }
    }
    g.add(reedGrp);

    // Midija charcoal brazier + glowing embers + Jebena (animated between resting & 25cm high-arc pour!)
    const midija = new T.Group();
    midija.position.set(0.08, 0, 0.30);
    const stoveBase = new T.Mesh(new T.CylinderGeometry(0.13, 0.10, 0.20, 14), mats.terracottaMat);
    stoveBase.position.y = 0.10;
    midija.add(stoveBase);
    const coals = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.025, 14), mats.emberMat);
    coals.position.y = 0.205;
    midija.add(coals);
    const emberLight = new T.PointLight(0xff7426, 0.95, 2.6, 1.8);
    emberLight.position.y = 0.30;
    midija.add(emberLight);
    g.add(midija);

    const jebena = makeJebenaPot(T, mats);
    jebena.position.set(0.08, 0.21, 0.30);
    g.add(jebena);

    // Rekebot carved wooden serving stand + 8 handleless Sini cups + laminar coffee arc
    const rekebot = new T.Group();
    rekebot.position.set(-0.34, 0, 0.12);
    const tray = new T.Mesh(new T.BoxGeometry(0.44, 0.08, 0.28), mats.timberMat);
    tray.position.y = 0.13;
    tray.castShadow = true;
    rekebot.add(tray);
    for (const lx of [-0.19, 0.19]) for (const lz of [-0.11, 0.11]) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.022, 0.018, 0.09, 8), mats.timberMat);
      leg.position.set(lx, 0.045, lz);
      rekebot.add(leg);
    }
    const cupFills = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        const cx = -0.135 + c * 0.09, cz = -0.055 + r * 0.11;
        const sini = new T.Mesh(new T.CylinderGeometry(0.028, 0.018, 0.044, 12), mats.siniPorcelainMat);
        sini.position.set(cx, 0.192, cz);
        rekebot.add(sini);
        const fill = new T.Mesh(new T.CircleGeometry(0.024, 10), mats.coffeeStreamMat);
        fill.rotation.x = -Math.PI * 0.5;
        fill.position.set(cx, 0.213, cz);
        rekebot.add(fill);
        cupFills.push(fill);
      }
    }
    g.add(rekebot);

    // Unbroken 25cm high-arc laminar coffee stream spline!
    const pourStream = new T.Mesh(
      new T.TubeGeometry(new T.CatmullRomCurve3([
        new T.Vector3(-0.08, 0.54, 0.18),
        new T.Vector3(-0.18, 0.42, 0.17),
        new T.Vector3(-0.245, 0.21, 0.175)
      ]), 14, 0.0055, 6, false),
      mats.coffeeStreamMat
    );
    g.add(pourStream);

    // Girgira stemmed frankincense burner + Menkeshkesh long-handled pan + Mukecha mortar + Barchuma 3-leg stool
    const girgira = new T.Mesh(
      new T.LatheGeometry([new T.Vector2(0.05, 0), new T.Vector2(0.02, 0.09), new T.Vector2(0.065, 0.15), new T.Vector2(0.055, 0.18)], 14),
      mats.terracottaMat
    );
    girgira.position.set(0.36, 0, 0.14);
    g.add(girgira);

    const panMat = new T.MeshStandardMaterial({ color: 0x8f9e84, roughness: 0.55 });
    const panGrp = new T.Group();
    panGrp.position.set(0.34, 0.02, 0.52);
    const panDish = new T.Mesh(new T.CylinderGeometry(0.11, 0.09, 0.028, 16), mats.ironDarkMat);
    panGrp.add(panDish);
    const beans = new T.Mesh(new T.CylinderGeometry(0.092, 0.085, 0.016, 14), panMat);
    beans.position.y = 0.012;
    panGrp.add(beans);
    const panHdl = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.36, 6), mats.ironDarkMat);
    panHdl.rotation.z = Math.PI * 0.46;
    panHdl.position.set(0.25, 0.04, 0);
    panGrp.add(panHdl);
    g.add(panGrp);

    const mukecha = new T.Mesh(
      new T.LatheGeometry([new T.Vector2(0.075, 0), new T.Vector2(0.055, 0.06), new T.Vector2(0.085, 0.22), new T.Vector2(0.065, 0.22)], 14),
      mats.timberMat
    );
    mukecha.position.set(0.62, 0, 0.32);
    g.add(mukecha);
    const pestle = new T.Mesh(new T.CylinderGeometry(0.018, 0.022, 0.30, 8), mats.timberMat);
    pestle.position.set(0.64, 0.22, 0.32);
    pestle.rotation.z = -0.24;
    g.add(pestle);

    // Barchuma 30cm 3-legged stool
    const stool = new T.Group();
    stool.position.set(-0.08, 0, 0.78);
    const seat = new T.Mesh(new T.CylinderGeometry(0.15, 0.14, 0.036, 16), mats.timberMat);
    seat.position.y = 0.285;
    stool.add(seat);
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3;
      const leg = new T.Mesh(new T.CylinderGeometry(0.018, 0.014, 0.29, 8), mats.timberMat);
      leg.position.set(Math.cos(a) * 0.09, 0.14, Math.sin(a) * 0.09);
      leg.rotation.set(Math.sin(a) * 0.16, 0, -Math.cos(a) * 0.16);
      stool.add(leg);
    }
    g.add(stool);

    // Rising smoke wisps (roasting smoke in Abol; laminar frankincense in Tona)
    const smokeMat = new T.MeshBasicMaterial({ color: 0xe8eef2, transparent: true, opacity: 0.36, depthWrite: false });
    const wisps = [];
    for (let i = 0; i < 7; i++) {
      const wM = new T.Mesh(new T.SphereGeometry(0.035 + i * 0.008, 8, 8), smokeMat);
      g.add(wM);
      wisps.push(wM);
    }

    // 3-Stage 20L Jerrycan Reuse trio beside compound threshold!
    if (opts.includeJerrycanLifecycle !== false) {
      for (let st = 0; st < 3; st++) {
        const jc = makeJerrycanReuseStage(T, mats, st);
        jc.position.set(0.95, 0, -0.15 + st * 0.42);
        g.add(jc);
      }
    }

    let currentRound = 0; // 0: Abol, 1: Tona, 2: Baraka
    function setRound(r) {
      currentRound = ((r % 3) + 3) % 3;
      // Abol: green->dark beans + high-arc pour; Tona: frankincense + medium pour; Baraka: resting pot + wilted reeds
      panMat.color.setHex(currentRound === 0 ? 0x3b2416 : 0x1e120c);
      mats.kettamaMat.color.setHex(currentRound === 2 ? 0x6b6c42 : 0x4f7338);
      for (const cf of cupFills) cf.visible = currentRound >= 0;
    }
    setRound(0);

    function update(nowSec) {
      const pouring = currentRound < 2 ? (0.5 + 0.5 * Math.sin(nowSec * 1.4)) > 0.35 : false;
      pourStream.visible = pouring;
      if (pouring) {
        jebena.position.set(-0.24, 0.42, 0.17);
        jebena.rotation.z = -0.62;
      } else {
        jebena.position.set(0.08, 0.21, 0.30);
        jebena.rotation.z = 0;
      }
      const srcX = currentRound === 0 ? 0.34 : 0.36;
      const srcZ = currentRound === 0 ? 0.52 : 0.14;
      for (let i = 0; i < wisps.length; i++) {
        const u = ((nowSec * 0.42 + i / wisps.length) % 1);
        wisps[i].visible = currentRound < 2;
        wisps[i].position.set(
          srcX + Math.sin(nowSec * 1.8 + i) * 0.05 * u,
          0.22 + u * 0.95,
          srcZ + Math.cos(nowSec * 1.4 + i) * 0.04 * u
        );
        wisps[i].scale.setScalar(0.6 + u * 1.5);
      }
    }

    return { group: g, setRound, getRound: () => currentRound, update };
  }

  /* =========================================================================
     SHEET 3: HIGHLAND TRANSIT ECOSYSTEM (HIACE, BAJAJ, ISUZU FSR)
     ========================================================================= */
  function addWheel(T, mats, parent, x, y, z, r = 0.34, w = 0.18) {
    const wg = new T.Group();
    wg.position.set(x, y, z);
    const tire = new T.Mesh(new T.CylinderGeometry(r, r, w, 16), mats.tireMat);
    tire.rotation.z = Math.PI * 0.5;
    tire.castShadow = true;
    wg.add(tire);
    const hub = new T.Mesh(new T.CylinderGeometry(r * 0.52, r * 0.52, w + 0.01, 12), mats.hiaceWhiteMat);
    hub.rotation.z = Math.PI * 0.5;
    wg.add(hub);
    parent.add(wg);
    return wg;
  }

  function makeLineTaxiHiAce(T) {
    const mats = getMaterials(T);
    const g = new T.Group();
    // Sky-blue lower van body + crisp white upper greenhouse/roof (`street_transit.jpg` top-left!)
    const lower = new T.Mesh(new T.BoxGeometry(1.76, 0.78, 4.55), mats.hiaceBlueMat);
    lower.position.set(0, 0.68, 0);
    lower.castShadow = true; lower.receiveShadow = true;
    g.add(lower);

    const upper = new T.Mesh(new T.BoxGeometry(1.70, 0.72, 4.35), mats.hiaceWhiteMat);
    upper.position.set(0, 1.41, -0.05);
    upper.castShadow = true;
    g.add(upper);

    // 3 distinct side passenger windows + dark front grille & bumpers (`street_transit.jpg` top-left!)
    for (const wz of [-1.28, -0.05, 1.18]) {
      const wPane = new T.Mesh(new T.BoxGeometry(1.73, 0.44, 1.02), mats.glassDarkMat);
      wPane.position.set(0, 1.43, wz);
      g.add(wPane);
    }
    const windshield = new T.Mesh(new T.BoxGeometry(1.52, 0.50, 0.08), mats.glassDarkMat);
    windshield.position.set(0, 1.40, 2.12);
    windshield.rotation.x = -0.16;
    g.add(windshield);
    const grille = new T.Mesh(new T.BoxGeometry(1.68, 0.24, 0.08), mats.ironDarkMat);
    grille.position.set(0, 0.66, 2.26);
    g.add(grille);
    for (const bz of [-2.28, 2.30]) {
      const bumper = new T.Mesh(new T.BoxGeometry(1.80, 0.16, 0.12), mats.ironDarkMat);
      bumper.position.set(0, 0.38, bz);
      g.add(bumper);
    }

    // Roof luggage rack + tricolor windshield tassel + headlights
    for (const sx of [-0.76, 0.76]) {
      const rail = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 3.6, 8), mats.ironDarkMat);
      rail.rotation.x = Math.PI * 0.5;
      rail.position.set(sx, 1.84, -0.15);
      g.add(rail);
    }
    const headlightMat = new T.MeshBasicMaterial({ color: 0xfff6d6 });
    for (const sx of [-0.62, 0.62]) {
      const hl = new T.Mesh(new T.BoxGeometry(0.26, 0.16, 0.05), headlightMat);
      hl.position.set(sx, 0.68, 2.28);
      g.add(hl);
    }
    const tassel = new T.Mesh(new T.CylinderGeometry(0.015, 0.03, 0.12, 8), new T.MeshBasicMaterial({ color: 0xe6be2e }));
    tassel.position.set(0, 1.52, 2.02);
    g.add(tassel);

    const wheels = [
      addWheel(T, mats, g, -0.86, 0.34,  1.38, 0.34, 0.19),
      addWheel(T, mats, g,  0.86, 0.34,  1.38, 0.34, 0.19),
      addWheel(T, mats, g, -0.86, 0.34, -1.36, 0.34, 0.19),
      addWheel(T, mats, g,  0.86, 0.34, -1.36, 0.34, 0.19)
    ];
    g.userData.wheels = wheels;
    return g;
  }

  function makeBajajRickshaw(T) {
    const mats = getMaterials(T);
    const g = new T.Group();
    // Rear passenger tub + curved front leg-shield + canvas canopy (`street_transit.jpg` top-right!)
    const rearTub = new T.Mesh(new T.BoxGeometry(1.26, 0.62, 1.38), mats.bajajBlueMat);
    rearTub.position.set(0, 0.52, -0.35);
    rearTub.castShadow = true;
    g.add(rearTub);

    const frontApron = new T.Mesh(new T.CylinderGeometry(0.46, 0.52, 0.92, 14, 1, false, -Math.PI * 0.45, Math.PI * 0.9), mats.bajajBlueMat);
    frontApron.rotation.y = Math.PI * 0.5;
    frontApron.position.set(0, 0.72, 0.56);
    g.add(frontApron);

    const screen = new T.Mesh(new T.PlaneGeometry(0.88, 0.46), mats.glassDarkMat);
    screen.position.set(0, 1.26, 0.66);
    screen.rotation.x = -0.24;
    g.add(screen);

    const canopy = new T.Mesh(new T.BoxGeometry(1.28, 0.12, 1.88), mats.canvasTopMat);
    canopy.position.set(0, 1.56, -0.10);
    canopy.castShadow = true;
    g.add(canopy);
    const rearCurtain = new T.Mesh(new T.BoxGeometry(1.26, 0.74, 0.08), mats.canvasTopMat);
    rearCurtain.position.set(0, 1.18, -1.00);
    g.add(rearCurtain);

    const lamp = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.08, 12), new T.MeshBasicMaterial({ color: 0xfff5cc }));
    lamp.rotation.x = Math.PI * 0.5;
    lamp.position.set(0, 0.66, 0.98);
    g.add(lamp);

    const wheels = [
      addWheel(T, mats, g,  0.00, 0.24,  0.88, 0.24, 0.13),
      addWheel(T, mats, g, -0.62, 0.24, -0.68, 0.24, 0.13),
      addWheel(T, mats, g,  0.62, 0.24, -0.68, 0.24, 0.13)
    ];
    g.userData.wheels = wheels;
    return g;
  }

  function makeIsuzuEscarpmentTruck(T) {
    const mats = getMaterials(T);
    const g = new T.Group();
    // Chassis rails
    const chassis = new T.Mesh(new T.BoxGeometry(1.85, 0.26, 6.2), mats.ironDarkMat);
    chassis.position.set(0, 0.62, 0);
    g.add(chassis);

    // Cab-over white tilt cab + side doors + Ge'ez windshield banner (`street_transit.jpg` bottom-left!)
    const cab = new T.Mesh(new T.BoxGeometry(2.04, 1.66, 1.56), mats.hiaceWhiteMat);
    cab.position.set(0, 1.52, 2.22);
    cab.castShadow = true;
    g.add(cab);
    const cabGlass = new T.Mesh(new T.PlaneGeometry(1.82, 0.62), mats.glassDarkMat);
    cabGlass.position.set(0, 1.76, 3.01);
    g.add(cabGlass);
    const cabSideWin = new T.Mesh(new T.BoxGeometry(2.06, 0.54, 0.92), mats.glassDarkMat);
    cabSideWin.position.set(0, 1.76, 2.28);
    g.add(cabSideWin);
    const cabBanner = new T.Mesh(new T.PlaneGeometry(1.82, 0.16), mats.eraSignMat);
    cabBanner.position.set(0, 2.14, 3.015);
    g.add(cabBanner);
    const fBumper = new T.Mesh(new T.BoxGeometry(2.08, 0.24, 0.14), mats.ironDarkMat);
    fBumper.position.set(0, 0.66, 3.02);
    g.add(fBumper);

    // Wooden stake cargo bed + stacked burlap teff grain sacks + lashed eucalyptus logs!
    const bed = new T.Mesh(new T.BoxGeometry(2.16, 0.58, 4.35), mats.hiaceWhiteMat);
    bed.position.set(0, 1.05, -0.88);
    bed.castShadow = true;
    g.add(bed);

    for (let row = 0; row < 4; row++) {
      for (let sx of [-0.52, 0.52]) {
        const sack = new T.Mesh(new T.SphereGeometry(0.42, 10, 8), mats.sackMat);
        sack.scale.set(1.15, 0.42, 0.88);
        sack.position.set(sx, 1.42 + row * 0.26, 0.58);
        sack.castShadow = true;
        g.add(sack);
      }
    }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const pole = new T.Mesh(new T.CylinderGeometry(0.075, 0.09, 3.3, 8), mats.eucalyptusMat);
        pole.rotation.x = Math.PI * 0.5;
        pole.position.set(-0.68 + c * 0.34, 1.44 + r * 0.16, -1.65);
        pole.castShadow = true;
        g.add(pole);
      }
    }

    const wheels = [
      addWheel(T, mats, g, -0.98, 0.44,  2.05, 0.44, 0.24),
      addWheel(T, mats, g,  0.98, 0.44,  2.05, 0.44, 0.24),
      addWheel(T, mats, g, -0.98, 0.44, -1.55, 0.44, 0.28),
      addWheel(T, mats, g,  0.98, 0.44, -1.55, 0.44, 0.28)
    ];
    g.userData.wheels = wheels;
    return g;
  }

  /* =========================================================================
     SHEET 3 & 4: STREET HABITUS, TANGLED UTILITY POLES, KIOSKS & SIGNAGE
     ========================================================================= */
  function makeEucalyptusUtilityPole(T, withMegaphone = true) {
    const mats = getMaterials(T);
    const g = new T.Group();
    // Crooked unpeeled eucalyptus timber pole
    const crv = new T.CatmullRomCurve3([
      new T.Vector3(0, 0, 0),
      new T.Vector3(0.09, 2.2, 0.04),
      new T.Vector3(-0.05, 4.5, -0.03),
      new T.Vector3(0.06, 6.4, 0.02)
    ]);
    const pole = new T.Mesh(new T.TubeGeometry(crv, 14, 0.105, 8, false), mats.eucalyptusMat);
    pole.castShadow = true;
    g.add(pole);

    // Crossarms + ceramic pin insulators + coiled fiber-optic slack loop + transformer!
    for (const cy of [5.55, 6.05]) {
      const arm = new T.Mesh(new T.BoxGeometry(1.65, 0.075, 0.075), mats.timberMat);
      arm.position.set(0.04, cy, 0);
      g.add(arm);
      for (const ix of [-0.68, -0.24, 0.24, 0.68]) {
        const ins = new T.Mesh(new T.CylinderGeometry(0.028, 0.035, 0.08, 8), mats.siniPorcelainMat);
        ins.position.set(0.04 + ix, cy + 0.07, 0);
        g.add(ins);
      }
    }
    const slackLoop = new T.Mesh(new T.TorusGeometry(0.32, 0.022, 8, 20), mats.tireMat);
    slackLoop.position.set(-0.22, 4.65, 0.06);
    g.add(slackLoop);

    const xformer = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.68, 12), mats.concreteMat);
    xformer.position.set(0.24, 4.35, 0);
    g.add(xformer);

    if (withMegaphone) {
      const horn = new T.Mesh(new T.ConeGeometry(0.24, 0.44, 14, 1, true), mats.hiaceWhiteMat);
      horn.rotation.z = -Math.PI * 0.42;
      horn.position.set(0.28, 5.12, 0.10);
      g.add(horn);
    }
    return g;
  }

  function makeSolarCobraLight(T) {
    const mats = getMaterials(T);
    const g = new T.Group();
    const mast = new T.Mesh(new T.CylinderGeometry(0.055, 0.075, 5.4, 10), mats.concreteMat);
    mast.position.y = 2.7;
    g.add(mast);
    const arm = new T.Mesh(new T.BoxGeometry(1.15, 0.05, 0.08), mats.concreteMat);
    arm.position.set(0.52, 5.2, 0);
    arm.rotation.z = 0.22;
    g.add(arm);
    const led = new T.Mesh(new T.BoxGeometry(0.38, 0.05, 0.16), new T.MeshBasicMaterial({ color: 0xeafaff }));
    led.position.set(1.02, 5.30, 0);
    g.add(led);
    const panel = new T.Mesh(new T.BoxGeometry(0.72, 0.035, 0.52), mats.glassDarkMat);
    panel.position.set(-0.12, 5.55, 0);
    panel.rotation.z = -0.38;
    g.add(panel);
    return g;
  }

  function makeStreetKiosk(T, brand = "telebirr") {
    const mats = getMaterials(T);
    const g = new T.Group();
    const frontMat = brand === "telebirr" ? mats.telebirrMat : mats.telecomEmeraldMat;
    const body = new T.Mesh(new T.BoxGeometry(1.85, 2.15, 1.55), mats.corrMat);
    body.position.y = 1.075;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const frontFace = new T.Mesh(new T.PlaneGeometry(1.83, 2.08), frontMat);
    frontFace.position.set(0, 1.07, 0.782);
    g.add(frontFace);
    const roof = new T.Mesh(new T.BoxGeometry(2.12, 0.12, 1.86), mats.corrMat);
    roof.position.y = 2.20;
    g.add(roof);
    // Glowing cyan payment / telemetry screen inside service window!
    const win = new T.Mesh(new T.BoxGeometry(0.92, 0.62, 0.06), mats.ironDarkMat);
    win.position.set(-0.12, 1.36, 0.78);
    g.add(win);
    const scr = new T.Mesh(new T.PlaneGeometry(0.46, 0.34), mats.cyanWaterMat);
    scr.position.set(-0.22, 1.36, 0.815);
    g.add(scr);

    // Striped patio sun umbrella + water bottle & jerrycan stacks outside!
    const umbPole = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 2.45, 8), mats.ironDarkMat);
    umbPole.position.set(1.28, 1.22, 0.65);
    umbPole.rotation.z = -0.10;
    g.add(umbPole);
    const umbCone = new T.Mesh(new T.ConeGeometry(1.08, 0.42, 12), frontMat);
    umbCone.position.set(1.40, 2.42, 0.65);
    umbCone.castShadow = true;
    g.add(umbCone);

    // Ambo sparkling glass crate + 12-pack PET spring water + 20L cyan dispenser jug + yellow jerrycan!
    const dispenser = new T.Mesh(new T.CylinderGeometry(0.135, 0.135, 0.36, 14), mats.petWaterMat);
    dispenser.position.set(1.12, 0.18, 0.25);
    g.add(dispenser);
    const amboBottle = new T.Mesh(new T.CylinderGeometry(0.032, 0.045, 0.28, 10), mats.amboGlassMat);
    amboBottle.position.set(1.12, 0.50, 0.25);
    g.add(amboBottle);
    const petPack = new T.Mesh(new T.BoxGeometry(0.36, 0.28, 0.27), mats.petWaterMat);
    petPack.position.set(-1.12, 0.14, 0.45);
    g.add(petPack);
    const jc = makeJerrycanReuseStage(T, mats, 0);
    jc.position.set(1.36, 0, 0.35);
    g.add(jc);
    return g;
  }

  function makeRoadSignsSet(T) {
    const mats = getMaterials(T);
    const g = new T.Group();
    // 1. ERA Bilingual Highway Sign (`ባሕር ዳር / BAHIR DAR`, `አባይ / ABAY GORGE`)
    for (const px of [-0.85, 0.85]) {
      const post = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 2.5, 8), mats.concreteMat);
      post.position.set(px, 1.25, 0);
      g.add(post);
    }
    const eraBoard = new T.Mesh(new T.BoxGeometry(2.2, 1.1, 0.05), mats.eraSignMat);
    eraBoard.position.set(0, 2.05, 0.03);
    eraBoard.castShadow = true;
    g.add(eraBoard);

    // 2. Octagonal `ቆም / STOP` Sign
    const stopPost = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 2.2, 8), mats.concreteMat);
    stopPost.position.set(1.85, 1.1, 0);
    g.add(stopPost);
    const stopDisc = new T.Mesh(new T.PlaneGeometry(0.78, 0.78), mats.stopSignMat);
    stopDisc.position.set(1.85, 2.05, 0.04);
    g.add(stopDisc);

    // 3. Weathered Corrugated-Tin `ቡና / SHOP / 0911-00-00` Plaque
    const bunaPlank = new T.Mesh(new T.BoxGeometry(1.45, 0.74, 0.03), mats.bunaSignMat);
    bunaPlank.position.set(-2.15, 1.65, 0);
    g.add(bunaPlank);
    const bunaPost = new T.Mesh(new T.CylinderGeometry(0.04, 0.045, 1.9, 8), mats.timberMat);
    bunaPost.position.set(-2.15, 0.95, -0.03);
    g.add(bunaPost);
    return g;
  }

  /* =========================================================================
     SHEET 1: MONUMENTAL VERTICAL TOTEMS (LALIBELA, RADIO MAST, DAM WALL)
     ========================================================================= */
  function makeLalibelaSunkenChurch(T) {
    // Monolithic cruciform church carved inside a sunken volcanic-tuff courtyard pit (Beta Giorgis archetype!)
    const mats = getMaterials(T);
    const g = new T.Group();
    const pitOuter = 13.0, pitInner = 9.4, wallH = 6.2;
    // 4 pit perimeter walls around the sunken trench
    for (const [wx, wz, ww, wd] of [
      [0, -5.6, pitOuter, 1.8], [0, 5.6, pitOuter, 1.8],
      [-5.6, 0, 1.8, pitInner], [5.6, 0, 1.8, pitInner]
    ]) {
      const wM = new T.Mesh(new T.BoxGeometry(ww, wallH, wd), mats.tuffMat);
      wM.position.set(wx, wallH * 0.32, wz);
      wM.castShadow = true; wM.receiveShadow = true;
      g.add(wM);
    }
    const pitFloor = new T.Mesh(new T.BoxGeometry(pitInner, 0.3, pitInner), mats.tuffMat);
    pitFloor.position.y = -1.6;
    pitFloor.receiveShadow = true;
    g.add(pitFloor);

    // Central Cruciform Monolith rising from pitFloor (-1.5) to roof (+4.6) with carved rooftop Greek Cross!
    const armA = new T.Mesh(new T.BoxGeometry(6.4, 6.0, 2.8), mats.tuffMat);
    armA.position.y = 1.5;
    armA.castShadow = true; armA.receiveShadow = true;
    g.add(armA);
    const armB = new T.Mesh(new T.BoxGeometry(2.8, 6.0, 6.4), mats.tuffMat);
    armB.position.y = 1.5;
    armB.castShadow = true; armB.receiveShadow = true;
    g.add(armB);

    // Nested relief cross carved on top of roof (`transect_map.jpg` far-left!)
    for (let k = 0; k < 2; k++) {
      const s = 1 - k * 0.34;
      const rA = new T.Mesh(new T.BoxGeometry(5.6 * s, 0.18, 1.9 * s), mats.plasterMat);
      rA.position.y = 4.58 + k * 0.16;
      g.add(rA);
      const rB = new T.Mesh(new T.BoxGeometry(1.9 * s, 0.18, 5.6 * s), mats.plasterMat);
      rB.position.y = 4.58 + k * 0.16;
      g.add(rB);
    }
    return g;
  }

  function makeRidgeRadioMast(T, height = 28) {
    const mats = getMaterials(T);
    const g = new T.Group();
    const bays = 7;
    const bayH = height / bays;
    for (let b = 0; b < bays; b++) {
      const r0 = lerp(1.65, 0.32, b / bays);
      const r1 = lerp(1.65, 0.32, (b + 1) / bays);
      const mat = b % 2 === 0 ? mats.mastRedMat : mats.mastWhiteMat;
      const cage = new T.Mesh(new T.CylinderGeometry(r1, r0, bayH, 4, 1, true), mat);
      cage.material.wireframe = false;
      // Build crisp 4-corner struts + X-braces
      for (let c = 0; c < 4; c++) {
        const a = (c * TAU) / 4 + Math.PI * 0.25;
        const p0 = new T.Vector3(Math.cos(a) * r0, b * bayH, Math.sin(a) * r0);
        const p1 = new T.Vector3(Math.cos(a) * r1, (b + 1) * bayH, Math.sin(a) * r1);
        const strut = new T.Mesh(new T.TubeGeometry(new T.LineCurve3(p0, p1), 1, 0.055, 6, false), mat);
        g.add(strut);
        const aNext = ((c + 1) * TAU) / 4 + Math.PI * 0.25;
        const pNext = new T.Vector3(Math.cos(aNext) * r1, (b + 1) * bayH, Math.sin(aNext) * r1);
        const diag = new T.Mesh(new T.TubeGeometry(new T.LineCurve3(p0, pNext), 1, 0.032, 5, false), mat);
        g.add(diag);
      }
    }
    const beacon = new T.Mesh(new T.SphereGeometry(0.24, 10, 10), new T.MeshBasicMaterial({ color: 0x3ce8ff }));
    beacon.position.y = height + 0.4;
    g.add(beacon);
    return g;
  }

  function makeGerdDamWall(T) {
    // Curved roller-compacted concrete arch-gravity dam wall + central spillway (`transect_map.jpg` right!)
    const mats = getMaterials(T);
    const g = new T.Group();
    const segs = 18;
    const radius = 58;
    for (let i = 0; i < segs; i++) {
      const u = (i / (segs - 1)) - 0.5;
      const ang = u * 1.08;
      const segW = 6.8;
      const isSpillway = Math.abs(i - 8.5) < 2.2;
      const h = isSpillway ? 18.5 : 21.0;
      const blk = new T.Mesh(new T.BoxGeometry(segW, h, 4.6), mats.concreteMat);
      blk.position.set(radius - Math.cos(ang) * radius, h * 0.5 - 3.0, Math.sin(ang) * radius);
      blk.rotation.y = -ang;
      blk.castShadow = true; blk.receiveShadow = true;
      g.add(blk);
      if (isSpillway) {
        const chute = new T.Mesh(new T.PlaneGeometry(segW * 0.88, 15.5), mats.cyanWaterMat);
        chute.position.set(radius - Math.cos(ang) * radius - 2.45, 7.2, Math.sin(ang) * radius);
        chute.rotation.y = -Math.PI * 0.5 - ang;
        chute.rotation.x = 0.16;
        g.add(chute);
      }
    }
    return g;
  }

  window.AbyssinianKits = {
    getMaterials,
    makeBunaThresholdSet,
    makeJerrycanReuseStage,
    makeLineTaxiHiAce,
    makeBajajRickshaw,
    makeIsuzuEscarpmentTruck,
    makeEucalyptusUtilityPole,
    makeSolarCobraLight,
    makeStreetKiosk,
    makeRoadSignsSet,
    makeLalibelaSunkenChurch,
    makeRidgeRadioMast,
    makeGerdDamWall
  };
})();
