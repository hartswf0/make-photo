/* Donkey Water 3D Study Plate Workbench — People, Props, Architecture & Film Keyframe Atlas.
   Modeled directly on /donkey/index.html's Study Plate mode ("the subject alone on paper,
   for comparing with reference sheets"). */
(function () {
  "use strict";

  const T = window.THREE;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  /* ---------- Complete 16-Cut Atlas Extracted from https://www.youtube.com/watch?v=ZZlDs10FCZk ---------- */
  const YT_ID = "ZZlDs10FCZk";
  const FILM_KEYFRAMES = [
    {
      id: "kf01", sec: 1, time: "00:01", img: "./keyframes/kf01_00m01s_droplet_rec_ppc.jpg",
      title: "REC PPC · Living Cyan Droplet on Basalt",
      teaches: "Establishes the world's core color law: monochrome silver-gelatin basalt & dust with high-index selective electric-cyan (#28d8f0) water."
    },
    {
      id: "kf02", sec: 2, time: "00:02", img: "./keyframes/kf02_00m02s_iron_standpipe_pump.jpg",
      title: "REC PPC · Cast-Iron Standpipe & Concrete Pad",
      teaches: "Exact standpipe proportions: bolted circular base flange, fluted cast-iron column, domed cap, downward-curved spout, and concrete pad."
    },
    {
      id: "kf03", sec: 3, time: "00:03", img: "./keyframes/kf03_00m03s_hand_jerrycan_transfer.jpg",
      title: "REC PPC · Close-Up Hand-to-Can Pour",
      teaches: "Rolled work-shirt cuff, knuckle tendons gripping threaded spout, and embossed-X stiffening ribs on the 20L white jerrycan."
    },
    {
      id: "kf04", sec: 7, time: "00:07", img: "./keyframes/kf04_00m07s_two_hand_basin_pour.jpg",
      title: "REC PPC (t=7s) · Two-Handed 20 kg Basin Pour",
      teaches: "Key biomechanical reference: button-placket work shirt, left hand on top handle, right hand cupping bottom corner, pouring into ribbed round tub."
    },
    {
      id: "kf05", sec: 16, time: "00:16", img: "./keyframes/kf05_00m16s_sunrise_translucent_can.jpg",
      title: "Backlit Translucent 20L X-Ribbed Jerrycan",
      teaches: "Subsurface water level refraction through semi-translucent HDPE walls with raised diagonal X-ribs and braced carrier legs behind."
    },
    {
      id: "kf06", sec: 20, time: "00:20", img: "./keyframes/kf06_00m20s_highland_stone_chapel.jpg",
      title: "Highland Gabled Stone Cross-Chapel",
      teaches: "Stepped stone plinth, limewashed plaster facade, corner pilasters, semicircular arched timber doorway, gable lancet belfry, eave finials & cross."
    },
    {
      id: "kf07", sec: 23, time: "00:23", img: "./keyframes/kf07_00m24s_cyan_server_sanctuary.jpg",
      title: "Liquid-Cooled Cross Server Sanctuary",
      teaches: "19-inch black server racks fed by thick glowing cyan cooling hoses curving out of floor ports, overhead steel ducts, and white sanctuary Cross."
    },
    {
      id: "kf08", sec: 36, time: "00:36", img: "./keyframes/kf08_00m36s_rec_ppc_desk_radio.jpg",
      title: "Hill Archive REC PPC Cubicle & VHF Radio Call",
      teaches: "Two-operator desk choreography: male in glasses logging on clipboard; female in ponytail lifting VHF radio to speak in front of live monitor."
    },
    {
      id: "kf09", sec: 48, time: "00:48", img: "./keyframes/kf09_00m48s_night_youths_phone_glow.jpg",
      title: "Ahiya Night Youths · Two-Handed Phone Face-Glow",
      teaches: "Woven Ethiopian gabi wraps, smartphones held in both hands casting upward cyan-blue bounce light onto chins/cheeks, and waist LED nodes."
    },
    {
      id: "kf10", sec: 54, time: "00:54", img: "./keyframes/kf10_00m56s_citadel_beacon_mesh.jpg",
      title: "Hilltop Cross-Beacon Citadel & Valley WiFi Mesh",
      teaches: "Terraced stone hilltop sanctuary shooting a vertical cyan sky pillar while geodesic AHIYA AREA NETWORK nodes link trails across the valley."
    },
    {
      id: "kf11", sec: 58, time: "00:58", img: "./keyframes/kf11_01m02s_water_wifi_stenciled_pack.jpg",
      title: "Stenciled WATER = WIFI Pack & Browband Emblem",
      teaches: "Rope-cradled glowing blue carboys stenciled 'WATER = WIFI / SIGNAL OF GOD / +' alongside hooded wool-wrapped night escorts holding tablets."
    },
    {
      id: "kf12", sec: 72, time: "01:12", img: "./keyframes/kf12_01m12s_draped_elders_procession.jpg",
      title: "Draped Highland Elders in Shamma & Turbans",
      teaches: "Multi-layered wool/cotton shamma & burnous shawls, coiled turbans, patterned headscarves, trimmed beards, and cracked earth with cyan nodes."
    },
    {
      id: "kf13", sec: 86, time: "01:26", img: "./keyframes/kf13_01m26s_ots_smartphone_citadel.jpg",
      title: "Over-the-Shoulder Smartphone Signal HUD",
      teaches: "Framing grammar connecting handheld signal telemetry in the foreground to the donkey caravan and searchlight citadel on the horizon."
    },
    {
      id: "kf14", sec: 98, time: "01:38", img: "./keyframes/kf14_01m45s_two_man_20kg_unload.jpg",
      title: "Two-Man 20 kg Jerrycan Unload off Sawbuck",
      teaches: "True 20 kg effort: furrowed brow, parted jaw, 12° spine counterbalance, wooden sawbuck horn, quilted saddle pad, and braided white sisal rope."
    },
    {
      id: "kf15", sec: 113, time: "01:53", img: "./keyframes/kf15_01m53s_father_child_hidmo_village.jpg",
      title: "Father & Child Handoff · Hidmo Earthen Village",
      teaches: "Bearded carrier in collarless brown tunic + child with short locs & indigo tibeb shoulder-strap tunic; flat-roofed ochre hidmo houses behind."
    },
    {
      id: "kf16", sec: 123, time: "02:03", img: "./keyframes/kf16_02m03s_terracotta_donkey_bowl.jpg",
      title: "Wheel-Thrown Terracotta Donkey Watering Bowl",
      teaches: "Wide rolled-lip terracotta clay basin (shekla) with 3 incised throwing rings on wet bedrock right beside the donkey's front hooves."
    }
  ];

  /* ---------- 6 Targeted AI Video Generation Briefs (Filling Every Gap Not in ZZlDs10FCZk) ---------- */
  const VIDEO_BRIEFS = [
    {
      title: "1 · Full-Body 6/8 Ethiopian Eskista Shoulder-Isolation Loop (6s, 16:9)",
      why: "ZZlDs10FCZk has zero footage of Eskista dancing. Needed to tune exact clavicle protraction/retraction timing, thoracic counter-bounce, and shamma drape lag.",
      prompt: "Studio biomechanical motion-reference video on warm neutral paper (#d9d5cb), Ansel Adams silver-gelatin monochrome. Full-body 3/4 view of an Ethiopian woman and elder man in hand-loomed cotton shamma shawls and work boots performing authentic 6/8 Eskista shoulder dance: sharp rhythmic clavicle and scapula forward-back isolations, subtle neck phrasing, relaxed bent elbows with open hands, synchronized knee bounce, crisp cloth fold follow-through, 60fps steady tripod."
    },
    {
      title: "2 · Full-Body Cast-Iron Wellhead Pump Leverage Cycle (6s, 16:9)",
      why: "ZZlDs10FCZk (00:02 & 00:16) crops tight on the pump spout. A full-body side profile gives exact hip-hinge, knee drive, and wrist pivot angles across top-to-bottom stroke.",
      prompt: "Side-profile biomechanical reference video, silver-gelatin monochrome with selective electric-cyan (#28d8f0) water only. A Black female carrier in a weathered open canvas duster coat with hip steel wrenches braces her laced boots on wet stone and pumps a tall cast-iron wellhead lever through three full strokes: high upward reach, full body-weight transfer on the down-stroke, thick glowing cyan water gushing from the curved iron spout into a terracotta clay bowl."
    },
    {
      title: "3 · Cottonwood Root-Bowl Kneeling Pour & Billowing Double Linen Screen (8s, 16:9)",
      why: "World Bible Page 15 ('Cottonwood Oxbow') is not in ZZlDs10FCZk. Needed for wind-harmonic cloth displacement on pegged forest sheets and kneeling one-knee balance.",
      prompt: "Wide medium shot in a dusk cottonwood forest, silver-gelatin monochrome with selective glowing electric-cyan (#28d8f0) water. On the left, a braided young woman in a field parka kneels on one knee beside gnarled cottonwood roots, tipping a tin dipper to pour glowing cyan water into a hollowed root-bowl while translucent 35mm filmstrip leaves sway overhead. On the right, two layered linen bedsheets pegged to ropes between trunks billow gently in mountain wind with a projected monochrome wedding reel while an older silver-haired woman in a shawl raises her hand to shade a face in the beam."
    },
    {
      title: "4 · Wire-Glass Registry Window Ledger Stamp & Three-Branch Hose Yard (8s, 16:9)",
      why: "Bridges ZZlDs10FCZk's server hall (00:23) to World Bible Pages 13 & 18: clerk hand mechanics through a pass-through slot and mud-yard splitter hose layout.",
      prompt: "Two-part continuous dolly shot, silver-gelatin monochrome with selective electric-cyan (#28d8f0) water. Starts low over wet highland cobblestones where black rubber and glowing cyan manifold hoses split into three branches—feeding a concrete cooling bay, a tin mug on a stone slab, and a root pit—then dollies up to a Georgian diamond wire-glass service window where a female clerk in rolled sleeves stamps a thick cloth-bound Ration Ledger beside a chipped enamel cup and slides a paper receipt through the slot, with glowing cyan server cooling pipes visible behind her."
    },
    {
      title: "5 · Sawbuck Diamond-Hitch Cinching & Saddle-Slip Recovery with Donkey (8s, 16:9)",
      why: "Extends ZZlDs10FCZk (01:45–01:55) to show exact sisal-rope knot tensioning, knee-against-ribs leverage, and donkey weight-shift reaction when cinching 40 kg.",
      prompt: "Medium 3/4 documentary shot in an Ethiopian highland compound, silver-gelatin monochrome with selective glowing cyan 20L jerrycans. A bearded carrier in a loose linen tunic and coiled turban lashes two translucent X-ribbed 20L cyan jerrycans onto a wooden X-frame sawbuck saddle on a grey pack donkey using braided sisal rope: pulling the cinch tight, checking side-to-side balance with both hands while the donkey shifts weight and flicks one ear."
    },
    {
      title: "6 · Highland Hidmo & Corrugated-Stone Courtyard Architectural Walkthrough (8s, 16:9)",
      why: "Combines ZZlDs10FCZk's ochre hidmo village (01:53) and stone cross-chapel (00:20) with World Bible Page 13's two-story corrugated-iron masonry houses.",
      prompt: "Slow steadicam architectural survey through an Ethiopian-Teton highland village at overcast dawn, crisp Ansel Adams Zone System silver-gelatin monochrome with selective cyan water in courtyard wells. Passes a two-story coursed-basalt and limewash house with corrugated iron gable roof weighed down by river stones and a swaying laundry line, enters an L-shaped flat-roofed hidmo mud-and-stone courtyard with protruding cedar vigas and a glowing cyan stone well, and frames a gabled stone chapel with rooftop cross against snow peaks."
    }
  ];

  /* ---------- 10 Live Interactive 3D Study Plates ---------- */
  const STUDIES = [
    {
      id: "t7_basin_pour",
      short: "1 · t=7s Pour",
      title: "1 · Imani & 20 kg Two-Handed Basin Pour",
      cat: "HUMAN BIOMECHANICS · ZZlDs10FCZk (00:07)",
      note: "Left hand grips the molded top handle, right hand cups the bottom rib, knees flex & pelvis counterbalances 20 kg over a wheel-thrown clay shekla bowl.",
      night: false,
      cam: { dist: 2.85, yaw: 0.42, pitch: 0.14, targetY: 0.92 },
      kfIds: ["kf04", "kf03", "kf16"],
      sheet: "./generated/study_sheet_motion.jpg",
      sheetCap: "Generated Motion Study Sheet — Strip 2: 20 kg Jerrycan Lift, Hip Counterbalance & Two-Handed Basin Pour."
    },
    {
      id: "father_child_20kg",
      short: "2 · 01:53 Handoff",
      title: "2 · Elder Carrier & Child · 20 kg Handoff",
      cat: "TWO-CHARACTER WEIGHT & CLOTH · ZZlDs10FCZk (01:53)",
      note: "Bearded carrier in coiled turban & draped shamma lowers the embossed-X 20L jerrycan while June (short locs + indigo tibeb trim) reaches up with both hands.",
      night: false,
      cam: { dist: 3.1, yaw: 0.28, pitch: 0.12, targetY: 0.95 },
      kfIds: ["kf15", "kf14"],
      sheet: "./generated/study_sheet_characters.jpg",
      sheetCap: "Generated Character Turnaround Sheet — Orthographic Front/Side/Back, Facial Planes, Sisal Rope & Hand-Grip Callouts."
    },
    {
      id: "eskista_trio",
      short: "3 · Eskista 6/8",
      title: "3 · 6/8 Ethiopian Eskista Shoulder-Isolation Trio",
      cat: "DANCE BIOMECHANICS & SHAMMA DRAPE",
      note: "Sharp 6/8 clavicle & scapula forward-back pops, thoracic counter-groove, relaxed bent elbows, knee-bounce sync & spring-damped head phrasing.",
      night: false,
      cam: { dist: 3.4, yaw: 0.18, pitch: 0.12, targetY: 0.98 },
      kfIds: ["kf12", "kf15"],
      sheet: "./generated/study_sheet_motion.jpg",
      sheetCap: "Generated Motion Study Sheet — Strip 1: 6/8 Eskista Scapula Protraction, Shamma Follow-Through & Knee Bounce."
    },
    {
      id: "pump_leverage",
      short: "4 · Pump Stroke",
      title: "4 · Full-Weight Cast-Iron Standpipe Pump Stroke",
      cat: "TOOL IK & BODY LEVERAGE · ZZlDs10FCZk (00:02)",
      note: "Two-bone arm & leg IK driving full-body weight transfer on the down-stroke beside the cast-iron standpipe and terracotta donkey basin.",
      night: false,
      cam: { dist: 2.9, yaw: 0.95, pitch: 0.14, targetY: 0.92 },
      kfIds: ["kf02", "kf05"],
      sheet: "./generated/study_sheet_motion.jpg",
      sheetCap: "Generated Motion Study Sheet — Strip 3: Maximum Upward Reach to Full Weight-Transfer Down-Stroke."
    },
    {
      id: "night_convoy",
      short: "5 · Night Phones",
      title: "5 · Ahiya Night Convoy · Upward Phone Face-Glow",
      cat: "NIGHT LIGHTING & DRAPED WALK · ZZlDs10FCZk (00:48 & 01:12)",
      note: "Rahel, Yared & Turbaned Elder walking beside Mistletoe's cyan-window panniers; handheld phones cast real upward blue-cyan point light onto faces & shawls.",
      night: true,
      cam: { dist: 3.25, yaw: 0.22, pitch: 0.10, targetY: 1.02 },
      kfIds: ["kf09", "kf12", "kf11"],
      sheet: "./generated/study_sheet_characters.jpg",
      sheetCap: "Night-Route Illumination Study — Selective cyan pack & upward phone bounce on sculpted cheekbones, eyelids, beards & shamma folds."
    },
    {
      id: "hill_desk",
      short: "6 · REC PPC Desk",
      title: "6 · Hill Archive Operators · Live VHF Radio & Log",
      cat: "SEATED ACTING & MICRO-LIFE · ZZlDs10FCZk (00:36)",
      note: "Daniel (wire spectacles, writing on clipboard) & Hanna (ponytail, periodically picking up the VHF radio handset to speak and setting it back down).",
      night: false,
      cam: { dist: 3.45, yaw: 0.24, pitch: 0.22, targetY: 1.02 },
      kfIds: ["kf08", "kf13"],
      sheet: "./generated/study_sheet_characters.jpg",
      sheetCap: "Seated Cubicle Acting — Autonomous eye saccades, spring-damped head turns, and timed VHF radio call cycle."
    },
    {
      id: "arch_hidmo",
      short: "7 · Hidmo House",
      title: "7 · Highland Hidmo Compound & Cyan Courtyard Well",
      cat: "VERNACULAR ARCHITECTURE · ZZlDs10FCZk (01:53)",
      note: "L-shaped flat-roofed stone-and-mud Ethiopian hidmo compound with parapet coping, protruding cedar vigas, recessed timber windows & circular cyan well.",
      night: false,
      cam: { dist: 12.6, yaw: 0.58, pitch: 0.30, targetY: 1.45 },
      kfIds: ["kf15", "kf10"],
      sheet: "./generated/study_sheet_architecture.jpg",
      sheetCap: "Generated Architecture Sheet (a) — Highland Hidmo Compound House & Stone Cyan Courtyard Well."
    },
    {
      id: "arch_chapel",
      short: "8 · Stone Chapel",
      title: "8 · Gabled Coursed-Stone Cross-Chapel / Archive",
      cat: "MONUMENTAL MASONRY · ZZlDs10FCZk (00:20 & 00:54)",
      note: "Stepped stone plinth, coursed basalt masonry, corner limewash pilasters, semicircular arched plank door, flanking lancets, eave finials & rooftop Cross.",
      night: false,
      cam: { dist: 13.8, yaw: 0.42, pitch: 0.22, targetY: 2.85 },
      kfIds: ["kf06", "kf10"],
      sheet: "./generated/study_sheet_architecture.jpg",
      sheetCap: "Generated Architecture Sheet (b) — Gabled Highland Stone Chapel / Archive Elevation."
    },
    {
      id: "arch_sanctuary",
      short: "9 · Server & Glass",
      title: "9 · Cutaway Wire-Glass Registry & Cyan Server Sanctuary",
      cat: "INDUSTRIAL WATER-TECH · ZZlDs10FCZk (00:23) + BIBLE P.18",
      note: "Georgian diamond wire-glass Registry counter with Tess inside alongside 19-inch server racks fed by glowing cyan floor-to-rack cooling hoses & white Cross.",
      night: true,
      cam: { dist: 6.8, yaw: -0.56, pitch: 0.25, targetY: 1.42 },
      kfIds: ["kf07", "kf01"],
      sheet: "./generated/study_sheet_architecture.jpg",
      sheetCap: "Generated Architecture Sheet (c) — Cutaway Cooling Bay, Diamond Wire-Glass Registry Window & Cyan Server Hoses."
    },
    {
      id: "arch_props",
      short: "10 · Pack & Bowls",
      title: "10 · Sawbuck Frame, X-Ribbed 20L Can, Pump & Clay Bowl",
      cat: "FIELD HARDWARE & CONTAINERS · ZZlDs10FCZk (00:02, 01:38, 02:03)",
      note: "Wooden X-frame donkey sawbuck with braided sisal rope, translucent embossed-X 20L cyan jerrycan, cast-iron standpipe pump & wheel-thrown terracotta bowl.",
      night: false,
      cam: { dist: 4.15, yaw: 0.28, pitch: 0.24, targetY: 0.50 },
      kfIds: ["kf14", "kf16", "kf02", "kf05"],
      sheet: "./generated/study_sheet_architecture.jpg",
      sheetCap: "Generated Architecture Sheet (d) — Sawbuck Pack Frame, Embossed-X 20L Jerrycan, Standpipe & Terracotta Shekla Bowl."
    }
  ];

  /* ---------- Three.js Studio Paper / Night Renderer (Matching /donkey/index.html) ---------- */
  const wrap = $("stage-wrap");
  const canvas = $("view");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new T.Scene();
  const PAPER_COLOR = new T.Color(0xd9d5cb);
  const NIGHT_COLOR = new T.Color(0x141615);
  scene.background = PAPER_COLOR.clone();

  const camera = new T.PerspectiveCamera(36, 1, 0.08, 240);

  // Studio Three-Point Lighting + 2048x2048 Soft Shadow Catcher (exact /donkey/ study setup!)
  const hemi = new T.HemisphereLight(0xf2efe8, 0x8d897f, 1.65);
  scene.add(hemi);

  const sun = new T.DirectionalLight(0xfffcf4, 2.55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.012;
  Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 0.5, far: 40 });
  scene.add(sun, sun.target);

  const rim = new T.DirectionalLight(0xdcecf2, 0.85);
  scene.add(rim, rim.target);

  const shadowCatcher = new T.Mesh(
    new T.PlaneGeometry(60, 60),
    new T.ShadowMaterial({ opacity: 0.28 })
  );
  shadowCatcher.rotation.x = -Math.PI * 0.5;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  // Subtle scale grid ring on study paper (like an architect's / sculptor's turntable plinth)
  const ringGeo = new T.RingGeometry(1.48, 1.50, 64);
  ringGeo.rotateX(-Math.PI * 0.5);
  const ringMat = new T.MeshBasicMaterial({ color: 0x8a867c, transparent: true, opacity: 0.32, side: T.DoubleSide });
  const plinthRing = new T.Mesh(ringGeo, ringMat);
  plinthRing.position.y = 0.003;
  scene.add(plinthRing);

  const stageRoot = new T.Group();
  scene.add(stageRoot);

  /* ---------- Camera Orbit / Zoom Controls ---------- */
  const camState = {
    yaw: 0.42, pitch: 0.14, dist: 2.85, targetY: 0.92,
    wantYaw: 0.42, wantPitch: 0.14, wantDist: 2.85, wantTargetY: 0.92,
    turntable: false, sunDeg: 42, night: false
  };

  function updateSunDirection() {
    const rad = (camState.sunDeg * Math.PI) / 180;
    sun.position.set(Math.sin(rad) * 8.5, 9.2, Math.cos(rad) * 8.5);
    rim.position.set(-Math.sin(rad) * 7.0, 4.2, -Math.cos(rad) * 7.0);
  }
  updateSunDirection();

  function setPaperMode(isNight) {
    camState.night = isNight;
    document.body.classList.toggle("night-mode", isNight);
    scene.background.copy(isNight ? NIGHT_COLOR : PAPER_COLOR);
    hemi.intensity = isNight ? 0.36 : 1.65;
    hemi.groundColor.setHex(isNight ? 0x1d2224 : 0x8d897f);
    sun.intensity = isNight ? 0.52 : 2.55;
    rim.intensity = isNight ? 0.65 : 0.85;
    shadowCatcher.material.opacity = isNight ? 0.55 : 0.28;
    ringMat.color.setHex(isNight ? 0x3be0f5 : 0x8a867c);
    $("btn-paper").setAttribute("aria-pressed", String(!isNight));
    $("btn-paper").textContent = isNight ? "Mode: Night" : "Mode: Study Paper";
  }

  let drag = null, pinchDist = 0;
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    camState.wantYaw -= dx * 0.0075;
    camState.wantPitch = clamp(camState.wantPitch + dy * 0.0055, -0.08, 1.18);
  });
  canvas.addEventListener("pointerup", e => { if (drag && drag.id === e.pointerId) drag = null; });
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    camState.wantDist = clamp(camState.wantDist * Math.exp(e.deltaY * 0.0011), 0.58, 22.0);
  }, { passive: false });
  canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (e.touches.length === 2 && pinchDist > 0) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      camState.wantDist = clamp(camState.wantDist * (pinchDist / Math.max(20, d)), 0.58, 22.0);
      pinchDist = d;
    }
  }, { passive: true });

  /* ---------- Build & Swap Live 3D Study Scenes ---------- */
  let activeStudyIdx = 0;
  let activeActors = [];
  let activeDonkey = null;
  let manualMoodIdx = -1;
  const MOOD_CYCLE = ["auto", "calm", "focus", "strain20kg", "converse", "listen", "rejoice"];
  const flatGround = () => 0;

  function clearStage() {
    while (stageRoot.children.length) stageRoot.remove(stageRoot.children[0]);
    activeActors = [];
    activeDonkey = null;
  }

  function spawnDonkeyWithSightWindow(x, z, heading) {
    if (!window.makeDonkey) return null;
    const d = window.makeDonkey({ assetPath: "../donkey/", shells: 12, monochrome: true, contactShadow: true, alwaysHalter: true });
    d.setCargo([{ kg: 14, slot: "L" }, { kg: 14, slot: "R" }, { kg: 8, slot: "T" }]);
    // Add glowing cyan sight-window pockets matching World Bible Page 1 & ZZlDs10FCZk!
    const frameMat = new T.MeshStandardMaterial({ color: 0x1a1613, roughness: 0.68 });
    const glowMat = new T.MeshStandardMaterial({ color: 0x3ae8ff, emissive: 0x16b8df, emissiveIntensity: 1.45, roughness: 0.16 });
    d.pack.traverse(obj => {
      if (obj.isGroup && Math.abs(Math.abs(obj.position.x) - 0.095) < 0.01 && Math.abs(obj.position.y + 0.225) < 0.02) {
        const s = Math.sign(obj.position.x) || 1;
        const bezel = new T.Mesh(new T.BoxGeometry(0.016, 0.21, 0.16), frameMat);
        bezel.position.set(s * 0.105, 0.02, 0.085);
        obj.add(bezel);
        const pouch = new T.Mesh(new T.BoxGeometry(0.022, 0.17, 0.122), glowMat);
        pouch.position.set(s * 0.108, 0.02, 0.085);
        obj.add(pouch);
      }
    });
    d.place(x, z, heading, flatGround);
    d.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    stageRoot.add(d.group);
    return d;
  }

  function spawnActor(spec) {
    const ch = window.makeExpeditionCharacter(T, spec);
    ch.place(spec.x || 0, spec.z || 0, spec.heading || 0, flatGround);
    stageRoot.add(ch.group);
    activeActors.push({ ch, pose: spec.pose || "idle" });
    return ch;
  }

  function countTriangles(root) {
    let tris = 0;
    root.traverse(o => {
      if (o.isMesh && o.geometry) {
        const idx = o.geometry.index;
        tris += idx ? (idx.count / 3) : (o.geometry.attributes.position.count / 3);
      }
    });
    return Math.round(tris);
  }

  function loadStudy(idx) {
    activeStudyIdx = clamp(idx, 0, STUDIES.length - 1);
    const st = STUDIES[activeStudyIdx];
    clearStage();
    setPaperMode(st.night);

    camState.dist = camState.wantDist = st.cam.dist;
    camState.yaw = camState.wantYaw = st.cam.yaw;
    camState.pitch = camState.wantPitch = st.cam.pitch;
    camState.targetY = camState.wantTargetY = st.cam.targetY;
    const isLargeArch = st.id.startsWith("arch_") && st.id !== "arch_props";
    const shBound = isLargeArch ? 9.5 : 3.8;
    sun.shadow.camera.left = -shBound;
    sun.shadow.camera.right = shBound;
    sun.shadow.camera.top = shBound;
    sun.shadow.camera.bottom = -shBound;
    sun.shadow.camera.updateProjectionMatrix();
    plinthRing.scale.setScalar(isLargeArch ? 3.2 : 1.15);

    if (st.id === "t7_basin_pour") {
      // Study 1: Imani pouring embossed-X 20L jerrycan with BOTH hands into wheel-thrown terracotta bowl beside Mistletoe!
      spawnActor({
        id: "imani", name: "Imani", x: -0.35, z: -0.18, heading: 0.45,
        skinHex: 0x3b261b, hair: "croppedCoily", outer: "duster", coatHex: 0x3b403c,
        shirtHex: 0x5c605a, trouserHex: 0x2c3032, toolBelt: true, patchedKnees: true, pose: "basinPour20kg"
      });
      const props = window.makeArchitectureStudyPiece(T, "props");
      // Keep only the terracotta bowl at (+0.02, 0, +0.46) right under the cyan pour stream!
      const bowl = props.children[2].clone();
      bowl.position.set(0.01, 0, 0.46);
      stageRoot.add(bowl);
      activeDonkey = spawnDonkeyWithSightWindow(0.72, -0.15, -0.35);
    } else if (st.id === "father_child_20kg") {
      // Study 2: Bearded Elder in turban & shamma handing 20L embossed-X jerrycan to Child with short locs + tibeb trim!
      spawnActor({
        id: "elder", name: "Elder Carrier", x: -0.26, z: -0.05, heading: 0.55,
        scale: 1.02, build: 1.05, fem: 0.10, skinHex: 0x3f291d,
        hair: "turban", wrapHex: 0x625a4c, beard: true, hairHex: 0x1a1715,
        outer: "shamma", coatHex: 0xb6ae9e, shirtHex: 0x5c5042, trouserHex: 0x2b2d2e, pose: "heaveSaddle20kg"
      });
      spawnActor({
        id: "june_kf15", name: "June", x: 0.18, z: 0.42, heading: -2.45,
        scale: 0.76, build: 0.96, fem: 0.55, skinHex: 0x3f291e,
        hair: "shortLocs", outer: "none", shirtHex: 0xb2a48c, trouserHex: 0x343635,
        tibebTrim: true, patchedKnees: true, pose: "childReceive20kg"
      });
      const props = window.makeArchitectureStudyPiece(T, "props");
      const sawbuck = props.children[0].clone();
      sawbuck.position.set(-0.92, 0, -0.22);
      sawbuck.rotation.y = 0.4;
      stageRoot.add(sawbuck);
    } else if (st.id === "eskista_trio") {
      // Study 3: 6/8 Eskista Shoulder-Dance Trio
      spawnActor({
        id: "d1", name: "Imani", x: -0.78, z: 0.08, heading: 0.22,
        skinHex: 0x3b261b, hair: "croppedCoily", outer: "duster", coatHex: 0x3b403c,
        toolBelt: true, pose: "eskista"
      });
      spawnActor({
        id: "d2", name: "Makeda", x: 0.0, z: -0.12, heading: 0.0,
        skinHex: 0x3c271c, hair: "cornrowBraids", outer: "shamma", coatHex: 0xc8c0b0,
        satchel: true, pose: "eskista", phase: 1.1
      });
      spawnActor({
        id: "d3", name: "Berhanu", x: 0.78, z: 0.08, heading: -0.22,
        scale: 1.02, build: 1.05, fem: 0.10, skinHex: 0x422c20,
        hair: "turban", wrapHex: 0x5c5446, beard: true, outer: "shamma", coatHex: 0x9b9486,
        pose: "eskista", phase: 2.2
      });
    } else if (st.id === "pump_leverage") {
      // Study 4: Full-weight cast-iron standpipe pump stroke
      const props = window.makeArchitectureStudyPiece(T, "props");
      const standpipe = props.children[1].clone();
      standpipe.position.set(0.28, 0, 0);
      standpipe.rotation.y = Math.PI;
      stageRoot.add(standpipe);
      const bowl = props.children[2].clone();
      bowl.position.set(-0.22, 0, 0);
      stageRoot.add(bowl);
      spawnActor({
        id: "pumper", name: "Imani", x: 0.68, z: 0, heading: -Math.PI * 0.5,
        skinHex: 0x3b261b, hair: "croppedCoily", outer: "duster", coatHex: 0x3b403c,
        toolBelt: true, pose: "pump"
      });
    } else if (st.id === "night_convoy") {
      // Study 5: Ahiya Night Convoy with upward blue phone glow & turbaned elder!
      activeDonkey = spawnDonkeyWithSightWindow(-0.62, -0.1, 0.08);
      spawnActor({
        id: "rahel", name: "Rahel", x: 0.24, z: 0.12, heading: 0.05,
        scale: 0.92, skinHex: 0x3b261b, hair: "croppedCoily",
        outer: "shamma", coatHex: 0xc2bcb0, shirtHex: 0x2c3644,
        enablePhoneLight: true, pose: "convoyPhoneWalk"
      });
      spawnActor({
        id: "yared", name: "Yared", x: 0.92, z: -0.06, heading: 0.06,
        scale: 0.84, fem: 0.2, skinHex: 0x392419, hair: "croppedCoily",
        outer: "shamma", coatHex: 0xb2b4ac, shirtHex: 0x26303e,
        enablePhoneLight: true, pose: "convoyPhoneWalk", phase: 1.6
      });
      spawnActor({
        id: "elder_night", name: "Elder", x: -1.35, z: -0.25, heading: 0.12,
        scale: 1.02, fem: 0.1, skinHex: 0x422c20, hair: "turban", beard: true,
        outer: "shamma", coatHex: 0x9e9688, enablePhoneLight: true, pose: "phoneGlow"
      });
    } else if (st.id === "hill_desk") {
      // Study 6: Hill Archive REC PPC Desk with Daniel & Hanna (periodic VHF radio pickup!)
      const deskMat = new T.MeshStandardMaterial({ color: 0xaeb4ba, roughness: 0.55, metalness: 0.18 });
      const darkMat = new T.MeshStandardMaterial({ color: 0x1f2326, roughness: 0.45, metalness: 0.5 });
      const woodMat = new T.MeshStandardMaterial({ color: 0x453629, roughness: 0.85 });
      // Procedural dark silver-cyan REC PPC surveillance screen matching kf08 (00:36)!
      const mCnv = document.createElement("canvas");
      mCnv.width = 512; mCnv.height = 288;
      const mCtx = mCnv.getContext("2d");
      mCtx.fillStyle = "#0e1518"; mCtx.fillRect(0, 0, 512, 288);
      const grad = mCtx.createRadialGradient(256, 155, 18, 256, 155, 220);
      grad.addColorStop(0, "rgba(48, 216, 240, 0.35)");
      grad.addColorStop(1, "rgba(12, 18, 21, 0.95)");
      mCtx.fillStyle = grad; mCtx.fillRect(0, 0, 512, 288);
      mCtx.strokeStyle = "rgba(235, 248, 252, 0.78)"; mCtx.lineWidth = 2.5;
      for (const [bx, by, sx, sy] of [[18, 18, 1, 1], [494, 18, -1, 1], [18, 270, 1, -1], [494, 270, -1, -1]]) {
        mCtx.beginPath(); mCtx.moveTo(bx, by + sy * 22); mCtx.lineTo(bx, by); mCtx.lineTo(bx + sx * 28, by); mCtx.stroke();
      }
      mCtx.fillStyle = "#3ce8ff"; mCtx.beginPath(); mCtx.arc(32, 34, 5, 0, TAU); mCtx.fill();
      mCtx.fillStyle = "#eaf6f8"; mCtx.font = "600 15px ui-monospace, Menlo, monospace";
      mCtx.fillText("REC PPC · AHIYA NIGHT FEED", 46, 39);
      mCtx.fillText("01:18:20  CH-04  20L FLOW NOMINAL", 28, 260);
      mCtx.strokeStyle = "rgba(62, 232, 255, 0.65)"; mCtx.lineWidth = 1.6;
      mCtx.beginPath();
      for (let x = 36; x < 476; x += 8) {
        const y = 168 - Math.sin(x * 0.045) * 24 - (x > 210 && x < 300 ? 38 : 0);
        if (x === 36) mCtx.moveTo(x, y); else mCtx.lineTo(x, y);
      }
      mCtx.stroke();
      const scrTex = new T.CanvasTexture(mCnv);
      if (T.SRGBColorSpace) scrTex.colorSpace = T.SRGBColorSpace;
      const screenMat = new T.MeshBasicMaterial({ map: scrTex });

      const desk = new T.Mesh(new T.BoxGeometry(2.3, 0.05, 0.88), deskMat);
      desk.position.set(0, 0.75, -0.18); desk.castShadow = true; desk.receiveShadow = true;
      stageRoot.add(desk);
      for (const lx of [-1.05, 1.05]) for (const lz of [-0.55, 0.20]) {
        const leg = new T.Mesh(new T.BoxGeometry(0.05, 0.75, 0.05), darkMat);
        leg.position.set(lx, 0.375, lz); stageRoot.add(leg);
      }
      for (const cx of [-0.62, 0.62]) {
        const seat = new T.Mesh(new T.BoxGeometry(0.46, 0.04, 0.44), woodMat);
        seat.position.set(cx, 0.44, 0.44); stageRoot.add(seat);
        const post = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 0.44, 10), darkMat);
        post.position.set(cx, 0.22, 0.44); stageRoot.add(post);
      }
      const mon = new T.Mesh(new T.BoxGeometry(1.72, 0.98, 0.06), darkMat);
      mon.position.set(0, 1.44, -0.62); stageRoot.add(mon);
      const scr = new T.Mesh(new T.PlaneGeometry(1.62, 0.88), screenMat);
      scr.position.set(0, 1.44, -0.585); stageRoot.add(scr);

      spawnActor({
        id: "op_m", name: "Daniel", x: -0.62, z: 0.42, heading: Math.PI * 0.88,
        scale: 1.01, build: 1.05, fem: 0.08, skinHex: 0x9b7862,
        hair: "glassesCrop", hairHex: 0x221b16, outer: "none", shirtHex: 0x1d2836,
        rolledSleeves: true, pose: "deskWrite"
      });
      spawnActor({
        id: "op_f", name: "Hanna", x: 0.62, z: 0.42, heading: -Math.PI * 0.88,
        scale: 0.97, fem: 0.80, skinHex: 0xa27e68,
        hair: "ponytail", hairHex: 0x3b2a1e, outer: "none", shirtHex: 0x1b2634,
        rolledSleeves: true, pose: "deskNotes"
      });
    } else if (st.id === "arch_hidmo") {
      stageRoot.add(window.makeArchitectureStudyPiece(T, "hidmo"));
      spawnActor({
        id: "v_hidmo", name: "Elder", x: -1.15, z: 1.85, heading: 0.65,
        fem: 0.1, hair: "turban", beard: true, outer: "shamma", coatHex: 0xb6ae9e, pose: "tieRope"
      });
    } else if (st.id === "arch_chapel") {
      const chp = window.makeArchitectureStudyPiece(T, "chapel");
      chp.position.z = -0.8;
      stageRoot.add(chp);
      activeDonkey = spawnDonkeyWithSightWindow(0.85, 3.35, 0.45);
    } else if (st.id === "arch_sanctuary") {
      const sanc = window.makeArchitectureStudyPiece(T, "sanctuary");
      stageRoot.add(sanc);
      spawnActor({
        id: "tess_sanc", name: "Tess", x: -1.62, z: 0.25, yOffset: 0.18, heading: -Math.PI * 0.5,
        skinHex: 0x7c5e4b, hair: "ponytail", outer: "duster", coatHex: 0x4c5254,
        shirtHex: 0xbac0be, rolledSleeves: true, pose: "clerkWindow"
      });
    } else if (st.id === "arch_props") {
      stageRoot.add(window.makeArchitectureStudyPiece(T, "props"));
    }

    // Update UI Header, Pills & Matched Reference Drawer
    $("st-title").textContent = st.title;
    $("st-cat").textContent = st.cat;
    $("st-note").textContent = st.note;
    $("st-tri-readout").textContent = `${countTriangles(stageRoot).toLocaleString()} TRIS · DRAG TO ORBIT · SCROLL TO ZOOM`;

    document.querySelectorAll("#study-pills .pill").forEach((b, i) => {
      b.classList.toggle("active", i === activeStudyIdx);
      b.setAttribute("aria-pressed", String(i === activeStudyIdx));
    });
    renderMatchedTab(st);
  }

  /* ---------- Populate UI Pills & Reference Tabs ---------- */
  const pillsWrap = $("study-pills");
  STUDIES.forEach((st, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pill";
    b.textContent = st.short;
    b.addEventListener("click", () => loadStudy(idx));
    pillsWrap.appendChild(b);
  });

  function openLightbox(src) {
    $("lightbox-img").src = src;
    $("lightbox").hidden = false;
  }
  $("lightbox").addEventListener("click", () => { $("lightbox").hidden = true; });

  function renderMatchedTab(st) {
    const el = $("tab-matched");
    const cards = [];
    cards.push(`
      <article class="ref-card">
        <img src="${st.sheet}" alt="${st.title} orthographic study sheet" data-zoom="${st.sheet}">
        <div class="ref-cap">
          <strong>Generated Orthographic / Motion Study Sheet</strong>
          ${st.sheetCap}
        </div>
      </article>
    `);
    for (const kid of st.kfIds) {
      const kf = FILM_KEYFRAMES.find(k => k.id === kid);
      if (!kf) continue;
      cards.push(`
        <article class="ref-card">
          <img src="${kf.img}" alt="${kf.title}" data-zoom="${kf.img}">
          <div class="ref-cap">
            <strong>Source Film Keyframe · ${kf.time}</strong>
            ${kf.title} — ${kf.teaches}<br>
            <a class="yt-link" href="https://www.youtube.com/watch?v=${YT_ID}&t=${kf.sec}s" target="_blank" rel="noopener">↗ Open ZZlDs10FCZk at ${kf.time}</a>
          </div>
        </article>
      `);
    }
    el.innerHTML = cards.join("");
    el.querySelectorAll("[data-zoom]").forEach(img => {
      img.addEventListener("click", () => openLightbox(img.dataset.zoom));
    });
  }

  // Populate Tab 2: All 16 Film Cuts
  {
    const el = $("tab-keyframes");
    el.innerHTML = `
      <p style="margin:0;font-size:12px;opacity:.85">All 16 master design keyframes extracted from <code>ZZlDs10FCZk</code> (<em>DONKEY WATER SCIFI</em>, 02:11). Click any frame to enlarge.</p>
      <div class="kf-grid">
        ${FILM_KEYFRAMES.map(kf => `
          <button type="button" class="kf-item" data-zoom="${kf.img}">
            <img src="${kf.img}" alt="${kf.title}" loading="lazy">
            <div><code>${kf.time}</code> · <strong>${kf.title}</strong><br>${kf.teaches}</div>
          </button>
        `).join("")}
      </div>
    `;
    el.querySelectorAll("[data-zoom]").forEach(btn => {
      btn.addEventListener("click", () => openLightbox(btn.dataset.zoom));
    });
  }

  // Populate Tab 3: 6 New Video Loops Needed Next
  {
    const el = $("tab-prompts");
    el.innerHTML = `
      <p style="margin:0;font-size:12px;opacity:.85">While <code>ZZlDs10FCZk</code> covers night phone convoys, REC PPC operators, 20 kg saddle unloading, hidmo houses, stone chapels &amp; clay bowls, these <strong>6 targeted reference videos</strong> fill every remaining motion &amp; architectural gap:</p>
      ${VIDEO_BRIEFS.map((vb, i) => `
        <div class="prompt-box">
          <div class="prompt-head">
            <strong>${vb.title}</strong>
            <button type="button" class="copy-btn" data-copy="${i}">Copy Prompt</button>
          </div>
          <p class="prompt-why">${vb.why}</p>
          <pre class="prompt-txt">${vb.prompt}</pre>
        </div>
      `).join("")}
    `;
    el.querySelectorAll("[data-copy]").forEach(btn => {
      btn.addEventListener("click", () => {
        const txt = VIDEO_BRIEFS[+btn.dataset.copy].prompt;
        navigator.clipboard?.writeText(txt);
        btn.textContent = "Copied ✓";
        setTimeout(() => { btn.textContent = "Copy Prompt"; }, 1400);
      });
    });
  }

  // Drawer tabs & stage buttons
  document.querySelectorAll(".d-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".d-tab").forEach(t => t.setAttribute("aria-selected", String(t === tab)));
      $("tab-matched").hidden = target !== "matched";
      $("tab-keyframes").hidden = target !== "keyframes";
      $("tab-prompts").hidden = target !== "prompts";
    });
  });

  $("btn-mood").addEventListener("click", () => {
    manualMoodIdx = (manualMoodIdx + 1) % MOOD_CYCLE.length;
    const m = MOOD_CYCLE[manualMoodIdx];
    $("btn-mood").textContent = `Mood: ${m === "auto" ? "Auto" : m}`;
  });
  $("btn-turntable").addEventListener("click", () => {
    camState.turntable = !camState.turntable;
    $("btn-turntable").setAttribute("aria-pressed", String(camState.turntable));
  });
  $("btn-paper").addEventListener("click", () => setPaperMode(!camState.night));
  $("sun-angle").addEventListener("input", e => {
    camState.sunDeg = +e.target.value;
    updateSunDirection();
  });
  $("btn-drawer").addEventListener("click", () => {
    const closed = document.body.classList.toggle("drawer-closed");
    $("btn-drawer").setAttribute("aria-pressed", String(!closed));
    $("btn-drawer").textContent = closed ? "Ref Sheet ▴" : "Ref Sheet ▾";
    setTimeout(resize, 260);
  });

  function resize() {
    const w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(wrap);
  }
  if (window.innerWidth <= 900) {
    document.body.classList.add("drawer-closed");
    $("btn-drawer").setAttribute("aria-pressed", "false");
    $("btn-drawer").textContent = "Ref Sheet ▴";
  }

  /* ---------- Animation Loop ---------- */
  const initIdx = +(new URLSearchParams(location.search).get("study") || 0);
  loadStudy(Number.isFinite(initIdx) ? initIdx : 0);
  resize();

  let lastNow = performance.now();
  function frame(now) {
    const dt = clamp((now - lastNow) * 0.001, 0.001, 0.05);
    lastNow = now;
    const nowSec = now * 0.001;

    if (camState.turntable && !drag) camState.wantYaw += dt * 0.38;
    const k = 1 - Math.exp(-dt * 8.5);
    camState.yaw = lerp(camState.yaw, camState.wantYaw, k);
    camState.pitch = lerp(camState.pitch, camState.wantPitch, k);
    camState.dist = lerp(camState.dist, camState.wantDist, k);
    camState.targetY = lerp(camState.targetY, camState.wantTargetY, k);

    const cp = Math.cos(camState.pitch), sp = Math.sin(camState.pitch);
    const effDist = camState.dist * (camera.aspect < 0.85 ? clamp(0.88 / camera.aspect, 1.0, 1.52) : 1.0);
    camera.position.set(
      Math.sin(camState.yaw) * cp * effDist,
      camState.targetY + sp * effDist,
      Math.cos(camState.yaw) * cp * effDist
    );
    camera.lookAt(0, camState.targetY, 0);

    const forcedMood = manualMoodIdx > 0 ? MOOD_CYCLE[manualMoodIdx] : undefined;
    for (const item of activeActors) {
      item.ch.update(dt, nowSec, {
        pose: item.pose,
        mood: forcedMood,
        surfaceAt: flatGround,
        beatPulse: 0.45 + 0.45 * Math.sin(nowSec * 4.8),
        lookAt: camera.position
      });
    }
    if (activeDonkey) {
      activeDonkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 2, drop: 0 }, flatGround);
    }

    $("st-mood-readout").textContent = `MOOD: ${(forcedMood || "AUTO").toUpperCase()}`;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__study = {
    isReady: () => true,
    loadStudy,
    getState: () => ({
      studyIdx: activeStudyIdx,
      studyId: STUDIES[activeStudyIdx].id,
      actorCount: activeActors.length,
      hasDonkey: Boolean(activeDonkey),
      keyframeCount: FILM_KEYFRAMES.length,
      videoBriefCount: VIDEO_BRIEFS.length
    })
  };
})();
