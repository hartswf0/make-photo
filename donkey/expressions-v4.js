/* Real-Time FACS Facial Expression, Coarticulated Open-Mouth Speech (Teeth + Tongue + Oral Cavity),
   and 30-Bone Expressive Hand & Upper-Body Acting Engine (v4).
   Exposes window.HumanExpressionsV4 for donkey/human-sculpt-v3.js, donkey/characters.js, and study/study.js. */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const MAX_JAW_RAD = 26.0 * DEG; // 26° true anatomical TMJ mandibular opening (~31mm lip aperture)

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const frac = x => x - Math.floor(x);
  const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

  function hashString(str) {
    if (typeof str === "number") return Math.abs(str) + 1.37;
    const s = String(str || "water_wifi");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) * 0.001 + 0.73;
  }

  function buildDualPresetCollection(items) {
    const arr = items.slice();
    const map = {};
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      map[item.id] = item;
      if (!(item.id in arr)) {
        Object.defineProperty(arr, item.id, {
          value: item,
          enumerable: false,
          configurable: false,
          writable: false
        });
      }
    }
    return { arr, map };
  }

  // Canonical zeroed FACS channel vector
  const FACS_KEYS = [
    "jawOpen",
    "smile",
    "sad",
    "browUpInner",
    "browUpOuter",
    "browFurrow",
    "squint",
    "wideEyes",
    "mouthFunnel",
    "mouthStretch",
    "lipPress",
    "noseWrinkle",
    "chinRaise",
    "tongueLift",
    "tongueOut",
    "lowerLipTuck"
  ];

  function createZeroFacs() {
    return {
      jawOpen: 0,
      smile: 0,
      sad: 0,
      browUpInner: 0,
      browUpOuter: 0,
      browFurrow: 0,
      squint: 0,
      wideEyes: 0,
      mouthFunnel: 0,
      mouthStretch: 0,
      lipPress: 0,
      noseWrinkle: 0,
      chinRaise: 0,
      tongueLift: 0,
      tongueOut: 0,
      lowerLipTuck: 0
    };
  }

  /* ============================================================================
     1. 10 CANONICAL FACS EMOTION PRESETS
     ============================================================================ */
  const EMOTION_DEFS = [
    {
      id: "neutral",
      label: "Neutral · Calm Composure",
      shortLabel: "Neutral",
      auSummary: "AU0 · Relaxed Neutral Rest",
      activeAUs: ["AU0"],
      autoSpeak: false,
      defaultHand: "relaxed_breathing",
      headPitch: 0.0,
      headRoll: 0.0,
      headYaw: 0.0,
      gazeY: 0.0,
      lidAperture: 1.00,
      duchenne: 0.0,
      pupilDilate: 0.50,
      weights: {}
    },
    {
      id: "speaking_animated",
      label: "Speaking · Animated Open-Mouth Dialogue",
      shortLabel: "Speaking",
      auSummary: "AU1+2+12+25+26 · Coarticulated Speech & Lean",
      activeAUs: ["AU1", "AU2", "AU12", "AU25", "AU26"],
      autoSpeak: true,
      speechLeanAmp: 11.0 * DEG,
      defaultHand: "talking_gesticulate",
      headPitch: -0.025,
      headRoll: 8.5 * DEG,
      headYaw: 0.06,
      gazeY: 0.02,
      lidAperture: 1.03,
      duchenne: 0.24,
      pupilDilate: 0.54,
      weights: {
        smile: 0.26,
        browUpInner: 0.24,
        browUpOuter: 0.28,
        squint: 0.12
      }
    },
    {
      id: "happy_joy",
      label: "Happy & Joy · Warm Duchenne Smile",
      shortLabel: "Happy / Joy",
      auSummary: "AU6+12+25 · Cheek Raise, Smile & Warm +12° Lean",
      activeAUs: ["AU6", "AU12", "AU25"],
      autoSpeak: false,
      defaultHand: "joyful_wave",
      headPitch: -0.045,
      headRoll: 12.0 * DEG,
      headYaw: 0.035,
      gazeY: 0.03,
      lidAperture: 0.94,
      duchenne: 0.72,
      pupilDilate: 0.58,
      weights: {
        jawOpen: 0.22,
        smile: 0.88,
        squint: 0.44,
        browUpOuter: 0.18,
        mouthStretch: 0.14
      }
    },
    {
      id: "laughing_open",
      label: "Laughing · Radiant Open-Mouth Duchenne Laugh",
      shortLabel: "Open Laugh",
      auSummary: "AU6+12+25+26 · Open Joyous Laugh & +12.5° Lean",
      activeAUs: ["AU6", "AU9", "AU12", "AU25", "AU26"],
      autoSpeak: false,
      laughPulse: 1.0,
      defaultHand: "joyful_wave",
      headPitch: -0.115,
      headRoll: 12.5 * DEG,
      headYaw: 0.045,
      gazeY: 0.04,
      lidAperture: 0.84,
      duchenne: 0.94,
      pupilDilate: 0.62,
      weights: {
        jawOpen: 0.72,
        smile: 0.96,
        squint: 0.58,
        browUpInner: 0.18,
        browUpOuter: 0.24,
        mouthStretch: 0.22,
        noseWrinkle: 0.16,
        tongueLift: 0.08
      }
    },
    {
      id: "sad_grief",
      label: "Sad & Grief · Soulful -16° Grief Lean & Sorrow",
      shortLabel: "Sad / Grief",
      auSummary: "AU1+4+15+17 · Grief Arch, -16° Lean & Bow",
      activeAUs: ["AU1", "AU4", "AU15", "AU17"],
      autoSpeak: false,
      defaultHand: "heart_gratitude",
      headPitch: 0.145,
      headRoll: -16.0 * DEG,
      headYaw: -0.065,
      gazeY: -0.06,
      lidDroop: 0.12,
      lidAperture: 0.87,
      duchenne: 0.24,
      pupilDilate: 0.64,
      weights: {
        jawOpen: 0.0,
        sad: 0.66,
        browUpInner: 0.88,
        browFurrow: 0.26,
        chinRaise: 0.42,
        lipPress: 0.12,
        squint: 0.26
      }
    },
    {
      id: "surprised_awe",
      label: "Surprise & Awe · Wide Palpebral Eyes & Dropped Jaw",
      shortLabel: "Surprise / Awe",
      auSummary: "AU1+2+5+26 · Arched Brows, Wide Lids & Open Jaw",
      activeAUs: ["AU1", "AU2", "AU5", "AU22", "AU26"],
      autoSpeak: false,
      defaultHand: "spread_splay_awe",
      headPitch: -0.080,
      headRoll: -6.5 * DEG,
      headYaw: 0.02,
      gazeY: 0.06,
      lidAperture: 1.06,
      duchenne: 0.0,
      pupilDilate: 0.74,
      weights: {
        jawOpen: 0.62,
        mouthFunnel: 0.52,
        browUpInner: 0.86,
        browUpOuter: 0.90,
        wideEyes: 0.88,
        tongueLift: 0.06
      }
    },
    {
      id: "effort_strain_20kg",
      label: "20 kg Effort Grimace · Furrowed Glabella & Bared Teeth",
      shortLabel: "20 kg Strain",
      auSummary: "AU4+6+7+9+20+25 · Heavy Load Grimace",
      activeAUs: ["AU4", "AU6", "AU7", "AU9", "AU20", "AU25"],
      autoSpeak: false,
      strainTremor: 1.0,
      defaultHand: "clenched_fist_resolve",
      headPitch: 0.110,
      headRoll: -8.0 * DEG,
      headYaw: -0.03,
      gazeY: -0.05,
      lidAperture: 0.82,
      duchenne: 0.56,
      pupilDilate: 0.42,
      weights: {
        jawOpen: 0.28,
        browFurrow: 0.92,
        squint: 0.58,
        noseWrinkle: 0.80,
        mouthStretch: 0.58,
        chinRaise: 0.26,
        tongueLift: 0.15
      }
    },
    {
      id: "concerned_pleading",
      label: "Concerned / Pleading · Earnest +15° Oblique Lean",
      shortLabel: "Pleading / Call",
      auSummary: "AU1+4+22+26 · Earnest +15° Forward-Oblique Lean",
      activeAUs: ["AU1", "AU4", "AU22", "AU25", "AU26"],
      autoSpeak: false,
      defaultHand: "cupped_water_plea",
      headPitch: 0.085,
      headRoll: 15.0 * DEG,
      headYaw: 0.090,
      gazeY: 0.02,
      lidAperture: 0.92,
      duchenne: 0.22,
      pupilDilate: 0.56,
      weights: {
        jawOpen: 0.50,
        browUpInner: 0.84,
        browFurrow: 0.32,
        sad: 0.30,
        mouthFunnel: 0.44,
        wideEyes: 0.24,
        tongueLift: 0.18
      }
    },
    {
      id: "determined_focus",
      label: "Determined Focus · Locked Brow & Pressed Lips",
      shortLabel: "Determined",
      auSummary: "AU4+7+17+24 · Steely Resolve",
      activeAUs: ["AU4", "AU7", "AU17", "AU24"],
      autoSpeak: false,
      defaultHand: "clenched_fist_resolve",
      headPitch: 0.050,
      headRoll: -4.5 * DEG,
      headYaw: 0.0,
      gazeY: 0.02,
      lidAperture: 0.92,
      duchenne: 0.28,
      pupilDilate: 0.44,
      weights: {
        jawOpen: 0.0,
        browFurrow: 0.70,
        squint: 0.38,
        lipPress: 0.66,
        chinRaise: 0.28,
        noseWrinkle: 0.14
      }
    },
    {
      id: "relief_sigh",
      label: "Relief Sigh · Softened Lids & Warm Exhale Lean",
      shortLabel: "Relief Sigh",
      auSummary: "AU6+12+22+43 · Deep Exhale & +10.5° Soft Lean",
      activeAUs: ["AU6", "AU12", "AU22", "AU43"],
      autoSpeak: false,
      sighCycle: 1.0,
      defaultHand: "exhausted_brow_wipe",
      headPitch: 0.075,
      headRoll: 10.5 * DEG,
      headYaw: 0.025,
      gazeY: -0.08,
      lidDroop: 0.26,
      lidAperture: 0.76,
      duchenne: 0.38,
      pupilDilate: 0.52,
      weights: {
        jawOpen: 0.26,
        mouthFunnel: 0.42,
        smile: 0.36,
        browUpInner: 0.28,
        squint: 0.24
      }
    }
  ];

  const { arr: EMOTION_PRESETS, map: EMOTION_MAP } = buildDualPresetCollection(EMOTION_DEFS);

  /* ============================================================================
     2. 10 SPEECH & PHONEME VISEME PRESETS (TEETH + TONGUE + LIP SHAPING)
     ============================================================================ */
  const VISEME_DEFS = [
    {
      id: "SIL",
      label: "SIL · Closed Lip Rest",
      phonemes: "sil / pause",
      weights: { jawOpen: 0.0 }
    },
    {
      id: "AA",
      label: "AA · Open Vowel ('water', 'father')",
      phonemes: "ɑ / a / æ",
      weights: { jawOpen: 0.74, mouthFunnel: 0.08, mouthStretch: 0.18, smile: 0.10, tongueLift: 0.06 }
    },
    {
      id: "EE",
      label: "EE · Wide Spread ('see', 'wifi')",
      phonemes: "i / eɪ",
      weights: { jawOpen: 0.26, mouthStretch: 0.80, smile: 0.38, tongueLift: 0.38 }
    },
    {
      id: "IH",
      label: "IH · Mid-Front Vowel ('signal', 'in')",
      phonemes: "ɪ / ɛ / ə",
      weights: { jawOpen: 0.38, mouthStretch: 0.44, smile: 0.16, tongueLift: 0.30 }
    },
    {
      id: "OH",
      label: "OH · Open Rounded ('post', 'go')",
      phonemes: "oʊ / ɔ",
      weights: { jawOpen: 0.60, mouthFunnel: 0.72, tongueLift: 0.05 }
    },
    {
      id: "OO",
      label: "OO · Tight Rounded Funnel ('you', 'two')",
      phonemes: "u / w",
      weights: { jawOpen: 0.18, mouthFunnel: 0.98, chinRaise: 0.22 }
    },
    {
      id: "MM",
      label: "MM · Bilabial Lip Press ('mistletoe', 'map')",
      phonemes: "m / b / p",
      weights: { jawOpen: 0.0, lipPress: 0.94, chinRaise: 0.28, mouthStretch: 0.06 }
    },
    {
      id: "FF",
      label: "FF · Labiodental Tuck ('ford', 'ferry')",
      phonemes: "f / v",
      weights: { jawOpen: 0.15, lowerLipTuck: 0.92, noseWrinkle: 0.30, mouthStretch: 0.20 }
    },
    {
      id: "TH",
      label: "TH · Interdental Tongue Tip ('the', 'three')",
      phonemes: "θ / ð",
      weights: { jawOpen: 0.32, tongueLift: 0.58, tongueOut: 0.90, mouthStretch: 0.18 }
    },
    {
      id: "LL",
      label: "LL · Alveolar Tongue Lift ('light', 'listen')",
      phonemes: "l / n / t / d",
      weights: { jawOpen: 0.48, tongueLift: 0.96, tongueOut: 0.20, mouthStretch: 0.22, smile: 0.10 }
    }
  ];

  const { arr: VISEME_PRESETS, map: VISEME_MAP } = buildDualPresetCollection(VISEME_DEFS);

  // Natural conversational syllable phrases with realistic vowel-consonant alternation & breathing rests
  const SPEECH_PHRASE_BANKS = [
    ["SIL", "MM", "AA", "LL", "OH", "TH", "EE", "MM", "OO", "LL", "AA", "FF", "IH", "SIL"],
    ["SIL", "OH", "LL", "AA", "MM", "EE", "TH", "AA", "OO", "FF", "EE", "LL", "SIL", "SIL"],
    ["SIL", "FF", "OH", "LL", "AA", "TH", "IH", "MM", "OO", "AA", "EE", "LL", "MM", "SIL"],
    ["SIL", "TH", "EE", "AA", "MM", "OH", "LL", "OO", "IH", "FF", "AA", "MM", "SIL", "SIL"]
  ];

  /* ============================================================================
     3. 12 EXPRESSIVE 30-BONE HAND GESTURE PRESETS (+ 6 TOOL GRIP COMPATIBILITY)
     ============================================================================ */
  // Bind finger rest splays from HumanSculptV3.FINGER_BIND_SPECS:
  const BIND_FINGER_SPLAY = [0.044, 0.010, -0.022, -0.056];

  const HAND_GESTURE_DEFS = [
    {
      id: "relaxed_breathing",
      label: "1 · Relaxed Breathing Cascade",
      shortLabel: "Relaxed Rest",
      desc: "Natural cascading index-to-pinky rest curl with gentle breathing drift.",
      isToolGrip: false
    },
    {
      id: "spread_splay_awe",
      label: "2 · Wide Splayed Awe / Stop",
      shortLabel: "Splayed Awe",
      desc: "Wide MCP finger abduction fan, extended phalanges & abducted thumb in wonder/shock.",
      isToolGrip: false
    },
    {
      id: "talking_gesticulate",
      label: "3 · Animated Talking Hands",
      shortLabel: "Talking Hands",
      desc: "Phase-offset multi-finger conversational open/curl & wrist supination rhythm.",
      isToolGrip: false
    },
    {
      id: "cupped_water_plea",
      label: "4 · Cupped Water Offering / Plea",
      shortLabel: "Cupped Water",
      desc: "Tightly adducted palmar bowl with zero interdigital gaps & tucked thumb.",
      isToolGrip: false
    },
    {
      id: "joyful_wave",
      label: "5 · Joyful Highland Wave",
      shortLabel: "Joyful Wave",
      desc: "Open splayed hand with radial/ulnar wrist wave oscillation & finger flutter.",
      isToolGrip: false
    },
    {
      id: "pointing_call",
      label: "6 · Crisp Index Point & Call",
      shortLabel: "Pointing Call",
      desc: "Extended index finger with cleanly flexed middle/ring/pinky & locked thumb.",
      isToolGrip: false
    },
    {
      id: "heart_gratitude",
      label: "7 · Hand-to-Heart Gratitude",
      shortLabel: "Heart Gratitude",
      desc: "Warm, softly curved adducted fingers resting gently over sternum/heart.",
      isToolGrip: false
    },
    {
      id: "clenched_fist_resolve",
      label: "8 · Clenched Fist of Resolve",
      shortLabel: "Clenched Fist",
      desc: "Tight anatomical fist with thumb locked cleanly OVER dorsal index & middle phalanges.",
      isToolGrip: false
    },
    {
      id: "piano_finger_ripple",
      label: "9 · Piano 30-Bone Finger Ripple",
      shortLabel: "Piano Ripple",
      desc: "Sequential pinky -> ring -> middle -> index -> thumb wave across all 30 phalanges.",
      isToolGrip: false
    },
    {
      id: "brow_shade_lookout",
      label: "10 · Brow-Shade Horizon Lookout",
      shortLabel: "Brow Lookout",
      desc: "Flat, tightly adducted visor hand shading eyebrows while peering afar.",
      isToolGrip: false
    },
    {
      id: "shock_hands_cheeks",
      label: "11 · Shock Hands-to-Cheeks",
      shortLabel: "Shock Cheeks",
      desc: "Splayed open palms framing both cheeks & jaw in astonishment.",
      isToolGrip: false
    },
    {
      id: "exhausted_brow_wipe",
      label: "12 · Exhausted Forehead Wipe",
      shortLabel: "Brow Wipe",
      desc: "Softly curved dorsal/radial hand sweeping across forehead in relief.",
      isToolGrip: false
    }
  ];

  const TOOL_GRIP_DEFS = [
    { id: "dorsal_palmar",   label: "Tool · Open Dorsal/Palmar Inspection", isToolGrip: true, v3Mode: "flat",      curl: 0.08, spread: 0.38 },
    { id: "pump_bar",        label: "Tool · Cast-Iron Pump Bar Lock",       isToolGrip: true, v3Mode: "pumpBar",   curl: 0.94, spread: 0.18 },
    { id: "jerrycan_handle", label: "Tool · 20 L Jerrycan Handle Thread",   isToolGrip: true, v3Mode: "handleTop", curl: 0.92, spread: 0.18 },
    { id: "phone_cradle",    label: "Tool · Cyan Smartphone Cradle",        isToolGrip: true, v3Mode: "cradle",    curl: 0.64, spread: 0.28 },
    { id: "pen_pinch",       label: "Tool · Archive Tripod Pen Pinch",      isToolGrip: true, v3Mode: "pinch",     curl: 0.62, spread: 0.10 },
    { id: "vhf_handset",     label: "Tool · VHF Radio Handset Wrap",        isToolGrip: true, v3Mode: "wrap",      curl: 0.84, spread: 0.20 }
  ];

  const { arr: HAND_GESTURE_PRESETS, map: HAND_GESTURE_MAP } = buildDualPresetCollection(HAND_GESTURE_DEFS);
  const TOOL_GRIP_PRESETS = {};
  for (let i = 0; i < TOOL_GRIP_DEFS.length; i++) {
    const tg = TOOL_GRIP_DEFS[i];
    TOOL_GRIP_PRESETS[tg.id] = tg;
    HAND_GESTURE_MAP[tg.id] = tg;
    Object.defineProperty(HAND_GESTURE_PRESETS, tg.id, {
      value: tg,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }

  const ACTIVE_PROP_GRIP_MODES = new Set([
    "pumpBar", "handleTop", "underRib", "ribBottom", "cradle", "sideWrap", "pinch",
    "pump_bar", "jerrycan_handle", "phone_cradle", "pen_pinch", "vhf_handset"
  ]);

  /* ============================================================================
     4. SILENT ZERO-404 EXPRESSION/VISEME PRIORS LOADER
     ============================================================================ */
  const SCRIPT_SRC = (typeof document !== "undefined" && document.currentScript && document.currentScript.src) || "";
  function resolveTexturesV3Dir(overrideBase) {
    if (overrideBase) {
      const b = overrideBase.endsWith("/") ? overrideBase : overrideBase + "/";
      return b.endsWith("textures_v3/") ? b : b + "textures_v3/";
    }
    if (SCRIPT_SRC) {
      try {
        return new URL("./textures_v3/", SCRIPT_SRC).href;
      } catch (_e) { /* ignore */ }
    }
    if (typeof location !== "undefined" && location.pathname) {
      const p = location.pathname;
      if (p.indexOf("/night-post/") >= 0 || p.indexOf("/zones/") >= 0 || p.indexOf("/study/") >= 0) {
        return "../donkey/textures_v3/";
      }
    }
    return "./textures_v3/";
  }

  const expressionPriorsState = {
    checked: false,
    loaded: false,
    data: null
  };

  function loadExpressionPriors(donkeyBaseUrl) {
    if (expressionPriorsState.checked || typeof fetch !== "function") return;
    expressionPriorsState.checked = true;
    const v3Dir = resolveTexturesV3Dir(donkeyBaseUrl);
    fetch(v3Dir + "expression_viseme_priors.json")
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (json) {
          expressionPriorsState.loaded = true;
          expressionPriorsState.data = json;
        }
      })
      .catch(() => {});
  }

  /* ============================================================================
     5. 30-BONE ANATOMICAL HAND PHALANX + WRIST + FOREARM TWIST POSE ENGINE
     ============================================================================ */
  /* Coordinate conventions verified against HumanSculptV3.getWatertightHandGeos:
     - Finger shafts point along -Y in bind pose.
     - Flexion into palm:   rz = -side * flexRad  (flexRad > 0 curls into palm; < 0 hyperextends)
     - Abduction / splay:   rx < 0 splays toward +Z (Radial / Index); rx > 0 splays toward -Z (Ulnar / Pinky).
                            rx = +BIND_FINGER_SPLAY[i] cancels bind splay for 0.0mm tight adduction!
     - Axial finger twist:  ry
     - Thumb:               th1.rx > 0 sweeps/adducts thumb across palm (+Z -> -Z); th1.rx < 0 abducts thumb wide back into +Z.
                            th1.rz = -side * val swings thumb palmarward (-side*X) to clear or oppose fingers! */
  function applyExpressiveHandBones(bones, B, side, gestureId, t = 0, intensity = 1.0) {
    const amt = clamp(intensity, 0, 1.25);
    const baseIdx = side > 0 ? B.L_THUMB_1 : B.R_THUMB_1;
    const bHand = side > 0 ? B.HAND_L : B.HAND_R;
    const bTwist = side > 0 ? B.FARM_TWIST_L : B.FARM_TWIST_R;
    const th1 = bones[baseIdx], th2 = bones[baseIdx + 1], th3 = bones[baseIdx + 2];
    if (!th1 || !bones[bHand]) return;

    // Handle tool-grip compatibility presets directly via HumanSculptV3.poseHandPhalanges if available
    const tg = TOOL_GRIP_PRESETS[gestureId];
    if (tg) {
      if (typeof window !== "undefined" && window.HumanSculptV3 && window.HumanSculptV3.poseHandPhalanges) {
        window.HumanSculptV3.poseHandPhalanges(bones, side, tg.curl * amt, tg.spread, tg.v3Mode, t);
      }
      return;
    }

    const ph = t + (side > 0 ? 0.0 : 0.65);

    // Per-finger [mcpFlex, pipFlex, dipFlex, splayRx, axialRy] for index(0), mid(1), ring(2), pinky(3)
    const fPose = [
      [0.20, 0.24, 0.14, 0.0, 0.0],
      [0.25, 0.30, 0.18, 0.0, 0.0],
      [0.30, 0.36, 0.22, 0.0, 0.0],
      [0.35, 0.42, 0.26, 0.0, 0.0]
    ];
    // Thumb [th1Rx, th1Ry, th1RzFlex, th2Rx, th2RzFlex, th3Rx, th3RzFlex]
    let thPose = [0.16, 0.14, 0.12, 0.10, 0.14, 0.08, 0.14];
    // Additive wrist & forearm pronation/supination offsets: [wristRxUlnar, wristRyTwist, wristRzFlex, forearmTwistY]
    let wristAdd = [0, 0, 0, 0];

    if (gestureId === "spread_splay_awe") {
      const pulse = 1.0 + 0.06 * Math.sin(ph * 2.6);
      // Wide radial-to-ulnar abduction fan (-0.25 index -> +0.28 pinky = ~30° full hand fan!) + slight dorsal extension
      const splayRx = [-0.25 * pulse, -0.075 * pulse, 0.095 * pulse, 0.28 * pulse];
      for (let i = 0; i < 4; i++) {
        fPose[i][0] = -0.09; // Slight hyperextension in shock/wonder!
        fPose[i][1] = 0.03;
        fPose[i][2] = 0.02;
        fPose[i][3] = splayRx[i];
      }
      // Abduct thumb wide back & radially (+Z, +side*X)
      thPose = [-0.42 * pulse, -0.16, -0.22, -0.06, -0.04, -0.04, -0.04];
      wristAdd = [-0.04, 0.0, 0.18, side * 0.18]; // Slight wrist extension
    } else if (gestureId === "talking_gesticulate") {
      const beat1 = Math.sin(t * 3.8 + (side > 0 ? 0.0 : 1.9));
      const beat2 = Math.sin(t * 6.4 + (side > 0 ? 0.5 : 2.6));
      const open = 0.5 + 0.5 * (0.68 * beat1 + 0.32 * beat2); // 0 = softly gathered, 1 = expressive open emphasis
      const splayFan = [-0.15, -0.04, 0.06, 0.17];
      for (let i = 0; i < 4; i++) {
        const lag = Math.sin(t * 3.8 - i * 0.32 + (side > 0 ? 0.0 : 1.9));
        const c = lerp(0.56, 0.06, clamp(0.5 + 0.5 * lag, 0, 1)) + i * 0.05;
        fPose[i][0] = c * 0.72;
        fPose[i][1] = c * 0.85;
        fPose[i][2] = c * 0.48;
        fPose[i][3] = splayFan[i] * lerp(0.25, 1.0, open);
      }
      thPose = [lerp(0.18, -0.22, open), 0.10, lerp(0.24, -0.06, open), 0.10, 0.12, 0.08, 0.10];
      wristAdd = [0.14 * beat1, 0.0, 0.10 * beat2, side * (0.28 + 0.24 * beat1)];
    } else if (gestureId === "cupped_water_plea") {
      // Tightly adducted fingers (FK-solved fingertip adduction -> 0.0mm inter-finger gap into concave water bowl!)
      const cupFlex = [
        [0.44, 0.50, 0.32],
        [0.48, 0.54, 0.35],
        [0.52, 0.58, 0.38],
        [0.58, 0.64, 0.42]
      ];
      const cupAdductRx = [0.28, 0.09, -0.10, -0.30];
      for (let i = 0; i < 4; i++) {
        fPose[i][0] = cupFlex[i][0];
        fPose[i][1] = cupFlex[i][1];
        fPose[i][2] = cupFlex[i][2];
        fPose[i][3] = cupAdductRx[i];
        fPose[i][4] = (i - 1.5) * 0.03;
      }
      // Tuck thumb snugly along radial side of index finger to seal the water cup!
      thPose = [0.38, 0.24, 0.20, 0.26, 0.22, 0.18, 0.18];
      wristAdd = [-0.08, 0.0, -0.14, side * 0.55];
    } else if (gestureId === "joyful_wave") {
      const wave = Math.sin(t * 6.2 + (side > 0 ? 0.0 : Math.PI));
      const splayRx = [-0.18, -0.05, 0.07, 0.20];
      for (let i = 0; i < 4; i++) {
        const flutter = 0.05 * Math.sin(t * 8.4 - i * 0.55);
        fPose[i][0] = 0.02 + flutter;
        fPose[i][1] = 0.06 + Math.max(0, flutter);
        fPose[i][2] = 0.04;
        fPose[i][3] = splayRx[i];
      }
      thPose = [-0.30, -0.10, -0.10, 0.04, 0.06, 0.04, 0.04];
      // Side-to-side radial/ulnar wave oscillation around hand X axis!
      wristAdd = [0.30 * wave, 0.0, 0.10, 0.0];
    } else if (gestureId === "pointing_call") {
      // Index crisp & extended; Middle, Ring, Pinky flexed tightly into palm without self-intersection!
      fPose[0] = [-0.02, 0.04, 0.02, -0.02, 0.0];
      fPose[1] = [1.56, 1.84, 1.30, 0.01, 0.0];
      fPose[2] = [1.62, 1.88, 1.34, -0.02, 0.0];
      fPose[3] = [1.66, 1.90, 1.36, -0.05, 0.0];
      // FK-solved thumb locked snugly over dorsal middle phalanx of flexed middle finger!
      thPose = [0.08, 0.00, 0.50, 1.06, 0.22, 0.65, 0.25];
      wristAdd = [-0.06, 0.0, 0.08 + 0.04 * Math.sin(t * 2.8), 0.0];
    } else if (gestureId === "heart_gratitude") {
      const breath = 0.03 * Math.sin(t * 2.1);
      const heartAdduct = [0.115, 0.035, -0.045, -0.125];
      for (let i = 0; i < 4; i++) {
        fPose[i][0] = 0.16 + i * 0.03 + breath;
        fPose[i][1] = 0.22 + i * 0.03;
        fPose[i][2] = 0.14 + i * 0.02;
        fPose[i][3] = heartAdduct[i]; // Softly adducted warm palm
      }
      thPose = [0.22, 0.14, 0.12, 0.12, 0.14, 0.10, 0.10];
      wristAdd = [0.05, 0.0, -0.08, 0.0];
    } else if (gestureId === "clenched_fist_resolve") {
      // True closed anatomical fist: distal pads press into palmar hollow (-X = -0.009m, ZERO tunnel & ZERO dorsal poke-through),
      // and FK-solved thumb locks snugly across dorsal middle phalanges of index & middle (IP@z=0.028 -> TIP@z=0.005)!
      const fistFlex = [
        [1.56, 1.84, 1.32],
        [1.60, 1.86, 1.34],
        [1.64, 1.88, 1.36],
        [1.68, 1.90, 1.38]
      ];
      const fistAdduct = [0.085, 0.025, -0.032, -0.095];
      for (let i = 0; i < 4; i++) {
        fPose[i][0] = fistFlex[i][0];
        fPose[i][1] = fistFlex[i][1];
        fPose[i][2] = fistFlex[i][2];
        fPose[i][3] = fistAdduct[i];
      }
      thPose = [-0.02, 0.00, 0.52, 1.08, -0.06, 0.65, 0.14];
      wristAdd = [0.04, 0.0, 0.08, 0.0];
    } else if (gestureId === "piano_finger_ripple") {
      // Traveling sequential pinky(3) -> ring(2) -> mid(1) -> index(0) -> thumb wave across all 30 phalanges!
      for (let i = 0; i < 4; i++) {
        const w = 0.5 + 0.5 * Math.sin(t * 4.8 + (3 - i) * 0.82 + (side > 0 ? 0.0 : 1.6));
        const wSharp = Math.pow(w, 1.45);
        fPose[i][0] = lerp(-0.06, 0.96, wSharp);
        fPose[i][1] = lerp(0.04, 1.18, wSharp);
        fPose[i][2] = lerp(0.02, 0.78, wSharp);
        fPose[i][3] = (i - 1.5) * 0.085 * (1.0 - 0.5 * wSharp);
      }
      const tw = Math.pow(0.5 + 0.5 * Math.sin(t * 4.8 + 4.0 * 0.82 + (side > 0 ? 0.0 : 1.6)), 1.45);
      thPose = [lerp(-0.24, 0.42, tw), lerp(-0.08, 0.24, tw), lerp(-0.08, 0.48, tw), tw * 0.34, tw * 0.32, tw * 0.28, tw * 0.34];
      wristAdd = [0.12 * Math.sin(t * 2.4), 0.0, 0.08 * Math.cos(t * 2.4), side * 0.16 * Math.sin(t * 2.4)];
    } else if (gestureId === "brow_shade_lookout") {
      // Flat, razor-aligned adducted visor hand shading the brow!
      for (let i = 0; i < 4; i++) {
        fPose[i][0] = 0.04;
        fPose[i][1] = 0.05;
        fPose[i][2] = 0.03;
        fPose[i][3] = BIND_FINGER_SPLAY[i] * 1.05;
      }
      thPose = [0.26, 0.16, 0.08, 0.08, 0.06, 0.06, 0.04];
      wristAdd = [0.06, 0.0, 0.0, 0.0];
    } else if (gestureId === "shock_hands_cheeks") {
      const tremble = 0.025 * Math.sin(t * 9.0);
      const splayRx = [-0.18, -0.05, 0.06, 0.19];
      for (let i = 0; i < 4; i++) {
        fPose[i][0] = 0.14 + tremble;
        fPose[i][1] = 0.18;
        fPose[i][2] = 0.12;
        fPose[i][3] = splayRx[i];
      }
      thPose = [-0.24, -0.06, 0.04, 0.08, 0.08, 0.06, 0.06];
      wristAdd = [0.0, 0.0, 0.14, 0.0];
    } else if (gestureId === "exhausted_brow_wipe") {
      for (let i = 0; i < 4; i++) {
        fPose[i][0] = 0.28 + i * 0.04;
        fPose[i][1] = 0.36 + i * 0.04;
        fPose[i][2] = 0.22 + i * 0.03;
        fPose[i][3] = BIND_FINGER_SPLAY[i] * 0.70;
      }
      thPose = [0.20, 0.14, 0.16, 0.14, 0.14, 0.10, 0.12];
      wristAdd = [0.10 * Math.sin(t * 1.8), 0.0, -0.10, 0.0];
    } else {
      // relaxed_breathing
      const drift = 0.035 * Math.sin(ph * 1.7);
      for (let i = 0; i < 4; i++) {
        fPose[i][0] = 0.18 + i * 0.055 + drift;
        fPose[i][1] = 0.24 + i * 0.065 + drift;
        fPose[i][2] = 0.14 + i * 0.040;
        fPose[i][3] = 0.0;
      }
      thPose = [0.16, 0.12, 0.10 + drift, 0.08, 0.12, 0.08, 0.12];
    }

    // Apply 3-DOF rotations onto all 12 finger phalanges
    for (let i = 0; i < 4; i++) {
      const fBase = baseIdx + 3 + i * 3;
      const mcp = bones[fBase], pip = bones[fBase + 1], dip = bones[fBase + 2];
      const fp = fPose[i];
      const mcpFlex = lerp(0.20 + i * 0.05, fp[0], amt);
      const pipFlex = lerp(0.24 + i * 0.06, fp[1], amt);
      const dipFlex = lerp(0.14 + i * 0.04, fp[2], amt);
      const splayRx = fp[3] * amt;
      const axialRy = side * fp[4] * amt;

      mcp.rotation.set(splayRx, axialRy, -side * mcpFlex, "XZY");
      pip.rotation.set(0, 0, -side * pipFlex);
      dip.rotation.set(0, 0, -side * dipFlex);
    }

    // Apply 3-DOF rotations onto all 3 thumb phalanges
    th1.rotation.set(
      lerp(0.14, thPose[0], amt),
      side * lerp(0.12, thPose[1], amt),
      -side * lerp(0.10, thPose[2], amt),
      "YZX"
    );
    th2.rotation.set(lerp(0.06, thPose[3], amt), 0, -side * lerp(0.10, thPose[4], amt));
    th3.rotation.set(lerp(0.06, thPose[5], amt), 0, -side * lerp(0.10, thPose[6], amt));

    // Layer subtle wrist & forearm pronation/supination offsets cleanly on top of current IK wrist orientation
    if (wristAdd[0] || wristAdd[1] || wristAdd[2]) {
      bones[bHand].rotateX(wristAdd[0] * amt);
      bones[bHand].rotateY(side * wristAdd[1] * amt);
      bones[bHand].rotateZ(-side * wristAdd[2] * amt);
    }
    if (wristAdd[3] && bones[bTwist]) {
      bones[bTwist].rotateY(wristAdd[3] * amt);
    }
  }

  /* ============================================================================
     6. FULL UPPER-BODY EXPRESSIVE ARM IK SOLVER (ch.applyExpressiveArmPose)
     ============================================================================ */
  let armIkScratch = null;
  function getArmIkScratch(T) {
    if (armIkScratch) return armIkScratch;
    armIkScratch = {
      S: new T.Vector3(),
      Tgt: new T.Vector3(),
      D: new T.Vector3(),
      uD: new T.Vector3(),
      Pole: new T.Vector3(),
      N: new T.Vector3(),
      uP: new T.Vector3(),
      J: new T.Vector3(),
      dir1: new T.Vector3(),
      dir2: new T.Vector3(),
      xAx: new T.Vector3(),
      yAx: new T.Vector3(),
      zAx: new T.Vector3(),
      mUpper: new T.Matrix4(),
      mLower: new T.Matrix4(),
      mHand: new T.Matrix4(),
      qParentInv: new T.Quaternion(),
      qUpperWorld: new T.Quaternion(),
      qLowerWorld: new T.Quaternion(),
      qHandWorld: new T.Quaternion(),
      qSaveU: new T.Quaternion(),
      qSaveF: new T.Quaternion(),
      qSaveTw: new T.Quaternion(),
      qSaveH: new T.Quaternion(),
      grpQuat: new T.Quaternion(),
      pWorldL: new T.Vector3(),
      pWorldR: new T.Vector3(),
      palmWorldL: new T.Vector3(),
      palmWorldR: new T.Vector3(),
      fDirWorldL: new T.Vector3(),
      fDirWorldR: new T.Vector3(),
      poleWorld: new T.Vector3(),
      fArmDir: new T.Vector3(),
      fDir: new T.Vector3(),
      pNrm: new T.Vector3(),
      qRel: new T.Quaternion()
    };
    return armIkScratch;
  }

  function solveTwoBoneArmIK(sc, clavBone, uarmBone, farmBone, targetWorld, poleWorld, l1, l2, charScale) {
    clavBone.updateWorldMatrix(true, false);
    uarmBone.updateWorldMatrix(true, false);
    uarmBone.getWorldPosition(sc.S);

    const a = l1 * charScale;
    const b = l2 * charScale;
    sc.D.subVectors(targetWorld, sc.S);
    const rawDist = sc.D.length();
    const d = clamp(rawDist, Math.abs(a - b) + 0.008, (a + b) * 0.992);
    if (rawDist > 1e-6) sc.uD.copy(sc.D).divideScalar(rawDist);
    else sc.uD.set(0, -1, 0);

    // Project pole orthogonal to uD
    sc.uP.copy(poleWorld).addScaledVector(sc.uD, -poleWorld.dot(sc.uD));
    if (sc.uP.lengthSq() < 1e-6) sc.uP.set(0, -0.3, -1).addScaledVector(sc.uD, -sc.uD.z * -1);
    sc.uP.normalize();

    const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    sc.J.copy(sc.S).addScaledVector(sc.uD, a * cosA).addScaledVector(sc.uP, a * sinA);

    // Bind arm points along -Y!
    sc.dir1.subVectors(sc.J, sc.S).normalize();
    sc.yAx.copy(sc.dir1).negate();
    sc.xAx.crossVectors(sc.yAx, sc.uP);
    if (sc.xAx.lengthSq() < 1e-6) sc.xAx.set(1, 0, 0);
    sc.xAx.normalize();
    sc.zAx.crossVectors(sc.xAx, sc.yAx).normalize();
    sc.mUpper.makeBasis(sc.xAx, sc.yAx, sc.zAx);
    sc.qUpperWorld.setFromRotationMatrix(sc.mUpper);

    clavBone.getWorldQuaternion(sc.qParentInv).invert();
    uarmBone.quaternion.copy(sc.qParentInv).multiply(sc.qUpperWorld);
    uarmBone.updateMatrixWorld(true);

    sc.Tgt.copy(sc.S).addScaledVector(sc.uD, d);
    sc.dir2.subVectors(sc.Tgt, sc.J).normalize();
    sc.yAx.copy(sc.dir2).negate();
    sc.zAx.crossVectors(sc.xAx, sc.yAx);
    if (sc.zAx.lengthSq() < 1e-6) sc.zAx.set(0, 0, 1);
    sc.zAx.normalize();
    sc.xAx.crossVectors(sc.yAx, sc.zAx).normalize();
    sc.mLower.makeBasis(sc.xAx, sc.yAx, sc.zAx);
    sc.qLowerWorld.setFromRotationMatrix(sc.mLower);

    uarmBone.getWorldQuaternion(sc.qParentInv).invert();
    farmBone.quaternion.copy(sc.qParentInv).multiply(sc.qLowerWorld);
    farmBone.updateMatrixWorld(true);
  }

  function applyExpressiveArmChain(T, ch, gestureId, t = 0, intensity = 1.0) {
    const V3 = typeof window !== "undefined" ? window.HumanSculptV3 : null;
    if (!V3 || !ch || !ch.bones || !ch.group) return;
    const B = V3.B;
    const bones = ch.bones;
    const amt = clamp(intensity, 0, 1);
    if (amt < 0.005) return;

    const sc = getArmIkScratch(T);
    const charScale = ch.group.scale.x || 1.0;
    const shX = Math.abs(bones[B.UARM_L].userData.worldBind ? bones[B.UARM_L].userData.worldBind.x : 0.175);

    // Default neutral standing hands
    let lPos = [shX + 0.04, 0.86, 0.05], rPos = [-shX - 0.04, 0.86, 0.05];
    let lPalm = [-0.90, -0.10, -0.35],   rPalm = [0.90, -0.10, -0.35];
    let lFDir = [0, -0.96, 0.28],        rFDir = [0, -0.96, 0.28];
    let lPole = [0.55, -0.45, -0.70],    rPole = [-0.55, -0.45, -0.70];
    let clavL = 0, clavR = 0;
    let activeL = true, activeR = true;

    if (gestureId === "spread_splay_awe") {
      const lift = 0.015 * Math.sin(t * 2.4);
      lPos = [0.25, 1.33 + lift, 0.28];   rPos = [-0.25, 1.33 + lift, 0.28];
      lPalm = [-0.18, 0.12, 0.97];        rPalm = [0.18, 0.12, 0.97];
      lFDir = [0.14, 0.97, -0.12];        rFDir = [-0.14, 0.97, -0.12];
      lPole = [0.65, -0.55, -0.45];       rPole = [-0.65, -0.55, -0.45];
      clavL = 0.08; clavR = 0.08;
    } else if (gestureId === "talking_gesticulate") {
      const s1 = Math.sin(t * 3.4), c1 = Math.cos(t * 2.7);
      lPos = [0.19 + 0.04 * s1, 1.15 + 0.045 * c1, 0.31 + 0.03 * s1];
      rPos = [-0.19 + 0.04 * c1, 1.17 - 0.045 * s1, 0.32 - 0.03 * c1];
      lPalm = [-0.52, 0.76, 0.38];        rPalm = [0.52, 0.76, 0.38];
      lFDir = [-0.12, 0.22, 0.96];        rFDir = [0.12, 0.22, 0.96];
      lPole = [0.62, -0.50, -0.60];       rPole = [-0.62, -0.50, -0.60];
    } else if (gestureId === "cupped_water_plea") {
      const bob = 0.012 * Math.sin(t * 1.9);
      // Two-handed cupped water bowl held forward at chest/offering height with ulnar pinky edges kissing into one bowl!
      lPos = [0.036, 1.15 + bob, 0.34];   rPos = [-0.036, 1.15 + bob, 0.34];
      lPalm = [-0.15, 0.97, 0.18];        rPalm = [0.15, 0.97, 0.18];
      lFDir = [-0.04, 0.14, 0.98];        rFDir = [0.04, 0.14, 0.98];
      lPole = [0.52, -0.55, -0.62];       rPole = [-0.52, -0.55, -0.62];
    } else if (gestureId === "joyful_wave") {
      const sw = Math.sin(t * 6.2);
      // Right hand raised high in highland greeting wave; left hand lively open poise at mid-rib!
      rPos = [-0.27 - 0.045 * sw, 1.56 + 0.015 * Math.abs(sw), 0.22];
      rPalm = [0.12, 0.08, 0.99];
      rFDir = [-0.12 + 0.24 * sw, 0.97, -0.08];
      rPole = [-0.72, -0.45, -0.35];
      clavR = 0.16;
      lPos = [0.21, 1.10 + 0.02 * sw, 0.22];
      lPalm = [-0.55, 0.65, 0.52];
      lFDir = [0.08, 0.35, 0.93];
    } else if (gestureId === "pointing_call") {
      const reach = 0.015 * Math.sin(t * 2.6);
      // Right arm extended forward & slightly up pointing toward horizon; left hand near collarbone/call!
      rPos = [-0.14, 1.39 + reach, 0.48 + reach];
      rPalm = [0.38, -0.88, 0.24];
      rFDir = [-0.06, 0.14, 0.98];
      rPole = [-0.62, -0.55, -0.42];
      clavR = 0.10;
      lPos = [0.13, 1.26, 0.24];
      lPalm = [-0.72, 0.45, 0.52];
      lFDir = [-0.12, 0.62, 0.77];
    } else if (gestureId === "heart_gratitude") {
      // Right palm resting warmly over upper sternum/heart; left hand cleanly offset below/forward so zero wrist/finger overlap!
      rPos = [-0.015, 1.280, 0.192];
      rPalm = [0.14, -0.18, -0.97];
      rFDir = [0.84, 0.50, 0.18];
      rPole = [-0.68, -0.48, -0.32];
      lPos = [0.075, 1.155, 0.238];
      lPalm = [-0.18, 0.12, -0.97];
      lFDir = [-0.84, 0.48, 0.20];
      lPole = [0.68, -0.48, -0.32];
    } else if (gestureId === "clenched_fist_resolve") {
      rPos = [-0.14, 1.24, 0.28];
      rPalm = [0.82, 0.22, -0.52];
      rFDir = [0.18, 0.88, 0.44];
      rPole = [-0.65, -0.50, -0.50];
      lPos = [0.16, 1.12, 0.24];
      lPalm = [-0.84, 0.22, -0.48];
      lFDir = [-0.16, 0.78, 0.60];
      lPole = [0.65, -0.50, -0.50];
    } else if (gestureId === "piano_finger_ripple") {
      // Present both hands clearly at chest/camera showcase height so all 30 rippling phalanges read cleanly!
      lPos = [0.15, 1.19, 0.35];          rPos = [-0.15, 1.19, 0.35];
      lPalm = [-0.25, -0.82, 0.50];       rPalm = [0.25, -0.82, 0.50];
      lFDir = [-0.05, -0.32, 0.94];       rFDir = [0.05, -0.32, 0.94];
      lPole = [0.62, -0.50, -0.55];       rPole = [-0.62, -0.50, -0.55];
    } else if (gestureId === "brow_shade_lookout") {
      // Right hand horizontal sun-visor just above supraorbital brow ridge!
      rPos = [-0.055, 1.652, 0.165];
      rPalm = [0.08, -0.94, -0.32];
      rFDir = [0.95, 0.04, 0.30];
      rPole = [-0.78, -0.22, 0.18];
      clavR = 0.16;
      activeL = false;
    } else if (gestureId === "shock_hands_cheeks") {
      // Splayed palms framing cheeks cleanly (+24mm lateral clearance so zero cheek/beard clipping!)
      lPos = [0.098, 1.505, 0.145];       rPos = [-0.098, 1.505, 0.145];
      lPalm = [-0.90, 0.22, -0.36];       rPalm = [0.90, 0.22, -0.36];
      lFDir = [-0.10, 0.96, 0.24];        rFDir = [0.10, 0.96, 0.24];
      lPole = [0.68, -0.52, 0.12];        rPole = [-0.68, -0.52, 0.12];
      clavL = 0.10; clavR = 0.10;
    } else if (gestureId === "exhausted_brow_wipe") {
      const wipe = Math.sin(t * 1.8);
      rPos = [-0.02 + 0.055 * wipe, 1.648, 0.162];
      rPalm = [0.16, -0.30, 0.94];
      rFDir = [0.94, 0.12, -0.32];
      rPole = [-0.76, -0.25, 0.18];
      clavR = 0.15;
      activeL = false;
    } else {
      return; // relaxed_breathing leaves scene's arm pose untouched
    }

    ch.group.updateMatrixWorld(true);
    ch.group.getWorldQuaternion(sc.grpQuat);

    const solveSide = (side, posArr, palmArr, fDirArr, poleArr, clavLift) => {
      const bCl = side > 0 ? B.CLAV_L : B.CLAV_R;
      const bUA = side > 0 ? B.UARM_L : B.UARM_R;
      const bEV = side > 0 ? B.ELBOW_VOL_L : B.ELBOW_VOL_R;
      const bFA = side > 0 ? B.FARM_L : B.FARM_R;
      const bTw = side > 0 ? B.FARM_TWIST_L : B.FARM_TWIST_R;
      const bHa = side > 0 ? B.HAND_L : B.HAND_R;

      sc.qSaveU.copy(bones[bUA].quaternion);
      sc.qSaveF.copy(bones[bFA].quaternion);
      sc.qSaveTw.copy(bones[bTw].quaternion);
      sc.qSaveH.copy(bones[bHa].quaternion);

      if (clavLift) {
        bones[bCl].rotateZ(side * clavLift * amt);
      }

      const pWorld = side > 0 ? sc.pWorldL : sc.pWorldR;
      const palmW = side > 0 ? sc.palmWorldL : sc.palmWorldR;
      const fDirW = side > 0 ? sc.fDirWorldL : sc.fDirWorldR;

      pWorld.set(posArr[0], posArr[1], posArr[2]).applyMatrix4(ch.group.matrixWorld);
      palmW.set(palmArr[0], palmArr[1], palmArr[2]).applyQuaternion(sc.grpQuat).normalize();
      fDirW.set(fDirArr[0], fDirArr[1], fDirArr[2]).applyQuaternion(sc.grpQuat).normalize();
      sc.poleWorld.set(poleArr[0], poleArr[1], poleArr[2]).applyQuaternion(sc.grpQuat).normalize();

      // Offset wrist back from palm center (~0.055m along -fDirW) so posArr specifies true hand/palm acting center!
      pWorld.addScaledVector(fDirW, -0.055 * charScale);

      solveTwoBoneArmIK(sc, bones[bCl], bones[bUA], bones[bFA], pWorld, sc.poleWorld, 0.275, 0.255, charScale);
      V3.solveWristTwistAndElbowVolume(sc, bones[bFA], bones[bTw], bones[bEV], bones[bHa], side, palmW, fDirW, 0.95);

      if (amt < 0.999) {
        bones[bUA].quaternion.copy(sc.qSaveU).slerp(bones[bUA].quaternion, amt);
        bones[bFA].quaternion.copy(sc.qSaveF).slerp(bones[bFA].quaternion, amt);
        bones[bTw].quaternion.copy(sc.qSaveTw).slerp(bones[bTw].quaternion, amt);
        bones[bHa].quaternion.copy(sc.qSaveH).slerp(bones[bHa].quaternion, amt);
        V3.updateKneeVolumeHelper(bones[bFA], bones[bEV]);
      }
      applyExpressiveHandBones(bones, B, side, gestureId, t, amt);
    };

    if (activeL) solveSide(1, lPos, lPalm, lFDir, lPole, clavL);
    if (activeR) solveSide(-1, rPos, rPalm, rFDir, rPole, clavR);
  }

  /* ============================================================================
     7. COARTICULATED SYLLABIC SPEECH ENVELOPE & VISEME GENERATOR
     ============================================================================ */
  function sampleSpeechVisemes(phraseSeed, t, intensity, outWeights) {
    const amt = clamp(intensity, 0, 1.35);
    const hSeed = hashString(phraseSeed);

    // If 20Hz priors JSON is loaded and has a matching curve, blend/use its rhythmic envelope
    let priorJawBoost = 1.0;
    if (expressionPriorsState.loaded && expressionPriorsState.data && Array.isArray(expressionPriorsState.data.speech_envelope_20hz)) {
      const envArr = expressionPriorsState.data.speech_envelope_20hz;
      if (envArr.length > 2) {
        const idxF = Math.abs(t * 20.0 + hSeed * 17.0) % envArr.length;
        const i0 = Math.floor(idxF), i1 = (i0 + 1) % envArr.length;
        priorJawBoost = 0.78 + 0.36 * lerp(envArr[i0] || 0.5, envArr[i1] || 0.5, idxF - i0);
      }
    }

    const bankIdx = Math.floor(hSeed * 10) % SPEECH_PHRASE_BANKS.length;
    const seq = SPEECH_PHRASE_BANKS[bankIdx];
    const syllRate = 5.4 + 0.5 * Math.sin(hSeed * 3.1); // ~5.4 syllables/sec natural human speech rate
    const pos = Math.max(0, t * syllRate + hSeed * 7.3);
    const idx0 = Math.floor(pos) % seq.length;
    const idx1 = (idx0 + 1) % seq.length;
    const u = smooth(0.12, 0.88, pos - Math.floor(pos));

    const v0 = VISEME_MAP[seq[idx0]] || VISEME_MAP.SIL;
    const v1 = VISEME_MAP[seq[idx1]] || VISEME_MAP.SIL;

    // Prosodic syllable stress envelope (natural breath phrasing every ~2.6s)
    const phraseWave = 0.72 + 0.28 * Math.sin(t * 2.3 + hSeed);
    const syllPulse = 0.84 + 0.22 * Math.sin((pos - Math.floor(pos)) * Math.PI);
    const scale = amt * phraseWave * syllPulse * priorJawBoost;

    for (let i = 0; i < FACS_KEYS.length; i++) {
      const k = FACS_KEYS[i];
      const w = lerp(v0.weights[k] || 0, v1.weights[k] || 0, u) * scale;
      outWeights[k] = Math.max(outWeights[k] || 0, clamp(w, 0, 1.15));
    }

    // Conversational brow & head micro-phrasing on stressed open vowels
    const vowelEnergy = outWeights.jawOpen;
    outWeights.browUpInner = clamp((outWeights.browUpInner || 0) + 0.22 * vowelEnergy * amt, 0, 1);
    outWeights.browUpOuter = clamp((outWeights.browUpOuter || 0) + 0.25 * vowelEnergy * amt, 0, 1);

    return u < 0.5 ? v0.id : v1.id;
  }

  /* ============================================================================
     7B. ANATOMICAL 3-JOINT SUPPLE CERVICAL NECK-LEANING ARC SOLVER (C1–C7 + RIB/CLAV)
     Distributes lateral lean (`rz` up to ±26.5°), pitch (`rx` up to ±24°), turn (`ry` up to ±41°),
     and horizontal Eskista cervical glide (`glideX` ±2.6cm) across:
       - B.THORAX + B.CHEST: 10% sympathetic upper-ribcage lean & 4% turn
       - B.CLAV_L / B.CLAV_R: -12% shoulder counter-relaxation on stretched SCM side, +8% cozy lift on leaned side
       - B.NECK_LOW  (y = 1.422): 40% lateral lean rz, 42% pitch rx, 28% yaw ry
       - B.NECK_HIGH (y = 1.480): 36% lateral lean rz, 34% pitch rx, 36% yaw ry
       - B.HEAD      (y = 1.534): 24% lateral lean rz, 24% pitch rx, 36% yaw ry + C2-C7 axial coupling
     ============================================================================ */
  const NECK_LEAN_PRESETS = {
    neutral:       { roll:  0.0 * DEG, pitch:  0.0 * DEG, yaw:  0.0 * DEG, glideX: 0.0 },
    left_24:       { roll: 24.0 * DEG, pitch: -1.5 * DEG, yaw:  2.5 * DEG, glideX: 0.0 },
    lean_left:     { roll: 24.0 * DEG, pitch: -1.5 * DEG, yaw:  2.5 * DEG, glideX: 0.0 },
    right_24:      { roll:-24.0 * DEG, pitch: -1.5 * DEG, yaw: -2.5 * DEG, glideX: 0.0 },
    lean_right:    { roll:-24.0 * DEG, pitch: -1.5 * DEG, yaw: -2.5 * DEG, glideX: 0.0 },
    oblique_turn:  { roll: 18.0 * DEG, pitch: -2.0 * DEG, yaw: 30.0 * DEG, glideX: 0.0 },
    oblique:       { roll: 18.0 * DEG, pitch: -2.0 * DEG, yaw: 30.0 * DEG, glideX: 0.0 },
    head_back:     { roll:  3.5 * DEG, pitch:-22.0 * DEG, yaw:  0.0 * DEG, glideX: 0.0 },
    extension:     { roll:  3.5 * DEG, pitch:-22.0 * DEG, yaw:  0.0 * DEG, glideX: 0.0 },
    grief_bow:     { roll:-18.0 * DEG, pitch: 11.5 * DEG, yaw: -6.0 * DEG, glideX: 0.0 },
    sad_lean:      { roll:-16.0 * DEG, pitch:  8.5 * DEG, yaw: -4.0 * DEG, glideX: 0.0 },
    pleading_lean: { roll: 15.0 * DEG, pitch:  5.5 * DEG, yaw:  6.0 * DEG, glideX: 0.0 },
    eskista_glide: { dynamic: "eskista" }
  };

  function toRadAngle(val) {
    if (typeof val !== "number" || !Number.isFinite(val)) return undefined;
    return Math.abs(val) > 1.60 ? val * DEG : val;
  }

  function resolveNeckLeanSpec(leanSpec, nowSec = 0, phase = 0) {
    if (leanSpec === null || leanSpec === undefined || leanSpec === false || leanSpec === "auto" || leanSpec === "none") {
      return null;
    }
    if (typeof leanSpec === "number" && Number.isFinite(leanSpec)) {
      return { roll: toRadAngle(leanSpec), additive: false };
    }
    if (typeof leanSpec === "string") {
      const key = leanSpec.trim().toLowerCase();
      if (!key || key === "auto" || key === "none") return null;
      const p = NECK_LEAN_PRESETS[key];
      if (!p) return null;
      if (p.dynamic === "eskista") {
        const barRad = frac((nowSec + phase * 0.19) / 1.153846) * TAU;
        return {
          roll: 10.5 * DEG * Math.sin(barRad) + 3.5 * DEG * Math.sin(barRad * 3.0 - 0.5),
          pitch: -2.5 * DEG + 2.2 * DEG * (0.5 - 0.5 * Math.cos(barRad * 2.0)),
          yaw: 5.0 * DEG * Math.sin(barRad),
          glideX: 0.022 * Math.sin(barRad * 2.0 + 0.35),
          additive: false
        };
      }
      return { roll: p.roll, pitch: p.pitch, yaw: p.yaw, glideX: p.glideX || 0.0, additive: false };
    }
    if (typeof leanSpec === "object") {
      if (leanSpec.preset && typeof leanSpec.preset === "string") {
        const base = resolveNeckLeanSpec(leanSpec.preset, nowSec, phase) || {};
        return {
          roll: leanSpec.roll !== undefined ? toRadAngle(leanSpec.roll) : (leanSpec.rollDeg !== undefined ? leanSpec.rollDeg * DEG : base.roll),
          pitch: leanSpec.pitch !== undefined ? toRadAngle(leanSpec.pitch) : (leanSpec.pitchDeg !== undefined ? leanSpec.pitchDeg * DEG : base.pitch),
          yaw: leanSpec.yaw !== undefined ? toRadAngle(leanSpec.yaw) : (leanSpec.yawDeg !== undefined ? leanSpec.yawDeg * DEG : base.yaw),
          glideX: leanSpec.glideX !== undefined ? leanSpec.glideX : (base.glideX || 0.0),
          chestAssist: leanSpec.chestAssist,
          additive: Boolean(leanSpec.additive)
        };
      }
      const r = leanSpec.roll !== undefined ? toRadAngle(leanSpec.roll) : (leanSpec.rollDeg !== undefined ? leanSpec.rollDeg * DEG : undefined);
      const p = leanSpec.pitch !== undefined ? toRadAngle(leanSpec.pitch) : (leanSpec.pitchDeg !== undefined ? leanSpec.pitchDeg * DEG : undefined);
      const y = leanSpec.yaw !== undefined ? toRadAngle(leanSpec.yaw) : (leanSpec.yawDeg !== undefined ? leanSpec.yawDeg * DEG : undefined);
      const g = typeof leanSpec.glideX === "number" && Number.isFinite(leanSpec.glideX) ? leanSpec.glideX : undefined;
      if (r === undefined && p === undefined && y === undefined && g === undefined) return null;
      return {
        roll: r,
        pitch: p,
        yaw: y,
        glideX: g,
        chestAssist: leanSpec.chestAssist,
        additive: Boolean(leanSpec.additive)
      };
    }
    return null;
  }

  function applyCervicalLeanArc(bones, B, pitchRx, yawRy, leanRollRz, chestAssist = 1.0, glideX = 0.0, uNeckLeanTargets = null) {
    if (!bones || !B) return { roll: 0, pitch: 0, yaw: 0, glideX: 0 };
    const rx = clamp(pitchRx || 0, -0.42, 0.42);
    const ry = clamp(yawRy || 0, -0.72, 0.72);
    const rz = clamp(leanRollRz || 0, -0.46, 0.46);
    const gx = clamp(glideX || 0, -0.032, 0.032);
    const cAssist = clamp(chestAssist !== undefined ? chestAssist : 1.0, 0, 1.5);

    // Biomechanical C2-C7 facet coupling: lateral cervical flexion couples gently with ipsilateral axial rotation,
    // and axial head rotation couples with subtle physiological coronal tilt!
    const coupledYaw  = -0.060 * rz * (1.0 - 0.75 * clamp(Math.abs(ry) / 0.28, 0, 1));
    const coupledRoll = -0.052 * ry * (1.0 - 0.75 * clamp(Math.abs(rz) / 0.22, 0, 1));
    const effRy = clamp(ry + coupledYaw, -0.74, 0.74);
    const effRz = clamp(rz + coupledRoll, -0.47, 0.47);

    // 1. Sympathetic Upper-Ribcage Lean & Turn (B.THORAX + B.CHEST = 10% lateral lean, 4% turn, 8% pitch)
    const bThorax = B.THORAX !== undefined ? B.THORAX : 3;
    const bChest  = B.CHEST  !== undefined ? B.CHEST  : 4;
    if (cAssist > 0.001) {
      if (bones[bThorax]) {
        bones[bThorax].rotateX(rx * 0.03 * cAssist);
        bones[bThorax].rotateY(effRy * 0.016 * cAssist);
        bones[bThorax].rotateZ(effRz * 0.04 * cAssist);
      }
      if (bones[bChest]) {
        bones[bChest].rotateX(rx * 0.05 * cAssist);
        bones[bChest].rotateY(effRy * 0.024 * cAssist);
        bones[bChest].rotateZ(effRz * 0.06 * cAssist);
      }

      // 2. Natural Clavicle / Shoulder Counter-Relaxation (-12% on stretched SCM side, +8% cozy lift toward leaning head!)
      const rPos = Math.max(0, rz);  // +rz leans head toward -X (character Right shoulder CLAV_R)
      const rNeg = Math.max(0, -rz); // -rz leans head toward +X (character Left shoulder CLAV_L)
      const dLiftL = (0.08 * rNeg - 0.12 * rPos) * cAssist;
      const dLiftR = (0.08 * rPos - 0.12 * rNeg) * cAssist;
      const bClavL = B.CLAV_L !== undefined ? B.CLAV_L : 9;
      const bClavR = B.CLAV_R !== undefined ? B.CLAV_R : 15;
      if (bones[bClavL]) bones[bClavL].rotateZ(dLiftL);
      if (bones[bClavR]) bones[bClavR].rotateZ(-dLiftR);
    }

    // 3. Supple 3-Joint Cervical C-Curve ("ZXY" order keeps coronal lean crisp even under ±35° oblique yaw turns!)
    const bNeckLow  = B.NECK_LOW  !== undefined ? B.NECK_LOW  : 5;
    const bNeckHigh = B.NECK_HIGH !== undefined ? B.NECK_HIGH : 6;
    const bHead     = B.HEAD      !== undefined ? B.HEAD      : 7;

    const glideCounterRz = gx * 1.65;
    if (bones[bNeckLow]) {
      if (bones[bNeckLow].userData && bones[bNeckLow].userData.rest) {
        bones[bNeckLow].position.x = bones[bNeckLow].userData.rest.x + gx * 0.48;
      }
      bones[bNeckLow].rotation.set(
        rx * 0.42,
        effRy * 0.28,
        effRz * 0.40 - glideCounterRz * 0.50,
        "ZXY"
      );
    }
    if (bones[bNeckHigh]) {
      if (bones[bNeckHigh].userData && bones[bNeckHigh].userData.rest) {
        bones[bNeckHigh].position.x = bones[bNeckHigh].userData.rest.x + gx * 0.52;
      }
      bones[bNeckHigh].rotation.set(
        rx * 0.34,
        effRy * 0.36,
        effRz * 0.36 - glideCounterRz * 0.50,
        "ZXY"
      );
    }
    if (bones[bHead]) {
      bones[bHead].rotation.set(
        rx * 0.24,
        effRy * 0.36,
        effRz * 0.24 + glideCounterRz,
        "ZXY"
      );
    }

    if (uNeckLeanTargets) {
      const list = Array.isArray(uNeckLeanTargets) ? uNeckLeanTargets : [uNeckLeanTargets];
      for (let i = 0; i < list.length; i++) {
        const tgt = list[i];
        const v = tgt && (tgt.value || tgt);
        if (v && typeof v.set === "function") v.set(effRz, rx, effRy, gx);
      }
    }

    return { roll: effRz, pitch: rx, yaw: effRy, glideX: gx };
  }

  /* Evaluates emotional + syllabic-speech cervical lean offsets (roll, pitch, yaw) so characters.js
     can fold them directly into the unified 3-joint cervical arc BEFORE arm IK & muscle smoothing! */
  function computeEmotionalCervicalLean(ch, nowSec = 0, opts = {}) {
    const ctrl = ch && ch._v4ExpCtrl;
    const globalOv = (typeof window !== "undefined" && window.NIGHT_POST_EMOTION_OVERRIDE) || null;
    const localOv = (ch && ch.userData && ch.userData.emotionOverride) || null;
    const ov = localOv || globalOv;

    let effEmotion = opts.emotion !== undefined ? opts.emotion : (ctrl ? ctrl.emotionId : "neutral");
    let effEmoInt  = opts.emotionIntensity !== undefined ? opts.emotionIntensity : (ctrl ? ctrl.emotionIntensity : 0.85);
    let effSpeaking = opts.speaking !== undefined ? opts.speaking : (ctrl ? ctrl.speaking : false);

    if (ov) {
      if (typeof ov === "string") {
        effEmotion = ov;
        effEmoInt = 1.0;
      } else if (typeof ov === "object") {
        if (ov.emotion !== undefined && ov.emotion !== "auto") effEmotion = ov.emotion;
        if (ov.intensity !== undefined) effEmoInt = ov.intensity;
        if (ov.speaking !== undefined) effSpeaking = ov.speaking;
      }
    }

    const amt = clamp(effEmoInt, 0, 1.35);
    const emoDef = (typeof effEmotion === "string" && EMOTION_MAP[effEmotion]) ? EMOTION_MAP[effEmotion] : EMOTION_MAP.neutral;
    const phaseOff = (ch && ch.state && ch.state.phase) || 0;
    const tPh = nowSec + phaseOff * 0.37;

    let pitch = (emoDef.headPitch || 0) * amt;
    let roll  = (emoDef.headRoll || 0) * amt;
    let yaw   = (emoDef.headYaw || 0) * amt;

    const wantSpeech = Boolean(effSpeaking) || Boolean(emoDef.autoSpeak && amt > 0.05);
    if (wantSpeech) {
      const spScale = clamp(ctrl && ctrl.speaking ? ctrl.speechIntensity : amt, 0.35, 1.25);
      // Fluid conversational lateral neck leans (±11° = ±0.192 rad) phrased smoothly with prosodic speech syllables!
      const leanPhrase = 0.72 * Math.cos(tPh * 1.22 - 0.30) + 0.28 * Math.sin(tPh * 2.48 + 0.65);
      if (emoDef.id === "speaking_animated") {
        roll = (emoDef.speechLeanAmp || (11.0 * DEG)) * leanPhrase * spScale;
      } else {
        roll += 6.5 * DEG * leanPhrase * spScale;
      }
      pitch += 0.042 * Math.sin(tPh * 3.9 + 0.2) * spScale;
      yaw   += 0.075 * Math.cos(tPh * 0.95 + 0.4) * spScale;
    }

    if (emoDef.laughPulse) {
      const ha = Math.abs(Math.sin(tPh * 8.6));
      pitch -= 0.045 * ha * amt;
      roll  += 0.028 * Math.sin(tPh * 4.3) * amt;
    }
    if (emoDef.sighCycle) {
      const sigh = Math.max(0, Math.sin(tPh * 1.35));
      pitch += 0.038 * sigh * amt;
      roll  += 0.032 * sigh * amt;
    }

    // Also support Sad <-> Smile slider driving natural grief-lean <-> warm-smile-lean when FACS sliders are active!
    if (ov && typeof ov === "object" && ov.facs) {
      if (ov.facs.sad > 0.05 && emoDef.id === "neutral") {
        roll  -= 15.0 * DEG * clamp(ov.facs.sad, 0, 1);
        pitch += 7.5 * DEG * clamp(ov.facs.sad, 0, 1);
      } else if (ov.facs.smile > 0.10 && emoDef.id === "neutral") {
        roll  += 11.5 * DEG * clamp(ov.facs.smile, 0, 1);
        pitch -= 2.5 * DEG * clamp(ov.facs.smile, 0, 1);
      }
    }

    return { pitch, yaw, roll };
  }

  /* ============================================================================
     8. PER-CHARACTER EXPRESSION CONTROLLER ATTACHMENT (ch.setEmotion, etc.)
     ============================================================================ */
  function discoverCharacterInternals(ch, provided = {}) {
    const V3 = typeof window !== "undefined" ? window.HumanSculptV3 : null;
    const B = provided.B || (V3 && V3.B) || { THORAX: 3, CHEST: 4, NECK_LOW: 5, NECK_HIGH: 6, HEAD: 7, JAW: 8, CLAV_L: 9, CLAV_R: 15 };
    const facsUniformTargets = [];
    const neckLeanTargets = [];
    const pushNeckLeanTarget = u => {
      if (u && neckLeanTargets.indexOf(u) < 0) neckLeanTargets.push(u);
    };
    let lids = provided.lids || null;
    let scionEyes = provided.scionEyes || (ch && ch.scionEyes) || (ch && ch.userData && ch.userData.scionEyes) || (lids && lids.scionEyes) || null;
    let scionLids = provided.scionLids || (ch && ch.scionLids) || (ch && ch.userData && ch.userData.scionLids) || (lids && lids.scionLids) || null;

    if (provided.headAnchor && provided.headAnchor.userData) {
      if (!scionEyes && provided.headAnchor.userData.scionEyes) scionEyes = provided.headAnchor.userData.scionEyes;
      if (!scionLids && provided.headAnchor.userData.scionLids) scionLids = provided.headAnchor.userData.scionLids;
    }

    if (provided.skinMat && provided.skinMat.userData) {
      if (provided.skinMat.userData.facsUniforms) {
        facsUniformTargets.push(provided.skinMat.userData.facsUniforms);
        pushNeckLeanTarget(provided.skinMat.userData.facsUniforms.uNeckLean);
      }
      pushNeckLeanTarget(provided.skinMat.userData.uNeckLean || provided.skinMat.userData.neckLeanUniform);
    }

    if (ch && ch.group && ch.group.traverse) {
      ch.group.traverse(obj => {
        if (obj.userData) {
          if (obj.userData.wetLids && !lids) lids = obj.userData.wetLids;
          if (obj.userData.scionEyes && !scionEyes) scionEyes = obj.userData.scionEyes;
          if (obj.userData.scionLids && !scionLids) scionLids = obj.userData.scionLids;
        }
        const mat = obj.material;
        if (mat && mat.userData) {
          if (mat.userData.facsUniforms) {
            if (facsUniformTargets.indexOf(mat.userData.facsUniforms) < 0) {
              facsUniformTargets.push(mat.userData.facsUniforms);
            }
            pushNeckLeanTarget(mat.userData.facsUniforms.uNeckLean);
          }
          pushNeckLeanTarget(mat.userData.uNeckLean || mat.userData.neckLeanUniform);
        }
      });
    }

    return {
      B,
      lids: lids || [],
      scionEyes,
      scionLids,
      facsUniformTargets,
      neckLeanTargets,
      xraySkeleton: provided.xraySkeleton || (ch && ch._v3XraySkeleton) || null
    };
  }

  function attachCharacterExpressionController(T, ch, internals = {}) {
    if (!ch) return null;
    if (ch._v4ExpCtrl) {
      // Refresh internals if newly provided (e.g. characters.js passing explicit refs after HumanSculptV3 auto-register)
      const extra = discoverCharacterInternals(ch, internals);
      if (extra.lids && extra.lids.length) ch._v4ExpCtrl.lids = extra.lids;
      if (extra.scionEyes) ch._v4ExpCtrl.scionEyes = extra.scionEyes;
      if (extra.scionLids) ch._v4ExpCtrl.scionLids = extra.scionLids;
      for (let i = 0; i < extra.facsUniformTargets.length; i++) {
        if (ch._v4ExpCtrl.facsUniformTargets.indexOf(extra.facsUniformTargets[i]) < 0) {
          ch._v4ExpCtrl.facsUniformTargets.push(extra.facsUniformTargets[i]);
        }
      }
      for (let i = 0; i < extra.neckLeanTargets.length; i++) {
        if (ch._v4ExpCtrl.neckLeanTargets.indexOf(extra.neckLeanTargets[i]) < 0) {
          ch._v4ExpCtrl.neckLeanTargets.push(extra.neckLeanTargets[i]);
        }
      }
      return ch._v4ExpCtrl;
    }

    loadExpressionPriors();
    ch.userData = ch.userData || (ch.group && ch.group.userData) || {};
    if (ch.group) ch.group.userData = ch.userData;

    const refs = discoverCharacterInternals(ch, internals);
    const origSetSpeechLabel = typeof ch.setSpeech === "function" ? ch.setSpeech.bind(ch) : null;
    if (origSetSpeechLabel && !ch.setSpeechLabel) {
      ch.setSpeechLabel = origSetSpeechLabel;
    }

    const curFacs = createZeroFacs();
    const tgtFacs = createZeroFacs();
    const speechScratch = createZeroFacs();

    const ctrl = {
      B: refs.B,
      lids: refs.lids,
      scionEyes: refs.scionEyes,
      scionLids: refs.scionLids,
      facsUniformTargets: refs.facsUniformTargets,
      neckLeanTargets: refs.neckLeanTargets,
      xraySkeleton: refs.xraySkeleton,
      emotionId: "neutral",
      emotionIntensity: 1.0,
      customWeights: null,
      speaking: false,
      speechPhrase: "water_wifi",
      speechIntensity: 1.0,
      speechTime: 0,
      visemeId: "SIL",
      visemeAmount: 0.0,
      activeSpeechViseme: "SIL",
      blinkOverride: null,
      gazeOverrideX: null,
      gazeOverrideY: null,
      curLidOpen: 1.0,
      curDuchenne: 0.0,
      curPupil: 0.50,
      baseGazeX: 0.0,
      baseGazeY: 0.0,
      handGestureL: null,
      handGestureR: null,
      handIntensityL: 1.0,
      handIntensityR: 1.0,
      handTimeL: 0,
      handTimeR: 0,
      armGesture: null,
      armIntensity: 1.0,
      armTime: 0,
      neckLeanOverride: null,
      neckLeanState: { roll: 0, pitch: 0, yaw: 0, glideX: 0, rollDeg: 0, pitchDeg: 0, yawDeg: 0 },
      lastNowSec: 0,
      initialized: false
    };

    function syncGpuUniforms() {
      // Lazy re-scan if materials or Scion eye/lid rigs were attached after initial controller creation
      if ((ctrl.facsUniformTargets.length < 2 || ctrl.neckLeanTargets.length < 1 || (!ctrl.scionLids && !ctrl.lids.length)) && ch.group) {
        const fresh = discoverCharacterInternals(ch, internals);
        ctrl.facsUniformTargets = fresh.facsUniformTargets;
        ctrl.neckLeanTargets = fresh.neckLeanTargets;
        if (!ctrl.lids.length && fresh.lids.length) ctrl.lids = fresh.lids;
        if (!ctrl.scionEyes && fresh.scionEyes) ctrl.scionEyes = fresh.scionEyes;
        if (!ctrl.scionLids && fresh.scionLids) ctrl.scionLids = fresh.scionLids;
      }
      for (let i = 0; i < ctrl.facsUniformTargets.length; i++) {
        const u = ctrl.facsUniformTargets[i];
        u.uFacsA.value.set(curFacs.smile, curFacs.sad, curFacs.mouthFunnel, curFacs.mouthStretch);
        u.uFacsB.value.set(curFacs.browUpInner, curFacs.browUpOuter, curFacs.browFurrow, curFacs.squint);
        u.uFacsC.value.set(curFacs.wideEyes, curFacs.lipPress, curFacs.noseWrinkle, curFacs.chinRaise);
        u.uFacsD.value.set(curFacs.jawOpen, curFacs.tongueLift, curFacs.tongueOut, curFacs.lowerLipTuck);
      }
    }

    function computeTargetState(nowSec, opts = {}) {
      for (let i = 0; i < FACS_KEYS.length; i++) tgtFacs[FACS_KEYS[i]] = 0;

      // Resolve effective emotion, speech, viseme, and hand options (opts + ch.userData.emotionOverride + global override)
      const globalOv = (typeof window !== "undefined" && window.NIGHT_POST_EMOTION_OVERRIDE) || null;
      const localOv = (ch.userData && ch.userData.emotionOverride) || null;
      const ov = localOv || globalOv;

      let effEmotion = opts.emotion !== undefined ? opts.emotion : ctrl.emotionId;
      let effEmoInt = opts.emotionIntensity !== undefined ? opts.emotionIntensity : ctrl.emotionIntensity;
      let effSpeaking = opts.speaking !== undefined ? opts.speaking : ctrl.speaking;
      let effViseme = opts.viseme !== undefined ? opts.viseme : (ctrl.visemeAmount > 0.001 ? ctrl.visemeId : null);
      let effVisAmt = opts.visemeAmount !== undefined ? opts.visemeAmount : ctrl.visemeAmount;
      let effHandL = opts.handGestureL !== undefined ? opts.handGestureL : ctrl.handGestureL;
      let effHandR = opts.handGestureR !== undefined ? opts.handGestureR : ctrl.handGestureR;
      let effHandInt = opts.handGestureIntensity !== undefined ? opts.handGestureIntensity : 1.0;
      let effArm = opts.expressiveArmGesture !== undefined ? opts.expressiveArmGesture : ctrl.armGesture;

      if (ov) {
        if (typeof ov === "string") {
          effEmotion = ov;
          effEmoInt = 1.0;
          effViseme = null;
          effVisAmt = 0.0;
        } else if (typeof ov === "object") {
          if (ov.emotion !== undefined && ov.emotion !== "auto") {
            effEmotion = ov.emotion;
            if (!ov.viseme && !ov.speaking) {
              effViseme = null;
              effVisAmt = 0.0;
            }
          }
          if (ov.intensity !== undefined) effEmoInt = ov.intensity;
          if (ov.speaking !== undefined) effSpeaking = ov.speaking;
          if (ov.viseme !== undefined) { effViseme = ov.viseme; effVisAmt = ov.visemeAmount !== undefined ? ov.visemeAmount : 1.0; }
          if (ov.handGestureL !== undefined) effHandL = ov.handGestureL;
          if (ov.handGestureR !== undefined) effHandR = ov.handGestureR;
          if (ov.armGesture !== undefined) effArm = ov.armGesture;
        }
      }

      // 1. Base Emotion Preset or Custom FACS Weights
      let emoDef = EMOTION_MAP.neutral;
      if (typeof effEmotion === "string") {
        emoDef = EMOTION_MAP[effEmotion] || EMOTION_MAP.neutral;
        for (const k in emoDef.weights) {
          tgtFacs[k] = (emoDef.weights[k] || 0) * effEmoInt;
        }
      } else if (effEmotion && typeof effEmotion === "object") {
        for (let i = 0; i < FACS_KEYS.length; i++) {
          const k = FACS_KEYS[i];
          if (effEmotion[k] !== undefined) tgtFacs[k] = effEmotion[k] * effEmoInt;
        }
      } else if (ctrl.customWeights) {
        for (let i = 0; i < FACS_KEYS.length; i++) {
          const k = FACS_KEYS[i];
          if (ctrl.customWeights[k] !== undefined) tgtFacs[k] = ctrl.customWeights[k] * effEmoInt;
        }
      }

      // Dynamic life modulation for laughing_open, relief_sigh, and effort_strain_20kg
      const phaseOff = (ch.state && ch.state.phase) || 0;
      const tAnim = nowSec + phaseOff * 0.25;
      if (emoDef.laughPulse) {
        const ha = 0.5 + 0.5 * Math.sin(tAnim * 9.2);
        tgtFacs.jawOpen = clamp(Math.max(0.38, tgtFacs.jawOpen * (0.76 + 0.30 * ha)), 0.36, 1.0);
        tgtFacs.squint = clamp(tgtFacs.squint + 0.12 * ha * effEmoInt, 0, 1.0);
      }
      if (emoDef.sighCycle) {
        const sigh = Math.max(0, Math.sin(tAnim * 1.35));
        tgtFacs.jawOpen = clamp(tgtFacs.jawOpen * (0.45 + 0.75 * sigh), 0, 0.65);
        tgtFacs.mouthFunnel = clamp(tgtFacs.mouthFunnel * (0.50 + 0.65 * sigh), 0, 0.85);
      }
      if (emoDef.strainTremor) {
        const tr = 0.5 + 0.5 * Math.sin(tAnim * 11.0);
        tgtFacs.noseWrinkle = clamp(tgtFacs.noseWrinkle + 0.08 * tr * effEmoInt, 0, 1.0);
      }

      // 2. Coarticulated Speech Stream (when speaking is active or speaking_animated emotion is chosen)
      let activeVis = "SIL";
      const wantSpeech = Boolean(effSpeaking) || Boolean(emoDef.autoSpeak && effEmoInt > 0.05);
      if (wantSpeech && (!effViseme || effVisAmt < 0.01)) {
        for (let i = 0; i < FACS_KEYS.length; i++) speechScratch[FACS_KEYS[i]] = 0;
        const phraseSeed = typeof effSpeaking === "string" && effSpeaking.length > 0
          ? effSpeaking
          : (ov && ov.speechPhrase) || ctrl.speechPhrase || (ch.state && ch.state.id) || "dispatch";
        const spInt = ctrl.speaking ? ctrl.speechIntensity : effEmoInt;
        activeVis = sampleSpeechVisemes(phraseSeed, tAnim, spInt, speechScratch);
        // Layer speech visemes smoothly over emotional smile/sad/brow state!
        tgtFacs.jawOpen = clamp(Math.max(tgtFacs.jawOpen * 0.45, speechScratch.jawOpen), 0, 1.0);
        tgtFacs.mouthFunnel = clamp(Math.max(tgtFacs.mouthFunnel, speechScratch.mouthFunnel), 0, 1.0);
        tgtFacs.mouthStretch = clamp(Math.max(tgtFacs.mouthStretch, speechScratch.mouthStretch), 0, 1.0);
        tgtFacs.lipPress = clamp(Math.max(tgtFacs.lipPress, speechScratch.lipPress), 0, 1.0);
        tgtFacs.lowerLipTuck = clamp(Math.max(tgtFacs.lowerLipTuck, speechScratch.lowerLipTuck), 0, 1.0);
        tgtFacs.tongueLift = clamp(Math.max(tgtFacs.tongueLift, speechScratch.tongueLift), 0, 1.0);
        tgtFacs.tongueOut = clamp(Math.max(tgtFacs.tongueOut, speechScratch.tongueOut), 0, 1.0);
        tgtFacs.noseWrinkle = clamp(Math.max(tgtFacs.noseWrinkle, speechScratch.noseWrinkle), 0, 1.0);
        tgtFacs.chinRaise = clamp(Math.max(tgtFacs.chinRaise, speechScratch.chinRaise), 0, 1.0);
        tgtFacs.browUpInner = clamp(tgtFacs.browUpInner + speechScratch.browUpInner * 0.45, 0, 1.0);
        tgtFacs.browUpOuter = clamp(tgtFacs.browUpOuter + speechScratch.browUpOuter * 0.45, 0, 1.0);
        if (tgtFacs.lipPress > 0.5) tgtFacs.jawOpen *= (1.0 - tgtFacs.lipPress * 0.92);
        if (emoDef.laughPulse && effEmoInt > 0.45) tgtFacs.jawOpen = Math.max(tgtFacs.jawOpen, 0.36);
      }

      // 3. Explicit Single-Viseme Override (e.g. Viseme Tour A·E·I·O·U·M·F·TH·L)
      if (effViseme && VISEME_MAP[effViseme] && effVisAmt > 0.001) {
        const vd = VISEME_MAP[effViseme];
        const va = clamp(effVisAmt, 0, 1.2);
        activeVis = effViseme;
        tgtFacs.jawOpen = lerp(tgtFacs.jawOpen, vd.weights.jawOpen || 0, clamp(va, 0, 1));
        tgtFacs.mouthFunnel = lerp(tgtFacs.mouthFunnel, vd.weights.mouthFunnel || 0, clamp(va, 0, 1));
        tgtFacs.mouthStretch = lerp(tgtFacs.mouthStretch, vd.weights.mouthStretch || 0, clamp(va, 0, 1));
        tgtFacs.lipPress = lerp(tgtFacs.lipPress, vd.weights.lipPress || 0, clamp(va, 0, 1));
        tgtFacs.lowerLipTuck = lerp(tgtFacs.lowerLipTuck, vd.weights.lowerLipTuck || 0, clamp(va, 0, 1));
        tgtFacs.tongueLift = lerp(tgtFacs.tongueLift, vd.weights.tongueLift || 0, clamp(va, 0, 1));
        tgtFacs.tongueOut = lerp(tgtFacs.tongueOut, vd.weights.tongueOut || 0, clamp(va, 0, 1));
        if (vd.weights.smile) tgtFacs.smile = Math.max(tgtFacs.smile, vd.weights.smile * va);
        if (vd.weights.noseWrinkle) tgtFacs.noseWrinkle = Math.max(tgtFacs.noseWrinkle, vd.weights.noseWrinkle * va);
        if (vd.weights.chinRaise) tgtFacs.chinRaise = Math.max(tgtFacs.chinRaise, vd.weights.chinRaise * va);
      }

      // 4. Direct Slider FACS Overrides (from study/index.html Live Director Sliders!)
      if (ov && typeof ov === "object" && ov.facs) {
        for (let i = 0; i < FACS_KEYS.length; i++) {
          const k = FACS_KEYS[i];
          if (ov.facs[k] !== undefined && ov.facs[k] !== null) {
            tgtFacs[k] = clamp(ov.facs[k], 0, 1.15);
          }
        }
      }

      // Mutual anatomical constraints: pressed lips (MM/BB) keep jaw shut!
      if (tgtFacs.lipPress > 0.15) {
        tgtFacs.jawOpen *= Math.max(0, 1.0 - tgtFacs.lipPress * 0.95);
      }

      ctrl.activeSpeechViseme = activeVis;
      return {
        emoDef,
        effEmoInt,
        wantSpeech,
        effHandL,
        effHandR,
        effHandInt,
        effArm,
        ov
      };
    }

    function applyBoneAndShaderRig(dt, nowSec, opts = {}, immediate = false) {
      const meta = computeTargetState(nowSec, opts);
      const sDt = clamp(dt || 0.016, 0.001, 0.08);
      // Fast responsive 60fps exponential damping for facial tissue & crisp consonant closures
      const alphaFace = (immediate || !ctrl.initialized) ? 1.0 : (1.0 - Math.exp(-sDt * 22.0));
      const alphaVis  = (immediate || !ctrl.initialized) ? 1.0 : (1.0 - Math.exp(-sDt * 28.0));

      for (let i = 0; i < FACS_KEYS.length; i++) {
        const k = FACS_KEYS[i];
        const a = (k === "jawOpen" || k === "lipPress" || k === "tongueLift" || k === "tongueOut" || k === "lowerLipTuck" || k === "mouthFunnel")
          ? alphaVis : alphaFace;
        curFacs[k] = lerp(curFacs[k], tgtFacs[k], a);
        if (Math.abs(curFacs[k]) < 1e-4) curFacs[k] = 0;
      }

      // Compute soulful emotional lid aperture, Duchenne lower-lid rise & pupil dilation targets
      const phaseOff = (ch.state && ch.state.phase) || 0;
      const tAnim = nowSec + phaseOff * 0.25;
      const emoOpenBase = meta.emoDef.lidAperture !== undefined ? lerp(1.0, meta.emoDef.lidAperture, clamp(meta.effEmoInt, 0, 1.25)) : 1.0;
      let tgtLidOpen = emoOpenBase;
      if (meta.wantSpeech) {
        tgtLidOpen += 0.05 * curFacs.jawOpen;
      }
      if (meta.emoDef.sighCycle) {
        tgtLidOpen -= 0.12 * Math.max(0, Math.sin(tAnim * 1.35)) * clamp(meta.effEmoInt, 0, 1);
      }
      const emoDuch = (meta.emoDef.duchenne || 0) * clamp(meta.effEmoInt, 0, 1.2);
      const tgtDuchenne = clamp(Math.max(emoDuch, curFacs.squint * 0.72 + curFacs.smile * 0.62), 0, 1.15);
      const tgtPupil = lerp(0.50, meta.emoDef.pupilDilate !== undefined ? meta.emoDef.pupilDilate : 0.50, clamp(meta.effEmoInt, 0, 1.1));

      ctrl.curLidOpen = lerp(ctrl.curLidOpen, tgtLidOpen, alphaFace);
      ctrl.curDuchenne = lerp(ctrl.curDuchenne, tgtDuchenne, alphaFace);
      ctrl.curPupil = lerp(ctrl.curPupil, tgtPupil, alphaFace);

      ctrl.initialized = true;
      ctrl.lastNowSec = nowSec;

      // 1. Push live FACS uniforms to GPU shaders (head, palpebral continuum, oral mucosa, teeth/tongue, beard!)
      syncGpuUniforms();

      const bones = ch.bones;
      const B = ctrl.B;
      if (!bones) return;

      // 2. Drive True Articulated TMJ Mandibular Hinge (B.JAW: 0..1 -> 0..26°)
      if (bones[B.JAW]) {
        const jawRad = clamp(curFacs.jawOpen, 0, 1.05) * MAX_JAW_RAD;
        // Preserve existing mood jaw opening only if expression is neutral & silent; otherwise drive exact FACS jaw!
        const hasActiveMouth = curFacs.jawOpen > 0.005 || curFacs.lipPress > 0.05 || meta.wantSpeech || meta.emoDef.id !== "neutral";
        if (hasActiveMouth) {
          bones[B.JAW].rotation.x = jawRad;
          if (ch.state && ch.state.boneQuats && ch.state.boneQuats[B.JAW]) {
            ch.state.boneQuats[B.JAW].copy(bones[B.JAW].quaternion);
          }
        }
      }

      // 3. Drive ScionEyelids (72x14 Spherical-Wrap Continuum + 116 3D Micro-Lashes) & ScionEyeGlobe!
      const ovObj = (meta.ov && typeof meta.ov === "object") ? meta.ov : null;
      let autoBlinkClose = 0.0;
      if (ch.state && ch.state.blink > 0) {
        // Fast natural downward sweep (~50ms) + smooth upward recovery (~95ms) peaking cleanly at 1.0!
        const uBlink = 1.0 - clamp(ch.state.blink, 0, 1);
        autoBlinkClose = Math.sin(Math.pow(uBlink, 0.72) * Math.PI);
      }
      const explicitBlink = opts.blinkClose !== undefined ? opts.blinkClose
        : (ovObj && ovObj.blink !== undefined ? ovObj.blink
        : (ovObj && ovObj.facs && ovObj.facs.blink !== undefined ? ovObj.facs.blink : ctrl.blinkOverride));
      const blinkAmt = explicitBlink !== null && explicitBlink !== undefined
        ? clamp(explicitBlink, 0, 1)
        : autoBlinkClose;

      const duchenneLower = ctrl.curDuchenne;
      const lidDroop = (meta.emoDef.lidDroop || 0) * meta.effEmoInt;
      const gazeYAdd = (meta.emoDef.gazeY || 0) * meta.effEmoInt;
      const speechGazeX = meta.wantSpeech ? 0.035 * Math.sin(tAnim * 1.7) : 0.0;
      const speechGazeY = meta.wantSpeech ? 0.025 * Math.cos(tAnim * 2.3) : 0.0;

      const explicitGazeX = opts.gazeX !== undefined ? opts.gazeX
        : (ovObj && ovObj.gazeX !== undefined ? ovObj.gazeX : ctrl.gazeOverrideX);
      const explicitGazeY = opts.gazeY !== undefined ? opts.gazeY
        : (ovObj && ovObj.gazeY !== undefined ? ovObj.gazeY : ctrl.gazeOverrideY);

      const effGazeX = explicitGazeX !== null && explicitGazeX !== undefined
        ? clamp(explicitGazeX, -0.48, 0.48)
        : clamp(ctrl.baseGazeX + speechGazeX, -0.45, 0.45);
      const effGazeY = explicitGazeY !== null && explicitGazeY !== undefined
        ? clamp(explicitGazeY, -0.42, 0.42)
        : clamp(ctrl.baseGazeY + gazeYAdd * 0.45 + speechGazeY, -0.40, 0.40);

      if (ctrl.scionLids) {
        ctrl.scionLids.setState({
          open: ctrl.curLidOpen,
          blink: blinkAmt,
          squint: curFacs.squint * 0.68,
          wideEyes: curFacs.wideEyes,
          duchenne: duchenneLower,
          gazeX: effGazeX,
          gazeY: effGazeY,
          browInner: curFacs.browUpInner,
          browOuter: curFacs.browUpOuter,
          browFurrow: curFacs.browFurrow
        });
      }
      if (ctrl.scionEyes) {
        ctrl.scionEyes.setGaze(effGazeX, effGazeY);
        if (typeof ctrl.scionEyes.setLidShadow === "function") {
          const ap = ctrl.scionLids && typeof ctrl.scionLids.getEffectiveAperture === "function"
            ? ctrl.scionLids.getEffectiveAperture()
            : { openL: ctrl.curLidOpen * (1 - blinkAmt), openR: ctrl.curLidOpen * (1 - blinkAmt), squint: duchenneLower };
          ctrl.scionEyes.setLidShadow(ap.openL, ap.openR, ap.squint);
        }
        if (typeof ctrl.scionEyes.setPupil === "function") {
          ctrl.scionEyes.setPupil(ctrl.curPupil);
        }
      }

      for (let i = 0; i < ctrl.lids.length; i++) {
        const L = ctrl.lids[i];
        const baseEz = (L._baseEyeZ !== undefined ? L._baseEyeZ : 0.0);
        const effEyePitchDown = clamp(-baseEz - gazeYAdd * 0.38, -0.10, 0.16);
        if (L.uLid) {
          const openRx = -0.225 + effEyePitchDown * 0.35 - 0.12 * curFacs.wideEyes + 0.055 * curFacs.squint + 0.032 * curFacs.browFurrow + 0.075 * lidDroop;
          L.uLid.rotation.x = clamp(lerp(openRx, 0.25, blinkAmt), -0.35, 0.26);
        }
        if (L.lLid) {
          const openLRx = 0.23 + effEyePitchDown * 0.12 - 0.11 * duchenneLower + 0.05 * curFacs.wideEyes;
          L.lLid.rotation.x = clamp(lerp(openLRx, 0.06, blinkAmt), 0.02, 0.34);
        }
        if (L.eye && Math.abs(gazeYAdd) > 0.002) {
          L.eye.rotation.z = clamp(baseEz + gazeYAdd * 0.38, -0.24, 0.26);
        }
      }

      // 4. Supple 3-Joint Cervical Neck-Leaning Arc & Live uNeckLean SCM Relief Uniform Sync
      // When invoked inside ch.update(), characters.js solves the full 3-joint cervical + ribcage + clavicle arc
      // BEFORE arm IK & muscle smoothing (`opts._cervicalSolvedInUpdate = true`), and we sync live bone sums -> uNeckLean.
      // When invoked standalone (`ch.setEmotion(...)` / `ch.setNeckLean(...)`), we solve the 3-joint arc directly from `_preCervicalQuats`!
      const bNeckLow  = B.NECK_LOW  !== undefined ? B.NECK_LOW  : 5;
      const bNeckHigh = B.NECK_HIGH !== undefined ? B.NECK_HIGH : 6;
      const bHead     = B.HEAD      !== undefined ? B.HEAD      : 7;
      if (bones[bHead]) {
        if (!opts._cervicalSolvedInUpdate) {
          const preQ = ch.state && ch.state._preCervicalQuats;
          const bThorax = B.THORAX !== undefined ? B.THORAX : 3;
          const bChest  = B.CHEST  !== undefined ? B.CHEST  : 4;
          const bClavL  = B.CLAV_L !== undefined ? B.CLAV_L : 9;
          const bClavR  = B.CLAV_R !== undefined ? B.CLAV_R : 15;
          if (preQ) {
            if (bones[bThorax] && preQ.thorax) bones[bThorax].quaternion.copy(preQ.thorax);
            if (bones[bChest]  && preQ.chest)  bones[bChest].quaternion.copy(preQ.chest);
            if (bones[bClavL]  && preQ.clavL)  bones[bClavL].quaternion.copy(preQ.clavL);
            if (bones[bClavR]  && preQ.clavR)  bones[bClavR].quaternion.copy(preQ.clavR);
          }
          const emoLean = computeEmotionalCervicalLean(ch, nowSec, opts);
          const baseP = (ch.state && ch.state._baseCervicalPitch) || 0;
          const baseY = (ch.state && ch.state._baseCervicalYaw)   || 0;
          const baseR = (ch.state && ch.state._baseCervicalRoll)  || 0;
          let wantPitch = baseP + emoLean.pitch;
          let wantYaw   = baseY + emoLean.yaw;
          let wantRoll  = baseR + emoLean.roll;
          let wantGlide = (ch.state && ch.state._baseCervicalGlideX) || 0;
          let cAssist   = 1.0;

          const rawLeanOv = opts.neckLean !== undefined ? opts.neckLean
            : (ovObj && ovObj.neckLean !== undefined ? ovObj.neckLean : ctrl.neckLeanOverride);
          const leanOv = resolveNeckLeanSpec(rawLeanOv, nowSec, (ch.state && ch.state.phase) || 0);
          if (leanOv) {
            if (leanOv.roll !== undefined)   wantRoll  = leanOv.additive ? (wantRoll + leanOv.roll)   : leanOv.roll;
            if (leanOv.pitch !== undefined)  wantPitch = leanOv.additive ? (wantPitch + leanOv.pitch) : leanOv.pitch;
            if (leanOv.yaw !== undefined)    wantYaw   = leanOv.additive ? (wantYaw + leanOv.yaw)     : leanOv.yaw;
            if (leanOv.glideX !== undefined) wantGlide = leanOv.additive ? (wantGlide + leanOv.glideX): leanOv.glideX;
            if (leanOv.chestAssist !== undefined) cAssist = leanOv.chestAssist;
          }

          const solved = applyCervicalLeanArc(bones, B, wantPitch, wantYaw, wantRoll, cAssist, wantGlide, ctrl.neckLeanTargets);
          if (ch.state && ch.state.boneQuats) {
            for (const bi of [bThorax, bChest, bClavL, bClavR, bNeckLow, bNeckHigh, bHead]) {
              if (bones[bi] && ch.state.boneQuats[bi]) ch.state.boneQuats[bi].copy(bones[bi].quaternion);
            }
          }
          ctrl.neckLeanState = {
            roll: solved.roll,
            pitch: solved.pitch,
            yaw: solved.yaw,
            glideX: solved.glideX,
            rollDeg: +(solved.roll / DEG).toFixed(2),
            pitchDeg: +(solved.pitch / DEG).toFixed(2),
            yawDeg: +(solved.yaw / DEG).toFixed(2)
          };
          if (ch.state) ch.state.neckLeanState = ctrl.neckLeanState;
        } else {
          // Read live smoothed 3-joint cervical sum solved by characters.js and ensure all uNeckLean targets stay in lockstep
          const liveSt = (ch.state && ch.state.neckLeanState) || null;
          const liveRoll  = liveSt ? liveSt.roll  : ((bones[bNeckLow] ? bones[bNeckLow].rotation.z : 0) + (bones[bNeckHigh] ? bones[bNeckHigh].rotation.z : 0) + bones[bHead].rotation.z);
          const livePitch = liveSt ? liveSt.pitch : ((bones[bNeckLow] ? bones[bNeckLow].rotation.x : 0) + (bones[bNeckHigh] ? bones[bNeckHigh].rotation.x : 0) + bones[bHead].rotation.x);
          const liveYaw   = liveSt ? liveSt.yaw   : ((bones[bNeckLow] ? bones[bNeckLow].rotation.y : 0) + (bones[bNeckHigh] ? bones[bNeckHigh].rotation.y : 0) + bones[bHead].rotation.y);
          const liveGlide = liveSt ? (liveSt.glideX || 0) : 0;
          for (let i = 0; i < ctrl.neckLeanTargets.length; i++) {
            const u = ctrl.neckLeanTargets[i];
            const v = u && (u.value || u);
            if (v && typeof v.set === "function") v.set(liveRoll, livePitch, liveYaw, liveGlide);
          }
          ctrl.neckLeanState = {
            roll: liveRoll,
            pitch: livePitch,
            yaw: liveYaw,
            glideX: liveGlide,
            rollDeg: +(liveRoll / DEG).toFixed(2),
            pitchDeg: +(livePitch / DEG).toFixed(2),
            yawDeg: +(liveYaw / DEG).toFixed(2)
          };
        }
      }

      // 5. Optional Full-Arm Expressive Acting Pose (joyful_wave, cupped_water_plea, heart_gratitude, etc.)
      if (meta.effArm) {
        applyExpressiveArmChain(T, ch, meta.effArm, nowSec, ctrl.armIntensity);
      } else {
        // 6. Apply 30-Bone Expressive Hand Gestures on Free Hands (respecting active tool grips!)
        const activeGripL = opts._activeGripModeL || (ch.userData && ch.userData.activeGripModeL) || "";
        const activeGripR = opts._activeGripModeR || (ch.userData && ch.userData.activeGripModeR) || "";
        const lockToolL = ACTIVE_PROP_GRIP_MODES.has(activeGripL) && !opts.forceHandGesture;
        const lockToolR = ACTIVE_PROP_GRIP_MODES.has(activeGripR) && !opts.forceHandGesture;

        if (meta.effHandL && !lockToolL) {
          applyExpressiveHandBones(bones, B, 1, meta.effHandL, nowSec, meta.effHandInt * ctrl.handIntensityL);
        }
        if (meta.effHandR && !lockToolR) {
          applyExpressiveHandBones(bones, B, -1, meta.effHandR, nowSec, meta.effHandInt * ctrl.handIntensityR);
        }
      }

      if (ch.group) ch.group.updateMatrixWorld(true);
      if (ctrl.xraySkeleton && ctrl.xraySkeleton.isEnabled && ctrl.xraySkeleton.isEnabled()) {
        ctrl.xraySkeleton.update();
      }
    }

    // Wrap ch.update once so expression/speech/hand rigs evaluate automatically at the end of every character update!
    if (typeof ch.update === "function" && !ch._v4UpdateWrapped) {
      const origUpdate = ch.update.bind(ch);
      ch._v4UpdateWrapped = true;
      ch.update = function (dt, nowSec, opts = {}) {
        const res = origUpdate(dt, nowSec, opts);
        if (ctrl.scionLids && ctrl.scionLids.state) {
          // Read pure un-accumulated base conjugate gaze written by characters.js setGaze()
          ctrl.baseGazeX = ctrl.scionLids.state.charGazeX || 0.0;
          ctrl.baseGazeY = ctrl.scionLids.state.charGazeY || 0.0;
        }
        for (let i = 0; i < ctrl.lids.length; i++) {
          const L = ctrl.lids[i];
          if (L.uLid) L._baseURx = L.uLid.rotation.x;
          if (L.lLid) L._baseLRx = L.lLid.rotation.x;
          if (L.eye) L._baseEyeZ = L.eye.rotation.z;
        }
        if (ctrl.scionLids && typeof ctrl.scionLids.setLod === "function" && opts.lodDist !== undefined) {
          ctrl.scionLids.setLod(opts.lodDist);
        }
        applyBoneAndShaderRig(dt, nowSec, opts, false);
        return res;
      };
    }

    // Public Character Methods
    ch.setBlink = function (close01) {
      ctrl.blinkOverride = (close01 === null || close01 === undefined || close01 === "auto") ? null : clamp(close01, 0, 1);
      applyBoneAndShaderRig(0.016, ctrl.lastNowSec, {}, true);
      return ch;
    };

    ch.setEyeGaze = function (yawRad, pitchRad) {
      if (yawRad === null || yawRad === undefined || yawRad === "auto") {
        ctrl.gazeOverrideX = null;
        ctrl.gazeOverrideY = null;
      } else {
        ctrl.gazeOverrideX = clamp(yawRad, -0.48, 0.48);
        ctrl.gazeOverrideY = clamp(pitchRad || 0, -0.42, 0.42);
      }
      applyBoneAndShaderRig(0.016, ctrl.lastNowSec, {}, true);
      return ch;
    };

    ch.setNeckLean = function (leanSpecOrAngle, immediate = true) {
      if (leanSpecOrAngle === null || leanSpecOrAngle === undefined || leanSpecOrAngle === "auto" || leanSpecOrAngle === false) {
        ctrl.neckLeanOverride = null;
        if (ch.state) ch.state._pinnedNeckLean = null;
      } else {
        ctrl.neckLeanOverride = leanSpecOrAngle;
        if (ch.state) {
          ch.state._pinnedNeckLean = leanSpecOrAngle;
          if (immediate) ch.state._snapNeckOnce = true;
        }
      }
      if (immediate) {
        applyBoneAndShaderRig(0.016, ctrl.lastNowSec, { neckLean: ctrl.neckLeanOverride }, true);
      }
      return ch;
    };

    ch.getNeckLeanState = function () {
      return Object.assign({}, (ch.state && ch.state.neckLeanState) || ctrl.neckLeanState);
    };

    ch.setEmotion = function (presetOrWeights, intensity = 1.0) {
      ctrl.emotionIntensity = clamp(intensity, 0, 1.5);
      if (typeof presetOrWeights === "string" || !presetOrWeights) {
        ctrl.emotionId = presetOrWeights || "neutral";
        ctrl.customWeights = null;
      } else if (typeof presetOrWeights === "object") {
        ctrl.emotionId = presetOrWeights.id || "custom";
        ctrl.customWeights = Object.assign({}, presetOrWeights);
      }
      applyBoneAndShaderRig(0.016, ctrl.lastNowSec, {}, true);
      return ch;
    };

    ch.setSpeech = function (activeOrPhrase, t, intensity = 1.0) {
      // Backward compatibility: single string call ch.setSpeech("line") updates label too if present
      if (typeof activeOrPhrase === "string" && t === undefined && origSetSpeechLabel) {
        origSetSpeechLabel(activeOrPhrase);
      }
      if (!activeOrPhrase) {
        ctrl.speaking = false;
      } else {
        ctrl.speaking = true;
        if (typeof activeOrPhrase === "string") ctrl.speechPhrase = activeOrPhrase;
        ctrl.speechIntensity = clamp(intensity, 0, 1.5);
        if (typeof t === "number") ctrl.lastNowSec = t;
      }
      applyBoneAndShaderRig(0.016, typeof t === "number" ? t : ctrl.lastNowSec, {}, Boolean(typeof t === "number"));
      return ch;
    };

    ch.setViseme = function (visemeId, amount = 1.0) {
      if (!visemeId || visemeId === "SIL" && amount === 0) {
        ctrl.visemeId = "SIL";
        ctrl.visemeAmount = 0.0;
      } else {
        ctrl.visemeId = VISEME_MAP[visemeId] ? visemeId : "SIL";
        ctrl.visemeAmount = clamp(amount, 0, 1.25);
      }
      applyBoneAndShaderRig(0.016, ctrl.lastNowSec, {}, true);
      return ch;
    };

    ch.setHandGesture = function (sideOrBoth, gestureId, t = 0, intensity = 1.0) {
      const s = sideOrBoth;
      const doL = s === "L" || s === "left" || s === 1 || s === "both" || s === "all" || s === 0 || !s;
      const doR = s === "R" || s === "right" || s === -1 || s === "both" || s === "all" || s === 0 || !s;
      if (doL) {
        ctrl.handGestureL = gestureId || null;
        ctrl.handIntensityL = clamp(intensity, 0, 1.25);
        ctrl.handTimeL = t;
        if (gestureId && ch.bones) applyExpressiveHandBones(ch.bones, ctrl.B, 1, gestureId, t, ctrl.handIntensityL);
      }
      if (doR) {
        ctrl.handGestureR = gestureId || null;
        ctrl.handIntensityR = clamp(intensity, 0, 1.25);
        ctrl.handTimeR = t;
        if (gestureId && ch.bones) applyExpressiveHandBones(ch.bones, ctrl.B, -1, gestureId, t, ctrl.handIntensityR);
      }
      if (ch.group) ch.group.updateMatrixWorld(true);
      if (ctrl.xraySkeleton && ctrl.xraySkeleton.isEnabled && ctrl.xraySkeleton.isEnabled()) {
        ctrl.xraySkeleton.update();
      }
      return ch;
    };

    ch.applyExpressiveArmPose = function (gestureId, t = 0, intensity = 1.0) {
      ctrl.armGesture = gestureId || null;
      ctrl.armIntensity = clamp(intensity, 0, 1.0);
      ctrl.armTime = t;
      if (gestureId) {
        applyExpressiveArmChain(T, ch, gestureId, t, ctrl.armIntensity);
        if (ch.group) ch.group.updateMatrixWorld(true);
        if (ctrl.xraySkeleton && ctrl.xraySkeleton.isEnabled && ctrl.xraySkeleton.isEnabled()) {
          ctrl.xraySkeleton.update();
        }
      }
      return ch;
    };

    ch.getExpressionState = function () {
      const emoDef = EMOTION_MAP[ctrl.emotionId] || EMOTION_MAP.neutral;
      const visId = ctrl.visemeAmount > 0.01 ? ctrl.visemeId : (ctrl.speaking || emoDef.autoSpeak ? ctrl.activeSpeechViseme : "SIL");
      const visDef = VISEME_MAP[visId] || VISEME_MAP.SIL;
      const nl = (ch.state && ch.state.neckLeanState) || ctrl.neckLeanState;
      return {
        emotion: ctrl.emotionId,
        emotionLabel: emoDef.label,
        shortLabel: emoDef.shortLabel,
        emotionIntensity: ctrl.emotionIntensity,
        auSummary: emoDef.auSummary,
        activeAUs: emoDef.activeAUs,
        speaking: Boolean(ctrl.speaking || emoDef.autoSpeak),
        speechPhrase: ctrl.speechPhrase,
        viseme: visId,
        visemeLabel: visDef.label,
        visemeAmount: ctrl.visemeAmount,
        jawOpen: curFacs.jawOpen,
        jawDeg: +(curFacs.jawOpen * 26.0).toFixed(1),
        facs: Object.assign({}, curFacs),
        neckLean: Object.assign({}, nl),
        handGestureL: ctrl.handGestureL || emoDef.defaultHand || "relaxed_breathing",
        handGestureR: ctrl.handGestureR || emoDef.defaultHand || "relaxed_breathing",
        expressiveArmGesture: ctrl.armGesture
      };
    };

    ctrl.applyBoneAndShaderRig = applyBoneAndShaderRig;
    ctrl.syncGpuUniforms = syncGpuUniforms;
    ch._v4ExpCtrl = ctrl;
    return ctrl;
  }

  function ensureController(ch, internals) {
    if (!ch) return null;
    if (ch._v4ExpCtrl) return ch._v4ExpCtrl;
    const T = (internals && internals.THREE) || (typeof window !== "undefined" && window.THREE);
    if (!T) return null;
    return attachCharacterExpressionController(T, ch, internals);
  }

  if (typeof window !== "undefined") {
    window.HumanExpressionsV4 = {
      version: "4.2.0",
      MAX_JAW_DEG: 26.0,
      FACS_KEYS,
      EMOTION_PRESETS,
      EMOTION_MAP,
      VISEME_PRESETS,
      VISEME_MAP,
      HAND_GESTURE_PRESETS,
      HAND_GESTURE_MAP,
      TOOL_GRIP_PRESETS,
      ACTIVE_PROP_GRIP_MODES,
      NECK_LEAN_PRESETS,
      attachCharacterExpressionController,
      ensureController,
      applyCervicalLeanArc,
      resolveNeckLeanSpec,
      computeEmotionalCervicalLean,
      applyExpressiveHandBones,
      applyExpressiveArmChain,
      sampleSpeechVisemes,
      loadExpressionPriors,
      getExpressionPriors: () => expressionPriorsState
    };

    // Auto-attach to any characters already registered in HumanSculptV3
    if (window.HumanSculptV3 && typeof window.HumanSculptV3.getActiveCharacters === "function" && window.THREE) {
      for (const ch of window.HumanSculptV3.getActiveCharacters()) {
        attachCharacterExpressionController(window.THREE, ch);
      }
    }
  }
})();
