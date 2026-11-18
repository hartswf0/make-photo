/* Articulated 3D Expedition Cast for Donkey Water / MONOLITH-3 & 2086 Night Post.
   Crafted for silver-gelatin + selective Blue Jerikan (#47B) living-cyan shaders.
   Exposes window.makeCharacter(THREE, spec) and window.makeExpeditionCast(THREE, opts). */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  let shared = null;
  function getShared(T) {
    if (shared && shared.T === T) return shared;
    const sphere = new T.SphereGeometry(1, 14, 12);
    const cyl = new T.CylinderGeometry(1, 1, 1, 12, 1);
    cyl.translate(0, -0.5, 0); // pivot at top joint
    const taper = new T.CylinderGeometry(0.82, 1.08, 1, 14, 1);
    const skirtGeo = new T.CylinderGeometry(0.16, 0.27, 0.56, 16, 1, false);
    skirtGeo.translate(0, -0.28, 0);
    const box = new T.BoxGeometry(1, 1, 1);
    const torus = new T.TorusGeometry(1, 0.16, 8, 20);

    // Tonal materials tuned for Adams Zone System + Blue Jerikan #47B cyan isolation
    const mats = {
      skinDeep: new T.MeshStandardMaterial({ color: 0x5d3e2c, roughness: 0.54, metalness: 0.04 }),
      skinWarm: new T.MeshStandardMaterial({ color: 0x765038, roughness: 0.52, metalness: 0.04 }),
      skinRich: new T.MeshStandardMaterial({ color: 0x4b3122, roughness: 0.56, metalness: 0.04 }),
      hairDark: new T.MeshStandardMaterial({ color: 0x171514, roughness: 0.84 }),
      hairSilver: new T.MeshStandardMaterial({ color: 0xbab6ac, roughness: 0.72 }),
      gabiIvory: new T.MeshStandardMaterial({
        color: 0xf0ece1, emissive: 0x24221d, emissiveIntensity: 0.20, roughness: 0.78
      }),
      canvasSlate: new T.MeshStandardMaterial({ color: 0x4b5054, roughness: 0.80 }),
      ochreEarth: new T.MeshStandardMaterial({ color: 0x9b8260, roughness: 0.76 }),
      indigoCoat: new T.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.74 }),
      leather: new T.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.68 }),
      bootDark: new T.MeshStandardMaterial({ color: 0x1d1c1a, roughness: 0.85 }),
      brass: new T.MeshStandardMaterial({ color: 0xd0b474, roughness: 0.28, metalness: 0.82 }),
      chalk: new T.MeshStandardMaterial({ color: 0xfaf8f2, emissive: 0x383834, emissiveIntensity: 0.28, roughness: 0.9 }),
      clay: new T.MeshStandardMaterial({ color: 0x7d5840, roughness: 0.86 }),
      // Low-red/low-green high-blue materials so #47B shader blooms them into living electric cyan
      cyanGlow: new T.MeshStandardMaterial({
        color: 0x0068f4, emissive: 0x0046c8, emissiveIntensity: 0.85, roughness: 0.24, metalness: 0.08
      }),
      cyanSoft: new T.MeshStandardMaterial({
        color: 0x0054d6, emissive: 0x003299, emissiveIntensity: 0.62, roughness: 0.36
      }),
      eyeWhite: new T.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.35 })
    };

    shared = { T, sphere, cyl, taper, skirtGeo, box, torus, mats };
    return shared;
  }

  function makeLabelSprite(T, name, role, accentCyan = true) {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 128;
    const ctx = cv.getContext("2d");
    const tex = new T.CanvasTexture(cv);
    tex.minFilter = T.LinearFilter;
    const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true });
    const sp = new T.Sprite(mat);
    sp.scale.set(1.18, 0.30, 1);

    function draw(lineOverride) {
      ctx.clearRect(0, 0, 512, 128);
      const sub = lineOverride || role || "";
      // Pill backdrop
      ctx.fillStyle = "rgba(10, 16, 18, 0.78)";
      ctx.strokeStyle = accentCyan ? "rgba(64, 218, 255, 0.72)" : "rgba(240, 232, 214, 0.55)";
      ctx.lineWidth = 3;
      const rx = 26, ry = 18, rw = 460, rh = 92, rad = 18;
      ctx.beginPath();
      ctx.moveTo(rx + rad, ry);
      ctx.lineTo(rx + rw - rad, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rad);
      ctx.lineTo(rx + rw, ry + rh - rad);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rad, ry + rh);
      ctx.lineTo(rx + rad, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rad);
      ctx.lineTo(rx, ry + rad);
      ctx.quadraticCurveTo(rx, ry, rx + rad, ry);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#f5f1e6";
      ctx.font = "700 28px Inter, system-ui, sans-serif";
      ctx.fillText(name.toUpperCase(), 256, 56);

      ctx.fillStyle = accentCyan ? "#6be8dc" : "#e8c47c";
      ctx.font = "600 20px ui-monospace, Menlo, monospace";
      ctx.fillText(sub.slice(0, 38), 256, 90);
      tex.needsUpdate = true;
    }
    draw("");
    return { sprite: sp, draw, mat };
  }

  function buildMiniJerikan(T, S, scale = 0.62) {
    const g = new T.Group();
    const body = new T.Mesh(S.box, S.mats.cyanGlow);
    body.scale.set(0.22, 0.31, 0.14);
    body.position.y = 0.16;
    g.add(body);
    const rib = new T.Mesh(S.box, S.mats.cyanSoft);
    rib.scale.set(0.16, 0.025, 0.155);
    rib.position.y = 0.16;
    g.add(rib);
    const handle = new T.Mesh(S.box, S.mats.cyanSoft);
    handle.scale.set(0.12, 0.035, 0.045);
    handle.position.set(-0.02, 0.335, 0);
    g.add(handle);
    const cap = new T.Mesh(S.taper, S.mats.chalk);
    cap.scale.set(0.026, 0.03, 0.026);
    cap.position.set(0.065, 0.34, 0);
    g.add(cap);
    g.scale.setScalar(scale);
    return g;
  }

  function makeCharacter(T, spec = {}) {
    const S = getShared(T);
    const scale = spec.scale || 1.0;
    const skinMat = S.mats[spec.skin || "skinWarm"] || S.mats.skinWarm;
    const tunicMat = S.mats[spec.tunic || "gabiIvory"] || S.mats.gabiIvory;
    const lowerMat = S.mats[spec.lower || "canvasSlate"] || S.mats.canvasSlate;
    const hairMat = S.mats[spec.hairColor || "hairDark"] || S.mats.hairDark;
    const hasShawl = spec.shawl !== false;
    const hasSkirt = Boolean(spec.skirt);

    const group = new T.Group();
    const bodyRoot = new T.Group();
    bodyRoot.scale.setScalar(scale);
    group.add(bodyRoot);

    // Pelvis at hip height (~0.92m unscaled)
    const pelvis = new T.Group();
    pelvis.position.y = 0.92;
    bodyRoot.add(pelvis);

    const hipBlock = new T.Mesh(S.taper, lowerMat);
    hipBlock.scale.set(0.155, 0.16, 0.115);
    hipBlock.position.y = 0.0;
    pelvis.add(hipBlock);

    if (hasSkirt) {
      const sk = new T.Mesh(S.skirtGeo, spec.skirtMat ? S.mats[spec.skirtMat] : tunicMat);
      sk.position.y = 0.04;
      pelvis.add(sk);
      // Woven cyan tibeb border near hem
      const hem = new T.Mesh(S.torus, S.mats.cyanGlow);
      hem.rotation.x = Math.PI / 2;
      hem.scale.set(0.255, 0.255, 0.12);
      hem.position.y = -0.49;
      pelvis.add(hem);
    }

    // Legs
    function makeLeg(side) {
      const hip = new T.Group();
      hip.position.set(side * 0.095, -0.02, 0);
      pelvis.add(hip);

      const thigh = new T.Mesh(S.cyl, lowerMat);
      thigh.scale.set(0.068, 0.42, 0.068);
      hip.add(thigh);

      const knee = new T.Group();
      knee.position.y = -0.42;
      hip.add(knee);

      const shin = new T.Mesh(S.cyl, skinMat);
      shin.scale.set(0.052, 0.39, 0.052);
      knee.add(shin);

      const boot = new T.Group();
      boot.position.y = -0.39;
      knee.add(boot);

      const ankle = new T.Mesh(S.taper, S.mats.bootDark);
      ankle.scale.set(0.058, 0.13, 0.065);
      ankle.position.y = 0.04;
      boot.add(ankle);

      const foot = new T.Mesh(S.box, S.mats.bootDark);
      foot.scale.set(0.095, 0.065, 0.21);
      foot.position.set(0, -0.03, 0.045);
      boot.add(foot);

      return { hip, knee, boot };
    }
    const legL = makeLeg(1);
    const legR = makeLeg(-1);

    // Spine & Torso
    const spine = new T.Group();
    spine.position.y = 0.05;
    pelvis.add(spine);

    const chest = new T.Mesh(S.taper, tunicMat);
    chest.scale.set(0.175, 0.46, 0.122);
    chest.position.y = 0.23;
    spine.add(chest);

    if (hasShawl) {
      // Ethiopian Netela / Gabi cross-draped shawl + glowing cyan tibeb border
      const wrap1 = new T.Mesh(S.torus, S.mats.gabiIvory);
      wrap1.scale.set(0.185, 0.145, 0.32);
      wrap1.rotation.set(1.18, 0.28, 0.32);
      wrap1.position.set(0, 0.35, 0.01);
      spine.add(wrap1);

      const tibeb = new T.Mesh(S.torus, S.mats.cyanGlow);
      tibeb.scale.set(0.192, 0.150, 0.14);
      tibeb.rotation.set(1.18, 0.28, 0.32);
      tibeb.position.set(0, 0.325, 0.015);
      spine.add(tibeb);
    }

    // Crossbody satchel strap if carrier/runner
    if (spec.satchel) {
      const strap = new T.Mesh(S.torus, S.mats.leather);
      strap.scale.set(0.19, 0.24, 0.12);
      strap.rotation.set(0.35, 0.2, -0.75);
      strap.position.set(0, 0.24, 0);
      spine.add(strap);

      const bag = new T.Mesh(S.box, S.mats.leather);
      bag.scale.set(0.08, 0.18, 0.16);
      bag.position.set(-0.185, 0.04, -0.02);
      spine.add(bag);

      const badge = new T.Mesh(S.sphere, S.mats.cyanGlow);
      badge.scale.setScalar(0.028);
      badge.position.set(0.09, 0.36, 0.125);
      spine.add(badge);
    }

    // Neck & Head
    const neck = new T.Group();
    neck.position.y = 0.47;
    spine.add(neck);

    const neckMesh = new T.Mesh(S.taper, skinMat);
    neckMesh.scale.set(0.052, 0.09, 0.052);
    neckMesh.position.y = 0.035;
    neck.add(neckMesh);

    const head = new T.Group();
    head.position.y = 0.085;
    neck.add(head);

    const cranium = new T.Mesh(S.sphere, skinMat);
    cranium.scale.set(0.102, 0.124, 0.112);
    cranium.position.y = 0.095;
    head.add(cranium);

    // Subtle nose & eyes facing +Z
    const nose = new T.Mesh(S.box, skinMat);
    nose.scale.set(0.022, 0.038, 0.026);
    nose.position.set(0, 0.092, 0.108);
    head.add(nose);

    for (const sx of [-0.036, 0.036]) {
      const ew = new T.Mesh(S.sphere, S.mats.eyeWhite);
      ew.scale.set(0.015, 0.010, 0.008);
      ew.position.set(sx, 0.108, 0.098);
      head.add(ew);
      const pupil = new T.Mesh(S.sphere, S.mats.hairDark);
      pupil.scale.setScalar(0.007);
      pupil.position.set(sx, 0.108, 0.104);
      head.add(pupil);
    }

    // Hair / Headwear styles
    const hairStyle = spec.hair || "braids";
    if (hairStyle === "braids") {
      const cap = new T.Mesh(S.sphere, hairMat);
      cap.scale.set(0.108, 0.115, 0.118);
      cap.position.set(0, 0.115, -0.012);
      head.add(cap);
      for (let i = -3; i <= 3; i++) {
        const ang = i * 0.28;
        const plait = new T.Mesh(S.cyl, hairMat);
        plait.scale.set(0.018, 0.17, 0.018);
        plait.position.set(Math.sin(ang) * 0.088, 0.12, -0.065 - Math.cos(ang) * 0.035);
        plait.rotation.x = 0.22;
        head.add(plait);
      }
      const band = new T.Mesh(S.torus, S.mats.cyanGlow);
      band.scale.set(0.104, 0.11, 0.08);
      band.rotation.x = 1.25;
      band.position.set(0, 0.145, 0.005);
      head.add(band);
    } else if (hairStyle === "puffs") {
      const cap = new T.Mesh(S.sphere, hairMat);
      cap.scale.set(0.106, 0.11, 0.112);
      cap.position.set(0, 0.112, -0.008);
      head.add(cap);
      for (const sx of [-0.095, 0.095]) {
        const puff = new T.Mesh(S.sphere, hairMat);
        puff.scale.setScalar(0.068);
        puff.position.set(sx, 0.175, -0.01);
        head.add(puff);
        const tie = new T.Mesh(S.torus, S.mats.cyanGlow);
        tie.scale.set(0.038, 0.038, 0.12);
        tie.rotation.y = sx * 4;
        tie.position.set(sx * 0.72, 0.15, -0.01);
        head.add(tie);
      }
    } else if (hairStyle === "shash") {
      const wrap = new T.Mesh(S.sphere, S.mats.gabiIvory);
      wrap.scale.set(0.116, 0.122, 0.128);
      wrap.position.set(0, 0.132, -0.018);
      head.add(wrap);
      const knot = new T.Mesh(S.sphere, S.mats.gabiIvory);
      knot.scale.set(0.055, 0.052, 0.065);
      knot.position.set(0, 0.12, -0.135);
      head.add(knot);
      const trim = new T.Mesh(S.torus, S.mats.cyanGlow);
      trim.scale.set(0.112, 0.118, 0.09);
      trim.rotation.x = 1.35;
      trim.position.set(0, 0.135, 0.0);
      head.add(trim);
    } else if (hairStyle === "hat") {
      const brim = new T.Mesh(S.taper, S.mats.ochreEarth);
      brim.scale.set(0.22, 0.016, 0.24);
      brim.position.set(0, 0.172, 0);
      head.add(brim);
      const crown = new T.Mesh(S.taper, S.mats.ochreEarth);
      crown.scale.set(0.105, 0.088, 0.118);
      crown.position.set(0, 0.215, 0);
      head.add(crown);
      const ribbon = new T.Mesh(S.torus, S.mats.cyanSoft);
      ribbon.rotation.x = Math.PI / 2;
      ribbon.scale.set(0.108, 0.120, 0.09);
      ribbon.position.set(0, 0.182, 0);
      head.add(ribbon);
    }

    // Clavicles & Arms (separate shoulder roots so Eskista clavicle pops look authentic!)
    function makeArm(side) {
      const clavicle = new T.Group();
      clavicle.position.set(side * 0.195, 0.425, 0);
      spine.add(clavicle);

      const cap = new T.Mesh(S.sphere, tunicMat);
      cap.scale.setScalar(0.058);
      clavicle.add(cap);

      const upper = new T.Mesh(S.cyl, tunicMat);
      upper.scale.set(0.048, 0.28, 0.048);
      clavicle.add(upper);

      const elbow = new T.Group();
      elbow.position.y = -0.28;
      clavicle.add(elbow);

      const fore = new T.Mesh(S.cyl, skinMat);
      fore.scale.set(0.040, 0.25, 0.040);
      elbow.add(fore);

      const hand = new T.Group();
      hand.position.y = -0.25;
      elbow.add(hand);

      const palm = new T.Mesh(S.sphere, skinMat);
      palm.scale.set(0.036, 0.045, 0.028);
      palm.position.y = -0.02;
      hand.add(palm);

      return { clavicle, baseX: side * 0.195, baseY: 0.425, elbow, hand };
    }
    const armL = makeArm(1);
    const armR = makeArm(-1);

    // Optional Signature Props
    const props = {};
    // 1) Shoulder-balanced Cyan Jerikan (Imani)
    const shoulderCan = buildMiniJerikan(T, S, 0.68);
    shoulderCan.position.set(-0.18, 0.49, -0.04);
    shoulderCan.rotation.set(0.12, 0.25, -0.22);
    shoulderCan.visible = Boolean(spec.carryCan);
    spine.add(shoulderCan);
    props.shoulderCan = shoulderCan;

    // 2) Pouring / two-hand jerikan in front
    const pourCan = buildMiniJerikan(T, S, 0.76);
    pourCan.position.set(0, -0.08, 0.12);
    pourCan.rotation.x = 0.95;
    pourCan.visible = false;
    armR.hand.add(pourCan);
    props.pourCan = pourCan;

    if (spec.prop === "micCup") {
      // June's enamel cup held like a microphone + glowing cyan earphone cord & phone
      const cup = new T.Mesh(S.taper, S.mats.chalk);
      cup.scale.set(0.038, 0.075, 0.038);
      cup.position.set(0, -0.03, 0.04);
      cup.rotation.x = Math.PI * 0.5;
      armR.hand.add(cup);

      const earBud = new T.Mesh(S.sphere, S.mats.cyanGlow);
      earBud.scale.setScalar(0.020);
      earBud.position.set(0.104, 0.095, 0.01);
      head.add(earBud);

      const phone = new T.Mesh(S.box, S.mats.cyanGlow);
      phone.scale.set(0.048, 0.009, 0.088);
      phone.position.set(0, -0.03, 0.035);
      armL.hand.add(phone);
      props.phone = phone;
    } else if (spec.prop === "slips") {
      // Etta's two signed custody slips & brass ferry master key
      const slip1 = new T.Mesh(S.box, S.mats.chalk);
      slip1.scale.set(0.085, 0.006, 0.12);
      slip1.position.set(0, -0.025, 0.05);
      armL.hand.add(slip1);
      const keyRing = new T.Mesh(S.torus, S.mats.brass);
      keyRing.scale.set(0.032, 0.032, 0.12);
      keyRing.position.set(0, -0.05, 0.02);
      armR.hand.add(keyRing);
    } else if (spec.prop === "ledger") {
      // Tess / Hill Operator cooling gauge clipboard + glowing cyan vial
      const board = new T.Mesh(S.box, S.mats.leather);
      board.scale.set(0.13, 0.012, 0.17);
      board.position.set(0.02, -0.02, 0.06);
      armL.hand.add(board);
      const page = new T.Mesh(S.box, S.mats.chalk);
      page.scale.set(0.11, 0.014, 0.14);
      page.position.set(0.02, -0.018, 0.06);
      armL.hand.add(page);
      const vial = new T.Mesh(S.taper, S.mats.cyanGlow);
      vial.scale.set(0.022, 0.09, 0.022);
      vial.position.set(0, -0.03, 0.03);
      armR.hand.add(vial);
    } else if (spec.prop === "chalk") {
      // Saba's white reserve chalk & brass dip rod
      const rod = new T.Mesh(S.taper, S.mats.brass);
      rod.scale.set(0.012, 0.42, 0.012);
      rod.position.set(0, -0.14, 0.04);
      armL.hand.add(rod);
      const ch = new T.Mesh(S.box, S.mats.chalk);
      ch.scale.set(0.02, 0.065, 0.02);
      ch.position.set(0, -0.03, 0.03);
      armR.hand.add(ch);
    } else if (spec.prop === "phone") {
      // Rahel's glowing night-route phone
      const ph = new T.Mesh(S.box, S.mats.cyanGlow);
      ph.scale.set(0.055, 0.012, 0.105);
      ph.position.set(0, -0.025, 0.05);
      armR.hand.add(ph);
    } else if (spec.prop === "sheet") {
      // The Aunt's folded rehearsal sheet & clay resonance bowl
      const sh = new T.Mesh(S.box, S.mats.chalk);
      sh.scale.set(0.11, 0.008, 0.14);
      sh.position.set(0, -0.02, 0.055);
      armL.hand.add(sh);
      const bowl = new T.Mesh(S.taper, S.mats.clay);
      bowl.scale.set(0.085, 0.06, 0.085);
      bowl.position.set(0, -0.02, 0.06);
      armR.hand.add(bowl);
    }

    const label = spec.name ? makeLabelSprite(T, spec.name, spec.role || "", spec.cyanBadge !== false) : null;
    if (label) {
      label.sprite.position.y = 2.04 * scale;
      group.add(label.sprite);
    }

    const st = {
      id: spec.id || "npc",
      name: spec.name || "Carrier",
      role: spec.role || "",
      x: spec.x || 0,
      y: 0,
      z: spec.z || 0,
      heading: spec.heading || 0,
      pose: spec.pose || "idle",
      phase: spec.phase || Math.random() * TAU,
      carryCan: Boolean(spec.carryCan),
      speech: "",
      steer: 0,
      walkSpeed: 1.0
    };

    function place(x, z, heading, surfaceFn) {
      st.x = x;
      st.z = z;
      if (heading !== undefined && heading !== null) st.heading = heading;
      st.y = surfaceFn ? surfaceFn(x, z) : st.y;
      group.position.set(st.x, st.y, st.z);
      group.rotation.set(0, st.heading, 0, "YXZ");
    }

    function setSpeech(txt) {
      if (st.speech === txt) return;
      st.speech = txt || "";
      if (label) label.draw(st.speech || st.role);
    }

    function update(dt, nowSec, opts = {}) {
      const pose = opts.pose || st.pose || "idle";
      const beat = opts.beatPulse ?? 0.25;
      const t = nowSec + st.phase;
      const dRate = clamp(dt * 10, 0, 1);

      // Resetclavicle offsets smoothly before applying pose
      let pY = 0.92, spineX = 0, spineY = 0, spineZ = 0;
      let headX = 0, headY = 0, headZ = 0;
      let lHipX = 0, rHipX = 0, lHipZ = 0, rHipZ = 0, lKneeX = 0.05, rKneeX = 0.05;
      let lArmX = 0.06, rArmX = 0.06, lArmZ = 0.08, rArmZ = -0.08, lArmY = 0, rArmY = 0;
      let lElbX = -0.18, rElbX = -0.18;
      let lClavY = armL.baseY, rClavY = armR.baseY, lClavZ = 0, rClavZ = 0;

      props.pourCan.visible = pose === "pour";
      props.shoulderCan.visible = Boolean((opts.carryCan ?? st.carryCan) && pose !== "pour" && pose !== "drive");

      // Subtle head-look toward target when idle/listening/talking
      if (opts.lookAt && pose !== "drive") {
        const dx = opts.lookAt.x - group.position.x;
        const dz = opts.lookAt.z - group.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.4 && dist < 28) {
          const wantYaw = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(wantYaw - group.rotation.y), Math.cos(wantYaw - group.rotation.y));
          if (Math.abs(diff) < 1.35) headY = clamp(diff * 0.62, -0.65, 0.65);
        }
      }

      if (pose === "walk" || pose === "lead") {
        const w = t * 5.2 * (opts.walkSpeed || st.walkSpeed || 1);
        const s = Math.sin(w), c = Math.cos(w);
        pY = 0.92 + Math.abs(c) * 0.032;
        spineX = 0.06;
        spineY = -s * 0.08;
        lHipX = -s * 0.52;
        rHipX = s * 0.52;
        lKneeX = Math.max(0.05, s * 0.58);
        rKneeX = Math.max(0.05, -s * 0.58);
        lArmX = s * 0.42;
        lElbX = -0.28 - Math.max(0, -s) * 0.25;
        if (props.shoulderCan.visible) {
          // Right hand raised to steady the cyan jerikan balanced on shoulder blade
          rArmX = -1.15;
          rArmZ = -0.24;
          rElbX = -1.35;
        } else if (pose === "lead") {
          rArmX = -0.48 + s * 0.10;
          rElbX = -0.42;
        } else {
          rArmX = -s * 0.42;
          rElbX = -0.28 - Math.max(0, s) * 0.25;
        }
      } else if (pose === "dance") {
        // Authentic 6/8 Ethiopian Eskista: rapid shoulder/clavicle pops, torso forward lean, knee bounce
        const ph = nowSec * 10.2 + st.phase * 0.5;
        const pop = Math.sin(ph * 2.0);
        const alt = Math.cos(ph * 2.0);
        const amp = 0.72 + beat * 0.42;
        pY = 0.89 + Math.abs(Math.sin(ph)) * 0.045 * amp;
        spineX = 0.16 + Math.sin(ph) * 0.06 * amp;
        spineY = Math.sin(ph * 0.5) * 0.18;
        spineZ = Math.cos(ph) * 0.05;
        lClavY = armL.baseY + Math.max(-0.02, pop) * 0.058 * amp;
        rClavY = armR.baseY + Math.max(-0.02, -pop) * 0.058 * amp;
        lClavZ = alt * 0.048 * amp;
        rClavZ = -alt * 0.048 * amp;
        lArmX = -0.32 + pop * 0.18 * amp;
        rArmX = -0.32 - pop * 0.18 * amp;
        lArmZ = 0.34 + Math.abs(pop) * 0.12;
        rArmZ = -0.34 - Math.abs(pop) * 0.12;
        lElbX = -1.28;
        rElbX = -1.28;
        lHipX = -0.14 - Math.abs(Math.sin(ph)) * 0.12;
        rHipX = -0.14 - Math.abs(Math.cos(ph)) * 0.12;
        lKneeX = 0.28 + Math.abs(Math.sin(ph)) * 0.18;
        rKneeX = 0.28 + Math.abs(Math.cos(ph)) * 0.18;
        headX = -0.08 + Math.sin(ph * 2.0) * 0.08 * amp;
        headZ = Math.cos(ph) * 0.07;
      } else if (pose === "pump") {
        const stroke = Math.sin(nowSec * 4.5);
        pY = 0.88 + stroke * 0.04;
        spineX = 0.24 - stroke * 0.14;
        lArmX = -0.95 + stroke * 0.38;
        rArmX = -0.95 + stroke * 0.38;
        lArmY = -0.18;
        rArmY = 0.18;
        lElbX = -0.55 - stroke * 0.22;
        rElbX = -0.55 - stroke * 0.22;
        lHipX = -0.18;
        rHipX = -0.08;
        lKneeX = 0.26;
        rKneeX = 0.14;
      } else if (pose === "pour") {
        const tip = 0.5 + 0.5 * Math.sin(nowSec * 2.2);
        pY = 0.84;
        spineX = 0.36 + tip * 0.08;
        lArmX = -0.92;
        rArmX = -0.96 - tip * 0.16;
        lArmY = -0.22;
        rArmY = 0.16;
        lElbX = -0.55;
        rElbX = -0.48;
        lHipX = -0.28;
        rHipX = -0.16;
        lKneeX = 0.42;
        rKneeX = 0.25;
      } else if (pose === "camera") {
        // Operating 8x10 mahogany view camera: left hand on front standard, right hand raising shutter bulb
        const squeeze = Math.sin(nowSec * 2.1);
        pY = 0.90;
        spineX = 0.10;
        lArmX = -0.88;
        lArmZ = 0.12;
        lElbX = -0.45;
        rArmX = -1.12 + squeeze * 0.06;
        rArmZ = -0.28;
        rElbX = -0.95;
        headX = 0.08;
      } else if (pose === "listen") {
        // Holding enamel microphone-cup / earphone to ear & swaying gently
        const sw = Math.sin(t * 2.1);
        pY = 0.92;
        spineZ = sw * 0.035;
        rArmX = -1.08;
        rArmZ = -0.10;
        rArmY = 0.24;
        rElbX = -1.42;
        lArmX = -0.48;
        lElbX = -0.82;
        headZ = sw * 0.05 + 0.04;
      } else if (pose === "sing") {
        // Expressive live vocal answer at screening sheet
        const sw = Math.sin(t * 2.8);
        const lift = 0.5 + 0.5 * Math.sin(t * 1.6);
        pY = 0.92 + lift * 0.015;
        spineX = -0.04;
        spineY = sw * 0.12;
        lArmX = -0.62 - lift * 0.28;
        lArmZ = 0.26;
        lElbX = -0.68;
        rArmX = -0.78 - (1 - lift) * 0.25;
        rArmZ = -0.24;
        rElbX = -0.85;
        headX = -0.08 - lift * 0.06;
      } else if (pose === "wave") {
        const wv = Math.sin(nowSec * 6.5);
        rArmX = -2.25;
        rArmZ = -0.35 + wv * 0.22;
        rElbX = -0.55 + wv * 0.25;
        lArmX = -0.15;
        lElbX = -0.35;
      } else if (pose === "drive") {
        // Seated in Cruiser Woody cab gripping wheel
        const stAng = opts.steer || st.steer || 0;
        pY = 0.54;
        spineX = -0.06;
        lHipX = -1.32;
        rHipX = -1.32;
        lHipZ = 0.08;
        rHipZ = -0.08;
        lKneeX = 1.18;
        rKneeX = 1.18;
        lArmX = -0.92 + stAng * 0.25;
        rArmX = -0.92 - stAng * 0.25;
        lArmY = -0.14;
        rArmY = 0.14;
        lElbX = -0.45;
        rElbX = -0.45;
      } else {
        // Idle breathing & subtle stance
        const br = Math.sin(t * 1.7);
        pY = 0.92 + br * 0.008;
        spineZ = Math.sin(t * 0.85) * 0.018;
        lArmX = 0.05 + br * 0.025;
        rArmX = -0.18 - br * 0.025;
        lElbX = -0.22;
        rElbX = spec.prop ? -0.78 : -0.24;
        if (props.shoulderCan.visible) {
          rArmX = -1.12;
          rArmZ = -0.22;
          rElbX = -1.32;
        }
      }

      pelvis.position.y = lerp(pelvis.position.y, pY, dRate);
      spine.rotation.set(
        lerp(spine.rotation.x, spineX, dRate),
        lerp(spine.rotation.y, spineY, dRate),
        lerp(spine.rotation.z, spineZ, dRate)
      );
      head.rotation.set(
        lerp(head.rotation.x, headX, dRate),
        lerp(head.rotation.y, headY, dRate),
        lerp(head.rotation.z, headZ, dRate)
      );
      legL.hip.rotation.x = lerp(legL.hip.rotation.x, lHipX, dRate);
      legR.hip.rotation.x = lerp(legR.hip.rotation.x, rHipX, dRate);
      legL.hip.rotation.z = lerp(legL.hip.rotation.z, lHipZ, dRate);
      legR.hip.rotation.z = lerp(legR.hip.rotation.z, rHipZ, dRate);
      legL.knee.rotation.x = lerp(legL.knee.rotation.x, lKneeX, dRate);
      legR.knee.rotation.x = lerp(legR.knee.rotation.x, rKneeX, dRate);

      armL.clavicle.position.y = lerp(armL.clavicle.position.y, lClavY, dRate);
      armR.clavicle.position.y = lerp(armR.clavicle.position.y, rClavY, dRate);
      armL.clavicle.position.z = lerp(armL.clavicle.position.z, lClavZ, dRate);
      armR.clavicle.position.z = lerp(armR.clavicle.position.z, rClavZ, dRate);

      armL.clavicle.rotation.set(
        lerp(armL.clavicle.rotation.x, lArmX, dRate),
        lerp(armL.clavicle.rotation.y, lArmY, dRate),
        lerp(armL.clavicle.rotation.z, lArmZ, dRate)
      );
      armR.clavicle.rotation.set(
        lerp(armR.clavicle.rotation.x, rArmX, dRate),
        lerp(armR.clavicle.rotation.y, rArmY, dRate),
        lerp(armR.clavicle.rotation.z, rArmZ, dRate)
      );
      armL.elbow.rotation.x = lerp(armL.elbow.rotation.x, lElbX, dRate);
      armR.elbow.rotation.x = lerp(armR.elbow.rotation.x, rElbX, dRate);
    }

    return { group, bodyRoot, pelvis, head, label, state: st, props, place, setSpeech, update };
  }

  function makeExpeditionCast(T, cfg) {
    const { parent, surfaceAt, hasAhiya = false } = cfg;
    const castGroup = new T.Group();
    parent.add(castGroup);

    const defs = [
      {
        id: "imani", name: "Imani", role: "Western Carrier · Saddle Mechanic",
        x: -24.2, z: -2.4, heading: 1.45, scale: 1.0,
        skin: "skinDeep", tunic: "gabiIvory", lower: "indigoCoat", hair: "braids",
        satchel: true, carryCan: true, shawl: true
      },
      {
        id: "june", name: "June", role: "Ruth's Daughter · WF-08 Listener",
        x: -20.3, z: -4.7, heading: -2.15, scale: 0.80,
        skin: "skinWarm", tunic: "gabiIvory", lower: "ochreEarth", hair: "puffs",
        skirt: true, prop: "micCup", pose: "listen", shawl: true
      },
      {
        id: "nell", name: "Nell", role: "Switchback Baker · Meal Slip",
        x: -44.2, z: -163.5, heading: 0.65, scale: 0.97,
        skin: "skinWarm", tunic: "ochreEarth", lower: "canvasSlate", hair: "shash",
        skirt: true, prop: "chalk", pose: "idle", shawl: true
      },
      {
        id: "etta", name: "Etta", role: "Silver Ford Print Keeper",
        x: -243.8, z: -51.6, heading: 0.85, scale: 0.98,
        skin: "skinRich", tunic: "gabiIvory", lower: "indigoCoat", hair: "shash",
        hairColor: "hairSilver", skirt: true, prop: "slips", pose: "idle", shawl: true
      },
      {
        id: "makeda", name: "Makeda", role: "Oxbow Yard Projectionist",
        x: -512.2, z: 92.8, heading: 0.52, scale: 0.99,
        skin: "skinDeep", tunic: "gabiIvory", lower: "canvasSlate", hair: "braids",
        satchel: true, prop: "phone", pose: "idle", shawl: true
      },
      {
        id: "tess", name: "Tess", role: "Pueblo Cooling & Archive Registrar",
        x: -775.8, z: -31.2, heading: 0.42, scale: 1.0,
        skin: "skinWarm", tunic: "indigoCoat", lower: "canvasSlate", hair: "hat",
        prop: "ledger", pose: "idle", shawl: true
      },
      {
        id: "dawit", name: "Dawit", role: "Whale Fluke Reef Projectionist",
        x: -1067.5, z: -22.8, heading: 0.58, scale: 1.02,
        skin: "skinDeep", tunic: "gabiIvory", lower: "indigoCoat", hair: "hat",
        satchel: true, prop: "slips", pose: "idle", shawl: true
      },
      {
        id: "ruth_keeper", name: "Martha", role: "East Apron Float Keeper",
        x: 431.4, z: 34.8, heading: -0.75, scale: 0.96,
        skin: "skinRich", tunic: "ochreEarth", lower: "canvasSlate", hair: "shash",
        hairColor: "hairSilver", prop: "ledger", pose: "idle", shawl: true
      }
    ];

    if (hasAhiya) {
      defs.push(
        {
          id: "saba", name: "Saba", role: "Basalt Pump Keeper · 4L Chalk",
          x: -1449.6, z: 766.4, heading: -0.85, scale: 0.99,
          skin: "skinRich", tunic: "gabiIvory", lower: "ochreEarth", hair: "shash",
          skirt: true, prop: "chalk", pose: "idle", shawl: true
        },
        {
          id: "rahel", name: "Rahel", role: "Ahiya Night Sound Runner",
          x: -1761.5, z: 555.2, heading: 0.25, scale: 0.98,
          skin: "skinDeep", tunic: "gabiIvory", lower: "indigoCoat", hair: "braids",
          satchel: true, carryCan: true, prop: "phone", pose: "idle", shawl: true
        },
        {
          id: "aunt", name: "Rahel's Aunt", role: "AR-03 Custodian & Live Singer",
          x: -1675.4, z: 780.6, heading: 0.35, scale: 0.98,
          skin: "skinWarm", tunic: "gabiIvory", lower: "indigoCoat", hair: "shash",
          skirt: true, prop: "sheet", pose: "sing", shawl: true
        }
      );
    }

    const byId = Object.create(null);
    const list = [];
    for (const d of defs) {
      const ch = makeCharacter(T, d);
      ch.home = { x: d.x, z: d.z, heading: d.heading, pose: d.pose || "idle" };
      ch.place(d.x, d.z, d.heading, surfaceAt);
      castGroup.add(ch.group);
      byId[d.id] = ch;
      list.push(ch);
    }

    const tmpWorld = new T.Vector3();

    function resetHomes() {
      for (const ch of list) {
        if (ch.group.parent !== castGroup) castGroup.add(ch.group);
        ch.group.visible = true;
        ch.state.pose = ch.home.pose;
        ch.setSpeech("");
        ch.place(ch.home.x, ch.home.z, ch.home.heading, surfaceAt);
      }
    }

    function update(dt, nowSec, env) {
      const { state, donkey, wagon, camera, fieldRigGroup, machinimaActive, hideLabels } = env;
      const imani = byId.imani;
      const dancingGlobal = state.danceTimer > 0;

      // Update Imani in normal gameplay when machinima isn't overriding her choreography
      if (imani && !machinimaActive) {
        const inWagon = state.drivingCart || (state.gliding && state.donkeyOnRoof);
        if (inWagon && wagon && wagon.chassis) {
          // Seat Imani inside the Cruiser Woody cab behind the steering wheel!
          if (imani.group.parent !== wagon.chassis) wagon.chassis.add(imani.group);
          imani.group.visible = true;
          imani.group.position.set(0.38, 0.44, 0.32);
          imani.group.rotation.set(0, 0, 0, "YXZ");
          if (imani.label) imani.label.sprite.visible = false;
          imani.update(dt, nowSec, { pose: "drive", steer: wagon.steerAngle * 2.2, carryCan: false, beatPulse: state.beatPulse });
        } else {
          if (imani.group.parent !== castGroup) castGroup.add(imani.group);
          if (state.gliding && !state.donkeyOnRoof) {
            // Hang-gliding beside/under Mistletoe's wing
            imani.group.visible = false;
          } else if (state.riding) {
            // Striding/jogging right at Mistletoe's left shoulder holding the halter lead
            const hdg = donkey.state.heading;
            const sinH = Math.sin(hdg), cosH = Math.cos(hdg);
            const lx = donkey.state.x + cosH * 0.95 + sinH * 0.35;
            const lz = donkey.state.z - sinH * 0.95 + cosH * 0.35;
            imani.place(lx, lz, hdg, surfaceAt);
            imani.group.visible = true;
            const spd = Math.abs(donkey.state.speed || 0);
            imani.update(dt, nowSec, {
              pose: spd > 0.35 ? "lead" : "idle",
              walkSpeed: clamp(spd / 3.8, 0.75, 2.1),
              carryCan: true,
              beatPulse: state.beatPulse,
              lookAt: camera.position
            });
          } else if (state.pourAnim) {
            const r = state.pourAnim.relay;
            const ang = Math.atan2(r.x - donkey.state.x, r.z - donkey.state.z);
            const px = donkey.state.x + Math.cos(ang) * 1.15;
            const pz = donkey.state.z - Math.sin(ang) * 1.15;
            imani.place(px, pz, Math.atan2(r.x - px, r.z - pz), surfaceAt);
            imani.group.visible = true;
            imani.update(dt, nowSec, { pose: "pour", beatPulse: state.beatPulse });
          } else if (state.rigDeployed && fieldRigGroup && fieldRigGroup.visible) {
            const rx = fieldRigGroup.position.x - Math.cos(fieldRigGroup.rotation.y) * 0.68;
            const rz = fieldRigGroup.position.z + Math.sin(fieldRigGroup.rotation.y) * 0.68;
            imani.place(rx, rz, fieldRigGroup.rotation.y, surfaceAt);
            const camD = Math.hypot(camera.position.x - rx, camera.position.z - rz);
            imani.group.visible = camD > 1.35;
            imani.update(dt, nowSec, { pose: dancingGlobal ? "dance" : "camera", carryCan: false, beatPulse: state.beatPulse });
          } else {
            // Standing/walking companion near Mistletoe's flank (hidden if FPS camera steps inside her radius)
            const hdg = donkey.state.heading;
            const tx = donkey.state.x + Math.cos(hdg) * 1.55 - Math.sin(hdg) * 0.55;
            const tz = donkey.state.z - Math.sin(hdg) * 1.55 - Math.cos(hdg) * 0.55;
            const stepDist = Math.hypot(tx - imani.state.x, tz - imani.state.z);
            if (stepDist > 18) {
              imani.place(tx, tz, hdg, surfaceAt);
            } else if (stepDist > 0.35) {
              const nx = lerp(imani.state.x, tx, clamp(dt * 3.5, 0, 1));
              const nz = lerp(imani.state.z, tz, clamp(dt * 3.5, 0, 1));
              imani.place(nx, nz, Math.atan2(tx - imani.state.x, tz - imani.state.z), surfaceAt);
            } else {
              imani.place(imani.state.x, imani.state.z, imani.state.heading, surfaceAt);
            }
            const camD = Math.hypot(camera.position.x - imani.state.x, camera.position.z - imani.state.z);
            imani.group.visible = camD > 2.15;
            const moving = stepDist > 0.45 || Math.abs(donkey.state.speed || 0) > 0.4;
            imani.update(dt, nowSec, {
              pose: dancingGlobal ? "dance" : (state.pumpFlow > 0.65 && Math.hypot(imani.state.x - (-22.2), imani.state.z - (-6.2)) < 7) ? "pump" : moving ? "walk" : "idle",
              carryCan: true,
              beatPulse: state.beatPulse,
              lookAt: camera.position
            });
          }
        }
      }

      // Update all station NPCs + label sprite visibility
      for (const ch of list) {
        const inWagonCab = ch === imani && wagon && ch.group.parent === wagon.chassis;
        ch.group.getWorldPosition(tmpWorld);
        const camDist = camera.position.distanceTo(tmpWorld);
        if (ch !== imani && !machinimaActive) {
          let p = ch.home.pose || "idle";
          if (dancingGlobal && camDist < 42) p = "dance";
          else if (state.pourAnim && camDist < 24) p = "wave";
          else if (camDist < 10 && p === "idle") p = "idle";
          ch.update(dt, nowSec, { pose: p, beatPulse: state.beatPulse, lookAt: camera.position });
        }
        if (ch.label) {
          const show = !inWagonCab && !hideLabels && ch.group.visible && camDist < (machinimaActive ? 48 : 65) && camDist > 1.8;
          ch.label.sprite.visible = show;
          if (show) {
            const distScale = clamp(camDist * 0.16, 0.68, 1.25);
            ch.label.sprite.scale.set(1.12 * distScale, 0.285 * distScale, 1);
            ch.label.mat.opacity = clamp(smooth(65, 40, camDist), 0.15, 0.92);
          }
        }
      }
    }

    return { group: castGroup, byId, list, resetHomes, update };
  }

  window.makeCharacter = makeCharacter;
  window.makeExpeditionCast = makeExpeditionCast;
})();
