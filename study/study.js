/* Donkey Water 3D Study Plate Workbench (v4) — Real-Time FACS Facial Emotions,
   Open-Mouth Speech Visemes (Upper/Lower Dental Arches, Moving Tongue & Vermilion Lips),
   12 Expressive 30-Bone Hand Gestures, 56-Bone Anatomical Skeleton &
   Live 1080p Gemini Video Reference Stage. */
(function () {
  "use strict";

  const T = window.THREE;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const TAU = Math.PI * 2;

  // All 6 1080p M1..M6 Gemini Omni macro study videos + M1..M6_sheet.jpg are live on disk!
  const MACRO_VIDEOS_LIVE = true;

  // Verified live on disk: E1..E4 1080p Emotion Reels + 1408x1408 FACS & Hand Ortho Grids!
  const liveEmotionFiles = new Set([
    "E1_imani_emotions_speech_arc.mp4", "E1_sheet.jpg",
    "E2_elder_youth_dialogue_reactions.mp4", "E2_sheet.jpg",
    "E3_expressive_hands_gestures_100mm.mp4", "E3_sheet.jpg",
    "E4_fullbody_emotional_acting_ensemble.mp4", "E4_sheet.jpg"
  ]);
  const liveTextureV3Files = new Set([
    "imani_expressions_sheet.jpg", "hand_emotions_sheet.jpg",
    "imani_head_front.jpg", "imani_head_side.jpg",
    "imani_photo_front.jpg", "imani_photo_side.jpg",
    "youth_head_front.jpg", "youth_head_side.jpg",
    "operator_f_head_front.jpg", "operator_m_head_front.jpg",
    "elder_head_front.jpg", "elder_head_side.jpg",
    "hand_dorsal.jpg", "hand_palmar.jpg"
  ]);

  /* ---------- Canonical v4 Emotion, Viseme & 12-Gesture Catalogs ---------- */
  const VISEME_LIST = [
    { id: "SIL", label: "SIL · Sealed", desc: "0.0mm closed vermilion seal (AU0)" },
    { id: "AA",  label: "AA · Open Ah", desc: "Wide jaw drop, upper/lower teeth & tongue body" },
    { id: "EE",  label: "EE · Wide Eh", desc: "AU20 horizontal commissure stretch & incisors" },
    { id: "IH",  label: "IH · Soft Ih", desc: "Relaxed parted lips & upper dental edge" },
    { id: "OH",  label: "OH · Round Oh", desc: "Oval rounded lips & recessed oral cavity" },
    { id: "OO",  label: "OO · Pucker U", desc: "AU22 protruding rounded lip funnel" },
    { id: "MM",  label: "MM · Bilabial", desc: "AU24 pressed bilabial closure (M/B/P)" },
    { id: "FF",  label: "FF · Labiodent", desc: "Upper incisors grazing lower vermilion (F/V)" },
    { id: "TH",  label: "TH · Interdent", desc: "Tongue tip visible between incisors (TH)" },
    { id: "LL",  label: "LL · Alveolar", desc: "Tongue tip lifted behind upper incisors (L/N/T)" }
  ];

  const E1_MODES = [
    {
      key: "auto_arc",
      short: "↻ Auto-Cycle Arc",
      hud: "AUTO-CYCLE EMOTION & SPEECH ARC",
      facs: "7-STAGE FACS + VISEME PERFORMANCE"
    },
    {
      key: "speaking",
      short: "Speaking (Live Dialogue)",
      emotion: "speaking_animated",
      intensity: 0.78,
      speaking: true,
      handL: "talking_gesticulate",
      handR: "talking_gesticulate",
      arm: "talking_gesticulate",
      hud: "ANIMATED OPEN-MOUTH SPEECH",
      facs: "AU1+AU2+AU25/26 · SYLLABIC VISEMES + TONGUE TIP"
    },
    {
      key: "happy_laugh",
      short: "Happy & Open Laugh",
      emotion: "laughing_open",
      altEmotion: "happy_joy",
      intensity: 0.76,
      handL: "heart_gratitude",
      handR: "joyful_wave",
      arm: "joyful_wave",
      hud: "RADIANT DUCHENNE LAUGH & JOY",
      facs: "AU6 (CHEEK/LID CRINKLE) + AU12 (ZYGOMATIC) + AU26"
    },
    {
      key: "sad_grief",
      short: "Sad & Grief",
      emotion: "sad_grief",
      intensity: 0.56,
      handL: "heart_gratitude",
      handR: "relaxed_breathing",
      arm: "heart_gratitude",
      hud: "SORROW, GRIEF & OBLIQUE BROWS",
      facs: "AU1 (INNER BROW LIFT) + AU15 (LIP DEPRESSOR) + AU17"
    },
    {
      key: "surprised_awe",
      short: "Surprise & Awe",
      emotion: "surprised_awe",
      intensity: 0.70,
      viseme: "OH",
      visemeAmount: 0.54,
      handL: "spread_splay_awe",
      handR: "spread_splay_awe",
      arm: "spread_splay_awe",
      hud: "WIDE-EYED SURPRISE & AWE",
      facs: "AU1+AU2 (ARCHED BROWS) + AU5 (WIDE LIDS) + AU26 (JAW)"
    },
    {
      key: "effort_strain",
      short: "20 kg Effort Grimace",
      emotion: "effort_strain_20kg",
      intensity: 0.76,
      handL: "clenched_fist_resolve",
      handR: "clenched_fist_resolve",
      arm: "clenched_fist_resolve",
      hud: "20 KG HEAVY EFFORT GRIMACE",
      facs: "AU4 (GLABELLAR FURROW) + AU7 + AU9 (NOSE WRINKLE)"
    },
    {
      key: "pleading_call",
      short: "Pleading / Calling Out",
      emotion: "concerned_pleading",
      intensity: 0.72,
      speaking: true,
      handL: "cupped_water_plea",
      handR: "cupped_water_plea",
      arm: "cupped_water_plea",
      hud: "HEARTFELT PLEADING & CALLING OUT",
      facs: "AU1+AU4 (CONCERN BROW) + AU26 (CALLING MOUTH)"
    },
    {
      key: "viseme_tour",
      short: "Viseme Tour (A·E·I·O·U·M·F·L)",
      hud: "0.26M PHONEME & DENTAL VISEME TOUR",
      facs: "UPPER/LOWER TEETH · ORAL CAVITY · TONGUE TIP"
    }
  ];

  const E1_AUTO_ARC_STAGES = [
    { dur: 2.4, emotion: "neutral", intensity: 1.0, viseme: "SIL", speaking: false, hand: "relaxed_breathing", label: "1/7 · CALM NEUTRAL (SEALED LIPS)", facs: "AU0 · 0.0MM VERMILION SEAL · VISEME: SIL" },
    { dur: 3.6, emotion: "speaking_animated", intensity: 0.78, speaking: true, hand: "talking_gesticulate", arm: "talking_gesticulate", label: "2/7 · ANIMATED OPEN-MOUTH SPEECH", facs: "AU1+AU2+AU25/26 · TEETH + TONGUE VISEMES" },
    { dur: 3.0, emotion: "laughing_open", intensity: 0.76, speaking: false, hand: "joyful_wave", arm: "joyful_wave", label: "3/7 · RADIANT DUCHENNE LAUGH & JOY", facs: "AU6 (LID CRINKLE) + AU12 (SMILE) + AU26 (OPEN JAW)" },
    { dur: 2.9, emotion: "sad_grief", intensity: 0.56, speaking: false, hand: "heart_gratitude", arm: "heart_gratitude", label: "4/7 · DEEP SADNESS & GRIEF", facs: "AU1 (OBLIQUE INNER BROW) + AU15 (CORNER DROP)" },
    { dur: 2.8, emotion: "surprised_awe", intensity: 0.70, viseme: "OH", visemeAmount: 0.54, speaking: false, hand: "spread_splay_awe", arm: "spread_splay_awe", label: "5/7 · WIDE-EYED SURPRISE & AWE", facs: "AU1+AU2 (ARCHED BROWS) + AU5 (WIDE LIDS) + AU26" },
    { dur: 2.7, emotion: "effort_strain_20kg", intensity: 0.76, speaking: false, hand: "clenched_fist_resolve", arm: "clenched_fist_resolve", label: "6/7 · 20 KG EFFORT STRAIN GRIMACE", facs: "AU4 (GLABELLA FURROW) + AU9 (ALAR FLARE) + TEETH" },
    { dur: 3.0, emotion: "concerned_pleading", intensity: 0.72, speaking: true, hand: "cupped_water_plea", arm: "cupped_water_plea", label: "7/7 · HEARTFELT PLEADING / CALLING", facs: "AU1+AU4 + AU25/26 + CUPPED OFFERING HANDS" }
  ];

  /* ---------- Flagship N1 · 3-Joint Cervical Neck Leaning, Oval V-Jaw & Skin Continuity Catalogs ---------- */
  const DEG = Math.PI / 180;

  const N1_FOCUS_MODES = [
    {
      idx: 0,
      key: "cycle",
      short: "↻ Cycle Neck Leans",
      hud: "AUTO-CYCLE 3-JOINT CERVICAL LEANS & SKIN CONTINUITY",
      facs: "C7→NECK_LOW→NECK_HIGH→HEAD · SCM RELIEF · UNBROKEN DERMAL SKIN",
      dist: 0.80, yaw: 0.01, pitch: 0.015, targetY: 1.480, targetXOff: -0.032
    },
    {
      idx: 1,
      key: "lean_left",
      short: "Lean Left +24° (SCM Stretch)",
      rollDeg: 24, pitchDeg: -2, yawDeg: 0, glideX: 0,
      emotion: "neutral", intensity: 0.35,
      hud: "LEAN LEFT +24° · ELONGATED RIGHT SCM CORD",
      facs: "3-JOINT C-CURVE (1.408M→EAR) · CONTRALATERAL SCM · OVAL V-JAW",
      dist: 0.80, yaw: 0.01, pitch: 0.015, targetY: 1.480, targetXOff: -0.035
    },
    {
      idx: 2,
      key: "lean_right",
      short: "Lean Right -24°",
      rollDeg: -24, pitchDeg: -3, yawDeg: -2, glideX: 0,
      emotion: "happy_joy", intensity: 0.62,
      hud: "LEAN RIGHT -24° · WARM DUCHENNE SMILE",
      facs: "SUPPLE CERVICAL ARC · LEFT SCM STRETCH · AU6+AU12 JOY",
      dist: 0.80, yaw: -0.01, pitch: 0.015, targetY: 1.480, targetXOff: -0.035
    },
    {
      idx: 3,
      key: "oblique",
      short: "Oblique Turn + Lean",
      rollDeg: 18, pitchDeg: -3, yawDeg: 30, glideX: 0,
      emotion: "neutral", intensity: 0.35,
      hud: "OBLIQUE PORTRAIT 3/4 · +18° LEAN + 30° TURN",
      facs: "DIAGONAL OVAL MANDIBLE · STERNAL SCM HEAD · CLAVICLE NOTCH",
      dist: 0.80, yaw: -0.06, pitch: 0.015, targetY: 1.480, targetXOff: -0.030
    },
    {
      idx: 4,
      key: "head_back",
      short: "Head-Back Chin & Throat",
      rollDeg: 5, pitchDeg: -22, yawDeg: 8, glideX: 0,
      emotion: "neutral", intensity: 0.35,
      hud: "HEAD-BACK EXTENSION -22° · CHIN & THROAT",
      facs: "CLEAN SUBMENTAL SHELF · HYOID ARCH · SUPRASTERNAL FOSSA",
      dist: 0.80, yaw: 0.14, pitch: -0.015, targetY: 1.485, targetXOff: -0.025
    },
    {
      idx: 5,
      key: "skin_blend",
      short: "Skin Blend: Face·Neck·Body·Hand",
      rollDeg: 10, pitchDeg: -2, yawDeg: 0, glideX: 0,
      emotion: "neutral", intensity: 0.30,
      evenLight: true,
      hud: "SKIN BLEND · FACE·JAW·NECK·CHEST·SHOULDER·ARM·HAND",
      facs: "EVEN FRONT STUDIO KEY · CANONICAL LINEAR SKIN · 0.0% COLOR SEAM",
      dist: 0.79, yaw: 0.00, pitch: 0.015, targetY: 1.470, targetXOff: -0.035
    },
    {
      idx: 6,
      key: "quartet",
      short: "Quartet All Leaning (4)",
      isQuartet: true,
      hud: "QUARTET ALL LEANING · 4 DISTINCT CERVICAL POSES & SKIN TONES",
      facs: "JUNE (+19°) · IMANI (-22°) · HANNA (+19°/3/4) · ELDER (-18°)",
      dist: 2.34, yaw: 0.00, pitch: 0.025, targetY: 1.45
    },
    {
      idx: 7,
      key: "profile",
      short: "90° Profile Lean",
      isProfile: true,
      rollDeg: 10, pitchDeg: -16, yawDeg: 0, glideX: 0,
      emotion: "neutral", intensity: 0.35,
      hud: "90° PROFILE CERVICAL LEAN & GONIAL JAWLINE",
      facs: "CRISP GONIAL ANGLE · SUBMENTAL SHELF · TRAGUS/CONCHA · C7 NAPE",
      dist: 0.80, yaw: -Math.PI * 0.5, pitch: 0.015, targetY: 1.485, targetXOff: 0.0
    }
  ];

  const N1_CYCLE_STAGES = [
    {
      dur: 2.8, rollDeg: 24, pitchDeg: -2, yawDeg: 0, glideX: 0,
      emotion: "neutral", intensity: 0.35,
      hud: "1/6 · LEFT LATERAL LEAN +24° (SCM STRETCH)",
      facs: "3-JOINT C-CURVE · ELONGATED RIGHT SCM · OVAL V-JAWLINE"
    },
    {
      dur: 2.8, rollDeg: -24, pitchDeg: -3, yawDeg: -2, glideX: 0,
      emotion: "happy_joy", intensity: 0.62,
      hud: "2/6 · RIGHT LATERAL LEAN -24° (DUCHENNE WARMTH)",
      facs: "SUPPLE CERVICAL BEND · LEFT SCM STRETCH · ZYGOMATIC SMILE"
    },
    {
      dur: 2.8, rollDeg: 18, pitchDeg: -3, yawDeg: 30, glideX: 0,
      emotion: "neutral", intensity: 0.35,
      hud: "3/6 · OBLIQUE LISTENING LEAN (+18° + 30° TURN)",
      facs: "PORTRAIT 3/4 MANDIBLE · STERNAL SCM HEAD · BARE CLAVICLE"
    },
    {
      dur: 2.7, rollDeg: 5, pitchDeg: -22, yawDeg: 8, glideX: 0,
      emotion: "neutral", intensity: 0.35,
      hud: "4/6 · HEAD-BACK THROAT & JAW EXTENSION (-22°)",
      facs: "CLEAN SUBMENTAL SHELF · HYOID ARCH · JUGULAR FOSSA"
    },
    {
      dur: 2.8, rollDeg: -19, pitchDeg: 13, yawDeg: -10, glideX: 0,
      emotion: "sad_grief", intensity: 0.48,
      hud: "5/6 · SOULFUL FORWARD-SIDE GRIEF LEAN (-19°)",
      facs: "AU1 OBLIQUE BROW · TENDER CERVICAL BOW · ZERO CREASE"
    },
    {
      dur: 3.0, eskistaSlide: true, rollDeg: 14, pitchDeg: 1, yawDeg: 0, glideX: 0.024,
      emotion: "happy_joy", intensity: 0.52,
      hud: "6/6 · ESKISTA HORIZONTAL CERVICAL SLIDE",
      facs: "TRANSLATIONAL CERVICAL GLIDE · CLAVICLE ISOLATION · SKIN FLOW"
    }
  ];

  const E2_GESTURES = [
    {
      idx: 0, id: "spread_splay_awe", short: "1 · Splayed Awe / Stop",
      emotion: "surprised_awe", speaking: false,
      hud: "1/12 · WIDE SPLAYED AWE / STOP",
      facs: "WIDE MCP ABDUCTION (RZ) + EXTENDED 30 PHALANGES + AU5 AWE",
      camDist: 0.56, camYaw: 0.08, camPitch: 0.14, headWeight: 0.18
    },
    {
      idx: 1, id: "talking_gesticulate", short: "2 · Animated Talking Hands",
      emotion: "speaking_animated", speaking: true,
      hud: "2/12 · CONVERSATIONAL GESTICULATION",
      facs: "PHASE-OFFSET PHALANX CADENCE + FOREARM SUPINATION + SPEECH",
      camDist: 0.60, camYaw: 0.10, camPitch: 0.14, headWeight: 0.22
    },
    {
      idx: 2, id: "cupped_water_plea", short: "3 · Cupped Water Plea",
      emotion: "concerned_pleading", speaking: false,
      hud: "3/12 · TWO-HAND CUPPED WATER OFFERING",
      facs: "ADDUCTED PALMAR BOWL + TUCKED THUMBS + ZERO FINGER GAP",
      camDist: 0.48, camYaw: 0.06, camPitch: 0.24, headWeight: 0.04
    },
    {
      idx: 3, id: "joyful_wave", short: "4 · Joyful Highland Wave",
      emotion: "laughing_open", speaking: false,
      hud: "4/12 · JOYFUL HIGHLAND GREETING WAVE",
      facs: "RADIAL/ULNAR WRIST OSCILLATION + SPLAYED FLUTTER + DUCHENNE JOY",
      camDist: 0.62, camYaw: -0.14, camPitch: 0.08, headWeight: 0.36
    },
    {
      idx: 4, id: "pointing_call", short: "5 · Pointing & Call",
      emotion: "concerned_pleading", speaking: true,
      hud: "5/12 · CRISP INDEX POINT & CALL OUT",
      facs: "EXTENDED INDEX + FLEXED MID/RING/PINKY + CALLING VISEMES",
      camDist: 0.58, camYaw: -0.20, camPitch: 0.12, headWeight: 0.26
    },
    {
      idx: 5, id: "heart_gratitude", short: "6 · Hand-to-Heart Gratitude",
      emotion: "happy_joy", speaking: false,
      hud: "6/12 · HAND-TO-HEART GRATITUDE",
      facs: "SOFT CURVED PALMS OVER STERNUM + WARM ZYGOMATIC SMILE",
      camDist: 0.56, camYaw: 0.10, camPitch: 0.12, headWeight: 0.28
    },
    {
      idx: 6, id: "clenched_fist_resolve", short: "7 · Clenched Fist Resolve",
      emotion: "determined_focus", speaking: false,
      hud: "7/12 · CLENCHED FIST OF RESOLVE",
      facs: "TIGHT FLEXION + THUMB LOCKED OVER DORSAL MID PHALANGES",
      camDist: 0.46, camYaw: 0.14, camPitch: 0.18, headWeight: 0.06
    },
    {
      idx: 7, id: "piano_finger_ripple", short: "8 · Piano 30-Bone Ripple",
      emotion: "happy_joy", speaking: false,
      hud: "8/12 · SEQUENTIAL 30-PHALANX PIANO RIPPLE",
      facs: "PINKY -> RING -> MID -> INDEX -> THUMB WAVE + DORSAL/PALMAR",
      camDist: 0.44, camYaw: 0.10, camPitch: 0.24, headWeight: 0.0
    },
    {
      idx: 8, id: "brow_shade_lookout", short: "9 · Brow-Shade Lookout",
      emotion: "determined_focus", speaking: false,
      hud: "9/12 · HORIZON BROW-SHADE VISOR",
      facs: "ADDUCTED FLAT HAND SHADING SUPRAORBITAL RIDGE + GAZE",
      camDist: 0.50, camYaw: -0.22, camPitch: 0.06, headWeight: 0.52
    },
    {
      idx: 9, id: "shock_hands_cheeks", short: "10 · Shock Hands-to-Cheeks",
      emotion: "surprised_awe", speaking: false,
      hud: "10/12 · ASTONISHMENT HANDS-TO-CHEEKS",
      facs: "BILATERAL PALMS FRAMING MANDIBLE + AU1/AU2/AU5/AU26 SHOCK",
      camDist: 0.48, camYaw: 0.06, camPitch: 0.05, headWeight: 0.50
    },
    {
      idx: 10, id: "exhausted_brow_wipe", short: "11 · Exhausted Brow Wipe",
      emotion: "relief_sigh", speaking: false,
      hud: "11/12 · EXHAUSTED FOREHEAD WIPE & SIGH",
      facs: "CURVED RADIAL/DORSAL WIPE ACROSS FRONTALIS + RELIEF EXHALE",
      camDist: 0.50, camYaw: -0.16, camPitch: 0.06, headWeight: 0.52
    },
    {
      idx: 11, id: "tool_grips_5x", short: "12 · Tool Grips (5x)",
      emotion: "determined_focus", speaking: false,
      hud: "12/12 · 5 PRECISION FIELD TOOL GRIPS",
      facs: "PUMP BAR · 20L HANDLE · CYAN PHONE · PEN PINCH · DORSAL/PALMAR",
      camDist: 0.48, camYaw: 0.10, camPitch: 0.26, headWeight: 0.0
    }
  ];

  const DIRECTOR_PRESETS = [
    { key: "auto",               label: "Scene Auto" },
    { key: "neutral",            label: "Calm",     intensity: 1.00, speaking: false, hand: "relaxed_breathing" },
    { key: "speaking_animated",  label: "Speak",    intensity: 0.78, speaking: true,  hand: "talking_gesticulate" },
    { key: "happy_joy",          label: "Happy",    intensity: 0.80, speaking: false, hand: "relaxed_breathing" },
    { key: "laughing_open",      label: "Laugh",    intensity: 0.76, speaking: false, hand: "joyful_wave" },
    { key: "sad_grief",          label: "Sad",      intensity: 0.56, speaking: false, hand: "heart_gratitude" },
    { key: "surprised_awe",      label: "Surprise", intensity: 0.70, speaking: false, hand: "spread_splay_awe" },
    { key: "effort_strain_20kg", label: "Strain",   intensity: 0.76, speaking: false, hand: "clenched_fist_resolve" },
    { key: "concerned_pleading", label: "Plead",    intensity: 0.72, speaking: true,  hand: "cupped_water_plea" }
  ];

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

  /* ---------- Live Study Videos (E1..E4 1080p Emotions + M1..M6 Macro + V1..V6 Scene Loops = 16 Videos) ---------- */
  const STUDY_VIDEOS = [
    {
      id: "E1", emotion: true, fileName: "E1_imani_emotions_speech_arc.mp4", posterName: "E1_sheet.jpg",
      src: "./v2g_emotions/E1_imani_emotions_speech_arc.mp4",
      poster: "./v2g_emotions/E1_sheet.jpg",
      badge: "EMOTION E1 · IMANI FACS & SPEECH",
      title: "E1 · Imani 85mm Emotions, Open-Mouth Speech & Duchenne Laugh",
      desc: "1080p studio arc on #424242: calm neutral -> animated open-mouth speech (teeth, tongue tip, O/U & A/E vowels) -> radiant Duchenne laugh -> furrowed grief.",
      studyId: "exp_emotions_speech"
    },
    {
      id: "E2", emotion: true, fileName: "E2_elder_youth_dialogue_reactions.mp4", posterName: "E2_sheet.jpg",
      src: "./v2g_emotions/E2_elder_youth_dialogue_reactions.mp4",
      poster: "./v2g_emotions/E2_sheet.jpg",
      badge: "EMOTION E2 · DIALOGUE & AWE",
      title: "E2 · Elder & Youth Open-Mouth Dialogue, Surprise & Shared Relief",
      desc: "85mm two-person reaction study: startled wide-eyed awe & dropped jaw -> urgent open-mouth calling out -> warm nodding conversation & shared smile.",
      studyId: "exp_emotions_speech"
    },
    {
      id: "E3", emotion: true, fileName: "E3_expressive_hands_gestures_100mm.mp4", posterName: "E3_sheet.jpg",
      src: "./v2g_emotions/E3_expressive_hands_gestures_100mm.mp4",
      poster: "./v2g_emotions/E3_sheet.jpg",
      badge: "EMOTION E3 · 100MM HAND ACTING",
      title: "E3 · 100mm Expressive Hand Emotions & 30-Bone Gesture Range",
      desc: "Macro hand study: wide splayed awe -> conversational gesticulation -> cupped water plea -> index point -> clenched fist -> chest gratitude -> piano ripple.",
      studyId: "exp_hand_acting"
    },
    {
      id: "E4", emotion: true, fileName: "E4_fullbody_emotional_acting_ensemble.mp4", posterName: "E4_sheet.jpg",
      src: "./v2g_emotions/E4_fullbody_emotional_acting_ensemble.mp4",
      poster: "./v2g_emotions/E4_sheet.jpg",
      badge: "EMOTION E4 · FULL-BODY ACTING",
      title: "E4 · Upper-Body Highland Wave, 20 kg Grimace & Heartfelt Bow",
      desc: "Whole-body + face + hand synergy: joyful two-hand highland wave & laugh -> heavy 20 kg effort grimace & brow wipe -> startled splayed palms -> chest bow.",
      studyId: "exp_hand_acting"
    },
    {
      id: "M1", macro: true,
      src: "./v2g_macro/M1_macro_hands_grip_study.mp4",
      poster: "./v2g_macro/M1_sheet.jpg",
      badge: "MACRO M1 · 100MM HANDS",
      title: "M1 · Macro Hands, Extensor Tendons & 5-Grip Study",
      desc: "Weathered carrier hands flexing from spread dorsal/palmar anatomy into cast-iron pump bar wrap, 20 L jerrycan handle thread & cyan smartphone cradle.",
      studyId: "macro_hands"
    },
    {
      id: "M2", macro: true,
      src: "./v2g_macro/M2_imani_portrait_hair_turntable.mp4",
      poster: "./v2g_macro/M2_sheet.jpg",
      badge: "MACRO M2 · IMANI 4C COILS",
      title: "M2 · Imani 85mm Portrait, Wet Corneas & 4C Coily Shells",
      desc: "Profile-to-front-to-3/4 studio sweep showing airy 4C micro-coil silhouette, natural blinks, eye saccades & subsurface cheek scatter.",
      studyId: "macro_portraits"
    },
    {
      id: "M3", macro: true,
      src: "./v2g_macro/M3_youth_locs_braids_portrait.mp4",
      poster: "./v2g_macro/M3_sheet.jpg",
      badge: "MACRO M3 · YOUTH LOCS",
      title: "M3 · Youth Twisted Locs, Baby Hairs & Cyan Phone Uplight",
      desc: "85mm portrait of East African youth with parted twisted locs & temple baby hairs looking down into upward cyan smartphone glow.",
      studyId: "macro_portraits"
    },
    {
      id: "M4", macro: true,
      src: "./v2g_macro/M4_operator_elder_portraits.mp4",
      poster: "./v2g_macro/M4_sheet.jpg",
      badge: "MACRO M4 · OPERATOR & ELDER",
      title: "M4 · Ponytail REC PPC Operator & Bearded Highland Elder",
      desc: "Feathered strand-card ponytail operator speaking into VHF handset paired with bearded highland elder in coiled turban.",
      studyId: "hill_desk"
    },
    {
      id: "M5", macro: true,
      src: "./v2g_macro/M5_skeleton_eskista_lift_mocap.mp4",
      poster: "./v2g_macro/M5_sheet.jpg",
      badge: "MACRO M5 · ESKISTA & 20KG",
      title: "M5 · 6/8 Eskista Clavicle Isolation -> 20 kg Squat-Lift",
      desc: "Full-body biomechanical reference on #424242 floor driving 56-bone S-curve spine, scapula pops, elbow volume & deep-knee lift.",
      studyId: "macro_skeleton"
    },
    {
      id: "M6", macro: true,
      src: "./v2g_macro/M6_garment_drape_turntable.mp4",
      poster: "./v2g_macro/M6_sheet.jpg",
      badge: "MACRO M6 · CLOTH DRAPE",
      title: "M6 · 360° Hand-Loomed Tibeb Shamma & Waxed Duster Drape",
      desc: "Slow turntable & walking cloth-drape reference for woven Ethiopian gabi shawl and weathered canvas carrier coat.",
      studyId: "eskista_trio"
    },
    {
      id: "V1", macro: false,
      src: "./v2g/V1_wellhead_pump.mp4",
      poster: "./v2g/V1_sheet.jpg",
      badge: "SCENE V1 · WELLHEAD PUMP",
      title: "V1 · Cast-Iron Wellhead Pump Leverage & Cyan Spout",
      desc: "Full-body hip-hinge, knee drive & two-handed iron lever stroke pouring glowing cyan water beside Mistletoe.",
      studyId: "pump_leverage"
    },
    {
      id: "V2", macro: false,
      src: "./v2g/V2_daylight_compound_unload.mp4",
      poster: "./v2g/V2_sheet.jpg",
      badge: "SCENE V2 · 20KG UNLOAD & POUR",
      title: "V2 · Daylight Hidmo Compound 20 L Unload & Shekla Pour",
      desc: "Two-carrier 20 kg jerrycan heave off sawbuck saddle into parabolic terracotta bowl pour.",
      studyId: "t7_basin_pour"
    },
    {
      id: "V3", macro: false,
      src: "./v2g/V3_oxbow_screening.mp4",
      poster: "./v2g/V3_sheet.jpg",
      badge: "SCENE V3 · OXBOW GROVE",
      title: "V3 · Cottonwood Root-Bowl Pour & Billowing Linen Screen",
      desc: "Kneeling tin-dipper pour and wind-billowing double linen projection sheets in the dusk grove.",
      studyId: "arch_chapel"
    },
    {
      id: "V4", macro: false,
      src: "./v2g/V4_pueblo_cooling_vault.mp4",
      poster: "./v2g/V4_sheet.jpg",
      badge: "SCENE V4 · SERVER VAULT",
      title: "V4 · Wire-Glass Registry & Liquid-Cooled Server Sanctuary",
      desc: "Diamond wire-glass counter clerk & glowing cyan floor-to-rack cooling hoses.",
      studyId: "arch_sanctuary"
    },
    {
      id: "V5", macro: false,
      src: "./v2g/V5_ahiya_night_convoy.mp4",
      poster: "./v2g/V5_sheet.jpg",
      badge: "SCENE V5 · NIGHT CONVOY",
      title: "V5 · Ahiya Night Ridge Shamma Procession & Phone Uplight",
      desc: "Walking highland youths & turbaned elders cradling cyan-lit smartphones beside Mistletoe.",
      studyId: "night_convoy"
    },
    {
      id: "V6", macro: false,
      src: "./v2g/V6_hill_rec_ppc_desk.mp4",
      poster: "./v2g/V6_sheet.jpg",
      badge: "SCENE V6 · REC PPC DESK",
      title: "V6 · Hill Archive Operators · Clipboard Log & VHF Radio",
      desc: "Seated two-operator choreography: tripod pen logging & forearm-aligned VHF radio dispatch.",
      studyId: "hill_desk"
    }
  ];

  /* ---------- 6 Targeted AI Video Generation Briefs ---------- */
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

  /* ---------- 15 Live Interactive 3D Study Plates (0..9 Classic, 10..12 v3 Macro, 13..14 v4 Emotion & Hand Showcases) ---------- */
  const STUDIES = [
    {
      id: "t7_basin_pour",
      short: "1 · t=7s Pour",
      title: "1 · Imani & 20 kg Two-Handed Basin Pour",
      cat: "HUMAN BIOMECHANICS & PARABOLIC POUR · ZZlDs10FCZk (00:07)",
      note: "Left hand grips the molded top handle, right hand cups the bottom rib, knees flex & pelvis counterbalances 20 kg pouring a curved parabolic arc into a clay shekla bowl.",
      night: false,
      cam: { dist: 2.65, yaw: -0.52, pitch: 0.16, targetX: -0.04, targetY: 0.88, targetZ: 0.16 },
      videoIds: ["V2", "M1", "E4"],
      orthoPlates: [
        { src: "../donkey/textures_v3/imani_photo_front.jpg", label: "imani_photo_front.jpg · 2K Duster Ortho" },
        { src: "../donkey/textures_v3/hand_dorsal.jpg", label: "hand_dorsal.jpg · Skinned Tendons & Nails" }
      ],
      kfIds: ["kf04", "kf03", "kf16"],
      sheet: "./generated/study_sheet_motion.jpg",
      sheetCap: "Generated Motion Study Sheet — Strip 2: 20 kg Jerrycan Lift, Hip Counterbalance & Two-Handed Basin Pour."
    },
    {
      id: "father_child_20kg",
      short: "2 · 01:53 Handoff",
      title: "2 · Elder Carrier & Child · 20 kg Handoff",
      cat: "TWO-CHARACTER WEIGHT & REACTIONS · ZZlDs10FCZk (01:53)",
      note: "Bearded carrier hinges hips under the 20L jerrycan (top handle + rear base) lowering into June's upward-cupped palms beneath the front-bottom bevels.",
      night: false,
      cam: { dist: 2.65, yaw: -0.68, pitch: 0.11, targetX: -0.06, targetY: 0.88, targetZ: 0.12 },
      videoIds: ["E2", "V2", "M6"],
      orthoPlates: [
        { src: "../donkey/textures_v3/elder_head_front.jpg", label: "elder_head_front.jpg · Front Ortho" },
        { src: "../donkey/textures_v3/youth_head_front.jpg", label: "youth_head_front.jpg · Youth Ortho" }
      ],
      kfIds: ["kf15", "kf14"],
      sheet: "./generated/study_sheet_characters.jpg",
      sheetCap: "Generated Character Turnaround Sheet — Orthographic Front/Side/Back, Facial Planes, Sisal Rope & Hand-Grip Callouts."
    },
    {
      id: "eskista_trio",
      short: "3 · Eskista 6/8",
      title: "3 · 6/8 Ethiopian Eskista Shoulder-Isolation Trio",
      cat: "104 BPM DANCE GROOVE, JOY & SHAMMA DRAPE",
      note: "Smooth 6/8 clavicle & scapula protraction-retraction groove, joyous Duchenne laughter/singing, expressive wrist/finger flourishes & grounded knee bounce.",
      night: false,
      cam: { dist: 3.35, yaw: 0.18, pitch: 0.12, targetY: 0.98 },
      videoIds: ["E4", "M5", "M6", "V2"],
      orthoPlates: [
        { src: "../donkey/textures_v3/imani_photo_front.jpg", label: "imani_photo_front.jpg · Front" },
        { src: "../donkey/textures_v3/imani_photo_side.jpg", label: "imani_photo_side.jpg · Profile" }
      ],
      kfIds: ["kf12", "kf15"],
      sheet: "./generated/study_sheet_motion.jpg",
      sheetCap: "Generated Motion Study Sheet — Strip 1: 6/8 Eskista Scapula Protraction, Shamma Follow-Through & Knee Bounce."
    },
    {
      id: "pump_leverage",
      short: "4 · Pump Stroke",
      title: "4 · Full-Weight Cast-Iron Standpipe Pump Stroke",
      cat: "ERGONOMIC LEVERAGE, PALMAR LOCK & PARABOLIC SPOUT · ZZlDs10FCZk (00:02)",
      note: "Ergonomic stand-off leverage with concentric 30-phalanx palmar lock on the iron lever, stroke-synced facial effort/relief & parabolic cyan stream with splash.",
      night: false,
      cam: { dist: 2.75, yaw: 0.16, pitch: 0.15, targetX: 0.22, targetY: 0.92, targetZ: 0.0 },
      videoIds: ["V1", "M1", "E4"],
      orthoPlates: [
        { src: "../donkey/textures_v3/imani_head_side.jpg", label: "imani_head_side.jpg · 90° Profile" },
        { src: "../donkey/textures_v3/hand_dorsal.jpg", label: "hand_dorsal.jpg · Bar-Wrap Skin" }
      ],
      kfIds: ["kf02", "kf05"],
      sheet: "./generated/study_sheet_motion.jpg",
      sheetCap: "Generated Motion Study Sheet — Strip 3: Maximum Upward Reach to Full Weight-Transfer Down-Stroke."
    },
    {
      id: "night_convoy",
      short: "5 · Night Phones",
      title: "5 · Ahiya Night Convoy · Upward Phone Face-Glow",
      cat: "NIGHT LIGHTING & DRAPED WALK · ZZlDs10FCZk (00:48 & 01:12)",
      note: "Rahel, Yared & Turbaned Elder walking beside Mistletoe's cyan-window panniers; supinated palms cradle glowing phones casting cyan bounce onto expressive faces.",
      night: true,
      cam: { dist: 3.25, yaw: 0.22, pitch: 0.10, targetY: 1.02 },
      videoIds: ["V5", "M3", "E2"],
      orthoPlates: [
        { src: "../donkey/textures_v3/youth_head_front.jpg", label: "youth_head_front.jpg · Front" },
        { src: "../donkey/textures_v3/hand_palmar.jpg", label: "hand_palmar.jpg · Supinated Palm" }
      ],
      kfIds: ["kf09", "kf12", "kf11"],
      sheet: "./generated/study_sheet_characters.jpg",
      sheetCap: "Night-Route Illumination Study — Selective cyan pack & upward phone bounce on sculpted cheekbones, eyelids, beards & shamma folds."
    },
    {
      id: "hill_desk",
      short: "6 · REC PPC Desk",
      title: "6 · Hill Archive Operators · Live VHF Radio & Log",
      cat: "SEATED DIALOGUE, VISEME DISPATCH & WRIST TWIST · ZZlDs10FCZk (00:36)",
      note: "Daniel (wire spectacles, tripod pen pinch & attentive glances) & Hanna (anisotropic ponytail, open-mouth VHF radio viseme dispatch & expressive hand callouts).",
      night: false,
      cam: { dist: 3.45, yaw: 0.24, pitch: 0.22, targetY: 1.02 },
      videoIds: ["V6", "M4", "E1"],
      orthoPlates: [
        { src: "../donkey/textures_v3/operator_f_head_front.jpg", label: "operator_f_head_front.jpg · Hanna" },
        { src: "../donkey/textures_v3/operator_m_head_front.jpg", label: "operator_m_head_front.jpg · Daniel" }
      ],
      kfIds: ["kf08", "kf13"],
      sheet: "./generated/study_sheet_characters.jpg",
      sheetCap: "Seated Cubicle Acting — Live open-mouth VHF dispatch visemes, spring-damped head turns, and tripod pen logging."
    },
    {
      id: "arch_hidmo",
      short: "7 · Hidmo House",
      title: "7 · Highland Hidmo Compound & Cyan Courtyard Well",
      cat: "VERNACULAR ARCHITECTURE · ZZlDs10FCZk (01:53)",
      note: "L-shaped flat-roofed stone-and-mud Ethiopian hidmo compound with parapet coping, protruding cedar vigas, recessed timber windows & circular cyan well.",
      night: false,
      cam: { dist: 12.6, yaw: 0.58, pitch: 0.30, targetY: 1.45 },
      videoIds: ["V2"],
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
      videoIds: ["V3", "V5"],
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
      videoIds: ["V4"],
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
      videoIds: ["V1", "V2"],
      kfIds: ["kf14", "kf16", "kf02", "kf05"],
      sheet: "./generated/study_sheet_architecture.jpg",
      sheetCap: "Generated Architecture Sheet (d) — Sawbuck Pack Frame, Embossed-X 20L Jerrycan, Standpipe & Terracotta Shekla Bowl."
    },

    /* ---------- 3 Next-Gen v3 Macro Diagnostic & Showcase Plates (Indices 10, 11, 12) ---------- */
    {
      id: "macro_hands",
      isMacro: true,
      short: "M1 · Hands & Grip",
      title: "M1 · Watertight Skinned Hands & 5-Grip Macro Study",
      cat: "MACRO ANATOMY (0.54M) · 30 PHALANGES & DUAL-ORTHO SKIN",
      note: "Seamless SkinnedMesh hands (interdigital webs, MCP knuckle domes, extensor tendons, fingernails & forearm twist) cycling: Dorsal/Palmar -> Pump Bar -> 20L Handle -> Phone -> Pen Pinch.",
      night: false,
      cam: { dist: 0.54, yaw: 0.14, pitch: 0.25, targetX: 0.0, targetY: 1.12, targetZ: 0.27 },
      videoIds: ["M1", "E3", "V1", "V6"],
      orthoPlates: [
        { src: "../donkey/textures_v3/hand_emotions_sheet.jpg", fileName: "hand_emotions_sheet.jpg", label: "hand_emotions_sheet.jpg · 9-Pose Hand Grid" },
        { src: "../donkey/textures_v3/hand_dorsal.jpg", label: "hand_dorsal.jpg · Tendons, Webs & Nails" },
        { src: "../donkey/textures_v3/hand_palmar.jpg", label: "hand_palmar.jpg · Creases & Thenar Pad" }
      ],
      kfIds: ["kf03", "kf04", "kf08"],
      sheet: "./generated/study_sheet_characters.jpg",
      sheetCap: "Donkey-Method 1:1 UV-Registered Dorsal & Palmar Hand Projection (#424242 bleed-padded, photoMix = 0.86)."
    },
    {
      id: "macro_portraits",
      isMacro: true,
      short: "M2 · Faces & Hair",
      title: "M2 · Dual-Ortho Portraits, Wet Corneas & Volumetric Hair",
      cat: "85MM PORTRAIT LINEUP · SHELLS, LOCS & CARDS",
      note: "Imani (12-shell 4C coily hair), June (68 twisted locs & baby hairs), Hanna (feathered strand-card ponytail) & Elder (8-shell beard & turban) with wet clearcoat corneas & flush eyelids.",
      night: false,
      cam: { dist: 1.48, yaw: 0.04, pitch: 0.04, targetX: 0.0, targetY: 1.54, targetZ: 0.02 },
      videoIds: ["M2", "M3", "M4", "E1", "E2"],
      orthoPlates: [
        { src: "../donkey/textures_v3/imani_expressions_sheet.jpg", fileName: "imani_expressions_sheet.jpg", label: "imani_expressions_sheet.jpg · 9-State FACS" },
        { src: "../donkey/textures_v3/imani_head_front.jpg", label: "imani_head_front.jpg · Front" },
        { src: "../donkey/textures_v3/imani_head_side.jpg", label: "imani_head_side.jpg · Left Profile" },
        { src: "../donkey/textures_v3/youth_head_front.jpg", label: "youth_head_front.jpg · Youth Front" },
        { src: "../donkey/textures_v3/youth_head_side.jpg", label: "youth_head_side.jpg · Youth Profile" },
        { src: "../donkey/textures_v3/operator_f_head_front.jpg", label: "operator_f_head_front.jpg · Hanna" },
        { src: "../donkey/textures_v3/elder_head_side.jpg", label: "elder_head_side.jpg · Elder Profile" },
        { src: "../donkey/textures_v3/elder_head_front.jpg", label: "elder_head_front.jpg · Elder Front" }
      ],
      kfIds: ["kf09", "kf08", "kf12"],
      sheet: "./generated/study_sheet_characters.jpg",
      sheetCap: "Matched Front + Left-Profile 2K Portrait Pairs on #424242 Studio Matte (photoMix = 0.87 + Subsurface Wrap)."
    },
    {
      id: "macro_skeleton",
      isMacro: true,
      autoSkeleton: true,
      short: "M3 · 56-Bone X-Ray",
      title: "M3 · 56-Bone Anatomical Skeleton & Eskista Kinematics",
      cat: "CLINICAL X-RAY RIG (2.55M) · SPINE, TWIST & 30 PHALANGES",
      note: "Live 56-bone X-Ray rig auto-enabled: S-curve lumbar/thoracic/cervical spine, radius-over-ulna forearm twist, elbow/knee volume helpers & 30 finger phalanges.",
      night: true,
      cam: { dist: 2.55, yaw: 0.20, pitch: 0.11, targetX: 0.0, targetY: 0.94, targetZ: 0.02 },
      videoIds: ["M5", "M6", "V2"],
      orthoPlates: [
        { src: "../donkey/textures_v3/imani_photo_front.jpg", label: "imani_photo_front.jpg · Full Body" },
        { src: "../donkey/textures_v3/imani_photo_side.jpg", label: "imani_photo_side.jpg · Side Profile" }
      ],
      kfIds: ["kf14", "kf15"],
      sheet: "./generated/study_sheet_motion.jpg",
      sheetCap: "56-Bone Osteological Hierarchy + Crimson Muscle Lines + Half-Angle Elbow & Knee Volume Helpers."
    },

    /* ---------- 2 Flagship v4 Emotion, Speech & Expressive Hand Showcases (Indices 13, 14 — Lead Default!) ---------- */
    {
      id: "exp_emotions_speech",
      isMacro: true,
      isExp: true,
      short: "E1 · Emotions & Speech",
      title: "E1 · Emotions, Open-Mouth Speech & Reactions",
      cat: "85MM FACS CLOSE-UP (0.24M–0.50M) · TEETH, TONGUE & DUCHENNE EYES",
      note: "Trigger & scrub open-mouth speech visemes (upper/lower dental arches & moving tongue tip), Duchenne laughter, grief, wide-eyed awe, 20 kg strain & pleading across Imani, June, Hanna & Elder.",
      night: false,
      cam: { dist: 0.50, yaw: 0.08, pitch: 0.03, targetX: -0.015, targetY: 1.532, targetZ: 0.23 },
      videoIds: ["E1", "E2", "M2", "M3", "M4"],
      orthoPlates: [
        { src: "../donkey/textures_v3/imani_expressions_sheet.jpg", fileName: "imani_expressions_sheet.jpg", label: "imani_expressions_sheet.jpg · 9 FACS States" },
        { src: "../donkey/textures_v3/hand_emotions_sheet.jpg", fileName: "hand_emotions_sheet.jpg", label: "hand_emotions_sheet.jpg · 9 Emotive Hands" },
        { src: "../donkey/textures_v3/imani_head_front.jpg", label: "imani_head_front.jpg · Imani Front" },
        { src: "../donkey/textures_v3/imani_head_side.jpg", label: "imani_head_side.jpg · Imani 90° Profile" },
        { src: "../donkey/textures_v3/youth_head_front.jpg", label: "youth_head_front.jpg · June (68 Locs)" },
        { src: "../donkey/textures_v3/elder_head_front.jpg", label: "elder_head_front.jpg · Bearded Elder" }
      ],
      kfIds: ["kf08", "kf09", "kf14", "kf15"],
      sheet: "./generated/study_sheet_characters.jpg",
      sheetCap: "Real-Time GPU FACS Action Units + Split Vermilion Oral Rima + Recessed Maxillary/Mandibular Dental Arches & Articulated Tongue."
    },
    {
      id: "exp_hand_acting",
      isMacro: true,
      isExp: true,
      short: "E2 · 12 Hand Gestures",
      title: "E2 · Expressive Hand Acting & 12 Gestures",
      cat: "30-BONE HAND ACTING (0.28M–0.65M) · SPLAY, CUP, FIST, WAVE & RIPPLE",
      note: "Watertight 30-phalanx hands + forearm pronation/supination performing all 12 expressive emotional gestures: Splayed Awe, Talking Hands, Cupped Water Plea, Highland Wave, Point, Heart Touch, Clenched Fist & Piano Ripple.",
      night: false,
      cam: { dist: 0.50, yaw: 0.08, pitch: 0.14, targetX: 0.00, targetY: 1.28, targetZ: 0.22 },
      videoIds: ["E3", "E4", "M1", "M5"],
      orthoPlates: [
        { src: "../donkey/textures_v3/hand_emotions_sheet.jpg", fileName: "hand_emotions_sheet.jpg", label: "hand_emotions_sheet.jpg · 9-Gesture Sheet" },
        { src: "../donkey/textures_v3/hand_dorsal.jpg", label: "hand_dorsal.jpg · Extensor Tendons & Nails" },
        { src: "../donkey/textures_v3/hand_palmar.jpg", label: "hand_palmar.jpg · Palmar Creases & Thenar" },
        { src: "../donkey/textures_v3/imani_expressions_sheet.jpg", fileName: "imani_expressions_sheet.jpg", label: "imani_expressions_sheet.jpg · Coupled FACS" }
      ],
      kfIds: ["kf03", "kf04", "kf08", "kf09"],
      sheet: "./generated/study_sheet_motion.jpg",
      sheetCap: "3-Axis (rx, ry, rz) 30-Phalanx Articulation + Radius-Ulna Forearm Twist + Expressive Whole-Arm Kinematics."
    },

    /* ---------- Flagship v5.2 Default Landing Showcase (Index 15 — Lead Default!) ---------- */
    {
      id: "neck_lean_skin",
      isMacro: true,
      isExp: true,
      isNeckLean: true,
      short: "N1 · Neck Lean & Skin",
      title: "N1 · Leaning Neck, Jawline & Body Skin Continuity",
      cat: "85MM CERVICAL BIOMECHANICS & SKIN CONTINUITY · 3-JOINT SCM LEAN",
      note: "Supple 3-joint cervical neck leaning (±24° SCM stretch, oblique portrait turn, -22° throat extension & Eskista glide) with unbroken face-jaw-neck-clavicle-arm-hand skin continuity.",
      night: false,
      cam: { dist: 0.80, yaw: 0.03, pitch: 0.025, targetX: 0.00, targetY: 1.468, targetZ: 0.18 },
      videoIds: ["M2", "E1", "M5", "E4"],
      orthoPlates: [
        { src: "../donkey/textures_v3/imani_head_front.jpg", label: "imani_head_front.jpg · Oval V-Jaw & Neck" },
        { src: "../donkey/textures_v3/imani_head_side.jpg", label: "imani_head_side.jpg · 90° Jaw & Nape" },
        { src: "../donkey/textures_v3/operator_f_head_front.jpg", label: "operator_f_head_front.jpg · Hanna" },
        { src: "../donkey/textures_v3/youth_head_front.jpg", label: "youth_head_front.jpg · June (68 Locs)" },
        { src: "../donkey/textures_v3/elder_head_front.jpg", label: "elder_head_front.jpg · Bearded Elder" },
        { src: "../donkey/textures_v3/hand_dorsal.jpg", label: "hand_dorsal.jpg · Matched Dorsal Skin" }
      ],
      kfIds: ["kf04", "kf08", "kf12", "kf15"],
      sheet: "./generated/study_sheet_characters.jpg",
      sheetCap: "Unified Linear Dermal Albedo (canonicalSkinLin) + Diagonal Oval V-Mandible + 3-Joint C-Curve Cervical Leaning & Dynamic SCM Relief."
    }
  ];

  /* ---------- Zero-404 Directory Listing Asset Discovery ---------- */
  function extractHrefFilenames(html) {
    const names = [];
    const re = /href="([^"?/#]+)"/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      try { names.push(decodeURIComponent(m[1])); } catch (_) { names.push(m[1]); }
    }
    return names;
  }

  let discoveryAttempts = 0;
  let discoveryTimer = null;

  async function discoverEmotionAssets() {
    let changed = false;
    try {
      const [rEmo, rTex] = await Promise.all([
        fetch("./v2g_emotions/", { cache: "no-store" }).catch(() => null),
        fetch("../donkey/textures_v3/", { cache: "no-store" }).catch(() => null)
      ]);
      if (rEmo && rEmo.ok) {
        const html = await rEmo.text();
        for (const fn of extractHrefFilenames(html)) {
          if (!liveEmotionFiles.has(fn)) {
            liveEmotionFiles.add(fn);
            changed = true;
          }
        }
      }
      if (rTex && rTex.ok) {
        const html = await rTex.text();
        for (const fn of extractHrefFilenames(html)) {
          if (!liveTextureV3Files.has(fn)) {
            liveTextureV3Files.add(fn);
            changed = true;
          }
        }
      }
    } catch (_) {
      // Silent safe fallback
    }

    if (changed && STUDIES[activeStudyIdx]) {
      renderMatchedTab(STUDIES[activeStudyIdx]);
      renderVideosTab();
    }

    const allVideosReady = ["E1_imani_emotions_speech_arc.mp4", "E2_elder_youth_dialogue_reactions.mp4", "E3_expressive_hands_gestures_100mm.mp4", "E4_fullbody_emotional_acting_ensemble.mp4"]
      .every(f => liveEmotionFiles.has(f));
    const allSheetsReady = liveTextureV3Files.has("imani_expressions_sheet.jpg") && liveTextureV3Files.has("hand_emotions_sheet.jpg");

    if ((!allVideosReady || !allSheetsReady) && discoveryAttempts < 24) {
      discoveryAttempts++;
      clearTimeout(discoveryTimer);
      discoveryTimer = setTimeout(discoverEmotionAssets, 6500);
    }
    return {
      emotionFiles: Array.from(liveEmotionFiles),
      hasExpressionSheet: liveTextureV3Files.has("imani_expressions_sheet.jpg"),
      hasHandEmotionSheet: liveTextureV3Files.has("hand_emotions_sheet.jpg")
    };
  }

  function isVideoAvailable(v) {
    if (!v) return false;
    if (v.emotion) return liveEmotionFiles.has(v.fileName);
    if (v.macro) return MACRO_VIDEOS_LIVE;
    return true;
  }

  function getVideoPosterAttr(v) {
    if (!v || !v.poster) return "";
    if (v.emotion) return liveEmotionFiles.has(v.posterName) ? ` poster="${v.poster}"` : "";
    if (v.macro && !MACRO_VIDEOS_LIVE) return "";
    return ` poster="${v.poster}"`;
  }

  function getAvailableOrthoPlates(plates) {
    if (!plates || !plates.length) return [];
    return plates.filter(op => !op.fileName || liveTextureV3Files.has(op.fileName));
  }

  /* ---------- Three.js Studio Paper / Night Renderer ---------- */
  const wrap = $("stage-wrap");
  const canvas = $("view");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.09;

  const scene = new T.Scene();
  const PAPER_COLOR = new T.Color(0xd9d5cb);
  const NIGHT_COLOR = new T.Color(0x141615);
  scene.background = PAPER_COLOR.clone();

  const camera = new T.PerspectiveCamera(35, 1, 0.015, 240);

  // Studio 3-Point + Subsurface Rim + Warm Ground Reflector Bounce + Oral/Cornea Fill
  const hemi = new T.HemisphereLight(0xf5f1e8, 0x968b7c, 1.56);
  scene.add(hemi);

  const sun = new T.DirectionalLight(0xfffaf0, 2.48);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.0065;
  Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 0.4, far: 36 });
  scene.add(sun, sun.target);

  const rim = new T.DirectionalLight(0xd4eef8, 1.02);
  scene.add(rim, rim.target);

  const bounceLight = new T.DirectionalLight(0xf6dfc6, 0.48);
  scene.add(bounceLight, bounceLight.target);

  // Gentle camera-coupled softbox specular catchlight for wet clearcoat corneas, dental enamel & fingernails
  const catchLight = new T.DirectionalLight(0xffffff, 0.28);
  scene.add(catchLight, catchLight.target);

  const shadowCatcher = new T.Mesh(
    new T.PlaneGeometry(60, 60),
    new T.ShadowMaterial({ opacity: 0.28 })
  );
  shadowCatcher.rotation.x = -Math.PI * 0.5;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  const ringGeo = new T.RingGeometry(1.48, 1.50, 64);
  ringGeo.rotateX(-Math.PI * 0.5);
  const ringMat = new T.MeshBasicMaterial({ color: 0x8a867c, transparent: true, opacity: 0.32, side: T.DoubleSide });
  const plinthRing = new T.Mesh(ringGeo, ringMat);
  plinthRing.position.y = 0.003;
  scene.add(plinthRing);

  const stageRoot = new T.Group();
  scene.add(stageRoot);

  /* ---------- Camera Orbit, Pan & 0.22m Macro Zoom Controls ---------- */
  const camState = {
    yaw: 0.08, pitch: 0.03, dist: 0.48,
    targetX: 0, targetY: 1.56, targetZ: 0.23,
    wantYaw: 0.08, wantPitch: 0.03, wantDist: 0.48,
    wantTargetX: 0, wantTargetY: 1.56, wantTargetZ: 0.23,
    turntable: false, sunDeg: 42, night: false
  };

  let followTargetFn = null;
  let lastShadowMode = "";
  let evenSkinLightActive = false;
  let pendingEvenShadowClear = false;
  const shadowClearColorTmp = new T.Color();

  function clearSunShadowMapToUnshadowed() {
    if (sun.shadow && sun.shadow.map) {
      const prevRT = renderer.getRenderTarget();
      const prevCol = renderer.getClearColor(shadowClearColorTmp);
      const prevA = renderer.getClearAlpha();
      renderer.setRenderTarget(sun.shadow.map);
      if (renderer.state && renderer.state.buffers && renderer.state.buffers.depth) {
        renderer.state.buffers.depth.setMask(true);
        renderer.state.buffers.depth.setClear(1);
      }
      renderer.setClearColor(0xffffff, 1);
      renderer.clear(true, true, true);
      renderer.setClearColor(prevCol, prevA);
      renderer.setRenderTarget(prevRT);
      return true;
    }
    return false;
  }

  function updateSunDirection() {
    const tx = camState.targetX, ty = camState.targetY * 0.55, tz = camState.targetZ;
    if (evenSkinLightActive && !camState.night) {
      // Diffuse, shadow-free front studio beauty lighting for quantitative colorimetric Face->Jaw->Neck->Chest->Arm->Hand audit!
      const cYaw = camState.yaw || 0;
      sun.target.position.set(tx, camState.targetY, tz);
      sun.position.set(tx + Math.sin(cYaw) * 7.2, camState.targetY + 1.15, tz + Math.cos(cYaw) * 7.2);
      rim.target.position.set(tx, camState.targetY, tz);
      rim.position.set(tx - Math.sin(cYaw) * 6.0, camState.targetY + 1.8, tz - Math.cos(cYaw) * 6.0);
      bounceLight.target.position.set(tx, camState.targetY - 0.12, tz);
      bounceLight.position.set(tx + Math.sin(cYaw) * 4.8, camState.targetY - 2.4, tz + Math.cos(cYaw) * 4.8);
      sun.target.updateMatrixWorld();
      rim.target.updateMatrixWorld();
      bounceLight.target.updateMatrixWorld();
      return;
    }
    const rad = (camState.sunDeg * Math.PI) / 180;
    sun.target.position.set(tx, ty, tz);
    sun.position.set(tx + Math.sin(rad) * 7.5, ty + 8.2, tz + Math.cos(rad) * 7.5);
    rim.target.position.set(tx, ty + 0.3, tz);
    rim.position.set(tx - Math.sin(rad + 0.32) * 6.8, ty + 3.8, tz - Math.cos(rad + 0.32) * 6.8);
    bounceLight.target.position.set(tx, ty + 0.4, tz);
    bounceLight.position.set(tx - Math.sin(rad - 0.85) * 4.6, -1.4, tz + Math.cos(rad - 0.85) * 4.6);
  }
  updateSunDirection();

  function applyEvenSkinLightMode(flag) {
    const next = Boolean(flag);
    if (evenSkinLightActive === next) {
      if (next && !camState.night) {
        clearSunShadowMapToUnshadowed();
        updateSunDirection();
      }
      return;
    }
    evenSkinLightActive = next;
    if (next && !camState.night) {
      sun.castShadow = false;
      shadowCatcher.visible = false;
      hemi.intensity = 2.08;
      hemi.groundColor.setHex(0xd4cec2);
      sun.intensity = 1.62;
      rim.intensity = 0.42;
      bounceLight.intensity = 0.72;
      catchLight.intensity = 0.22;
      pendingEvenShadowClear = !clearSunShadowMapToUnshadowed();
    } else {
      sun.castShadow = true;
      shadowCatcher.visible = true;
      pendingEvenShadowClear = false;
      renderer.shadowMap.needsUpdate = true;
      setPaperMode(camState.night);
    }
    updateSunDirection();
  }

  function syncTightShadowFrustum(st) {
    const isLargeArch = st && st.id.startsWith("arch_") && st.id !== "arch_props";
    const isMacroNow = !isLargeArch && (camState.dist < 1.35 || (st && st.isMacro && camState.dist < 1.65));
    const modeKey = isLargeArch ? "arch" : (isMacroNow ? "macro" : "human");
    const shBound = isLargeArch ? 9.5 : (isMacroNow ? 0.96 : 3.4);
    sun.shadow.bias = isLargeArch ? -0.0003 : (isMacroNow ? -0.00007 : -0.00018);
    sun.shadow.normalBias = isLargeArch ? 0.012 : (isMacroNow ? 0.0032 : 0.0068);
    if (modeKey !== lastShadowMode || Math.abs(sun.shadow.camera.right - shBound) > 0.02) {
      lastShadowMode = modeKey;
      sun.shadow.camera.left = -shBound;
      sun.shadow.camera.right = shBound;
      sun.shadow.camera.top = shBound;
      sun.shadow.camera.bottom = -shBound;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = isLargeArch ? 40 : 28;
      sun.shadow.camera.updateProjectionMatrix();
    }
  }

  function setPaperMode(isNight) {
    camState.night = isNight;
    document.body.classList.toggle("night-mode", isNight);
    scene.background.copy(isNight ? NIGHT_COLOR : PAPER_COLOR);
    hemi.intensity = isNight ? 0.42 : 1.56;
    hemi.groundColor.setHex(isNight ? 0x1d2426 : 0x968b7c);
    sun.intensity = isNight ? 0.58 : 2.48;
    rim.intensity = isNight ? 0.78 : 1.02;
    bounceLight.intensity = isNight ? 0.18 : 0.48;
    catchLight.intensity = isNight ? 0.18 : 0.28;
    shadowCatcher.material.opacity = isNight ? 0.55 : 0.28;
    ringMat.color.setHex(isNight ? 0x3be0f5 : 0x8a867c);
    $("btn-paper").setAttribute("aria-pressed", String(!isNight));
    $("btn-paper").textContent = isNight ? "Mode: Night" : "Mode: Study Paper";
  }

  let drag = null, pinchDist = 0;
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);
    const isPan = e.button === 2 || e.button === 1 || e.shiftKey;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: isPan };
    if (isPan) followTargetFn = null;
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) {
      const panScale = camState.dist * 0.0014;
      const cy = Math.cos(camState.yaw), sy = Math.sin(camState.yaw);
      camState.wantTargetX -= dx * cy * panScale;
      camState.wantTargetZ += dx * sy * panScale;
      camState.wantTargetY = clamp(camState.wantTargetY + dy * panScale, 0.05, 6.0);
    } else {
      camState.wantYaw -= dx * 0.0072;
      camState.wantPitch = clamp(camState.wantPitch + dy * 0.0055, -0.26, 1.22);
    }
  });
  canvas.addEventListener("pointerup", e => { if (drag && drag.id === e.pointerId) drag = null; });
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    camState.wantDist = clamp(camState.wantDist * Math.exp(e.deltaY * 0.0011), 0.15, 22.0);
  }, { passive: false });
  canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (e.touches.length === 2 && pinchDist > 0) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      camState.wantDist = clamp(camState.wantDist * (pinchDist / Math.max(20, d)), 0.15, 22.0);
      pinchDist = d;
    }
  }, { passive: true });

  /* ---------- Stage State, Showcases & Live Expression Director ---------- */
  let activeStudyIdx = 15;
  let activeActors = [];
  let activeDonkey = null;
  let activeStudyPump = null;
  let activeSharedHandoff = null;
  let activeBasinBowlPos = null;
  let activeMacroHands = null;
  let activeMacroPortraits = null;
  let activeEmotionsStage = null;
  let activeHandActingStage = null;
  let activeNeckLeanStage = null;
  let activeFocusKey = "default";

  // Live Stage Expression, Neck Lean & Speech Director State (works across ALL studies!)
  const directorState = {
    preset: "auto",     // "auto" or preset id in DIRECTOR_PRESETS
    slidersOpen: false,
    neckLeanDeg: 0,     // -26..+26 degrees lateral cervical lean
    jawSpeech: 0,       // 0..1
    smileSad: 0,        // -1..+1
    brows: 0,           // -1..+1
    handSplayCurl: 0    // -1..+1
  };

  // Telemetry snapshot for UI HUD & window.__study.getExpressionTelemetry()
  const liveTelemetry = {
    emotion: "neutral",
    viseme: "SIL",
    jawOpen: 0,
    neckLeanDeg: 0,
    neckPitchDeg: 0,
    neckYawDeg: 0,
    speaking: false,
    handGestureL: "relaxed_breathing",
    handGestureR: "relaxed_breathing",
    hudTitle: "AUTO-CYCLE 3-JOINT CERVICAL LEANS",
    hudFacs: "3-JOINT C-CURVE · SCM RELIEF"
  };

  // 56-Bone X-Ray Skeleton State
  let userSkeletonPinned = false;
  let skeletonXRayActive = false;

  const studyPumpGrips = {
    pumpGripL: new T.Vector3(),
    pumpGripR: new T.Vector3(),
    pumpGripWorld: new T.Vector3(),
    pumpBarDir: new T.Vector3(),
    pumpPhase: 0
  };
  let manualMoodIdx = -1;
  const MOOD_CYCLE = ["auto", "calm", "focus", "strain20kg", "converse", "listen", "rejoice"];
  const flatGround = () => 0;

  function hasFacsOnlySlidersActive() {
    return (
      directorState.jawSpeech > 0.01 ||
      Math.abs(directorState.smileSad) > 0.01 ||
      Math.abs(directorState.brows) > 0.01
    );
  }

  function hasDirectorSlidersActive() {
    return (
      Math.abs(directorState.neckLeanDeg) > 0.25 ||
      hasFacsOnlySlidersActive() ||
      Math.abs(directorState.handSplayCurl) > 0.01
    );
  }

  function isDirectorOverrideActive() {
    return directorState.preset !== "auto" || hasDirectorSlidersActive();
  }

  function buildDirectorOverridePayload() {
    if (!isDirectorOverrideActive()) {
      window.NIGHT_POST_EMOTION_OVERRIDE = null;
      return null;
    }
    const pDef = DIRECTOR_PRESETS.find(p => p.key === directorState.preset);
    const hasFacsSliders = hasFacsOnlySlidersActive();
    const hasNeckLean = Math.abs(directorState.neckLeanDeg) > 0.25;
    const sm = directorState.smileSad;
    const br = directorState.brows;
    const hs = directorState.handSplayCurl;
    const jw = directorState.jawSpeech;
    const neckLeanRad = directorState.neckLeanDeg * DEG;

    const facs = hasFacsSliders ? {
      jawOpen: jw,
      smile: Math.max(0, sm),
      squint: Math.max(0, sm) * 0.56,
      sad: Math.max(0, -sm),
      browUpInner: Math.max(Math.max(0, -sm) * 0.65, Math.max(0, br)),
      browUpOuter: Math.max(0, br) * 0.92,
      wideEyes: Math.max(0, br) * 0.52,
      browFurrow: Math.max(0, -br),
      noseWrinkle: Math.max(0, -br) * 0.42
    } : null;

    const hasExplicitPreset = Boolean(directorState.preset && directorState.preset !== "auto");
    let handGesture = hasExplicitPreset ? ((pDef && pDef.hand) || "relaxed_breathing") : undefined;
    if (hs > 0.12) handGesture = "spread_splay_awe";
    else if (hs < -0.12) handGesture = "clenched_fist_resolve";

    const speakingNow = hasExplicitPreset ? Boolean(pDef && pDef.speaking) : undefined;
    const visemeNow = (!speakingNow && jw > 0.06)
      ? (jw > 0.52 ? "AA" : "OH")
      : (directorState.preset === "neutral" && jw <= 0.01 ? "SIL" : undefined);

    const payload = {
      emotion: hasExplicitPreset ? directorState.preset : undefined,
      intensity: hasExplicitPreset ? (pDef && pDef.intensity !== undefined ? pDef.intensity : 1.0) : undefined,
      speaking: speakingNow,
      speechIntensity: speakingNow ? (0.65 + jw * 0.45) : undefined,
      viseme: visemeNow,
      visemeAmount: visemeNow ? (visemeNow === "SIL" ? 1.0 : clamp(jw, 0, 1)) : undefined,
      facs,
      neckLean: hasNeckLean ? { roll: neckLeanRad, pitch: 0, yaw: 0, glideX: 0 } : undefined,
      handGestureL: handGesture,
      handGestureR: handGesture,
      armGesture: (pDef && pDef.key !== "auto" && (pDef.hand === "joyful_wave" || pDef.hand === "cupped_water_plea" || pDef.hand === "talking_gesticulate"))
        ? pDef.hand : undefined
    };
    window.NIGHT_POST_EMOTION_OVERRIDE = payload;
    return payload;
  }

  function applySkeletonStateToActors(flag) {
    skeletonXRayActive = Boolean(flag);
    if (window.HumanSculptV3 && typeof window.HumanSculptV3.setGlobalDebugSkeleton === "function") {
      window.HumanSculptV3.setGlobalDebugSkeleton(skeletonXRayActive);
    }
    for (const item of activeActors) {
      if (item.ch && typeof item.ch.setDebugSkeleton === "function") {
        item.ch.setDebugSkeleton(skeletonXRayActive);
      }
    }
    const btn = $("btn-skeleton");
    if (btn) {
      btn.setAttribute("aria-pressed", String(skeletonXRayActive));
      btn.classList.toggle("active", skeletonXRayActive);
      btn.textContent = skeletonXRayActive ? "Skeleton X-Ray: ON" : "Skeleton X-Ray";
    }
  }

  function setSkeletonXRay(flag, isUserAction = false) {
    if (isUserAction) userSkeletonPinned = Boolean(flag);
    applySkeletonStateToActors(flag);
  }

  function clearStage() {
    while (stageRoot.children.length) stageRoot.remove(stageRoot.children[0]);
    activeActors = [];
    activeDonkey = null;
    activeStudyPump = null;
    activeSharedHandoff = null;
    activeBasinBowlPos = null;
    activeMacroHands = null;
    activeMacroPortraits = null;
    activeEmotionsStage = null;
    activeHandActingStage = null;
    activeNeckLeanStage = null;
    followTargetFn = null;
    activeFocusKey = "default";
    applyEvenSkinLightMode(false);
  }

  function spawnDonkeyWithSightWindow(x, z, heading) {
    if (!window.makeDonkey) return null;
    const d = window.makeDonkey({ assetPath: "../donkey/", shells: 12, monochrome: true, contactShadow: true, alwaysHalter: true });
    d.setCargo([{ kg: 14, slot: "L" }, { kg: 14, slot: "R" }, { kg: 8, slot: "T" }]);
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

  function makeIronPumpBarProp() {
    const ironMat = new T.MeshStandardMaterial({ color: 0x25282a, roughness: 0.42, metalness: 0.78 });
    const brassCollarMat = new T.MeshStandardMaterial({ color: 0xb59a6a, roughness: 0.36, metalness: 0.72 });
    const barGroup = new T.Group();
    const barShaft = new T.Mesh(new T.CylinderGeometry(0.0145, 0.0145, 0.44, 20), ironMat);
    barShaft.rotation.z = Math.PI * 0.5;
    barShaft.castShadow = true; barShaft.receiveShadow = true;
    barGroup.add(barShaft);
    for (const sx of [-0.185, 0.185]) {
      const col = new T.Mesh(new T.CylinderGeometry(0.020, 0.020, 0.016, 18), brassCollarMat);
      col.rotation.z = Math.PI * 0.5;
      col.position.x = sx;
      barGroup.add(col);
    }
    barGroup.position.set(0, 1.06, 0.34);
    barGroup.visible = false;
    stageRoot.add(barGroup);
    return barGroup;
  }

  function spawnActor(spec) {
    const ch = window.makeExpeditionCharacter(T, spec);
    if (!ch.userData) ch.userData = ch.group.userData;
    if (window.HumanExpressionsV4 && typeof window.HumanExpressionsV4.ensureController === "function") {
      window.HumanExpressionsV4.ensureController(ch);
    }
    ch.place(spec.x || 0, spec.z || 0, spec.heading || 0, flatGround);
    if (skeletonXRayActive && typeof ch.setDebugSkeleton === "function") {
      ch.setDebugSkeleton(true);
    }
    stageRoot.add(ch.group);
    activeActors.push({
      ch,
      pose: spec.pose || "idle",
      baseX: spec.x || 0,
      baseZ: spec.z || 0,
      baseHeading: spec.heading || 0
    });
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

  /* ---------- Exact Live Bone World-Position Helper for Macro Lens Presets ---------- */
  const boneTmpA = new T.Vector3();
  const boneTmpB = new T.Vector3();

  function getActorPartWorldPos(ch, part, out) {
    if (!ch || !ch.bones) return out.set(0, 1.2, 0);
    ch.group.updateMatrixWorld(true);
    const isV3 = Boolean(window.HumanSculptV3 && ch.bones.length >= 50);
    const B3 = isV3 ? window.HumanSculptV3.B : null;
    const idxHead     = B3 ? B3.HEAD : 5;
    const idxNeckHigh = B3 ? B3.NECK_HIGH : 5;
    const idxNeckLow  = B3 ? B3.NECK_LOW : 4;
    const idxChest    = B3 ? B3.CHEST : 3;
    const idxHandL    = B3 ? B3.L_MID_1 : 9;
    const idxHandR    = B3 ? B3.R_MID_1 : 13;
    const idxPelvis   = B3 ? B3.PELVIS : 1;

    if (part === "eyeMacro" || part === "eyes" || part === "eye" || part === "eyeLid") {
      // Frames 23.2mm Scion eye globe, 11.1mm iris, ivory sclera, caruncle, 3D micro-lashes & supratarsal crease at 0.18m!
      out.set(0.008, 0.076, 0.062);
      return ch.bones[idxHead].localToWorld(out);
    }
    if (part === "neckLeanFrame") {
      // Steady chest-referenced mid-neck/clavicle anchor (y ~ 1.475m) so lateral ±24° cervical leans read dramatically against stable shoulders!
      out.set(-0.012, 0.158, 0.038);
      return ch.bones[idxChest].localToWorld(out);
    }
    if (part === "neckCollar" || part === "neck" || part === "collar" || part === "neck34") {
      // Live B_NECK_HIGH anchor matching bae98254.jpg: frames full head crown (1.74) down to clavicles & open collar (1.36) clear above .stage-bar!
      out.set(0, 0.006, 0.042);
      return ch.bones[idxNeckHigh].localToWorld(out);
    }
    if (part === "mouth" || part === "mouth34" || part === "mouthProfile") {
      // Slightly below rima (y+0.004) so open mouth, teeth, tongue & wet eyes sit high above .stage-bar at 0.24m!
      out.set(0, 0.004, 0.056);
      return ch.bones[idxHead].localToWorld(out);
    }
    if (part === "lips") {
      out.set(0, -0.006, 0.068);
      return ch.bones[idxHead].localToWorld(out);
    }
    if (part === "head" || part === "profile" || part === "threeQuarter") {
      out.set(0, 0.036, 0.038);
      return ch.bones[idxHead].localToWorld(out);
    }
    if (part === "upperBody") {
      out.set(0, -0.02, 0.08);
      return ch.bones[idxChest].localToWorld(out);
    }
    if (part === "handL") {
      ch.bones[idxHandL].getWorldPosition(out);
      out.y -= 0.028;
      return out;
    }
    if (part === "handR") {
      ch.bones[idxHandR].getWorldPosition(out);
      out.y -= 0.028;
      return out;
    }
    if (part === "hands") {
      ch.bones[idxHandL].getWorldPosition(boneTmpA);
      ch.bones[idxHandR].getWorldPosition(boneTmpB);
      out.copy(boneTmpA).add(boneTmpB).multiplyScalar(0.5);
      out.y -= 0.034;
      return out;
    }
    ch.bones[idxPelvis].getWorldPosition(out);
    out.y += 0.12;
    return out;
  }

  function setCameraPreset(cfg, snap = false) {
    if (cfg.fov !== undefined && Number.isFinite(+cfg.fov)) {
      camera.fov = clamp(+cfg.fov, 15, 75);
      camera.updateProjectionMatrix();
    }
    if (cfg.dist !== undefined) camState.wantDist = clamp(cfg.dist, 0.15, 22.0);
    if (cfg.yaw !== undefined) camState.wantYaw = cfg.yaw;
    if (cfg.pitch !== undefined) camState.wantPitch = clamp(cfg.pitch, -0.26, 1.22);
    if (Array.isArray(cfg.target) && cfg.target.length >= 3) {
      camState.wantTargetX = +cfg.target[0] || 0;
      camState.wantTargetY = +cfg.target[1] || 0;
      camState.wantTargetZ = +cfg.target[2] || 0;
    } else if (cfg.target && typeof cfg.target === "object") {
      if (cfg.target.x !== undefined) camState.wantTargetX = cfg.target.x;
      if (cfg.target.y !== undefined) camState.wantTargetY = cfg.target.y;
      if (cfg.target.z !== undefined) camState.wantTargetZ = cfg.target.z;
    }
    if (cfg.targetX !== undefined) camState.wantTargetX = cfg.targetX;
    if (cfg.targetY !== undefined) camState.wantTargetY = cfg.targetY;
    if (cfg.targetZ !== undefined) camState.wantTargetZ = cfg.targetZ;
    if (snap) {
      camState.dist = camState.wantDist;
      camState.yaw = camState.wantYaw;
      camState.pitch = camState.wantPitch;
      camState.targetX = camState.wantTargetX;
      camState.targetY = camState.wantTargetY;
      camState.targetZ = camState.wantTargetZ;
    }
    updateSunDirection();
  }

  const M1_STAGE_CAMS = [
    { dist: 0.54, yaw: 0.14,  pitch: 0.25, targetX:  0.00, targetY: 1.12, targetZ: 0.27 }, // 0: Dorsal & Palmar Spread
    { dist: 0.48, yaw: 0.08,  pitch: 0.28, targetX:  0.00, targetY: 1.06, targetZ: 0.33 }, // 1: Cast-Iron Pump Bar
    { dist: 0.62, yaw: -0.44, pitch: 0.24, targetX:  0.00, targetY: 0.95, targetZ: 0.36 }, // 2: 20L Jerrycan Top Handle & Bottom Rib
    { dist: 0.44, yaw: 0.20,  pitch: 0.30, targetX:  0.00, targetY: 1.14, targetZ: 0.28 }, // 3: Cyan Smartphone Cradle
    { dist: 0.43, yaw: -0.32, pitch: 0.32, targetX: -0.01, targetY: 1.01, targetZ: 0.29 }  // 4: Tripod Pen Pinch & Card
  ];

  function applyMacroGripStage(stageIdx, snapCam = false) {
    if (!activeMacroHands) return;
    activeMacroHands.lockedGrip = stageIdx;
    followTargetFn = null;
    activeFocusKey = "default";
    const camIdx = stageIdx >= 0 ? clamp(stageIdx, 0, M1_STAGE_CAMS.length - 1) : 0;
    setCameraPreset(M1_STAGE_CAMS[camIdx], snapCam);
    renderModePills(STUDIES[activeStudyIdx]);
    renderFocusPills(STUDIES[activeStudyIdx]);
  }

  function setN1SoloActor(soloIdx) {
    if (!activeNeckLeanStage) return;
    activeNeckLeanStage.soloIdx = soloIdx;
    if (soloIdx >= 0) activeNeckLeanStage.inspectIdx = soloIdx;
    for (let i = 0; i < activeActors.length; i++) {
      const a = activeActors[i];
      a.ch.group.visible = soloIdx < 0 || i === soloIdx;
      if (soloIdx === i) {
        a.ch.place(0.0, 0.16, 0.0, flatGround);
      } else if (a.baseX !== undefined) {
        a.ch.place(a.baseX, a.baseZ, a.baseHeading, flatGround);
      }
    }
    if (activeNeckLeanStage.junePlinth) {
      activeNeckLeanStage.junePlinth.visible = soloIdx < 0 || soloIdx === 1;
      if (soloIdx === 1) activeNeckLeanStage.junePlinth.position.set(0.0, 0.18, 0.16);
      else activeNeckLeanStage.junePlinth.position.set(-0.75, 0.18, -0.02);
    }
  }

  function resolveNeckLeanModeDef(modeKey) {
    if (typeof modeKey === "number" && Number.isFinite(modeKey)) {
      return N1_FOCUS_MODES[clamp(Math.round(modeKey), 0, N1_FOCUS_MODES.length - 1)];
    }
    const low = String(modeKey || "cycle").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (low === "default" || low === "auto" || low === "cycle" || low === "cycle_leans" || low === "cycle_neck_leans") {
      return N1_FOCUS_MODES[0];
    }
    if (low === "lean_left" || low === "left" || low === "left_24" || low === "lean_left_24" || low === "scm_stretch") {
      return N1_FOCUS_MODES[1];
    }
    if (low === "lean_right" || low === "right" || low === "right_24" || low === "lean_right_24") {
      return N1_FOCUS_MODES[2];
    }
    if (low === "oblique" || low === "oblique_turn_lean" || low === "oblique_lean" || low === "turn_lean" || low === "34") {
      return N1_FOCUS_MODES[3];
    }
    if (low === "head_back" || low === "extension" || low === "throat" || low === "chin_throat" || low === "head_back_chin_throat" || low === "head_back_extension") {
      return N1_FOCUS_MODES[4];
    }
    if (low === "skin_blend" || low === "skin" || low === "skin_continuity" || low === "color_blend" || low === "face_neck_body_hand") {
      return N1_FOCUS_MODES[5];
    }
    if (low === "quartet" || low === "quartet_leaning" || low === "quartet_all_leaning" || low === "all" || low === "ensemble") {
      return N1_FOCUS_MODES[6];
    }
    if (low === "profile" || low === "profile_lean" || low === "90_profile" || low === "90_profile_lean") {
      return N1_FOCUS_MODES[7];
    }
    return N1_FOCUS_MODES.find(m => m.key === low || m.short.toLowerCase().includes(low)) || N1_FOCUS_MODES[0];
  }

  function syncN1CameraForMode(mDef, snapCam = false) {
    if (!activeNeckLeanStage || !mDef) return;
    applyEvenSkinLightMode(Boolean(mDef.evenLight));
    if (mDef.isQuartet) {
      setN1SoloActor(-1);
      followTargetFn = null;
      setCameraPreset({
        dist: mDef.dist || 2.34,
        yaw: mDef.yaw || 0.0,
        pitch: mDef.pitch || 0.025,
        targetX: 0.0,
        targetY: mDef.targetY || 1.45,
        targetZ: 0.02
      }, snapCam);
      return;
    }
    const idx = activeNeckLeanStage.inspectIdx >= 0 ? activeNeckLeanStage.inspectIdx : 0;
    setN1SoloActor(idx);
    const ch = activeActors[idx]?.ch;
    if (!ch) return;
    const hdg = ch.state.heading || 0;
    const charScale = ch.group.scale.x || 1.0;
    const isTurbanElder = idx === 3;
    const baseY = (mDef.targetY !== undefined ? mDef.targetY : 1.480) + (isTurbanElder ? 0.012 : 0.0);
    const xOff = mDef.isProfile ? 0.0 : (mDef.targetXOff !== undefined ? mDef.targetXOff : -0.035);
    followTargetFn = out => {
      out.set(
        ch.group.position.x + xOff * charScale,
        ch.group.position.y + baseY * charScale,
        ch.group.position.z
      );
      return out;
    };
    const p = followTargetFn(new T.Vector3());
    const yaw = mDef.isProfile ? (hdg - Math.PI * 0.5) : (hdg + (mDef.yaw || 0));
    const baseDist = (mDef.dist || 0.78) + (isTurbanElder ? 0.04 : 0.0);
    const effDist = baseDist * lerp(1.0, charScale, 0.78);
    setCameraPreset({
      dist: effDist,
      yaw,
      pitch: mDef.pitch !== undefined ? mDef.pitch : 0.015,
      targetX: p.x,
      targetY: p.y,
      targetZ: p.z
    }, snapCam);
  }

  function applyNeckLeanMode(modeKey, snapCam = false) {
    if (STUDIES[activeStudyIdx]?.id !== "neck_lean_skin") {
      loadStudy("neck_lean_skin");
    }
    if (!activeNeckLeanStage) return null;
    const mDef = resolveNeckLeanModeDef(modeKey);
    activeNeckLeanStage.mode = mDef.key;
    activeFocusKey = mDef.key;
    syncN1CameraForMode(mDef, snapCam);
    renderModePills(STUDIES[activeStudyIdx]);
    renderFocusPills(STUDIES[activeStudyIdx]);
    return {
      studyId: "neck_lean_skin",
      mode: mDef.key,
      inspectIdx: activeNeckLeanStage.inspectIdx,
      soloIdx: activeNeckLeanStage.soloIdx
    };
  }

  function setNeckLeanActor(actorIdxOrId, snapCam = false) {
    if (STUDIES[activeStudyIdx]?.id !== "neck_lean_skin") {
      loadStudy("neck_lean_skin");
    }
    if (!activeNeckLeanStage) return false;
    if (actorIdxOrId === -1 || String(actorIdxOrId).toLowerCase() === "quartet" || String(actorIdxOrId).toLowerCase() === "all") {
      return applyNeckLeanMode("quartet", snapCam);
    }
    let entryIdx = 0;
    if (typeof actorIdxOrId === "number") {
      entryIdx = clamp(Math.round(actorIdxOrId), 0, Math.max(0, activeActors.length - 1));
    } else {
      const low = String(actorIdxOrId || "").toLowerCase();
      const found = activeActors.findIndex(a =>
        a.ch.state.id.toLowerCase().includes(low) ||
        a.ch.state.name.toLowerCase().includes(low)
      );
      entryIdx = found >= 0 ? found : 0;
    }
    activeNeckLeanStage.inspectIdx = entryIdx;
    if (activeNeckLeanStage.mode === "quartet") {
      activeNeckLeanStage.mode = "cycle";
      activeFocusKey = "cycle";
    }
    const mDef = resolveNeckLeanModeDef(activeNeckLeanStage.mode);
    syncN1CameraForMode(mDef, snapCam);
    renderModePills(STUDIES[activeStudyIdx]);
    renderFocusPills(STUDIES[activeStudyIdx]);
    return entryIdx;
  }

  function setNeckLeanAngle(deg, opts = {}) {
    if (deg === null || deg === undefined || deg === "auto") {
      directorState.neckLeanDeg = 0;
    } else {
      directorState.neckLeanDeg = clamp(+deg || 0, -26, 26);
    }
    syncSliderReadouts();
    const ov = buildDirectorOverridePayload();
    renderDirectorBar();
    if (opts.immediate !== false) {
      const nowSec = performance.now() * 0.001;
      const leanRad = directorState.neckLeanDeg * DEG;
      for (const item of activeActors) {
        if (!item.ch) continue;
        if (item.ch.userData) item.ch.userData.emotionOverride = ov;
        if (typeof item.ch.setNeckLean === "function") {
          item.ch.setNeckLean(Math.abs(directorState.neckLeanDeg) > 0.25 ? { roll: leanRad, pitch: 0, yaw: 0, glideX: 0 } : null);
        }
      }
    }
    return directorState.neckLeanDeg;
  }

  function setE1SoloActor(soloIdx) {
    if (!activeEmotionsStage) return;
    activeEmotionsStage.soloIdx = soloIdx;
    if (soloIdx >= 0) activeEmotionsStage.inspectIdx = soloIdx;
    for (let i = 0; i < activeActors.length; i++) {
      const a = activeActors[i];
      a.ch.group.visible = soloIdx < 0 || i === soloIdx;
      if (soloIdx === i) {
        a.ch.place(0.0, 0.18, 0.0, flatGround);
      } else if (a.baseX !== undefined) {
        a.ch.place(a.baseX, a.baseZ, a.baseHeading, flatGround);
      }
    }
    if (activeEmotionsStage.junePlinth) {
      activeEmotionsStage.junePlinth.visible = soloIdx < 0 || soloIdx === 1;
      if (soloIdx === 1) activeEmotionsStage.junePlinth.position.set(0.0, 0.18, 0.18);
      else activeEmotionsStage.junePlinth.position.set(-0.64, 0.18, -0.02);
    }
  }

  function applyEmotionMode(modeKey, snapCam = false) {
    if (STUDIES[activeStudyIdx]?.id !== "exp_emotions_speech") {
      loadStudy("exp_emotions_speech");
    }
    if (!activeEmotionsStage) return;
    const found = E1_MODES.find(m => m.key === modeKey || m.emotion === modeKey);
    activeEmotionsStage.mode = found ? found.key : "auto_arc";
    if (activeEmotionsStage.mode !== "viseme_tour") {
      activeEmotionsStage.lockedViseme = null;
    } else {
      const idx = activeEmotionsStage.inspectIdx >= 0 ? activeEmotionsStage.inspectIdx : 0;
      const keepProf = activeFocusKey.includes("prof");
      const keep34 = activeFocusKey.includes("34");
      const vPart = keepProf ? "mouthProfile" : keep34 ? "mouth34" : "mouth";
      const vDist = keepProf ? 0.30 : keep34 ? 0.28 : 0.26;
      setE1SoloActor(idx);
      focusActor(idx, vPart, vDist, snapCam);
      if (!keepProf && !keep34) activeFocusKey = idx === 0 ? "imani_mouth" : `char_${idx}`;
    }
    renderVisemeHudChips();
    renderModePills(STUDIES[activeStudyIdx]);
    renderFocusPills(STUDIES[activeStudyIdx]);
  }

  function lockIndividualViseme(visemeId, snapCam = false) {
    // Guard N1 (neck_lean_skin): keep N1 active and preserve N1 framing when setViseme is called during N1 audits!
    if (STUDIES[activeStudyIdx]?.id === "neck_lean_skin" && activeNeckLeanStage) {
      activeNeckLeanStage.lockedViseme = (!visemeId || visemeId === "AUTO") ? null : String(visemeId).toUpperCase();
      return activeNeckLeanStage.lockedViseme;
    }
    if (STUDIES[activeStudyIdx]?.id !== "exp_emotions_speech") {
      loadStudy("exp_emotions_speech");
    }
    if (!activeEmotionsStage) return;
    activeEmotionsStage.mode = "viseme_tour";
    activeEmotionsStage.lockedViseme = (!visemeId || visemeId === "AUTO") ? null : String(visemeId).toUpperCase();
    const idx = activeEmotionsStage.inspectIdx >= 0 ? activeEmotionsStage.inspectIdx : 0;
    const keepProf = activeFocusKey.includes("prof");
    const keep34 = activeFocusKey.includes("34");
    const vPart = keepProf ? "mouthProfile" : keep34 ? "mouth34" : "mouth";
    const vDist = keepProf ? 0.30 : keep34 ? 0.28 : 0.25;
    setE1SoloActor(idx);
    focusActor(idx, vPart, vDist, snapCam);
    renderVisemeHudChips();
    renderModePills(STUDIES[activeStudyIdx]);
    renderFocusPills(STUDIES[activeStudyIdx]);
  }

  function applyHandGestureMode(idxOrId, snapCam = false) {
    if (STUDIES[activeStudyIdx]?.id !== "exp_hand_acting") {
      loadStudy("exp_hand_acting");
    }
    if (!activeHandActingStage) return;
    let targetIdx = -1;
    if (typeof idxOrId === "number") {
      targetIdx = idxOrId < 0 ? -1 : clamp(Math.round(idxOrId), 0, E2_GESTURES.length - 1);
    } else if (idxOrId && String(idxOrId).toLowerCase() !== "cycle" && String(idxOrId) !== "-1") {
      const low = String(idxOrId).toLowerCase();
      const g = E2_GESTURES.find(x => x.id.toLowerCase() === low || x.short.toLowerCase().includes(low));
      if (g) targetIdx = g.idx;
    }
    activeHandActingStage.lockedGesture = targetIdx;
    activeHandActingStage.lastAutoIdx = -99;
    activeHandActingStage.snapNextCam = Boolean(snapCam);
    renderModePills(STUDIES[activeStudyIdx]);
    renderFocusPills(STUDIES[activeStudyIdx]);
  }

  function focusActor(actorIdxOrId = 0, part = "head", customDist, snap = false) {
    let entryIdx = 0;
    if (typeof actorIdxOrId === "number") {
      entryIdx = clamp(actorIdxOrId, 0, Math.max(0, activeActors.length - 1));
    } else {
      const foundIdx = activeActors.findIndex(a =>
        a.ch.state.id === actorIdxOrId ||
        a.ch.state.name.toLowerCase().includes(String(actorIdxOrId).toLowerCase())
      );
      entryIdx = foundIdx >= 0 ? foundIdx : 0;
    }
    const entry = activeActors[entryIdx];
    if (!entry) return false;
    const st = STUDIES[activeStudyIdx];
    const ch = entry.ch;
    const id = ch.state.id;

    // Unhide focused actor (and solo on E1/M2 profile or macro <= 0.46m so neighbors never photobomb!)
    const isScionLens = part === "eyeMacro" || part === "eyes" || part === "eye" || part === "eyeLid"
      || part === "neckCollar" || part === "neck" || part === "collar" || part === "neck34" || part === "neckLeanFrame";
    if (activeNeckLeanStage) {
      activeNeckLeanStage.inspectIdx = entryIdx;
      setN1SoloActor(entryIdx);
    } else if (activeEmotionsStage) {
      activeEmotionsStage.inspectIdx = entryIdx;
      const shouldSolo = isScionLens || part === "profile" || part === "mouthProfile" || (customDist !== undefined && customDist <= 0.68) || activeEmotionsStage.soloIdx >= 0;
      if (shouldSolo) setE1SoloActor(entryIdx);
    } else if (activeMacroPortraits && (isScionLens || part === "profile" || activeMacroPortraits.selectedIdx >= 0)) {
      activeMacroPortraits.selectedIdx = entryIdx;
      activeMacroPortraits.freezeTurn = true;
      for (let i = 0; i < activeActors.length; i++) {
        activeActors[i].ch.group.visible = i === entryIdx;
      }
      ch.state.heading = 0;
      if (activeMacroPortraits.junePlinth) activeMacroPortraits.junePlinth.visible = entryIdx === 1;
    } else {
      ch.group.visible = true;
    }

    const hdg = ch.state.heading || 0;
    let effectivePart = part;
    let dist = customDist !== undefined
      ? customDist
      : (part === "eyeMacro" || part === "eyes" || part === "eye" || part === "eyeLid" ? 0.18
        : part === "mouth" || part === "lips" || part === "mouth34" || part === "mouthProfile" ? 0.25
        : part === "handL" || part === "handR" ? 0.32
        : part === "hands" ? 0.40
        : part === "neckCollar" || part === "neck" || part === "collar" || part === "neck34" ? 0.68
        : part === "head" || part === "profile" || part === "threeQuarter" ? 0.44
        : part === "upperBody" ? 0.65 : 2.1);

    let yaw = (part === "profile" || part === "mouthProfile") ? (hdg - Math.PI * 0.5)
      : (part === "threeQuarter" || part === "mouth34" || part === "neck34") ? (hdg + 0.52)
      : (part === "neckCollar" || part === "neck" || part === "collar") ? hdg
      : (part === "eyeMacro" || part === "eyes" || part === "eye" || part === "eyeLid") ? (hdg + 0.03)
      : (part === "mouth" || part === "lips") ? (hdg + 0.06)
      : (part === "head") ? (hdg + 0.10) : (hdg + 0.20);
    let pitch = (part === "handL" || part === "handR" || part === "hands") ? 0.24
      : (part === "eyeMacro" || part === "eyes" || part === "eye" || part === "eyeLid") ? 0.01
      : (part === "neckCollar" || part === "neck" || part === "collar") ? 0.02
      : (part === "mouth" || part === "lips" || part === "mouth34" || part === "mouthProfile") ? 0.02 : 0.04;
    let customFollow = null;

    if (st.id === "exp_hand_acting" && activeHandActingStage && entryIdx === 0) {
      const ha = activeHandActingStage;
      if (activeActors[1]) activeActors[1].ch.group.visible = false;
      if (part === "upperBody" || part === "hands") {
        ha.lensMode = part === "upperBody" ? "upper" : "hands";
        ha.lastAutoIdx = -99;
        ha.snapNextCam = Boolean(snap);
        followTargetFn = null;
        return true;
      }
      if (part === "handL" || part === "handR") {
        ha.lensMode = part;
        ha.lastAutoIdx = -99;
        ha.snapNextCam = Boolean(snap);
        followTargetFn = null;
        return true;
      }
    }

    if (st.id === "hill_desk") {
      const isHanna = id === "op_f";
      if (part === "hands") {
        effectivePart = "handR";
        dist = customDist !== undefined ? customDist : (isHanna ? 0.38 : 0.36);
      }
      if (effectivePart === "handR") {
        yaw = isHanna ? 1.98 : -2.18;
        pitch = isHanna ? 0.16 : 0.36;
      } else if (effectivePart === "handL") {
        yaw = isHanna ? 2.38 : -2.36;
        pitch = 0.38;
      } else if (effectivePart === "profile") {
        yaw = isHanna ? 1.65 : -1.65;
        pitch = 0.05;
      } else if (effectivePart === "head" || effectivePart === "mouth") {
        yaw = isHanna ? 2.66 : -2.66;
        pitch = 0.05;
      }
    } else if (st.id === "pump_leverage") {
      if (part === "hands" || part === "handL" || part === "handR") {
        yaw = -0.58;
        pitch = 0.24;
        dist = customDist !== undefined ? Math.max(0.44, customDist) : 0.48;
        if (part === "hands" && activeStudyPump) {
          customFollow = out => out.copy(studyPumpGrips.pumpGripWorld);
        }
      } else if (part === "profile") {
        yaw = 0.0;
        pitch = 0.05;
      } else if (part === "head" || part === "mouth") {
        yaw = -0.82;
        pitch = 0.05;
      }
    } else if (st.id === "father_child_20kg") {
      if (part === "hands" || part === "handL" || part === "handR") {
        // Unobstructed front-side (+Z) angle perpendicular to Elder->June handoff axis so all 4 hands + 20L jerrycan sit dead-center!
        yaw = -0.70;
        pitch = 0.14;
        dist = Math.max(0.82, customDist || 0.82);
        if (part === "hands" && activeSharedHandoff) {
          customFollow = out => {
            out.copy(activeSharedHandoff.canRoot.position);
            out.y += 0.01;
            return out;
          };
        }
      } else if (part === "profile") {
        yaw = 1.52;
        pitch = 0.05;
      } else if ((part === "head" || part === "mouth") && id === "june_kf15") {
        yaw = -1.92;
        pitch = 0.06;
      }
    } else if (st.id === "t7_basin_pour") {
      if (part === "hands" || part === "handL" || part === "handR") {
        yaw = 0.56;
        pitch = 0.22;
        dist = customDist !== undefined ? customDist : 0.54;
      }
    }

    followTargetFn = customFollow || (out => getActorPartWorldPos(ch, effectivePart, out));
    const p = followTargetFn(new T.Vector3());
    setCameraPreset({ dist, yaw, pitch, targetX: p.x, targetY: p.y, targetZ: p.z }, snap);
    return true;
  }

  /* ---------- Render HUD Viseme Chips, Mode Pills, Focus Pills & Live Director Bar ---------- */
  function renderVisemeHudChips() {
    const box = $("hud-visemes");
    if (!box) return;
    const show = Boolean(activeEmotionsStage && activeEmotionsStage.mode === "viseme_tour");
    box.hidden = !show;
    if (!show) return;
    const locked = activeEmotionsStage.lockedViseme;
    const items = [{ id: "AUTO", short: "↻ AUTO" }].concat(VISEME_LIST.map(v => ({ id: v.id, short: v.id })));
    box.innerHTML = items.map(it => {
      const isAct = it.id === "AUTO" ? !locked : locked === it.id;
      return `<button type="button" class="v-chip${isAct ? " active" : ""}" data-viseme="${it.id}">${it.short}</button>`;
    }).join("");
    box.querySelectorAll("[data-viseme]").forEach(btn => {
      btn.addEventListener("click", () => lockIndividualViseme(btn.dataset.viseme, false));
    });
  }

  function renderDirectorBar() {
    const row = $("director-row");
    const slidersRow = $("director-sliders");
    if (!row) return;
    row.innerHTML = `<span class="row-tag">Live Reaction:</span>`;
    for (const p of DIRECTOR_PRESETS) {
      const b = document.createElement("button");
      b.type = "button";
      const isAct = directorState.preset === p.key;
      b.className = "pill pill-dir" + (isAct ? " active" : "");
      b.setAttribute("aria-pressed", String(isAct));
      b.textContent = p.label;
      b.addEventListener("click", () => {
        directorState.preset = p.key;
        buildDirectorOverridePayload();
        renderDirectorBar();
      });
      row.appendChild(b);
    }
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "pill pill-dir" + (directorState.slidersOpen || hasDirectorSlidersActive() ? " active" : "");
    toggleBtn.setAttribute("aria-pressed", String(directorState.slidersOpen));
    toggleBtn.textContent = directorState.slidersOpen ? "FACS Sliders ▾" : "FACS Sliders ▸";
    toggleBtn.addEventListener("click", () => {
      directorState.slidersOpen = !directorState.slidersOpen;
      if (slidersRow) slidersRow.hidden = !directorState.slidersOpen;
      renderDirectorBar();
    });
    row.appendChild(toggleBtn);
    if (slidersRow) slidersRow.hidden = !directorState.slidersOpen;
  }

  function syncSliderReadouts() {
    if ($("sl-neck-lean")) {
      const deg = Math.round(directorState.neckLeanDeg);
      $("sl-neck-lean").value = String(deg);
      $("val-neck-lean").textContent = `${deg > 0 ? "+" : ""}${deg}°`;
    }
    $("sl-jaw").value = String(Math.round(directorState.jawSpeech * 100));
    $("val-jaw").textContent = `${Math.round(directorState.jawSpeech * 100)}%`;
    $("sl-smile").value = String(Math.round(directorState.smileSad * 100));
    $("val-smile").textContent = (directorState.smileSad > 0 ? "+" : "") + Math.round(directorState.smileSad * 100);
    $("sl-brows").value = String(Math.round(directorState.brows * 100));
    $("val-brows").textContent = (directorState.brows > 0 ? "+" : "") + Math.round(directorState.brows * 100);
    $("sl-hands").value = String(Math.round(directorState.handSplayCurl * 100));
    $("val-hands").textContent = (directorState.handSplayCurl > 0 ? "+" : "") + Math.round(directorState.handSplayCurl * 100);
  }

  function bindDirectorSliders() {
    const onInput = () => {
      if ($("sl-neck-lean")) directorState.neckLeanDeg = clamp(+$("sl-neck-lean").value, -26, 26);
      directorState.jawSpeech = +$("sl-jaw").value / 100;
      directorState.smileSad = +$("sl-smile").value / 100;
      directorState.brows = +$("sl-brows").value / 100;
      directorState.handSplayCurl = +$("sl-hands").value / 100;
      syncSliderReadouts();
      buildDirectorOverridePayload();
      renderDirectorBar();
    };
    ["sl-neck-lean", "sl-jaw", "sl-smile", "sl-brows", "sl-hands"].forEach(id => {
      $(id)?.addEventListener("input", onInput);
    });
    $("btn-sl-reset")?.addEventListener("click", () => {
      directorState.preset = "auto";
      directorState.neckLeanDeg = 0;
      directorState.jawSpeech = 0;
      directorState.smileSad = 0;
      directorState.brows = 0;
      directorState.handSplayCurl = 0;
      syncSliderReadouts();
      buildDirectorOverridePayload();
      renderDirectorBar();
    });
  }

  function renderModePills(st) {
    const row = $("mode-pills");
    if (!row) return;
    row.innerHTML = "";
    if (st.id === "neck_lean_skin" && activeNeckLeanStage) {
      const nl = activeNeckLeanStage;
      const castItems = [
        [0, "Imani · Bare-Arm Hero"],
        [2, "Hanna · Olive-Tan"],
        [1, "June · 68 Locs"],
        [3, "Elder · Beard"],
        [-1, "Quartet (4)"]
      ];
      const tag = document.createElement("span");
      tag.className = "row-tag";
      tag.textContent = "Subject:";
      row.appendChild(tag);
      for (const [cIdx, lbl] of castItems) {
        const b = document.createElement("button");
        b.type = "button";
        const isAct = cIdx < 0 ? (nl.soloIdx < 0) : (nl.soloIdx >= 0 && nl.inspectIdx === cIdx);
        b.className = "pill pill-focus" + (isAct ? " active" : "");
        b.setAttribute("aria-pressed", String(isAct));
        b.textContent = lbl;
        b.addEventListener("click", () => setNeckLeanActor(cIdx, false));
        row.appendChild(b);
      }
      const sep = document.createElement("span");
      sep.className = "pill-sep";
      row.appendChild(sep);
      const eyeBtn = document.createElement("button");
      eyeBtn.type = "button";
      eyeBtn.className = "pill pill-focus";
      eyeBtn.textContent = "Eye 0.18m Macro";
      eyeBtn.addEventListener("click", () => {
        const idx = nl.inspectIdx >= 0 ? nl.inspectIdx : 0;
        setN1SoloActor(idx);
        applyEvenSkinLightMode(false);
        focusActor(idx, "eyeMacro", 0.18, false);
      });
      row.appendChild(eyeBtn);
    } else if (st.id === "exp_emotions_speech" && activeEmotionsStage) {
      for (const m of E1_MODES) {
        const b = document.createElement("button");
        b.type = "button";
        const isAct = activeEmotionsStage.mode === m.key;
        b.className = "pill pill-focus" + (isAct ? " active" : "");
        b.setAttribute("aria-pressed", String(isAct));
        b.textContent = m.short;
        b.addEventListener("click", () => applyEmotionMode(m.key, false));
        row.appendChild(b);
      }
    } else if (st.id === "exp_hand_acting" && activeHandActingStage) {
      const cycleBtn = document.createElement("button");
      cycleBtn.type = "button";
      const isCyc = activeHandActingStage.lockedGesture < 0;
      cycleBtn.className = "pill pill-focus" + (isCyc ? " active" : "");
      cycleBtn.setAttribute("aria-pressed", String(isCyc));
      cycleBtn.textContent = "↻ Cycle 12 Gestures";
      cycleBtn.addEventListener("click", () => applyHandGestureMode(-1, false));
      row.appendChild(cycleBtn);

      for (const g of E2_GESTURES) {
        const b = document.createElement("button");
        b.type = "button";
        const isAct = activeHandActingStage.lockedGesture === g.idx;
        b.className = "pill pill-focus" + (isAct ? " active" : "");
        b.setAttribute("aria-pressed", String(isAct));
        b.textContent = g.short;
        b.addEventListener("click", () => applyHandGestureMode(g.idx, false));
        row.appendChild(b);
      }
    } else if (st.id === "macro_hands" && activeMacroHands) {
      const mh = activeMacroHands;
      const stages = [
        [-1, "⟳ Cycle 5 Grips"],
        [0, "1 · Dorsal & Palmar"],
        [1, "2 · Iron Pump Bar"],
        [2, "3 · 20L Handle"],
        [3, "4 · Cyan Phone"],
        [4, "5 · Tripod Pinch"]
      ];
      for (const [sIdx, lbl] of stages) {
        const b = document.createElement("button");
        b.type = "button";
        const isSel = mh.lockedGrip === sIdx && activeFocusKey === "default";
        b.className = "pill pill-focus" + (isSel ? " active" : "");
        b.setAttribute("aria-pressed", String(isSel));
        b.textContent = lbl;
        b.addEventListener("click", () => applyMacroGripStage(sIdx, false));
        row.appendChild(b);
      }
    }
  }

  function renderFocusPills(st) {
    const row = $("focus-pills");
    if (!row) return;
    row.innerHTML = "";
    const addChip = (key, label, onClick) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pill pill-focus" + (activeFocusKey === key ? " active" : "");
      b.setAttribute("aria-pressed", String(activeFocusKey === key));
      b.dataset.focusKey = key;
      b.textContent = label;
      b.addEventListener("click", () => {
        activeFocusKey = key;
        onClick();
        renderFocusPills(st);
      });
      row.appendChild(b);
    };

    if (st.id === "neck_lean_skin" && activeNeckLeanStage) {
      for (const m of N1_FOCUS_MODES) {
        const b = document.createElement("button");
        b.type = "button";
        const isAct = activeNeckLeanStage.mode === m.key;
        b.className = "pill pill-focus" + (isAct ? " active" : "");
        b.setAttribute("aria-pressed", String(isAct));
        b.dataset.focusKey = m.key;
        b.textContent = m.short;
        b.addEventListener("click", () => applyNeckLeanMode(m.key, false));
        row.appendChild(b);
      }
    } else if (st.id === "exp_emotions_speech" && activeEmotionsStage) {
      addChip("default", "Imani Hero · 0.50m", () => {
        setE1SoloActor(0);
        followTargetFn = null;
        setCameraPreset({ dist: st.cam.dist, yaw: st.cam.yaw, pitch: st.cam.pitch, targetX: st.cam.targetX, targetY: st.cam.targetY, targetZ: st.cam.targetZ });
      });
      addChip("scion_eye_018", "Eye & Lid 0.18m Macro", () => {
        const idx = activeEmotionsStage.inspectIdx >= 0 ? activeEmotionsStage.inspectIdx : 0;
        setE1SoloActor(idx);
        focusActor(idx, "eyeMacro", 0.18);
      });
      addChip("scion_neck_042", "Neck & Collar 0.58m", () => {
        const idx = activeEmotionsStage.inspectIdx >= 0 ? activeEmotionsStage.inspectIdx : 0;
        setE1SoloActor(idx);
        focusActor(idx, "neckCollar", 0.68);
      });
      addChip("imani_mouth", "Imani · 0.24m Mouth & Eyes", () => {
        setE1SoloActor(0);
        focusActor(0, "mouth", 0.24);
      });
      addChip("imani_34", "Imani · 3/4 Macro", () => {
        setE1SoloActor(0);
        focusActor(0, "mouth34", 0.30);
      });
      addChip("imani_prof", "Imani · 90° Profile", () => {
        setE1SoloActor(0);
        focusActor(0, "mouthProfile", 0.32);
      });
      addChip("quartet", "Quartet (4)", () => {
        setE1SoloActor(-1);
        followTargetFn = null;
        setCameraPreset({ dist: 2.34, yaw: 0.01, pitch: 0.04, targetX: 0.01, targetY: 1.45, targetZ: 0.02 });
      });
      addChip("char_1", "June · 0.26m Locs", () => {
        setE1SoloActor(1);
        focusActor(1, "mouth", 0.26);
      });
      addChip("char_2", "Hanna · 0.26m Macro", () => {
        setE1SoloActor(2);
        focusActor(2, "mouth", 0.26);
      });
      addChip("char_3", "Elder · 0.28m Beard", () => {
        setE1SoloActor(3);
        focusActor(3, "mouth", 0.28);
      });
      addChip("active_prof", "Active · 90° Profile", () => {
        const idx = activeEmotionsStage.inspectIdx >= 0 ? activeEmotionsStage.inspectIdx : 0;
        setE1SoloActor(idx);
        focusActor(idx, "mouthProfile", 0.32);
      });
    } else if (st.id === "exp_hand_acting" && activeHandActingStage) {
      const ha = activeHandActingStage;
      const setSoloHandHero = solo => {
        if (activeActors[1]) activeActors[1].ch.group.visible = !solo;
      };
      addChip("default", "Auto Gesture Lens", () => {
        ha.lensMode = "auto";
        setSoloHandHero(true);
        followTargetFn = null;
        ha.lastAutoIdx = -99;
      });
      addChip("both_036", "Both Hands", () => {
        ha.lensMode = "hands";
        setSoloHandHero(true);
        followTargetFn = null;
        ha.lastAutoIdx = -99;
      });
      addChip("dorsal_028", "Left Hand 0.30m", () => {
        ha.lensMode = "handL";
        setSoloHandHero(true);
        followTargetFn = null;
        ha.lastAutoIdx = -99;
      });
      addChip("palmar_028", "Right Hand 0.30m", () => {
        ha.lensMode = "handR";
        setSoloHandHero(true);
        followTargetFn = null;
        ha.lastAutoIdx = -99;
      });
      addChip("upper_065", "Upper-Body + Face", () => {
        ha.lensMode = "upper";
        setSoloHandHero(true);
        followTargetFn = null;
        ha.lastAutoIdx = -99;
      });
      addChip("duo_118", "Ensemble Duo 1.28m", () => {
        ha.lensMode = "duo";
        setSoloHandHero(false);
        followTargetFn = null;
        setCameraPreset({ dist: 1.38, yaw: 0.10, pitch: 0.08, targetX: 0.24, targetY: 1.34, targetZ: -0.06 });
      });
    } else if (st.id === "macro_hands" && activeMacroHands) {
      addChip("default", "Stage Lens", () => applyMacroGripStage(activeMacroHands.lockedGrip, false));
      addChip("dorsal_032", "Zoom Dorsal 0.32m", () => focusActor(0, "handL", 0.32));
      addChip("palmar_032", "Zoom Palmar 0.32m", () => focusActor(0, "handR", 0.32));
    } else if (st.id === "macro_portraits" && activeMacroPortraits) {
      const mp = activeMacroPortraits;
      const setSoloPortrait = soloIdx => {
        mp.selectedIdx = soloIdx;
        mp.freezeTurn = soloIdx >= 0;
        for (let i = 0; i < activeActors.length; i++) {
          activeActors[i].ch.group.visible = soloIdx < 0 || i === soloIdx;
          if (soloIdx === i) activeActors[i].ch.state.heading = 0;
          else activeActors[i].ch.state.heading = activeActors[i].baseHeading;
        }
        if (mp.junePlinth) mp.junePlinth.visible = soloIdx < 0 || soloIdx === 1;
      };
      addChip("default", "Ensemble (4)", () => {
        setSoloPortrait(-1);
        followTargetFn = null;
        setCameraPreset({ dist: st.cam.dist, yaw: st.cam.yaw, pitch: st.cam.pitch, targetX: st.cam.targetX || 0, targetY: st.cam.targetY, targetZ: st.cam.targetZ || 0 });
      });
      addChip("m2_eye_018", "Eye & Lid 0.18m Macro", () => {
        const idx = mp.selectedIdx >= 0 ? mp.selectedIdx : 0;
        setSoloPortrait(idx);
        focusActor(idx, "eyeMacro", 0.18);
      });
      addChip("m2_neck_042", "Neck & Collar 0.58m", () => {
        const idx = mp.selectedIdx >= 0 ? mp.selectedIdx : 0;
        setSoloPortrait(idx);
        focusActor(idx, "neckCollar", 0.68);
      });
      addChip("imani_f", "Imani · 4C Coils", () => { setSoloPortrait(0); focusActor(0, "head", 0.43); });
      addChip("imani_p", "Imani · 90° Profile", () => { setSoloPortrait(0); focusActor(0, "profile", 0.44); });
      addChip("june_f", "June · 68 Locs", () => { setSoloPortrait(1); focusActor(1, "head", 0.40); });
      addChip("hanna_f", "Hanna · Hair Cards", () => { setSoloPortrait(2); focusActor(2, "head", 0.43); });
      addChip("hanna_p", "Hanna · Ponytail Side", () => { setSoloPortrait(2); focusActor(2, "profile", 0.46); });
      addChip("elder_f", "Elder · Beard Shells", () => { setSoloPortrait(3); focusActor(3, "head", 0.45); });
    } else if (st.id === "macro_skeleton") {
      addChip("default", "Full 56-Bone Duo", () => {
        followTargetFn = null;
        setCameraPreset({ dist: st.cam.dist, yaw: st.cam.yaw, pitch: st.cam.pitch, targetX: 0, targetY: st.cam.targetY, targetZ: 0 });
      });
      addChip("esk_clav", "Eskista Spine & Clavicle", () => focusActor(0, "head", 0.85));
      addChip("lift_elbow", "20kg Twist & Elbow Vol", () => focusActor(1, "hands", 0.72));
      addChip("phalanges", "30 Phalanges Close-Up", () => focusActor(0, "hands", 0.40));
    } else if (st.id === "hill_desk") {
      addChip("default", "Full Desk", () => {
        followTargetFn = null;
        setCameraPreset({ dist: st.cam.dist, yaw: st.cam.yaw, pitch: st.cam.pitch, targetX: 0, targetY: st.cam.targetY, targetZ: 0 });
      });
      addChip("daniel_pen", "Daniel Pen 0.36m", () => focusActor(0, "handR", 0.36));
      addChip("hanna_radio", "Hanna Radio 0.38m", () => focusActor(1, "handR", 0.38));
      addChip("hanna_face", "Hanna Speech 0.34m", () => focusActor(1, "mouth", 0.34));
      addChip("hanna_prof", "Hanna Ponytail 0.46m", () => focusActor(1, "profile", 0.46));
      addChip("daniel_face", "Daniel Face 0.40m", () => focusActor(0, "head", 0.40));
    } else if (activeActors.length > 0 && !st.id.startsWith("arch_")) {
      addChip("default", "Full Scene", () => {
        followTargetFn = null;
        setCameraPreset({ dist: st.cam.dist, yaw: st.cam.yaw, pitch: st.cam.pitch, targetX: st.cam.targetX || 0, targetY: st.cam.targetY, targetZ: st.cam.targetZ || 0 });
      });
      addChip("face_0", "Macro Face 0.38m", () => focusActor(0, "mouth", 0.38));
      addChip("prof_0", "90° Profile 0.42m", () => focusActor(0, "profile", 0.42));
      addChip("hands_0", st.id === "father_child_20kg" ? "4-Hand Grip 0.68m" : "Macro Hands 0.44m", () => focusActor(0, "hands", st.id === "father_child_20kg" ? 0.68 : 0.44));
      if (activeActors.length > 1) {
        const nm2 = activeActors[1].ch.state.name.split(" ")[0];
        addChip("face_1", `${nm2} Face 0.38m`, () => focusActor(1, "mouth", 0.38));
        addChip("hands_1", `${nm2} Hands 0.42m`, () => focusActor(1, "hands", 0.42));
      }
    }
  }

  function resolveStudyIndex(idxOrId) {
    if (typeof idxOrId === "number" && Number.isFinite(idxOrId)) {
      return clamp(Math.round(idxOrId), 0, STUDIES.length - 1);
    }
    const raw = String(idxOrId || "").trim();
    if (/^\d+$/.test(raw)) return clamp(+raw, 0, STUDIES.length - 1);
    const low = raw.toLowerCase();
    if (low === "n1" || low === "neck" || low === "lean" || low === "neck_lean" || low === "skin" || low === "neck_lean_skin") {
      return STUDIES.findIndex(s => s.id === "neck_lean_skin");
    }
    if (low === "e1" || low === "emotions" || low === "speech" || low === "visemes" || low === "exp_emotions_speech") {
      return STUDIES.findIndex(s => s.id === "exp_emotions_speech");
    }
    if (low === "e2" || low === "gestures" || low === "hand_acting" || low === "exp_hand_acting") {
      return STUDIES.findIndex(s => s.id === "exp_hand_acting");
    }
    if (low === "m1" || low === "macro a" || low === "macro_a" || low === "hands") return STUDIES.findIndex(s => s.id === "macro_hands");
    if (low === "m2" || low === "macro b" || low === "macro_b" || low === "portraits" || low === "faces") return STUDIES.findIndex(s => s.id === "macro_portraits");
    if (low === "m3" || low === "macro c" || low === "macro_c" || low === "skeleton") return STUDIES.findIndex(s => s.id === "macro_skeleton");
    const found = STUDIES.findIndex(s => s.id.toLowerCase() === low || s.short.toLowerCase().includes(low));
    return found >= 0 ? found : STUDIES.findIndex(s => s.id === "neck_lean_skin");
  }

  function loadStudy(idxOrId) {
    activeStudyIdx = resolveStudyIndex(idxOrId);
    const st = STUDIES[activeStudyIdx];
    clearStage();
    setPaperMode(st.night);

    applySkeletonStateToActors(Boolean(st.autoSkeleton || userSkeletonPinned));

    if (camera.fov !== 34) {
      camera.fov = 34;
      camera.updateProjectionMatrix();
    }
    camState.dist = camState.wantDist = st.cam.dist;
    camState.yaw = camState.wantYaw = st.cam.yaw;
    camState.pitch = camState.wantPitch = st.cam.pitch;
    camState.targetX = camState.wantTargetX = st.cam.targetX || 0;
    camState.targetY = camState.wantTargetY = st.cam.targetY;
    camState.targetZ = camState.wantTargetZ = st.cam.targetZ || 0;
    updateSunDirection();
    syncTightShadowFrustum(st);

    const isLargeArch = st.id.startsWith("arch_") && st.id !== "arch_props";
    plinthRing.scale.setScalar(isLargeArch ? 3.2 : (st.isMacro ? 0.92 : 1.15));

    if (st.id === "neck_lean_skin") {
      // N1: Flagship 85mm Leaning Neck, Oval V-Jawline & Face-Neck-Chest-Shoulder-Arm-Hand Skin Continuity Stage!
      const plinthMat = new T.MeshStandardMaterial({ color: 0x383733, roughness: 0.88, metalness: 0.05 });
      const junePlinth = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 0.36, 32), plinthMat);
      junePlinth.position.set(-0.75, 0.18, -0.02);
      junePlinth.castShadow = true; junePlinth.receiveShadow = true;
      stageRoot.add(junePlinth);

      // 0: Imani (Center Hero in openCollarBareArms scoop-neck tank so Face, V-Jaw, Leaning Neck, Clavicles, Sternum, Bare Shoulders, Forearms & Hands are 100% visible!)
      const imani = spawnActor({
        id: "imani_lean", name: "Imani · Bare-Arm Hero", x: -0.25, z: 0.05, heading: 0.04,
        skinHex: 0x3b261b, fem: 0.86, hair: "croppedCoily", outer: "none",
        openCollarBareArms: true, neckStudyTank: true, rolledSleeves: true,
        shirtHex: 0x4d544f, trouserHex: 0x2a2e30, pose: "idle"
      });
      // 1: June (68 Twisted Locs & Baby Hairs on basalt plinth, bare-arm open tunic)
      const june = spawnActor({
        id: "june_lean", name: "June · 68 Locs", x: -0.75, z: -0.02, yOffset: 0.36, heading: 0.12,
        scale: 0.76, build: 0.96, fem: 0.56, skinHex: 0x3f291e,
        hair: "shortLocs", outer: "none", openCollarBareArms: true, neckStudyTank: true, rolledSleeves: true,
        shirtHex: 0x9b8f7a, trouserHex: 0x343635, tibebTrim: true, pose: "idle"
      });
      // 2: Hanna (Feathered Anisotropic Ponytail, warm olive-tan skin continuity)
      const hanna = spawnActor({
        id: "hanna_lean", name: "Hanna · Ponytail", x: 0.25, z: 0.05, heading: -0.04,
        scale: 0.97, fem: 0.82, skinHex: 0xa27e68,
        hair: "ponytail", hairHex: 0x3b2a1e, outer: "none",
        openCollarBareArms: true, neckStudyTank: true, rolledSleeves: true,
        shirtHex: 0x223040, trouserHex: 0x282c30, pose: "idle"
      });
      // 3: Bearded Highland Elder (8-Shell Curly Beard & Coiled Turban, open-collar bare-arm tunic so chest/clavicle/forearm/hand skin is 100% visible!)
      const elder = spawnActor({
        id: "elder_lean", name: "Elder · Beard", x: 0.77, z: -0.02, heading: -0.12,
        scale: 1.02, build: 1.05, fem: 0.10, skinHex: 0x3f291d,
        hair: "turban", wrapHex: 0x625a4c, beard: true, hairHex: 0x1a1715,
        outer: "none", openCollarBareArms: true, neckStudyTank: true, rolledSleeves: true,
        shirtHex: 0x5c5042, trouserHex: 0x2b2d2e, pose: "idle"
      });

      [imani, june, hanna, elder].forEach(c => {
        if (c.label && c.label.sprite) c.label.sprite.visible = false;
      });

      activeNeckLeanStage = {
        mode: "cycle",
        soloIdx: 0,
        inspectIdx: 0,
        lockedViseme: null,
        junePlinth
      };
      activeFocusKey = "cycle";
      setN1SoloActor(0);
      syncN1CameraForMode(N1_FOCUS_MODES[0], true);
    } else if (st.id === "exp_emotions_speech") {
      // E1: Flagship 85mm Emotions, Open-Mouth Speech Visemes (Teeth + Tongue) & Quartet Reactions Stage
      const plinthMat = new T.MeshStandardMaterial({ color: 0x383733, roughness: 0.88, metalness: 0.05 });
      // Balanced symmetric quartet spacing [-0.64, -0.21, +0.22, +0.66]; soloed hero centers at (0, 0.18) via setE1SoloActor!
      const junePlinth = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 0.36, 32), plinthMat);
      junePlinth.position.set(-0.64, 0.18, -0.02);
      junePlinth.castShadow = true; junePlinth.receiveShadow = true;
      stageRoot.add(junePlinth);

      // 0: Imani (Center Hero)
      const imani = spawnActor({
        id: "imani_exp", name: "Imani · 4C Hero", x: -0.21, z: 0.06, heading: 0.05,
        skinHex: 0x3b261b, hair: "croppedCoily", outer: "duster", coatHex: 0x3b403c,
        shirtHex: 0x5c605a, trouserHex: 0x2c3032, rolledSleeves: true, pose: "idle"
      });
      // 1: June (68 Twisted Locs & Baby Hairs, eye-level on basalt plinth)
      const june = spawnActor({
        id: "june_exp", name: "June · 68 Locs", x: -0.64, z: -0.02, yOffset: 0.36, heading: 0.15,
        scale: 0.76, build: 0.96, fem: 0.55, skinHex: 0x3f291e,
        hair: "shortLocs", outer: "none", shirtHex: 0xb2a48c, trouserHex: 0x343635,
        tibebTrim: true, pose: "idle"
      });
      // 2: Hanna (Feathered Anisotropic Strand-Card Ponytail)
      const hanna = spawnActor({
        id: "hanna_exp", name: "Hanna · Ponytail", x: 0.22, z: 0.06, heading: -0.05,
        scale: 0.97, fem: 0.80, skinHex: 0xa27e68,
        hair: "ponytail", hairHex: 0x3b2a1e, outer: "none", shirtHex: 0x1b2634,
        rolledSleeves: true, pose: "idle"
      });
      // 3: Bearded Highland Elder (8-Shell Curly Beard & Coiled Turban)
      const elder = spawnActor({
        id: "elder_exp", name: "Elder · Beard", x: 0.66, z: -0.02, heading: -0.15,
        scale: 1.02, build: 1.05, fem: 0.10, skinHex: 0x3f291d,
        hair: "turban", wrapHex: 0x625a4c, beard: true, hairHex: 0x1a1715,
        outer: "shamma", coatHex: 0xb6ae9e, shirtHex: 0x5c5042, pose: "idle"
      });

      [imani, june, hanna, elder].forEach(c => {
        if (c.label && c.label.sprite) c.label.sprite.visible = false;
      });

      activeEmotionsStage = {
        mode: "auto_arc",
        soloIdx: 0,
        inspectIdx: 0,
        lockedViseme: null,
        junePlinth
      };
      setE1SoloActor(0);
    } else if (st.id === "exp_hand_acting") {
      // E2: Flagship 30-Bone Expressive Hand Acting & 12 Gestures Stage (Bare-forearm Hero + Companion Actor)
      const hero = spawnActor({
        id: "imani_gestures", name: "Imani · 30-Bone Hands", x: 0.00, z: 0.00, heading: 0.00,
        skinHex: 0x3b261b, hair: "croppedCoily", outer: "none",
        shirtHex: 0x4c514c, trouserHex: 0x282c2e,
        rolledSleeves: true, enablePhoneLight: true, pose: "idle"
      });
      const companion = spawnActor({
        id: "elder_gestures", name: "Elder · Ensemble Acting", x: 0.56, z: -0.26, heading: -0.22,
        scale: 1.01, build: 1.04, fem: 0.10, skinHex: 0x3f291d,
        hair: "turban", wrapHex: 0x625a4c, beard: true, hairHex: 0x1a1715,
        outer: "shamma", coatHex: 0xb6ae9e, shirtHex: 0x5c5042, pose: "idle"
      });
      // Hide companion in solo close-up hand lens so 0.36m-0.56m hand silhouettes read on clean paper; shown in Ensemble Duo!
      companion.group.visible = false;
      if (hero.label && hero.label.sprite) hero.label.sprite.visible = false;
      if (companion.label && companion.label.sprite) companion.label.sprite.visible = false;

      const barGroup = makeIronPumpBarProp();
      activeHandActingStage = {
        hero,
        companion,
        barGroup,
        lockedGesture: -1, // -1 = auto-cycle all 12 gestures
        lensMode: "auto",
        lastAutoIdx: -99,
        gripL: new T.Vector3(),
        gripR: new T.Vector3(),
        gripMid: new T.Vector3(),
        barDir: new T.Vector3(-1, 0, 0)
      };
    } else if (st.id === "macro_hands") {
      const hero = spawnActor({
        id: "imani_hands", name: "Imani (Hand Rig)", x: 0, z: 0, heading: 0,
        skinHex: 0x3b261b, hair: "croppedCoily", outer: "none",
        shirtHex: 0x4c514c, trouserHex: 0x282c2e,
        rolledSleeves: true, enablePhoneLight: true, pose: "auntSing"
      });
      if (hero.label && hero.label.sprite) hero.label.sprite.visible = false;
      const barGroup = makeIronPumpBarProp();
      activeMacroHands = {
        hero,
        barGroup,
        lockedGrip: -1,
        gripL: new T.Vector3(),
        gripR: new T.Vector3(),
        gripMid: new T.Vector3(),
        barDir: new T.Vector3(1, 0, 0)
      };
    } else if (st.id === "macro_portraits") {
      const plinthMat = new T.MeshStandardMaterial({ color: 0x383733, roughness: 0.88, metalness: 0.05 });
      const junePlinth = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 0.36, 32), plinthMat);
      junePlinth.position.set(-0.15, 0.18, 0.03);
      junePlinth.castShadow = true; junePlinth.receiveShadow = true;
      stageRoot.add(junePlinth);

      spawnActor({
        id: "imani_port", name: "Imani · 12-Shell 4C", x: -0.46, z: -0.02, heading: 0.14,
        skinHex: 0x3b261b, hair: "croppedCoily", outer: "duster", coatHex: 0x3b403c,
        shirtHex: 0x5c605a, trouserHex: 0x2c3032, pose: "idle"
      });
      spawnActor({
        id: "june_port", name: "June · 68 Locs", x: -0.15, z: 0.03, yOffset: 0.36, heading: 0.05,
        scale: 0.76, build: 0.96, fem: 0.55, skinHex: 0x3f291e,
        hair: "shortLocs", outer: "none", shirtHex: 0xb2a48c, trouserHex: 0x343635,
        tibebTrim: true, pose: "idle"
      });
      spawnActor({
        id: "hanna_port", name: "Hanna · Hair Cards", x: 0.15, z: 0.03, heading: -0.05,
        scale: 0.97, fem: 0.80, skinHex: 0xa27e68,
        hair: "ponytail", hairHex: 0x3b2a1e, outer: "none", shirtHex: 0x1b2634,
        rolledSleeves: true, pose: "idle"
      });
      spawnActor({
        id: "elder_port", name: "Elder · 8-Shell Beard", x: 0.46, z: -0.02, heading: -0.14,
        scale: 1.02, build: 1.05, fem: 0.10, skinHex: 0x3f291d,
        hair: "turban", wrapHex: 0x625a4c, beard: true, hairHex: 0x1a1715,
        outer: "shamma", coatHex: 0xb6ae9e, shirtHex: 0x5c5042, pose: "idle"
      });

      activeMacroPortraits = { freezeTurn: false, selectedIdx: -1, junePlinth };
    } else if (st.id === "macro_skeleton") {
      spawnActor({
        id: "skel_eskista", name: "Imani · 6/8 Eskista Rig", x: -0.48, z: 0.04, heading: 0.22,
        skinHex: 0x3b261b, hair: "croppedCoily", outer: "none",
        shirtHex: 0x3c4240, trouserHex: 0x24282a, rolledSleeves: true, pose: "eskista"
      });
      spawnActor({
        id: "skel_lift", name: "Carrier · 20 kg Squat Rig", x: 0.48, z: -0.04, heading: -0.24,
        scale: 1.01, build: 1.04, fem: 0.12, skinHex: 0x3f291d,
        hair: "croppedCoily", beard: true, outer: "none",
        shirtHex: 0x48423a, trouserHex: 0x242628, rolledSleeves: true, pose: "heaveSaddle20kg"
      });
    } else if (st.id === "t7_basin_pour") {
      // Study 1: Spout-aligned 20 kg two-handed basin pour into wheel-thrown terracotta shekla bowl!
      const imaniX = -0.35, imaniZ = -0.18, pourHdg = 0.48;
      spawnActor({
        id: "imani", name: "Imani", x: imaniX, z: imaniZ, heading: pourHdg,
        skinHex: 0x3b261b, hair: "croppedCoily", outer: "duster", coatHex: 0x3b403c,
        shirtHex: 0x5c605a, trouserHex: 0x2c3032, toolBelt: true, patchedKnees: true, pose: "basinPour20kg"
      });
      const props = window.makeArchitectureStudyPiece(T, "props");
      const bowl = props.children[2].clone();
      // Place bowl 0.68m along Imani's exact pour heading so the parabolic stream lands dead-center in the water meniscus!
      const bx = imaniX + Math.sin(pourHdg) * 0.68;
      const bz = imaniZ + Math.cos(pourHdg) * 0.68;
      bowl.position.set(bx, 0, bz);
      stageRoot.add(bowl);
      activeBasinBowlPos = new T.Vector3(bx, 0.22, bz);
      activeDonkey = spawnDonkeyWithSightWindow(0.76, -0.18, -0.35);
    } else if (st.id === "father_child_20kg") {
      // Study 2: Compact 0.45m handoff spacing so both Elder (scale 1.02) & June (scale 0.76, 40.3cm arms) lock 0.000m onto canRoot!
      const elderX = -0.20, elderZ = -0.06;
      const juneX = 0.09, juneZ = 0.27;
      const handoffYaw = Math.atan2(juneX - elderX, juneZ - elderZ);
      spawnActor({
        id: "elder", name: "Elder Carrier", x: elderX, z: elderZ, heading: handoffYaw,
        scale: 1.02, build: 1.05, fem: 0.10, skinHex: 0x3f291d,
        hair: "turban", wrapHex: 0x625a4c, beard: true, hairHex: 0x1a1715,
        outer: "shamma", coatHex: 0xb6ae9e, shirtHex: 0x5c5042, trouserHex: 0x2b2d2e, pose: "heaveSaddle20kg"
      });
      spawnActor({
        id: "june_kf15", name: "June", x: juneX, z: juneZ, heading: handoffYaw - Math.PI,
        scale: 0.76, build: 0.96, fem: 0.55, skinHex: 0x3f291e,
        hair: "shortLocs", outer: "none", shirtHex: 0xb2a48c, trouserHex: 0x343635,
        tibebTrim: true, patchedKnees: true, pose: "childReceive20kg"
      });

      let canObj = null;
      let canRoot;
      if (typeof window.makeWaterWifiCan === "function") {
        canObj = window.makeWaterWifiCan(T, { withPourAndRipples: false });
        canRoot = canObj.canRoot;
      } else {
        canRoot = new T.Group();
        const rawCan = window.makeArchitectureStudyPiece(T, "wifi_can");
        rawCan.position.y = -0.20;
        rawCan.rotation.y = Math.PI * 0.5;
        canRoot.add(rawCan);
      }
      canRoot.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      // Exact flush bevel contact points on 0.195 x 0.365 x 0.275m canRoot:
      //   - gElderL: under top carry-handle arch (y = +0.204, z = -0.022)
      //   - gElderR: directly on rear-bottom bevel (y = -0.172, z = -0.112)
      //   - gJuneL / gJuneR: directly on front-bottom bevels (y = -0.172, z = +0.112)
      const gElderL = new T.Object3D(); gElderL.position.set( 0.008,  0.204, -0.022); canRoot.add(gElderL);
      const gElderR = new T.Object3D(); gElderR.position.set(-0.062, -0.172, -0.112); canRoot.add(gElderR);
      const gJuneL  = new T.Object3D(); gJuneL.position.set(-0.066, -0.172,  0.112); canRoot.add(gJuneL);
      const gJuneR  = new T.Object3D(); gJuneR.position.set( 0.066, -0.172,  0.112); canRoot.add(gJuneR);
      stageRoot.add(canRoot);

      activeSharedHandoff = {
        canRoot, elderX, elderZ, handoffYaw,
        gElderL, gElderR, gJuneL, gJuneR,
        wElderL: new T.Vector3(), wElderR: new T.Vector3(),
        wJuneL: new T.Vector3(), wJuneR: new T.Vector3(),
        nElderL: new T.Vector3(), nElderR: new T.Vector3(),
        nJuneL: new T.Vector3(), nJuneR: new T.Vector3(),
        qCan: new T.Quaternion()
      };

      const props = window.makeArchitectureStudyPiece(T, "props");
      const sawbuck = props.children[0].clone();
      const extraCan = sawbuck.getObjectByName("restingCan");
      if (extraCan) extraCan.visible = false;
      sawbuck.position.set(-0.92, 0, -0.22);
      sawbuck.rotation.y = 0.4;
      stageRoot.add(sawbuck);
    } else if (st.id === "eskista_trio") {
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
      // Study 4: Standpipe fulcrum at x=+0.045, gripCenter at x=+0.470, endKnob at x=+0.610.
      // Place Imani at ergonomic stand-off x=1.05 (0.44m clear of endKnob!) so both arms extend naturally onto pumpGripL/R!
      const props = window.makeArchitectureStudyPiece(T, "props");
      const standpipe = props.children[1].clone();
      standpipe.position.set(-0.04, 0, 0);
      standpipe.rotation.y = Math.PI;
      stageRoot.add(standpipe);
      activeStudyPump = standpipe;
      const bowl = props.children[2].clone();
      bowl.position.set(-0.58, 0, 0);
      stageRoot.add(bowl);
      spawnActor({
        id: "pumper", name: "Imani", x: 1.05, z: 0.01, heading: -Math.PI * 0.5,
        skinHex: 0x3b261b, hair: "croppedCoily", outer: "duster", coatHex: 0x3b403c,
        toolBelt: true, pose: "pump"
      });
    } else if (st.id === "night_convoy") {
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
      const deskMat = new T.MeshStandardMaterial({ color: 0xaeb4ba, roughness: 0.55, metalness: 0.18 });
      const darkMat = new T.MeshStandardMaterial({ color: 0x1f2326, roughness: 0.45, metalness: 0.5 });
      const woodMat = new T.MeshStandardMaterial({ color: 0x453629, roughness: 0.85 });
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
      const propsGrp = window.makeArchitectureStudyPiece(T, "props");
      stageRoot.add(propsGrp);
      activeStudyPump = propsGrp.children[1] || null;
    }

    $("st-title").textContent = st.title;
    $("st-cat").textContent = st.cat;
    $("st-note").textContent = st.note;
    $("st-tri-readout").textContent = `${countTriangles(stageRoot).toLocaleString()} TRIS · DRAG ORBIT · SCROLL TO 0.22M`;

    document.querySelectorAll("#study-pills .pill").forEach(b => {
      const isAct = +b.dataset.studyIdx === activeStudyIdx;
      b.classList.toggle("active", isAct);
      b.setAttribute("aria-pressed", String(isAct));
    });
    renderVisemeHudChips();
    renderModePills(st);
    renderFocusPills(st);
    renderDirectorBar();
    renderMatchedTab(st);
  }

  /* ---------- Populate UI Pills (Flagship N1 Neck Lean & Skin First, Followed by E1, E2, M1..M3 & Classic 1..10) ---------- */
  const pillsWrap = $("study-pills");
  const PILL_ORDER = [15, 13, 14, 10, 11, 12, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const idx of PILL_ORDER) {
    if (idx === -1) {
      const sep = document.createElement("span");
      sep.className = "pill-sep";
      sep.setAttribute("aria-hidden", "true");
      pillsWrap.appendChild(sep);
      continue;
    }
    const st = STUDIES[idx];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pill" + (st.isNeckLean ? " pill-lean" : st.isExp ? " pill-exp" : st.isMacro ? " pill-macro" : "");
    b.dataset.studyIdx = String(idx);
    b.textContent = st.short;
    b.addEventListener("click", () => loadStudy(idx));
    pillsWrap.appendChild(b);
  }

  function openLightbox(src) {
    $("lightbox-img").src = src;
    $("lightbox").hidden = false;
  }
  $("lightbox").addEventListener("click", () => { $("lightbox").hidden = true; });

  function getAvailableVideosForIds(ids) {
    if (!ids || !ids.length) return [];
    const list = [];
    for (const id of ids) {
      const v = STUDY_VIDEOS.find(x => x.id === id);
      if (v && isVideoAvailable(v)) list.push(v);
    }
    return list;
  }

  function playDrawerVideosIn(container) {
    if (!container) return;
    container.querySelectorAll("video").forEach(v => {
      v.muted = true;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    });
  }

  function pauseDrawerVideosIn(container) {
    if (!container) return;
    container.querySelectorAll("video").forEach(v => v.pause());
  }

  function releaseDrawerVideosIn(container) {
    if (!container) return;
    container.querySelectorAll("video").forEach(v => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
  }

  function renderMatchedTab(st, activeVidIdx = 0) {
    const el = $("tab-matched");
    releaseDrawerVideosIn(el);
    const cards = [];

    // 1. Single-Active-Decoder Live Looping Video Hero Card (with Reel Switcher Chips so 3D stays 60+ FPS!)
    const matchedVids = getAvailableVideosForIds(st.videoIds);
    if (matchedVids.length) {
      const selIdx = clamp(activeVidIdx, 0, matchedVids.length - 1);
      const vid = matchedVids[selIdx];
      const posterAttr = getVideoPosterAttr(vid);
      const badgeCls = vid.emotion ? "vid-badge emotion" : "vid-badge";
      const switcherHtml = matchedVids.length > 1 ? `
        <div class="vid-switcher" aria-label="Switch matched reference video">
          ${matchedVids.map((mv, mi) => `
            <button type="button" class="vid-sw-btn${mi === selIdx ? " active" : ""}" data-vid-idx="${mi}">${mv.id} · ${mv.badge.split("·")[1]?.trim() || mv.id}</button>
          `).join("")}
        </div>
      ` : "";
      cards.push(`<p class="sec-kicker">Live Video Reference · Side-by-Side Sync</p>`);
      cards.push(`
        <article class="ref-card">
          <div class="vid-wrap">
            <video src="${vid.src}"${posterAttr} autoplay loop muted playsinline preload="auto" controls></video>
            <span class="${badgeCls}">${vid.badge}</span>
          </div>
          <div class="ref-cap">
            <strong>${vid.title}</strong>
            ${vid.desc}
            ${switcherHtml}
          </div>
        </article>
      `);
    }

    // 2. 2K Photographic Orthographic & FACS/Hand Plates (#424242 Studio Matte)
    const availOrtho = getAvailableOrthoPlates(st.orthoPlates);
    if (availOrtho.length) {
      cards.push(`<p class="sec-kicker">2K FACS, Hand &amp; Ortho Plates (#424242 Matte)</p>`);
      cards.push(`
        <div class="ortho-grid">
          ${availOrtho.map(op => `
            <div class="ortho-tile" data-zoom="${op.src}">
              <img src="${op.src}" alt="${op.label}" loading="lazy">
              <span>${op.label}</span>
            </div>
          `).join("")}
        </div>
      `);
    }

    // 3. Generated Orthographic / Motion Study Sheet
    cards.push(`<p class="sec-kicker">Turnaround Sheet &amp; ZZlDs10FCZk Keyframes</p>`);
    cards.push(`
      <article class="ref-card">
        <img src="${st.sheet}" alt="${st.title} orthographic study sheet" data-zoom="${st.sheet}">
        <div class="ref-cap">
          <strong>Generated Orthographic / Motion Study Sheet</strong>
          ${st.sheetCap}
        </div>
      </article>
    `);

    // 4. Matched ZZlDs10FCZk Source Film Keyframes
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
    el.querySelectorAll("[data-vid-idx]").forEach(btn => {
      btn.addEventListener("click", () => renderMatchedTab(st, +btn.dataset.vidIdx));
    });
    el.querySelectorAll("[data-zoom]").forEach(node => {
      node.addEventListener("click", () => openLightbox(node.dataset.zoom));
    });
    if (!el.hidden) playDrawerVideosIn(el);
  }

  // Populate Tab 2: All Live Emotion (E1..E4), Macro (M1..M6) & Scene (V1..V6) Study Videos
  // Mounts <video src> only while #tab-prompts is visible so total active WebMediaPlayers never exceeds Chrome's 16-decoder cap!
  function renderVideosTab() {
    const el = $("tab-prompts");
    releaseDrawerVideosIn(el);
    if (el.hidden) {
      el.innerHTML = "";
      return;
    }
    const liveList = STUDY_VIDEOS.filter(isVideoAvailable);
    el.innerHTML = `
      <p style="margin:0;font-size:12px;opacity:.86">Live <strong>1080p Emotion, Speech &amp; Hand Acting (${liveList.length} reels)</strong> buffering locally alongside the 3D stage:</p>
      ${liveList.map((vid, vi) => `
        <article class="ref-card">
          <div class="vid-wrap">
            <video src="${vid.src}"${getVideoPosterAttr(vid)}${vi < 4 ? " autoplay" : ""} loop muted playsinline preload="auto" controls></video>
            <span class="${vid.emotion ? "vid-badge emotion" : "vid-badge"}">${vid.badge}</span>
          </div>
          <div class="ref-cap">
            <strong>${vid.title}</strong>
            ${vid.desc}<br>
            <button type="button" class="vid-jump-btn" data-jump-study="${vid.studyId}">↗ Load Matched 3D Plate</button>
          </div>
        </article>
      `).join("")}
      <details class="briefs-fold">
        <summary>View 6 Source AI Motion Prompts</summary>
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
      </details>
    `;
    el.querySelectorAll("[data-jump-study]").forEach(btn => {
      btn.addEventListener("click", () => loadStudy(btn.dataset.jumpStudy));
    });
    el.querySelectorAll("[data-copy]").forEach(btn => {
      btn.addEventListener("click", () => {
        const txt = VIDEO_BRIEFS[+btn.dataset.copy].prompt;
        navigator.clipboard?.writeText(txt);
        btn.textContent = "Copied ✓";
        setTimeout(() => { btn.textContent = "Copy Prompt"; }, 1400);
      });
    });
  }

  // Populate Tab 3: All 16 Film Cuts
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

  // Drawer tabs & stage buttons
  document.querySelectorAll(".d-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".d-tab").forEach(t => t.setAttribute("aria-selected", String(t === tab)));
      $("tab-matched").hidden = target !== "matched";
      $("tab-prompts").hidden = target !== "prompts";
      $("tab-keyframes").hidden = target !== "keyframes";
      if (target === "matched") {
        releaseDrawerVideosIn($("tab-prompts"));
        $("tab-prompts").innerHTML = "";
        renderMatchedTab(STUDIES[activeStudyIdx]);
      } else if (target === "prompts") {
        releaseDrawerVideosIn($("tab-matched"));
        renderVideosTab();
      } else {
        releaseDrawerVideosIn($("tab-matched"));
        releaseDrawerVideosIn($("tab-prompts"));
        $("tab-prompts").innerHTML = "";
      }
    });
  });

  $("btn-skeleton").addEventListener("click", () => {
    setSkeletonXRay(!skeletonXRayActive, true);
  });
  window.addEventListener("keydown", e => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (e.key === "x" || e.key === "X") {
      setSkeletonXRay(!skeletonXRayActive, true);
    }
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

  bindDirectorSliders();
  syncSliderReadouts();

  let pendingResize = false;
  let loopStarted = false;
  let lastAppliedW = 0, lastAppliedH = 0;

  function applyResizeNow() {
    pendingResize = false;
    const w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);
    if (w !== lastAppliedW || h !== lastAppliedH) {
      lastAppliedW = w;
      lastAppliedH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function resize() {
    if (!loopStarted) {
      applyResizeNow();
    } else {
      pendingResize = true;
    }
  }
  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(wrap);
  }
  if (window.innerWidth <= 980) {
    document.body.classList.add("drawer-closed");
    $("btn-drawer").setAttribute("aria-pressed", "false");
    $("btn-drawer").textContent = "Ref Sheet ▴";
  }

  /* ---------- Initial Plate Selection (Defaulting to Flagship N1 · Leaning Neck, Jawline & Skin Continuity!) ---------- */
  const urlParams = new URLSearchParams(location.search);
  const rawStudyParam = urlParams.get("study");
  const defaultIdx = STUDIES.findIndex(s => s.id === "neck_lean_skin");
  loadStudy(rawStudyParam !== null ? rawStudyParam : (defaultIdx >= 0 ? defaultIdx : 0));
  if (urlParams.get("leanMode") || (STUDIES[activeStudyIdx]?.id === "neck_lean_skin" && urlParams.get("mode"))) {
    applyNeckLeanMode(urlParams.get("leanMode") || urlParams.get("mode"), true);
  } else if (urlParams.get("mode")) {
    applyEmotionMode(urlParams.get("mode"), true);
  }
  if (urlParams.get("actor") !== null && STUDIES[activeStudyIdx]?.id === "neck_lean_skin") {
    setNeckLeanActor(urlParams.get("actor"), true);
  }
  if (urlParams.get("neckLean") !== null) {
    setNeckLeanAngle(+urlParams.get("neckLean"));
  }
  if (urlParams.get("viseme")) lockIndividualViseme(urlParams.get("viseme"), true);
  if (urlParams.get("gesture")) applyHandGestureMode(urlParams.get("gesture"), true);
  if (urlParams.get("skeleton") === "1" || urlParams.get("xray") === "1") {
    setSkeletonXRay(true, true);
  }
  resize();
  discoverEmotionAssets();

  /* ---------- Helpers: Evaluate N1 Cycle Stages, Raised Bare-Arm Skin Continuity Pose & E1 Arc ---------- */
  const TOTAL_N1_CYCLE_SEC = N1_CYCLE_STAGES.reduce((s, x) => s + x.dur, 0);
  function sampleN1Cycle(nowSec) {
    let rem = ((nowSec % TOTAL_N1_CYCLE_SEC) + TOTAL_N1_CYCLE_SEC) % TOTAL_N1_CYCLE_SEC;
    let idx = 0;
    for (let i = 0; i < N1_CYCLE_STAGES.length; i++) {
      if (rem < N1_CYCLE_STAGES[i].dur) { idx = i; break; }
      rem -= N1_CYCLE_STAGES[i].dur;
    }
    const cur = N1_CYCLE_STAGES[idx];
    const nxt = N1_CYCLE_STAGES[(idx + 1) % N1_CYCLE_STAGES.length];
    // Hold steady through the first 74% of each stage (so initial page load at t=0..2.0s immediately shows full +24° lean!),
    // then glide with C2 smoothstep into the next stage over the final 0.72s!
    const blendStart = Math.max(0.4, cur.dur - 0.72);
    const u = smooth(blendStart, cur.dur, rem);

    const curRoll = cur.eskistaSlide ? (13.0 * Math.sin(nowSec * 2.8 + 0.6)) : cur.rollDeg;
    const nxtRoll = nxt.eskistaSlide ? (13.0 * Math.sin(nowSec * 2.8 + 0.6)) : nxt.rollDeg;
    const curGlide = cur.eskistaSlide ? (0.024 * Math.sin(nowSec * 5.6)) : (cur.glideX || 0);
    const nxtGlide = nxt.eskistaSlide ? (0.024 * Math.sin(nowSec * 5.6)) : (nxt.glideX || 0);

    return {
      stageIdx: idx,
      rollDeg: lerp(curRoll, nxtRoll, u),
      pitchDeg: lerp(cur.pitchDeg, nxt.pitchDeg, u),
      yawDeg: lerp(cur.yawDeg, nxt.yawDeg, u),
      glideX: lerp(curGlide, nxtGlide, u),
      emotion: u < 0.55 ? cur.emotion : nxt.emotion,
      intensity: lerp(cur.intensity, nxt.intensity, u),
      hud: cur.hud,
      facs: cur.facs
    };
  }

  // Dedicated 2-bone IK scratch for raising one bare forearm & dorsal wrist/hand cleanly beside the clavicle/shoulder on N1!
  const skinArmSc = {
    S: new T.Vector3(), Tgt: new T.Vector3(), D: new T.Vector3(), uD: new T.Vector3(),
    uP: new T.Vector3(), J: new T.Vector3(), dir1: new T.Vector3(), dir2: new T.Vector3(),
    xAx: new T.Vector3(), yAx: new T.Vector3(), zAx: new T.Vector3(),
    mUpper: new T.Matrix4(), mLower: new T.Matrix4(),
    qParentInv: new T.Quaternion(), qUpperW: new T.Quaternion(), qLowerW: new T.Quaternion(),
    grpQuat: new T.Quaternion(), pWorld: new T.Vector3(), palmW: new T.Vector3(),
    fDirW: new T.Vector3(), poleW: new T.Vector3(),
    // Required scratch fields for V3.solveWristTwistAndElbowVolume:
    fArmDir: new T.Vector3(), fDir: new T.Vector3(), pNrm: new T.Vector3(),
    mHand: new T.Matrix4(), qHandWorld: new T.Quaternion(), qLowerWorld: new T.Quaternion(), qRel: new T.Quaternion()
  };

  function poseSkinContinuityArm(ch, nowSec, steady = false) {
    const V3 = window.HumanSculptV3;
    if (!V3 || !ch || !ch.bones || ch.bones.length < 50 || !ch.group) return;
    const B = V3.B;
    const bones = ch.bones;
    const sc = skinArmSc;
    const charScale = ch.group.scale.x || 1.0;

    ch.group.updateMatrixWorld(true);
    ch.group.getWorldQuaternion(sc.grpQuat);

    const solveSide = (side, lx, ly, lz, px, py, pz, fx, fy, fz, plx, ply, plz, clavZ) => {
      const bCl = side > 0 ? B.CLAV_L : B.CLAV_R;
      const bUA = side > 0 ? B.UARM_L : B.UARM_R;
      const bEV = side > 0 ? B.ELBOW_VOL_L : B.ELBOW_VOL_R;
      const bFA = side > 0 ? B.FARM_L : B.FARM_R;
      const bTw = side > 0 ? B.FARM_TWIST_L : B.FARM_TWIST_R;
      const bHa = side > 0 ? B.HAND_L : B.HAND_R;
      if (clavZ) bones[bCl].rotateZ(side * clavZ);
      bones[bCl].updateWorldMatrix(true, false);
      bones[bUA].updateWorldMatrix(true, false);
      bones[bUA].getWorldPosition(sc.S);

      sc.pWorld.set(lx, ly, lz).applyMatrix4(ch.group.matrixWorld);
      sc.palmW.set(px, py, pz).applyQuaternion(sc.grpQuat).normalize();
      sc.fDirW.set(fx, fy, fz).applyQuaternion(sc.grpQuat).normalize();
      sc.poleW.set(plx, ply, plz).applyQuaternion(sc.grpQuat).normalize();

      const a = 0.275 * charScale, b = 0.255 * charScale;
      sc.D.subVectors(sc.pWorld, sc.S);
      const rawDist = sc.D.length();
      const d = clamp(rawDist, Math.abs(a - b) + 0.008, (a + b) * 0.992);
      if (rawDist > 1e-6) sc.uD.copy(sc.D).divideScalar(rawDist);
      else sc.uD.set(0, -1, 0);

      sc.uP.copy(sc.poleW).addScaledVector(sc.uD, -sc.poleW.dot(sc.uD));
      if (sc.uP.lengthSq() < 1e-6) sc.uP.set(0, -0.3, -1);
      sc.uP.normalize();

      const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
      const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      sc.J.copy(sc.S).addScaledVector(sc.uD, a * cosA).addScaledVector(sc.uP, a * sinA);

      sc.dir1.subVectors(sc.J, sc.S).normalize();
      sc.yAx.copy(sc.dir1).negate();
      // Right-handed anatomical basis matching characters.js (uP points toward posterior olecranon, so uP x yAx = +X and zAx faces +Z anterior!)
      sc.xAx.crossVectors(sc.uP, sc.yAx);
      if (sc.xAx.lengthSq() < 1e-6) sc.xAx.set(1, 0, 0);
      sc.xAx.normalize();
      sc.zAx.crossVectors(sc.xAx, sc.yAx).normalize();
      sc.mUpper.makeBasis(sc.xAx, sc.yAx, sc.zAx);
      sc.qUpperW.setFromRotationMatrix(sc.mUpper);

      bones[bCl].getWorldQuaternion(sc.qParentInv).invert();
      bones[bUA].quaternion.copy(sc.qParentInv).multiply(sc.qUpperW);
      bones[bUA].updateMatrixWorld(true);

      sc.Tgt.copy(sc.S).addScaledVector(sc.uD, d);
      sc.dir2.subVectors(sc.Tgt, sc.J).normalize();
      sc.yAx.copy(sc.dir2).negate();
      sc.zAx.crossVectors(sc.xAx, sc.yAx);
      if (sc.zAx.lengthSq() < 1e-6) sc.zAx.set(0, 0, 1);
      sc.zAx.normalize();
      sc.xAx.crossVectors(sc.yAx, sc.zAx).normalize();
      sc.mLower.makeBasis(sc.xAx, sc.yAx, sc.zAx);
      sc.qLowerW.setFromRotationMatrix(sc.mLower);

      bones[bUA].getWorldQuaternion(sc.qParentInv).invert();
      bones[bFA].quaternion.copy(sc.qParentInv).multiply(sc.qLowerW);
      bones[bFA].updateMatrixWorld(true);

      V3.solveWristTwistAndElbowVolume(sc, bones[bFA], bones[bTw], bones[bEV], bones[bHa], side, sc.palmW, sc.fDirW, 0.96);
      if (window.HumanExpressionsV4 && typeof window.HumanExpressionsV4.applyExpressiveHandBones === "function") {
        window.HumanExpressionsV4.applyExpressiveHandBones(bones, B, side, side < 0 ? "heart_gratitude" : "relaxed_breathing", steady ? 0 : nowSec, 0.68);
      }
    };

    const sway = steady ? 0.0 : 0.006 * Math.sin(nowSec * 1.6);
    // Raise Right bare forearm & dorsal wrist/hand tucked ~3.5cm inward beside right shoulder (lx=-0.205, ly=1.445, lz=0.180, px ~ 180..225)
    // so Cheek + Jaw + Neck + Chest + Bare Shoulder + Bare Forearm + Dorsal Hand all sit cleanly inside frame & above .stage-bar (py < 735) facing +Z!
    solveSide(
      -1,
      -0.196, 1.438 + sway, 0.182,
      0.02, -0.02, -0.999,
      -0.05, 0.995, 0.08,
      -0.24, -0.64, -0.68,
      0.02
    );
    // Keep Left bare shoulder & upper arm relaxed at side facing +Z (posterior olecranon pole -> zero axial shoulder twist!)
    solveSide(
      1,
      0.204, 0.915 - sway * 0.4, 0.036,
      -0.92, -0.06, -0.38,
      0.03, -0.98, 0.18,
      0.16, -0.10, -0.98,
      0.0
    );
    ch.group.updateMatrixWorld(true);
    if (ch._v3XraySkeleton && ch._v3XraySkeleton.isEnabled && ch._v3XraySkeleton.isEnabled()) {
      ch._v3XraySkeleton.update();
    }
  }

  function applyFallbackNeckLeanIfNeeded(ch, neckLean) {
    if (!ch || !ch.bones || !neckLean) return;
    // Defer 100% to characters.js native 3-joint solver once @body-skin-lean-rig's ch.setNeckLean / ch.getNeckLeanState is attached!
    if (typeof ch.setNeckLean === "function" || typeof ch.getNeckLeanState === "function") return;
    const V3 = window.HumanSculptV3;
    const B = (V3 && V3.B) || { CHEST: 3, NECK_LOW: 4, NECK_HIGH: 5, HEAD: 6, CLAV_L: 10, CLAV_R: 31 };
    const roll = neckLean.roll || 0;
    const pitch = neckLean.pitch || 0;
    const yaw = neckLean.yaw || 0;
    const glideX = neckLean.glideX || 0;
    if (ch.bones[B.CHEST]) {
      ch.bones[B.CHEST].rotateZ(roll * 0.10);
      ch.bones[B.CHEST].rotateY(yaw * 0.04);
    }
    if (ch.bones[B.NECK_LOW]) {
      ch.bones[B.NECK_LOW].rotateX(pitch * 0.42);
      ch.bones[B.NECK_LOW].rotateY(yaw * 0.28);
      ch.bones[B.NECK_LOW].rotateZ(roll * 0.40);
      if (glideX) ch.bones[B.NECK_LOW].position.x += glideX * 0.55;
    }
    if (ch.bones[B.NECK_HIGH]) {
      ch.bones[B.NECK_HIGH].rotateX(pitch * 0.34);
      ch.bones[B.NECK_HIGH].rotateY(yaw * 0.36);
      ch.bones[B.NECK_HIGH].rotateZ(roll * 0.36);
      if (glideX) ch.bones[B.NECK_HIGH].position.x += glideX * 0.45;
    }
    if (ch.bones[B.HEAD]) {
      ch.bones[B.HEAD].rotateX(pitch * 0.24);
      ch.bones[B.HEAD].rotateY(yaw * 0.36);
      ch.bones[B.HEAD].rotateZ(roll * 0.24);
    }
    ch.group.updateMatrixWorld(true);
  }

  function readActorNeckLeanDegrees(ch, fallbackLean) {
    if (ch && typeof ch.getNeckLeanState === "function") {
      const st = ch.getNeckLeanState();
      if (st && typeof st.roll === "number") {
        return {
          rollDeg: +(st.roll / DEG).toFixed(1),
          pitchDeg: +((st.pitch || 0) / DEG).toFixed(1),
          yawDeg: +((st.yaw || 0) / DEG).toFixed(1)
        };
      }
      if (st && typeof st.rollDeg === "number") return st;
    }
    if (fallbackLean) {
      return {
        rollDeg: +((fallbackLean.roll || 0) / DEG).toFixed(1),
        pitchDeg: +((fallbackLean.pitch || 0) / DEG).toFixed(1),
        yawDeg: +((fallbackLean.yaw || 0) / DEG).toFixed(1)
      };
    }
    if (ch && ch.bones && window.HumanSculptV3?.B) {
      const B = window.HumanSculptV3.B;
      const rz = (ch.bones[B.NECK_LOW]?.rotation.z || 0) + (ch.bones[B.NECK_HIGH]?.rotation.z || 0) + (ch.bones[B.HEAD]?.rotation.z || 0);
      const rx = (ch.bones[B.NECK_LOW]?.rotation.x || 0) + (ch.bones[B.NECK_HIGH]?.rotation.x || 0) + (ch.bones[B.HEAD]?.rotation.x || 0);
      const ry = (ch.bones[B.NECK_LOW]?.rotation.y || 0) + (ch.bones[B.NECK_HIGH]?.rotation.y || 0) + (ch.bones[B.HEAD]?.rotation.y || 0);
      return {
        rollDeg: +(rz / DEG).toFixed(1),
        pitchDeg: +(rx / DEG).toFixed(1),
        yawDeg: +(ry / DEG).toFixed(1)
      };
    }
    return { rollDeg: 0, pitchDeg: 0, yawDeg: 0 };
  }

  const TOTAL_ARC_SEC = E1_AUTO_ARC_STAGES.reduce((s, x) => s + x.dur, 0);
  function sampleE1AutoArc(nowSec) {
    let rem = nowSec % TOTAL_ARC_SEC;
    for (const stg of E1_AUTO_ARC_STAGES) {
      if (rem < stg.dur) return stg;
      rem -= stg.dur;
    }
    return E1_AUTO_ARC_STAGES[0];
  }

  /* ---------- Live 60 FPS Animation Loop ---------- */
  const followVec = new T.Vector3();
  const handMidTmp = new T.Vector3();
  const headPosTmp = new T.Vector3();
  let lastNow = performance.now();

  function frame(now) {
    if (pendingResize || wrap.clientWidth !== lastAppliedW || wrap.clientHeight !== lastAppliedH) {
      applyResizeNow();
    }
    const dt = clamp((now - lastNow) * 0.001, 0.001, 0.05);
    lastNow = now;
    const nowSec = now * 0.001;
    const st = STUDIES[activeStudyIdx];

    if (activeStudyPump && typeof window.stepStandpipePump === "function") {
      const pPhase = nowSec * 3.6;
      studyPumpGrips.pumpPhase = pPhase;
      window.stepStandpipePump(activeStudyPump, pPhase, studyPumpGrips);
    }

    let handoffWave = 0;
    if (activeSharedHandoff) {
      const sh = activeSharedHandoff;
      handoffWave = 0.5 + 0.5 * Math.sin(nowSec * 1.15);
      const fwdFromElder = lerp(0.245, 0.265, handoffWave);
      sh.canRoot.position.set(
        sh.elderX + Math.sin(sh.handoffYaw) * fwdFromElder,
        lerp(0.95, 0.89, handoffWave),
        sh.elderZ + Math.cos(sh.handoffYaw) * fwdFromElder
      );
      sh.canRoot.rotation.set(0.07 * handoffWave, sh.handoffYaw, 0, "YXZ");
      sh.canRoot.updateWorldMatrix(true, true);
      sh.gElderL.getWorldPosition(sh.wElderL);
      sh.gElderR.getWorldPosition(sh.wElderR);
      sh.gJuneL.getWorldPosition(sh.wJuneL);
      sh.gJuneR.getWorldPosition(sh.wJuneR);
      sh.canRoot.getWorldQuaternion(sh.qCan);
      // Upward-supporting palmar normals so Elder & June bear real 20 kg gravity underneath the can!
      sh.nElderL.set(0, -1, 0).applyQuaternion(sh.qCan);
      sh.nElderR.set(0.32, 0.88, 0.34).normalize().applyQuaternion(sh.qCan);
      sh.nJuneL.set(0.34, 0.88, -0.32).normalize().applyQuaternion(sh.qCan);
      sh.nJuneR.set(-0.34, 0.88, -0.32).normalize().applyQuaternion(sh.qCan);
    }

    // M2 Portrait Lineup: subtle head/body sway when in 4-ensemble view
    if (activeMacroPortraits && !activeMacroPortraits.freezeTurn) {
      for (let i = 0; i < activeActors.length; i++) {
        const item = activeActors[i];
        item.ch.state.heading = item.baseHeading + 0.44 * Math.sin(nowSec * 0.48 + i * 1.15);
      }
    }

    // E1 Quartet gentle breathing sway when not solo-locked on 90° profile / 0.24m mouth macro
    if (activeEmotionsStage && activeEmotionsStage.soloIdx < 0) {
      for (let i = 0; i < activeActors.length; i++) {
        const item = activeActors[i];
        item.ch.state.heading = item.baseHeading + 0.14 * Math.sin(nowSec * 0.55 + i * 1.3);
      }
    }

    // M1 Macro Hands 5-Grip Choreographer
    let macroGripStage = -1;
    if (activeMacroHands) {
      const mh = activeMacroHands;
      macroGripStage = mh.lockedGrip >= 0 ? mh.lockedGrip : (Math.floor(nowSec / 3.4) % 5);
      mh.barGroup.visible = macroGripStage === 1;
      if (macroGripStage === 1) {
        const barY = 1.06 + 0.045 * Math.sin(nowSec * 2.6);
        mh.barGroup.position.set(0, barY, 0.33);
        mh.gripL.set( 0.105, barY, 0.33);
        mh.gripR.set(-0.105, barY, 0.33);
        mh.gripMid.set(0, barY, 0.33);
        mh.barDir.set(-1, 0, 0);
      }
      if (!drag && !followTargetFn) {
        const sc = M1_STAGE_CAMS[macroGripStage];
        if (mh.lastStage !== macroGripStage) {
          mh.lastStage = macroGripStage;
          camState.wantDist = sc.dist;
          camState.wantYaw = sc.yaw;
          camState.wantPitch = sc.pitch;
        }
        camState.wantTargetX = sc.targetX;
        camState.wantTargetY = sc.targetY;
        camState.wantTargetZ = sc.targetZ;
      }
    }

    // N1 Leaning Neck, Jawline & Skin Continuity Stage Evaluation
    let n1ActiveSpec = null;
    if (activeNeckLeanStage) {
      const nl = activeNeckLeanStage;
      const mDef = resolveNeckLeanModeDef(nl.mode);
      if (mDef.key === "cycle") {
        const cyc = sampleN1Cycle(nowSec);
        n1ActiveSpec = {
          modeKey: "cycle",
          roll: cyc.rollDeg * DEG,
          pitch: cyc.pitchDeg * DEG,
          yaw: cyc.yawDeg * DEG,
          glideX: cyc.glideX || 0,
          emotion: cyc.emotion,
          intensity: cyc.intensity,
          hud: cyc.hud,
          facs: cyc.facs,
          raiseBareArm: true,
          steadyArm: false
        };
      } else if (mDef.isQuartet) {
        n1ActiveSpec = {
          modeKey: "quartet",
          isQuartet: true,
          hud: mDef.hud,
          facs: mDef.facs
        };
      } else {
        const microBreath = mDef.evenLight ? 0.0 : (0.8 * DEG * Math.sin(nowSec * 1.25));
        n1ActiveSpec = {
          modeKey: mDef.key,
          roll: (mDef.rollDeg || 0) * DEG + microBreath,
          pitch: (mDef.pitchDeg || 0) * DEG,
          yaw: (mDef.yawDeg || 0) * DEG,
          glideX: mDef.glideX || 0,
          emotion: mDef.emotion || "neutral",
          intensity: mDef.intensity !== undefined ? mDef.intensity : 0.45,
          hud: mDef.hud,
          facs: mDef.facs,
          raiseBareArm: !mDef.isProfile,
          steadyArm: Boolean(mDef.evenLight)
        };
      }
    }

    // E1 Emotion & Speech Stage Evaluation
    let e1ActiveSpec = null;
    if (activeEmotionsStage) {
      const em = activeEmotionsStage;
      if (em.mode === "auto_arc") {
        const arc = sampleE1AutoArc(nowSec);
        e1ActiveSpec = {
          emotion: arc.emotion,
          intensity: arc.intensity !== undefined ? arc.intensity : 0.90,
          speaking: arc.speaking,
          viseme: arc.viseme,
          visemeAmount: arc.visemeAmount,
          handL: arc.hand,
          handR: arc.hand,
          arm: arc.arm,
          hud: arc.label,
          facs: arc.facs
        };
      } else if (em.mode === "viseme_tour") {
        const vObj = em.lockedViseme
          ? (VISEME_LIST.find(v => v.id === em.lockedViseme) || VISEME_LIST[0])
          : VISEME_LIST[Math.floor(nowSec / 1.65) % VISEME_LIST.length];
        e1ActiveSpec = {
          emotion: "neutral",
          intensity: 1.0,
          speaking: false,
          viseme: vObj.id,
          visemeAmount: 1.0,
          handL: "relaxed_breathing",
          handR: "relaxed_breathing",
          hud: `VISEME [${vObj.id}] · ${vObj.label.split("·")[1]?.trim() || vObj.id}`,
          facs: vObj.desc.toUpperCase()
        };
      } else {
        const mDef = E1_MODES.find(m => m.key === em.mode) || E1_MODES[1];
        const useAlt = mDef.altEmotion && (Math.sin(nowSec * 0.9) > 0.35);
        e1ActiveSpec = {
          emotion: useAlt ? mDef.altEmotion : mDef.emotion,
          intensity: mDef.intensity !== undefined ? mDef.intensity : 0.88,
          speaking: Boolean(mDef.speaking),
          viseme: mDef.viseme,
          visemeAmount: mDef.visemeAmount,
          handL: mDef.handL,
          handR: mDef.handR,
          arm: mDef.arm,
          hud: mDef.hud,
          facs: mDef.facs
        };
      }
    }

    // E2 12-Gesture Hand Acting Stage Evaluation
    let e2GestureDef = null;
    let e2ToolSubGrip = 0;
    if (activeHandActingStage) {
      const ha = activeHandActingStage;
      const gIdx = ha.lockedGesture >= 0 ? ha.lockedGesture : (Math.floor(nowSec / 3.2) % E2_GESTURES.length);
      e2GestureDef = E2_GESTURES[gIdx];
      e2ToolSubGrip = Math.floor(nowSec / 2.6) % 5;
      const showPumpBar = e2GestureDef.id === "tool_grips_5x" && e2ToolSubGrip === 0;
      ha.barGroup.visible = showPumpBar;
      if (showPumpBar) {
        const barY = 1.06 + 0.04 * Math.sin(nowSec * 2.5);
        ha.barGroup.position.set(0, barY, 0.33);
        ha.gripL.set( 0.105, barY, 0.33);
        ha.gripR.set(-0.105, barY, 0.33);
        ha.gripMid.set(0, barY, 0.33);
        ha.barDir.set(-1, 0, 0);
      }
    }

    const dirOverride = buildDirectorOverridePayload();
    const forcedMood = manualMoodIdx > 0 ? MOOD_CYCLE[manualMoodIdx] : undefined;
    const holdSteadyMacro = Boolean(activeNeckLeanStage) || (camState.dist < 0.65 && (
      activeFocusKey.includes("prof") ||
      activeFocusKey.includes("mouth") ||
      activeFocusKey.includes("eye") ||
      activeFocusKey.includes("neck") ||
      (activeEmotionsStage && activeEmotionsStage.mode === "viseme_tour")
    ));

    let inspectNeckLeanUsed = null;
    for (let actorIdx = 0; actorIdx < activeActors.length; actorIdx++) {
      const item = activeActors[actorIdx];
      if (!item.ch || !item.ch.group.visible) continue;
      const opts = {
        pose: item.pose,
        mood: forcedMood,
        surfaceAt: flatGround,
        beatPulse: 0.45 + 0.45 * Math.sin(nowSec * 4.8),
        lookAt: holdSteadyMacro ? undefined : camera.position
      };
      let raiseShowcaseArm = false;
      let steadyShowcaseArm = false;

      if (activeNeckLeanStage && n1ActiveSpec) {
        const n1Vis = activeNeckLeanStage.lockedViseme || "SIL";
        if (n1ActiveSpec.isQuartet) {
          // Quartet All Leaning (4): distinct graceful 3-joint leaning poses & calm symmetrical closed-lip warmth across June, Imani, Hanna & Elder!
          const qSway = 1.6 * DEG * Math.sin(nowSec * 1.15 + actorIdx * 1.4);
          if (actorIdx === 0) {
            // Imani: -22° Right Lateral Lean + calm warm poise
            opts.neckLean = { roll: -22 * DEG + qSway, pitch: -3 * DEG, yaw: -5 * DEG, glideX: 0 };
            opts.emotion = "happy_joy";
            opts.emotionIntensity = 0.44;
          } else if (actorIdx === 1) {
            // June: +19° Left Lateral Lean + radiant Duchenne warmth
            opts.neckLean = { roll: 19 * DEG - qSway, pitch: -3 * DEG, yaw: 10 * DEG, glideX: 0 };
            opts.emotion = "happy_joy";
            opts.emotionIntensity = 0.54;
          } else if (actorIdx === 2) {
            // Hanna: +19° Oblique Listening Lean + -22° Turn
            opts.neckLean = { roll: 19 * DEG + qSway, pitch: -2 * DEG, yaw: -22 * DEG, glideX: 0 };
            opts.emotion = "happy_joy";
            opts.emotionIntensity = 0.36;
          } else {
            // Elder: -18° Dignified Soulful Lean + +12° Turn
            opts.neckLean = { roll: -18 * DEG - qSway, pitch: 4 * DEG, yaw: -12 * DEG, glideX: 0 };
            opts.emotion = "neutral";
            opts.emotionIntensity = 0.45;
          }
          opts.speaking = false;
          opts.viseme = n1Vis;
          opts.visemeAmount = 1.0;
          opts.handGestureL = "relaxed_breathing";
          opts.handGestureR = "relaxed_breathing";
        } else {
          opts.neckLean = {
            roll: n1ActiveSpec.roll,
            pitch: n1ActiveSpec.pitch,
            yaw: n1ActiveSpec.yaw,
            glideX: n1ActiveSpec.glideX || 0
          };
          opts.emotion = n1ActiveSpec.emotion;
          opts.emotionIntensity = n1ActiveSpec.intensity;
          opts.speaking = false;
          opts.viseme = n1Vis;
          opts.visemeAmount = 1.0;
          opts.handGestureL = "relaxed_breathing";
          opts.handGestureR = "heart_gratitude";
          raiseShowcaseArm = Boolean(n1ActiveSpec.raiseBareArm);
          steadyShowcaseArm = Boolean(n1ActiveSpec.steadyArm);
        }
      } else if (activeEmotionsStage && e1ActiveSpec) {
        // In Quartet dialogue mode, stagger speaking turns & complementary listener reactions across the 4 actors!
        const isDialogueTurn = activeEmotionsStage.mode === "speaking" && activeEmotionsStage.soloIdx < 0 && actorIdx > 0;
        const speakerSlot = Math.floor(nowSec / 3.4) % 4;
        if (isDialogueTurn && speakerSlot !== actorIdx) {
          opts.emotion = actorIdx % 2 === 1 ? "happy_joy" : "surprised_awe";
          opts.emotionIntensity = 0.68;
          opts.speaking = false;
          opts.handGestureL = "relaxed_breathing";
          opts.handGestureR = "relaxed_breathing";
        } else {
          opts.emotion = e1ActiveSpec.emotion;
          opts.emotionIntensity = e1ActiveSpec.intensity !== undefined ? e1ActiveSpec.intensity : 0.88;
          opts.speaking = Boolean(e1ActiveSpec.speaking);
          if (e1ActiveSpec.viseme) {
            opts.viseme = e1ActiveSpec.viseme;
            opts.visemeAmount = e1ActiveSpec.visemeAmount !== undefined ? e1ActiveSpec.visemeAmount : 1.0;
          }
          opts.handGestureL = e1ActiveSpec.handL;
          opts.handGestureR = e1ActiveSpec.handR;
          // Only run wide lateral arm gestures when soloed so Quartet (4) faces never collide with a neighbor's hand!
          if (e1ActiveSpec.arm && activeEmotionsStage.soloIdx >= 0 && camState.dist > 0.34) {
            opts.expressiveArmGesture = e1ActiveSpec.arm;
          }
        }
      } else if (activeHandActingStage && e2GestureDef) {
        const ha = activeHandActingStage;
        const isHero = item.ch === ha.hero;
        if (e2GestureDef.id === "tool_grips_5x" && isHero) {
          if (e2ToolSubGrip === 0) {
            opts.pose = "pump";
            opts.pumpPhase = nowSec * 2.5;
            opts.pumpGripL = ha.gripL;
            opts.pumpGripR = ha.gripR;
            opts.worldGripL = ha.gripL;
            opts.worldGripR = ha.gripR;
            opts.pumpGripWorld = ha.gripMid;
            opts.pumpBarDir = ha.barDir;
            opts.lookAt = ha.gripMid;
          } else if (e2ToolSubGrip === 1) {
            opts.pose = "basinPour20kg";
            opts.pourAmount = 0.35 + 0.20 * Math.sin(nowSec * 1.6);
          } else if (e2ToolSubGrip === 2) {
            opts.pose = "phoneGlow";
          } else if (e2ToolSubGrip === 3) {
            opts.pose = "clerkWindow";
          } else {
            opts.pose = "handInspect";
            opts.handInspect = true;
          }
          opts.emotion = "determined_focus";
        } else {
          if (!window.HumanExpressionsV4) {
            opts.pose = e2GestureDef.id === "piano_finger_ripple" ? "handInspect"
              : e2GestureDef.id === "joyful_wave" ? "wave"
              : e2GestureDef.id === "brow_shade_lookout" ? "shadeScreen" : "auntSing";
          }
          opts.emotion = e2GestureDef.emotion;
          opts.emotionIntensity = 1.0;
          opts.speaking = Boolean(e2GestureDef.speaking);
          opts.handGestureL = e2GestureDef.id;
          opts.handGestureR = e2GestureDef.id;
          opts.handGestureIntensity = 1.0;
          opts.expressiveArmGesture = e2GestureDef.id;
        }
      } else if (activeMacroHands && item.ch === activeMacroHands.hero) {
        const mh = activeMacroHands;
        if (macroGripStage === 0) {
          opts.pose = "handInspect";
          opts.handInspect = true;
        } else if (macroGripStage === 1) {
          opts.pose = "pump";
          opts.pumpPhase = nowSec * 2.6;
          opts.pumpGripL = mh.gripL;
          opts.pumpGripR = mh.gripR;
          opts.worldGripL = mh.gripL;
          opts.worldGripR = mh.gripR;
          opts.pumpGripWorld = mh.gripMid;
          opts.pumpBarDir = mh.barDir;
          opts.lookAt = mh.gripMid;
        } else if (macroGripStage === 2) {
          opts.pose = "basinPour20kg";
          opts.pourAmount = 0.35 + 0.22 * Math.sin(nowSec * 1.6);
        } else if (macroGripStage === 3) {
          opts.pose = "phoneGlow";
        } else {
          opts.pose = "clerkWindow";
        }
      } else if (item.pose === "basinPour20kg" && activeBasinBowlPos) {
        opts.pourTarget = activeBasinBowlPos;
        opts.lookAt = activeBasinBowlPos;
      } else if (item.pose === "pump" && activeStudyPump) {
        opts.pumpPhase = studyPumpGrips.pumpPhase;
        opts.pumpGripL = studyPumpGrips.pumpGripL;
        opts.pumpGripR = studyPumpGrips.pumpGripR;
        opts.worldGripL = studyPumpGrips.pumpGripL;
        opts.worldGripR = studyPumpGrips.pumpGripR;
        opts.pumpGripWorld = studyPumpGrips.pumpGripWorld;
        opts.pumpBarDir = studyPumpGrips.pumpBarDir;
        opts.lookAt = studyPumpGrips.pumpGripWorld;
      } else if (activeSharedHandoff && item.ch.state.id === "elder") {
        const sh = activeSharedHandoff;
        opts.worldGripL = sh.wElderL;
        opts.worldGripR = sh.wElderR;
        opts.gripNormalL = sh.nElderL;
        opts.gripNormalR = sh.nElderR;
        opts.gripModeL = "handleTop";
        opts.gripModeR = "underRib";
        opts.unloadPhase = lerp(0.32, 0.50, handoffWave);
        opts.lookAt = sh.canRoot.position;
      } else if (activeSharedHandoff && item.ch.state.id === "june_kf15") {
        const sh = activeSharedHandoff;
        opts.worldGripL = sh.wJuneL;
        opts.worldGripR = sh.wJuneR;
        opts.gripNormalL = sh.nJuneL;
        opts.gripNormalR = sh.nJuneR;
        opts.gripModeL = "underRib";
        opts.gripModeR = "underRib";
        opts.lookAt = sh.canRoot.position;
      }

      // Apply Live Director Neck Lean (-26° ↔ +26°) across ANY study (E1, E2, M2, N1, Classic 1..10)!
      if (dirOverride && dirOverride.neckLean) {
        opts.neckLean = {
          roll: dirOverride.neckLean.roll,
          pitch: opts.neckLean ? (opts.neckLean.pitch || 0) : 0,
          yaw: opts.neckLean ? (opts.neckLean.yaw || 0) : 0,
          glideX: opts.neckLean ? (opts.neckLean.glideX || 0) : 0
        };
      }

      if (item.ch.userData) {
        item.ch.userData.emotionOverride = dirOverride || null;
      }

      item.ch.update(dt, nowSec, opts);
      if (opts.neckLean) {
        applyFallbackNeckLeanIfNeeded(item.ch, opts.neckLean);
      }
      if (raiseShowcaseArm && item.ch.group.visible) {
        poseSkinContinuityArm(item.ch, nowSec, steadyShowcaseArm);
      }
      const targetInspectIdx = activeNeckLeanStage ? (activeNeckLeanStage.inspectIdx || 0)
        : activeEmotionsStage ? (activeEmotionsStage.inspectIdx || 0) : 0;
      if (actorIdx === targetInspectIdx && opts.neckLean) {
        inspectNeckLeanUsed = opts.neckLean;
      }
    }

    // Smart Span-Aware & BBox-Aware Camera for E2 12-Gesture Stage (auto, hands, upper, handL, handR)
    if (activeHandActingStage && e2GestureDef && activeHandActingStage.lensMode !== "duo" && !drag && !followTargetFn) {
      const ha = activeHandActingStage;
      const lm = ha.lensMode || "auto";
      const B3 = window.HumanSculptV3 && ha.hero.bones.length >= 50 ? window.HumanSculptV3.B : null;
      const idxHL = B3 ? B3.L_MID_1 : 9;
      const idxHR = B3 ? B3.R_MID_1 : 13;
      ha.hero.bones[idxHL].getWorldPosition(boneTmpA);
      ha.hero.bones[idxHR].getWorldPosition(boneTmpB);
      getActorPartWorldPos(ha.hero, "mouth", headPosTmp);

      const isSingleBrow = e2GestureDef.id === "brow_shade_lookout" || e2GestureDef.id === "exhausted_brow_wipe";
      const isRightLead = isSingleBrow || e2GestureDef.id === "joyful_wave" || e2GestureDef.id === "pointing_call";
      const effAspect = clamp(camera.aspect || 1.16, 0.85, 1.45);

      if (e2GestureDef.id === "tool_grips_5x") {
        const sc = M1_STAGE_CAMS[e2ToolSubGrip === 0 ? 1 : e2ToolSubGrip === 1 ? 2 : e2ToolSubGrip === 2 ? 3 : e2ToolSubGrip === 3 ? 4 : 0];
        if (lm === "handL" || lm === "handR") {
          const hp = lm === "handL" ? boneTmpA : boneTmpB;
          camState.wantDist = 0.34;
          camState.wantYaw = sc.yaw;
          camState.wantPitch = 0.24;
          camState.wantTargetX = hp.x;
          camState.wantTargetY = hp.y - 0.022;
          camState.wantTargetZ = hp.z;
        } else {
          camState.wantDist = lm === "upper" ? Math.max(1.06, sc.dist * 1.85) : sc.dist;
          camState.wantYaw = sc.yaw;
          camState.wantPitch = lm === "upper" ? 0.14 : sc.pitch;
          camState.wantTargetX = sc.targetX;
          camState.wantTargetY = lm === "upper" ? 1.24 : sc.targetY;
          camState.wantTargetZ = sc.targetZ;
        }
      } else if (lm === "handL" || lm === "handR") {
        const hp = (lm === "handL" && !isSingleBrow) ? boneTmpA : boneTmpB;
        camState.wantDist = 0.30;
        camState.wantYaw = lm === "handL" ? 0.18 : -0.18;
        camState.wantPitch = 0.18;
        camState.wantTargetX = hp.x;
        camState.wantTargetY = hp.y - 0.022;
        camState.wantTargetZ = hp.z;
      } else if (lm === "upper") {
        // Full Upper-Body + Face + Raised/Wide Hands Bounding Box so head crown & both hands NEVER clip!
        const crownY = headPosTmp.y + 0.19;
        const minY = Math.min(isSingleBrow ? boneTmpB.y : Math.min(boneTmpA.y, boneTmpB.y), 1.08);
        const maxY = Math.max(crownY, boneTmpB.y + 0.08, isSingleBrow ? crownY : boneTmpA.y + 0.08);
        const spanX = isSingleBrow ? 0.32 : Math.abs(boneTmpA.x - boneTmpB.x) + 0.24;
        const needV = (maxY - minY + 0.14) / 0.52;
        const needH = spanX / (0.50 * effAspect);
        camState.wantDist = clamp(Math.max(1.06, needV, needH), 1.04, 1.42);
        camState.wantYaw = e2GestureDef.camYaw * 0.65;
        camState.wantPitch = 0.07;
        camState.wantTargetX = isSingleBrow ? boneTmpB.x * 0.35 : (boneTmpA.x + boneTmpB.x) * 0.25;
        camState.wantTargetY = (minY + maxY) * 0.5 - 0.055;
        camState.wantTargetZ = (boneTmpB.z + headPosTmp.z) * 0.5;
      } else {
        // "auto" or "hands": dynamically scale distance to fit live bilateral 3D hand span with zero edge cutoff!
        if (isRightLead) {
          const hw = lm === "hands" ? (isSingleBrow ? 0.36 : 0.20) : e2GestureDef.headWeight;
          const spanRH = boneTmpB.distanceTo(headPosTmp);
          const minD = lm === "hands" ? 0.48 : e2GestureDef.camDist;
          camState.wantDist = clamp(Math.max(minD, (spanRH * hw * 2.0 + 0.28)), 0.44, 0.96);
          camState.wantYaw = e2GestureDef.camYaw;
          camState.wantPitch = e2GestureDef.camPitch;
          camState.wantTargetX = lerp(boneTmpB.x, headPosTmp.x, hw);
          camState.wantTargetY = lerp(boneTmpB.y, headPosTmp.y, hw) - 0.032 * camState.wantDist;
          camState.wantTargetZ = lerp(boneTmpB.z, headPosTmp.z, hw);
        } else {
          const spanLR = boneTmpA.distanceTo(boneTmpB);
          const fitBothDist = (spanLR + 0.21) / (0.50 * effAspect);
          const hw = lm === "hands" ? 0.0 : e2GestureDef.headWeight;
          const baseD = lm === "hands" ? 0.42 : e2GestureDef.camDist;
          camState.wantDist = clamp(Math.max(baseD, fitBothDist), 0.40, 1.18);
          camState.wantYaw = e2GestureDef.camYaw;
          camState.wantPitch = lm === "hands" ? Math.max(0.14, e2GestureDef.camPitch) : e2GestureDef.camPitch;
          handMidTmp.copy(boneTmpA).add(boneTmpB).multiplyScalar(0.5);
          camState.wantTargetX = lerp(handMidTmp.x, headPosTmp.x, hw);
          camState.wantTargetY = lerp(handMidTmp.y, headPosTmp.y, hw) - 0.045 * camState.wantDist;
          camState.wantTargetZ = lerp(handMidTmp.z, headPosTmp.z, hw);
        }
      }
      if (ha.snapNextCam) {
        ha.snapNextCam = false;
        camState.dist = camState.wantDist;
        camState.yaw = camState.wantYaw;
        camState.pitch = camState.wantPitch;
        camState.targetX = camState.wantTargetX;
        camState.targetY = camState.wantTargetY;
        camState.targetZ = camState.wantTargetZ;
      }
    }

    if (activeDonkey) {
      activeDonkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 2, drop: 0 }, flatGround);
    }

    if (followTargetFn && !drag) {
      followTargetFn(followVec);
      camState.wantTargetX = followVec.x;
      camState.wantTargetY = followVec.y;
      camState.wantTargetZ = followVec.z;
    }

    if (camState.turntable && !drag) camState.wantYaw += dt * 0.38;
    const k = 1 - Math.exp(-dt * 8.5);
    camState.yaw = lerp(camState.yaw, camState.wantYaw, k);
    camState.pitch = lerp(camState.pitch, camState.wantPitch, k);
    camState.dist = lerp(camState.dist, camState.wantDist, k);
    camState.targetX = lerp(camState.targetX, camState.wantTargetX, k);
    camState.targetY = lerp(camState.targetY, camState.wantTargetY, k);
    camState.targetZ = lerp(camState.targetZ, camState.wantTargetZ, k);

    const wantNear = clamp(camState.dist * 0.042, 0.006, 0.12);
    if (Math.abs(camera.near - wantNear) > 0.002) {
      camera.near = wantNear;
      camera.updateProjectionMatrix();
    }
    syncTightShadowFrustum(st);
    updateSunDirection();

    const cp = Math.cos(camState.pitch), sp = Math.sin(camState.pitch);
    const effDist = camState.dist * (camera.aspect < 0.85 ? clamp(0.88 / camera.aspect, 1.0, 1.52) : 1.0);
    camera.position.set(
      camState.targetX + Math.sin(camState.yaw) * cp * effDist,
      camState.targetY + sp * effDist,
      camState.targetZ + Math.cos(camState.yaw) * cp * effDist
    );
    camera.lookAt(camState.targetX, camState.targetY, camState.targetZ);

    catchLight.target.position.set(camState.targetX, camState.targetY, camState.targetZ);
    const catchLat = evenSkinLightActive ? 0.0 : 0.72;
    catchLight.position.set(
      camera.position.x + Math.cos(camState.yaw) * catchLat,
      camera.position.y + (evenSkinLightActive ? 0.18 : 0.52),
      camera.position.z - Math.sin(camState.yaw) * catchLat
    );

    // Update Live Neck-Lean / FACS / Viseme / Hand Gesture Telemetry HUD
    const hudEl = $("exp-hud");
    const inspectIdxNow = activeNeckLeanStage ? (activeNeckLeanStage.inspectIdx || 0)
      : activeEmotionsStage ? (activeEmotionsStage.inspectIdx || 0) : 0;
    const inspectActor = activeActors[inspectIdxNow]?.ch || activeActors[0]?.ch || null;
    const expState = (inspectActor && typeof inspectActor.getExpressionState === "function")
      ? inspectActor.getExpressionState()
      : null;
    const neckTelemetry = readActorNeckLeanDegrees(inspectActor, inspectNeckLeanUsed || dirOverride?.neckLean || null);
    const ctrlV4 = inspectActor?._v4ExpCtrl || null;
    const liveVisNow = (dirOverride && dirOverride.viseme)
      || (e1ActiveSpec && e1ActiveSpec.viseme)
      || (ctrlV4 && ctrlV4.activeSpeechViseme && ctrlV4.activeSpeechViseme !== "SIL" ? ctrlV4.activeSpeechViseme : null)
      || (expState && expState.viseme)
      || "SIL";
    const liveEmoNow = (dirOverride && dirOverride.emotion)
      || (n1ActiveSpec && n1ActiveSpec.emotion)
      || (e1ActiveSpec && e1ActiveSpec.emotion)
      || (e2GestureDef && e2GestureDef.emotion)
      || (expState && expState.emotion)
      || "neutral";
    const liveJawNow = expState ? +(expState.jawOpen || 0).toFixed(3) : 0;
    const activeGripLNow = (inspectActor && inspectActor.userData && inspectActor.userData.activeGripModeL) || "";
    const activeGripRNow = (inspectActor && inspectActor.userData && inspectActor.userData.activeGripModeR) || "";
    const liveHandLNow = activeGripLNow || (dirOverride && dirOverride.handGestureL) || (e2GestureDef && e2GestureDef.id) || (e1ActiveSpec && e1ActiveSpec.handL) || expState?.handGestureL || "relaxed_breathing";
    const liveHandRNow = activeGripRNow || (dirOverride && dirOverride.handGestureR) || (e2GestureDef && e2GestureDef.id) || (e1ActiveSpec && e1ActiveSpec.handR) || expState?.handGestureR || "relaxed_breathing";

    liveTelemetry.emotion = liveEmoNow;
    liveTelemetry.viseme = liveVisNow;
    liveTelemetry.jawOpen = liveJawNow;
    liveTelemetry.neckLeanDeg = neckTelemetry.rollDeg;
    liveTelemetry.neckPitchDeg = neckTelemetry.pitchDeg;
    liveTelemetry.neckYawDeg = neckTelemetry.yawDeg;
    liveTelemetry.speaking = Boolean((dirOverride && dirOverride.speaking) || (e1ActiveSpec && e1ActiveSpec.speaking) || (e2GestureDef && e2GestureDef.speaking) || expState?.speaking);
    liveTelemetry.handGestureL = liveHandLNow;
    liveTelemetry.handGestureR = liveHandRNow;

    const showHud = Boolean(st.isExp || st.isNeckLean || dirOverride || liveJawNow > 0.04 || Math.abs(neckTelemetry.rollDeg) > 1.5 || liveEmoNow !== "neutral");
    if (hudEl) {
      hudEl.hidden = !showHud;
      if (showHud) {
        const dotEl = $("hud-dot");
        if (dotEl) dotEl.classList.toggle("override", Boolean(dirOverride));
        let titleTxt = "";
        let facsTxt = "";
        const jawPct = Math.round(liveJawNow * 100);
        const rollStr = `${neckTelemetry.rollDeg > 0 ? "+" : ""}${Math.round(neckTelemetry.rollDeg)}°`;
        if (dirOverride) {
          const pLbl = DIRECTOR_PRESETS.find(p => p.key === directorState.preset)?.label || "Custom FACS";
          titleTxt = `LIVE DIRECTOR OVERRIDE · ${pLbl.toUpperCase()} (LEAN ${rollStr})`;
          facsTxt = `NECK LEAN: ${rollStr} · VISEME: ${liveVisNow} · JAW: ${jawPct}% · SMILE: ${Math.round(directorState.smileSad * 100)}`;
        } else if (activeNeckLeanStage && n1ActiveSpec) {
          titleTxt = n1ActiveSpec.hud;
          facsTxt = `${n1ActiveSpec.facs} · LEAN: ${rollStr}`;
        } else if (activeEmotionsStage && e1ActiveSpec) {
          titleTxt = e1ActiveSpec.hud;
          facsTxt = `${e1ActiveSpec.facs} · VISEME: ${liveVisNow} (${jawPct}%)`;
        } else if (activeHandActingStage && e2GestureDef) {
          titleTxt = e2GestureDef.hud;
          facsTxt = `${e2GestureDef.facs} · JAW: ${jawPct}%`;
        } else {
          titleTxt = `SCENE ACTING · ${String(liveEmoNow).replace(/_/g, " ").toUpperCase()}`;
          facsTxt = `LEAN: ${rollStr} · VISEME: ${liveVisNow} · JAW: ${jawPct}% · HANDS: ${String(liveHandRNow).toUpperCase()}`;
        }
        liveTelemetry.hudTitle = titleTxt;
        liveTelemetry.hudFacs = facsTxt;
        $("hud-title").textContent = titleTxt;
        $("hud-facs").textContent = facsTxt;
      }
    }

    $("st-mood-readout").textContent = skeletonXRayActive
      ? "56-BONE X-RAY ACTIVE"
      : dirOverride
        ? `DIRECTOR: ${directorState.preset.toUpperCase()} (${Math.round(neckTelemetry.rollDeg)}°)`
        : st.isNeckLean
          ? `NECK LEAN: ${(activeNeckLeanStage?.mode || "CYCLE").toUpperCase()} (${neckTelemetry.rollDeg > 0 ? "+" : ""}${Math.round(neckTelemetry.rollDeg)}°)`
          : st.isExp
            ? `FACS: ${String(liveEmoNow).replace(/_/g, " ").toUpperCase()}`
            : `MOOD: ${(forcedMood || "AUTO").toUpperCase()}`;

    if (evenSkinLightActive && !camState.night) {
      updateSunDirection();
      if (pendingEvenShadowClear && clearSunShadowMapToUnshadowed()) {
        pendingEvenShadowClear = false;
      }
    }
    if (window.__study && typeof window.__study.customFrameHook === "function") {
      window.__study.customFrameHook(dt, nowSec);
    }
    if (window.__study && typeof window.__study.customRenderHook === "function") {
      window.__study.customRenderHook(renderer, scene, camera, dt, nowSec);
    } else {
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }

  window.__study = {
    isReady: () => true,
    renderer,
    scene,
    camera,
    stageRoot,
    wrap,
    canvas,
    getActiveActors: () => activeActors,
    getActiveDonkey: () => activeDonkey,
    getCamState: () => camState,
    setPaperMode,
    customFrameHook: null,
    customRenderHook: null,
    loadStudy,
    setNeckLeanMode: (modeKey, snap = true) => applyNeckLeanMode(modeKey, snap),
    setNeckLeanAngle: (deg, opts) => setNeckLeanAngle(deg, opts),
    setNeckLeanActor: (actorIdxOrId, snap = true) => setNeckLeanActor(actorIdxOrId, snap),
    setEmotionMode: (modeKey, snap = true) => applyEmotionMode(modeKey, snap),
    setViseme: (visemeId, snap = true) => lockIndividualViseme(visemeId, snap),
    setHandGesture: (idxOrId, snap = true) => applyHandGestureMode(idxOrId, snap),
    setDirectorOverride: (cfg = {}) => {
      if (typeof cfg === "string") {
        directorState.preset = cfg;
      } else {
        if (cfg.preset !== undefined) directorState.preset = cfg.preset;
        if (cfg.neckLeanDeg !== undefined) directorState.neckLeanDeg = clamp(+cfg.neckLeanDeg, -26, 26);
        else if (typeof cfg.neckLean === "number") directorState.neckLeanDeg = clamp(+cfg.neckLean, -26, 26);
        if (cfg.jawSpeech !== undefined) directorState.jawSpeech = clamp(+cfg.jawSpeech, 0, 1);
        if (cfg.smileSad !== undefined) directorState.smileSad = clamp(+cfg.smileSad, -1, 1);
        if (cfg.brows !== undefined) directorState.brows = clamp(+cfg.brows, -1, 1);
        if (cfg.handSplayCurl !== undefined) directorState.handSplayCurl = clamp(+cfg.handSplayCurl, -1, 1);
      }
      syncSliderReadouts();
      buildDirectorOverridePayload();
      renderDirectorBar();
      return window.NIGHT_POST_EMOTION_OVERRIDE;
    },
    resetDirectorOverride: () => {
      directorState.preset = "auto";
      directorState.neckLeanDeg = 0;
      directorState.jawSpeech = 0;
      directorState.smileSad = 0;
      directorState.brows = 0;
      directorState.handSplayCurl = 0;
      syncSliderReadouts();
      buildDirectorOverridePayload();
      renderDirectorBar();
    },
    refreshEmotionAssets: discoverEmotionAssets,
    setSkeletonXRay: flag => setSkeletonXRay(flag, true),
    toggleSkeletonXRay: () => setSkeletonXRay(!skeletonXRayActive, true),
    setCamera: (cfg, snap = true) => { followTargetFn = null; setCameraPreset(cfg, snap); },
    focusActor,
    setMacroGrip: stageIdx => applyMacroGripStage(stageIdx, true),
    listStudies: () => STUDIES.map((s, idx) => ({ idx, id: s.id, short: s.short, title: s.title, isMacro: Boolean(s.isMacro), isExp: Boolean(s.isExp), isNeckLean: Boolean(s.isNeckLean) })),
    getExpressionTelemetry: () => ({
      ...liveTelemetry,
      studyId: STUDIES[activeStudyIdx]?.id,
      neckLeanMode: activeNeckLeanStage?.mode || null,
      neckLeanInspectIdx: activeNeckLeanStage?.inspectIdx ?? null,
      neckLeanSoloIdx: activeNeckLeanStage?.soloIdx ?? null,
      directorNeckLeanDeg: directorState.neckLeanDeg,
      evenSkinLight: evenSkinLightActive,
      e1Mode: activeEmotionsStage?.mode || null,
      lockedViseme: activeEmotionsStage?.lockedViseme || null,
      e2GestureIdx: activeHandActingStage ? (activeHandActingStage.lockedGesture >= 0 ? activeHandActingStage.lockedGesture : Math.floor((performance.now() * 0.001) / 3.2) % E2_GESTURES.length) : null,
      directorOverride: Boolean(isDirectorOverrideActive()),
      hasHumanExpressionsV4: Boolean(window.HumanExpressionsV4),
      hasScionEyeGlobe: Boolean(window.ScionEyeGlobe),
      hasScionEyelids: Boolean(window.ScionEyelids),
      hasScionNeck: Boolean(window.ScionNeck),
      liveVideoCount: STUDY_VIDEOS.filter(isVideoAvailable).length,
      emotionFiles: Array.from(liveEmotionFiles),
      hasExpressionSheet: liveTextureV3Files.has("imani_expressions_sheet.jpg"),
      hasHandEmotionSheet: liveTextureV3Files.has("hand_emotions_sheet.jpg")
    }),
    getState: () => ({
      studyIdx: activeStudyIdx,
      studyId: STUDIES[activeStudyIdx].id,
      activeFocusKey,
      neckLeanMode: activeNeckLeanStage?.mode || null,
      neckLeanDeg: liveTelemetry.neckLeanDeg,
      evenSkinLight: evenSkinLightActive,
      skeletonXRay: skeletonXRayActive,
      camDist: +camState.dist.toFixed(3),
      actorCount: activeActors.length,
      boneCount: activeActors[0]?.ch?.bones?.length || 0,
      hasHumanSculptV3: Boolean(window.HumanSculptV3),
      hasHumanExpressionsV4: Boolean(window.HumanExpressionsV4),
      hasScionEyeGlobe: Boolean(window.ScionEyeGlobe),
      hasScionEyelids: Boolean(window.ScionEyelids),
      hasScionNeck: Boolean(window.ScionNeck),
      macroVideosLive: MACRO_VIDEOS_LIVE,
      liveVideoCount: STUDY_VIDEOS.filter(isVideoAvailable).length,
      hasDonkey: Boolean(activeDonkey),
      keyframeCount: FILM_KEYFRAMES.length,
      videoBriefCount: VIDEO_BRIEFS.length
    })
  };
  loopStarted = true;
  requestAnimationFrame(frame);
})();
