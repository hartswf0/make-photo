/* Donkey Water · All-15-Look GPU Post-Process Shader Rack, 3×3 Darkroom Contact Sheet &
   "Cyan Jerikan Over Cosmic Addis" Music-Video Lip-Sync / Formant Audition Engine (v5 Scion).
   Ports the exact 14 GPU Zone/Optical Look Shaders (`LOOKS`), `MODES`, `SONG_EPOCHS`, and synced
   `LYRICS` from `night-post/night-post.js` — calibrated for soulful East African melanin skin
   (Zone IV–VI micro-contrast), crisp wet corneal catchlights, non-blown ivory sclera/teeth, and
   selective electric-cyan (#28d8f0) water, jerrycans & phone bounce.
   Exposes `window.LookAuditionMV` and seamlessly enhances `window.__study` in `study/index.html`. */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fract = x => x - Math.floor(x);
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* ---------- 1. Canonical 14 GPU Looks + Raw PBR + Modes + Epochs + Lyrics (from night-post.js) ---------- */
  const LOOKS = [
    { idx: 0,  id: "embers",      short: "Light Alone",    name: "LIGHT ALONE",    zone: 0,  trail: 0.88, desc: "Darkness pierced by drifting embers while keeping facial & surface definition." },
    { idx: 1,  id: "set",         short: "The Set CRT",    name: "THE SET",        zone: 1,  trail: 0.36, desc: "High-definition 320-line phosphor monitor with slow broadcast sync sweep." },
    { idx: 2,  id: "cave",        short: "Warm Cave",      name: "WARM CAVE",      zone: 2,  trail: 0.72, desc: "Thermal heat vision blended with crisp sculpted portrait relief." },
    { idx: 3,  id: "silhouette",  short: "Silhouette",     name: "SILHOUETTE",     zone: 3,  trail: 0.22, desc: "Lit warm tissue paper, crisp sumi-ink shadows, and vermilion rim accents." },
    { idx: 4,  id: "woodblock",   short: "Woodblock Print",   name: "WOODBLOCK SCREENPRINT", zone: 4,  trail: 0.15, desc: "4-spot-color graphic novel screenprint: slate-blue stone, terracotta-sienna, apricot-sand, sumi ink & selective #33ccf2 cyan." },
    { idx: 5,  id: "silver",      short: "Silver Gelatin",    name: "SILVER GELATIN",        zone: 5,  trail: 0.08, desc: "High-clarity Ansel Adams platinum-selenium 8×10 baryta fiber print." },
    { idx: 6,  id: "card",        short: "The Card",          name: "THE CARD",              zone: 6,  trail: 0.10, desc: "Cream archival stock hatched and cross-engraved by light." },
    { idx: 7,  id: "spray",       short: "Spray Wall",        name: "SPRAY WALL",            zone: 7,  trail: 0.82, desc: "Celluloid mural wall, white paper contour halos, and dripping pigment." },
    { idx: 8,  id: "watercolour", short: "Watercolour",       name: "WATERCOLOUR",           zone: 8,  trail: 0.16, desc: "Graphite pencil underdrawing washed with translucent pigment on cold-press paper." },
    { idx: 9,  id: "cyanotype",   short: "Cyanotype",         name: "CYANOTYPE",             zone: 9,  trail: 0.65, desc: "Hand-brushed Prussian blue blueprint exposed to bright highland sun." },
    { idx: 10, id: "glass",       short: "Glass",             name: "GLASS",                 zone: 10, trail: 0.76, desc: "X-ray optical refraction tracing glowing contour edges over deep relief." },
    { idx: 11, id: "risograph",   short: "Risograph Stipple", name: "RISOGRAPH STIPPLE",     zone: -1, trail: 0.12, desc: "High-frequency organic stippled paper grain mapping indigo-violet shadows, dusty coral-amber midtones & sunlit gold-cream." },
    { idx: 12, id: "inkwash",     short: "Ink Wash",          name: "INK WASH",              zone: -1, trail: 0.16, desc: "Sumi-e ink dilutions on fibrous washi paper with vermilion stone seal." },
    { idx: 13, id: "jerikan",     short: "Cyan Jerikan",      name: "CYAN JERIKAN · SILVER GELATIN", zone: -1, trail: 0.32, desc: "Continuous Zone II–VIII platinum-selenium monochrome on #e6e1d6 paper with selective #33ccf2 cyan water & pack window." }
  ];

  const RAW_LOOK = {
    idx: -1,
    id: "raw",
    short: "Raw PBR",
    name: "RAW STUDIO PBR",
    zone: -1,
    trail: 0.0,
    desc: "Unmodified Three.js ACESFilmic studio PBR reference."
  };

  // Ordered for the UI pill bar: 4 Hero Reference Looks first (Cyan Jerikan, Risograph Stipple, Woodblock Print, Raw PBR), followed by full Zone rack
  const UI_LOOK_ORDER = [
    "jerikan", "risograph", "woodblock", "raw", "silver", "cyanotype", "inkwash",
    "silhouette", "set", "card", "watercolour", "spray", "cave", "embers", "glass"
  ];

  const ALL_LOOKS = [RAW_LOOK].concat(LOOKS);

  // Exact 3x3 Signature Contact Sheet Grid (0..8)
  const CONTACT_SHEET_LOOKS = [
    { slot: 0, plate: "01", id: "raw",        label: "RAW PBR",        sub: "Studio Reference" },
    { slot: 1, plate: "02", id: "jerikan",    label: "CYAN JERIKAN",   sub: "Selective #28d8f0" },
    { slot: 2, plate: "03", id: "silver",     label: "SILVER GELATIN", sub: "Zone V Selenium" },
    { slot: 3, plate: "04", id: "woodblock",  label: "WOODBLOCK",      sub: "4-Block Woodcut" },
    { slot: 4, plate: "05", id: "cyanotype",  label: "CYANOTYPE",      sub: "Prussian Blueprint" },
    { slot: 5, plate: "06", id: "risograph",  label: "RISOGRAPH",      sub: "3-Drum Halftone" },
    { slot: 6, plate: "07", id: "inkwash",    label: "INK WASH",       sub: "Sumi-e & Seal" },
    { slot: 7, plate: "08", id: "silhouette", label: "SILHOUETTE",     sub: "Tissue & Sumi Ink" },
    { slot: 8, plate: "09", id: "set",        label: "THE SET",        sub: "320-Line CRT" }
  ];

  const MODES = [
    { id: "jerikan",   label: "DONKEY WATER", sub: "Cyan Jerikan Sci-Fi" },
    { id: "threshold", label: "THRESHOLD",    sub: "Tonal + Depth Pull" },
    { id: "shells",    label: "DEPTH SHELLS", sub: "Spatial Slides" },
    { id: "strata",    label: "TONAL STRATA", sub: "11-Zone Bands" }
  ];

  const SONG_EPOCHS = [
    { t0: 0,   t1: 45,  name: "I · Wellhead Awakening",    zone: 4,  relayId: "switchback", setIdx: 0 },
    { t0: 45,  t1: 94,  name: "II · Hooves on Cobble",     zone: 6,  relayId: "ford",       setIdx: 1 },
    { t0: 94,  t1: 140, name: "III · Kidase Under Awning", zone: 7,  relayId: "oxbow",      setIdx: 2 },
    { t0: 140, t1: 186, name: "IV · Tezeta Ferric Drop",   zone: 10, relayId: "pueblo",     setIdx: 3 },
    { t0: 186, t1: 235, name: "V · Whale Fluke Tide",      zone: 8,  relayId: "abyss",      setIdx: 3 },
    { t0: 235, t1: 290, name: "VI · Cosmic Addis Summit",  zone: 9,  relayId: "halfdome",   setIdx: 4 }
  ];

  // Exact canonical LYRICS from night-post/night-post.js lines 1705–1716
  const LYRICS = [
    [0,   "Intro · Warm cassette tape wakes before the rooster."],
    [12,  "“Iron lever cracks before the rooster / My hands know the cold of it.”"],
    [28,  "“Cyan jerikan balanced on my shoulder blade / Stone steps climbing toward a blue-lit door.”"],
    [45,  "“Take this water from my well / Will you carry what I cannot.”"],
    [62,  "“Carry the cyan up the ridge with me / Hooves on cobble and the tape is turning.”"],
    [94,  "“Kidase hums beneath the kiosk awning / Static blooms across the dial.”"],
    [118, "“My father dubbed his Tezeta onto ferric / Every slosh a metronome.”"],
    [152, "“Carry the cyan up the ridge with me / Brass comes back and the crates are spinning.”"],
    [186, "“Rope creaks · Wind holds its breath · The drums step out · And the basin fills.”"],
    [220, "“Cosmic Addis Arkestra — carry WiFi water up to the Highland Pueblo.”"]
  ];

  const LOOK_ALIASES = {
    pbr: "raw",
    studio: "raw",
    none: "raw",
    off: "raw",
    light_alone: "embers",
    ember: "embers",
    the_set: "set",
    crt: "set",
    warm_cave: "cave",
    thermal: "cave",
    woodcut: "woodblock",
    woodblock_print: "woodblock",
    woodblock_screenprint: "woodblock",
    screenprint: "woodblock",
    silver_gelatin: "silver",
    ansel: "silver",
    the_card: "card",
    spray_wall: "spray",
    watercolor: "watercolour",
    cyano: "cyanotype",
    blueprint: "cyanotype",
    xray_glass: "glass",
    riso: "risograph",
    risograph_stipple: "risograph",
    stipple: "risograph",
    ink_wash: "inkwash",
    sumie: "inkwash",
    cyan_jerikan: "jerikan",
    cyan: "jerikan",
    donkey_water: "jerikan",
    raw_pbr: "raw"
  };

  function resolveLook(idOrIdx) {
    if (idOrIdx === null || idOrIdx === undefined || idOrIdx === "") return RAW_LOOK;
    if (typeof idOrIdx === "number" && Number.isFinite(idOrIdx)) {
      const n = Math.round(idOrIdx);
      if (n < 0) return RAW_LOOK;
      return LOOKS[clamp(n, 0, LOOKS.length - 1)] || RAW_LOOK;
    }
    const rawStr = String(idOrIdx).trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (/^-?\d+$/.test(rawStr)) {
      const n = parseInt(rawStr, 10);
      return n < 0 ? RAW_LOOK : (LOOKS[clamp(n, 0, LOOKS.length - 1)] || RAW_LOOK);
    }
    const mapped = LOOK_ALIASES[rawStr] || rawStr;
    return ALL_LOOKS.find(l => l.id === mapped) ||
      ALL_LOOKS.find(l => l.name.toLowerCase().replace(/\s+/g, "_") === mapped) ||
      RAW_LOOK;
  }

  /* ---------- 2. Audition Cast, Sets & Director Camera Cut Definitions ---------- */
  const MV_CAST = [
    {
      id: "imani",
      short: "Imani",
      title: "Imani · 4C Coils & Duster",
      spec: {
        id: "mv_imani", name: "Imani", skinHex: 0x3b261b, fem: 0.86, scale: 1.0, build: 1.0,
        hair: "croppedCoily", outer: "duster", coatHex: 0x3b403c, shirtHex: 0x5c605a,
        trouserHex: 0x2c3032, toolBelt: true
      }
    },
    {
      id: "june",
      short: "June",
      title: "June · 68 Twisted Locs",
      spec: {
        id: "mv_june", name: "June", skinHex: 0x3f291e, fem: 0.56, scale: 0.82, build: 0.96,
        hair: "shortLocs", outer: "none", shirtHex: 0xb2a48c, trouserHex: 0x343635,
        tibebTrim: true, patchedKnees: true
      }
    },
    {
      id: "hanna",
      short: "Hanna",
      title: "Hanna · Feathered Ponytail",
      spec: {
        id: "mv_hanna", name: "Hanna", skinHex: 0xa27e68, fem: 0.82, scale: 0.97, build: 0.98,
        hair: "ponytail", hairHex: 0x3b2a1e, outer: "none", shirtHex: 0x1b2634,
        trouserHex: 0x282c30, rolledSleeves: true
      }
    },
    {
      id: "elder",
      short: "Elder",
      title: "Elder Berhanu · Beard & Shamma",
      spec: {
        id: "mv_elder", name: "Elder Berhanu", skinHex: 0x3f291d, fem: 0.10, scale: 1.02, build: 1.05,
        hair: "turban", wrapHex: 0x625a4c, beard: true, hairHex: 0x1a1715,
        outer: "shamma", coatHex: 0xb6ae9e, shirtHex: 0x5c5042, trouserHex: 0x2b2d2e
      }
    },
    {
      id: "makeda",
      short: "Makeda",
      title: "Makeda · Cornrows & Shamma",
      spec: {
        id: "mv_makeda", name: "Makeda", skinHex: 0x3c271c, fem: 0.88, scale: 0.98, build: 1.0,
        hair: "cornrowBraids", outer: "shamma", coatHex: 0xc8c0b0, shirtHex: 0x52483e,
        trouserHex: 0x2d3032, satchel: true
      }
    },
    {
      id: "daniel",
      short: "Daniel",
      title: "Daniel · Wire Glasses & Archive Shirt",
      spec: {
        id: "mv_daniel", name: "Daniel", skinHex: 0x9b7862, fem: 0.08, scale: 1.01, build: 1.04,
        hair: "glassesCrop", hairHex: 0x221b16, outer: "none", shirtHex: 0x23303e,
        trouserHex: 0x282b2e, rolledSleeves: true
      }
    },
    {
      id: "ensemble",
      short: "★ Full Ensemble",
      title: "Full Ensemble · 5-Voice Highland Arkestra",
      isEnsemble: true
    }
  ];

  const MV_SETS = [
    {
      idx: 0,
      id: "dawn_wellhead",
      short: "I · Dawn Wellhead & Pour",
      title: "I · Dawn Wellhead, Parabolic Cyan Spout & Mistletoe",
      startSec: 12.2,
      night: false,
      defaultLook: "jerikan",
      sunDeg: 38,
      desc: "Cast-iron standpipe gushing parabolic #28d8f0 water into a wheel-thrown terracotta bowl beside Mistletoe."
    },
    {
      idx: 1,
      id: "hidmo_handoff",
      short: "II · Hidmo 20 kg Handoff",
      title: "II · Hidmo Earthen Courtyard & 20 kg Jerrycan Handoff",
      startSec: 45.2,
      night: false,
      defaultLook: "jerikan",
      sunDeg: 54,
      desc: "Flat-roofed Ethiopian hidmo stone-and-mud compound, courtyard cyan well, and two-person 20 kg jerrycan handoff."
    },
    {
      idx: 2,
      id: "cottonwood_oxbow",
      short: "III · Oxbow Linen Screen",
      title: "III · Cottonwood Oxbow Billowing Linen Projection",
      startSec: 94.2,
      night: false,
      defaultLook: "silver",
      sunDeg: 312,
      desc: "Wind-billowing double linen cinema sheets between cottonwood trunks, 35mm filmstrip canopy & cyan root-bowl."
    },
    {
      idx: 3,
      id: "ahiya_night_convoy",
      short: "IV · Night Cyan Convoy",
      title: "IV · Ahiya Night Ridge Shamma Convoy & Phone Glow",
      startSec: 152.2,
      night: true,
      defaultLook: "jerikan",
      sunDeg: 24,
      desc: "Night ridge procession beside Mistletoe's glowing cyan pack windows with upward smartphone face-glow."
    },
    {
      idx: 4,
      id: "cosmic_addis_finale",
      short: "V · Cosmic Addis Eskista",
      title: "V · Cosmic Addis 6/8 Eskista Brass Finale",
      startSec: 220.2,
      night: false,
      defaultLook: "jerikan",
      sunDeg: 44,
      desc: "Full 104 BPM 6/8 Ethiopian Eskista shoulder-isolation brass chorus outside the Cyan Sanctuary."
    }
  ];

  const MV_CUTS = [
    { id: "auto",    short: "🎬 Auto Director", label: "AUTO DIRECTOR CUT" },
    { id: "face",    short: "Face 0.36m",       label: "85MM VOCAL FACE & EYES" },
    { id: "eyes",    short: "Eyes 0.20m",       label: "100MM SCION EYE & LASH MACRO" },
    { id: "neck",    short: "Neck & Collar",    label: "SCION NECK, CLAVICLE & COLLAR (0.44M)" },
    { id: "hands",   short: "Hands & Singing",  label: "50MM SINGING & EXPRESSIVE HANDS" },
    { id: "profile", short: "90° Profile",      label: "90° PROFILE RIM-LIGHT (0.44M)" },
    { id: "wide",    short: "Wide Set",         label: "35MM DONKEY & SET TWO-SHOT" },
    { id: "orbit",   short: "Free Orbit",       label: "FREE ORBIT & ZOOM" }
  ];

  /* ---------- 3. Word-to-Phoneme Viseme Mapper & Synced 104 BPM Vocal Score ---------- */
  // Maps English/Amharic lyric words into realistic (onset consonant -> stressed vowel -> coda) viseme tuples!
  function wordToPhonemePair(rawWord) {
    const w = String(rawWord || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return ["IH", "AA"];

    let onset = null;
    if (/^(m|b|p)/.test(w)) onset = "MM";
    else if (/^(f|v)/.test(w)) onset = "FF";
    else if (/^th/.test(w)) onset = "TH";
    else if (/^(w|wh|qu)/.test(w)) onset = "OO";
    else if (/^(l|n|t|d|r|s|z|k|c|g)/.test(w)) onset = "LL";

    let vowel = "AA";
    if (/(oo|ou|u|ew|ue|wo)/.test(w) && !/(out|our|ound|up|un|um|us|ut|ub)/.test(w)) {
      vowel = "OO";
    } else if (/(ow|oa|or|o|au|aw)/.test(w) && !/(on|of|from)/.test(w)) {
      vowel = "OH";
    } else if (/(ee|ea|ie|ey|iy|i$|y$|wi|fi|ki)/.test(w) && !/(my|by|sky|dial)/.test(w)) {
      vowel = "EE";
    } else if (/(^in|^it|^is|ll|ic|id|ig|im|ip|en|et|el|er)/.test(w) && !/(iron|jerikan|light)/.test(w)) {
      vowel = "IH";
    } else {
      vowel = "AA";
    }

    let coda = null;
    if (/(m|b|p)$/.test(w)) coda = "MM";
    else if (/(f|v)$/.test(w)) coda = "FF";
    else if (/th$/.test(w)) coda = "TH";
    else if (/(l|n|t|d)$/.test(w)) coda = "LL";

    return [onset, vowel, coda];
  }

  // Structured vocal sections anchored 1:1 to night-post.js LYRICS timestamps + call-and-response refrains
  // so characters sing continuous, musical, breath-phrased lines at ANY timestamp 0..283s!
  const VOCAL_SECTIONS = [
    {
      t0: 0, t1: 12, epochIdx: 0,
      emotion: "determined_focus", altEmotion: "relief_sigh",
      hand: "cupped_water_plea", dance: false,
      lines: [
        { sub: 0.0, dur: 4.8, breath: true, text: "Intro · Warm cassette tape wakes before the rooster", vocal: "Humming warm Tezeta prelude… mm — oh — ah" },
        { sub: 5.6, dur: 5.4, breath: false, text: "“Mm — dawn water rising in the iron pipe / Wake the highland tape”" }
      ]
    },
    {
      t0: 12, t1: 28, epochIdx: 0,
      emotion: "determined_focus", altEmotion: "concerned_pleading",
      hand: "talking_gesticulate", altHand: "clenched_fist_resolve", dance: false,
      lines: [
        { sub: 0.0,  dur: 4.6, text: "“Iron lever cracks before the rooster”" },
        { sub: 5.4,  dur: 4.4, text: "“My hands know the cold of it.”" },
        { sub: 10.8, dur: 4.4, text: "“Pump the living cyan into clay / Before the sun hits stone.”" }
      ]
    },
    {
      t0: 28, t1: 45, epochIdx: 0,
      emotion: "concerned_pleading", altEmotion: "determined_focus",
      hand: "cupped_water_plea", altHand: "pointing_call", dance: false,
      lines: [
        { sub: 0.0,  dur: 5.0, text: "“Cyan jerikan balanced on my shoulder blade”" },
        { sub: 5.8,  dur: 5.0, text: "“Stone steps climbing toward a blue-lit door.”" },
        { sub: 11.7, dur: 4.5, text: "“Twenty kilos singing against my ribs / Hold the signal steady.”" }
      ]
    },
    {
      t0: 45, t1: 62, epochIdx: 1,
      emotion: "concerned_pleading", altEmotion: "happy_joy",
      hand: "cupped_water_plea", altHand: "heart_gratitude", dance: false,
      lines: [
        { sub: 0.0,  dur: 4.6, text: "“Take this water from my well”" },
        { sub: 5.4,  dur: 4.8, text: "“Will you carry what I cannot.”" },
        { sub: 11.1, dur: 5.0, text: "“Pass the glowing handle palm to palm / Hidmo doors open wide.”" }
      ]
    },
    {
      t0: 62, t1: 94, epochIdx: 1,
      emotion: "happy_joy", altEmotion: "laughing_open",
      hand: "joyful_wave", altHand: "talking_gesticulate", dance: true,
      lines: [
        { sub: 0.0,  dur: 5.0, text: "“Carry the cyan up the ridge with me”" },
        { sub: 5.8,  dur: 5.2, text: "“Hooves on cobble and the tape is turning.”" },
        { sub: 12.0, dur: 5.0, text: "“Mistletoe steps steady on the silver ford / Signal in the saddle.”" },
        { sub: 18.0, dur: 5.2, text: "“Every drop a packet of highland light / Carry the cyan home.”" },
        { sub: 24.2, dur: 6.4, text: "“Oh — carry the water up the stone switchback / Let the village hear.”" }
      ]
    },
    {
      t0: 94, t1: 118, epochIdx: 2,
      emotion: "surprised_awe", altEmotion: "happy_joy",
      hand: "spread_splay_awe", altHand: "brow_shade_lookout", dance: false,
      lines: [
        { sub: 0.0,  dur: 5.2, text: "“Kidase hums beneath the kiosk awning”" },
        { sub: 6.0,  dur: 4.8, text: "“Static blooms across the dial.”" },
        { sub: 11.8, dur: 5.2, text: "“White linen sheets billow in the cottonwoods”" },
        { sub: 17.8, dur: 5.2, text: "“Silver wedding ghosts flicker in the wind.”" }
      ]
    },
    {
      t0: 118, t1: 152, epochIdx: 2,
      emotion: "speaking_animated", altEmotion: "heart_gratitude",
      hand: "heart_gratitude", altHand: "piano_finger_ripple", dance: false,
      lines: [
        { sub: 0.0,  dur: 5.4, text: "“My father dubbed his Tezeta onto ferric”" },
        { sub: 6.2,  dur: 4.6, text: "“Every slosh a metronome.”" },
        { sub: 11.8, dur: 5.4, text: "“Copper reel spinning through the oxbow leaves”" },
        { sub: 18.2, dur: 5.4, text: "“Pour the blue dipper in the hollow root”" },
        { sub: 24.6, dur: 7.8, text: "“Memory flows where the cold creek bends / Hold the lantern high.”" }
      ]
    },
    {
      t0: 152, t1: 186, epochIdx: 3,
      emotion: "happy_joy", altEmotion: "determined_focus",
      hand: "talking_gesticulate", altHand: "joyful_wave", dance: true,
      lines: [
        { sub: 0.0,  dur: 5.2, text: "“Carry the cyan up the ridge with me”" },
        { sub: 6.0,  dur: 5.4, text: "“Brass comes back and the crates are spinning.”" },
        { sub: 12.4, dur: 5.4, text: "“Blue phone light on our cheekbones in the dark”" },
        { sub: 18.8, dur: 5.6, text: "“Ahiya network linking trail to trail”" },
        { sub: 25.4, dur: 7.4, text: "“Signal of God in twenty-liter plastic / Walk the night convoy.”" }
      ]
    },
    {
      t0: 186, t1: 220, epochIdx: 4,
      emotion: "surprised_awe", altEmotion: "concerned_pleading",
      hand: "cupped_water_plea", altHand: "spread_splay_awe", dance: false,
      lines: [
        { sub: 0.0,  dur: 4.8, text: "“Rope creaks · Wind holds its breath”" },
        { sub: 5.6,  dur: 5.2, text: "“The drums step out · And the basin fills.”" },
        { sub: 11.8, dur: 5.4, text: "“Deep stone cooling vault drinks the mountain stream”" },
        { sub: 18.2, dur: 5.6, text: "“Every server breathing cyan highland rain”" },
        { sub: 24.8, dur: 7.8, text: "“Open up the sluice gate — let the chorus rise!”" }
      ]
    },
    {
      t0: 220, t1: 290, epochIdx: 5,
      emotion: "laughing_open", altEmotion: "happy_joy",
      hand: "joyful_wave", altHand: "spread_splay_awe", dance: true,
      lines: [
        { sub: 0.0,  dur: 6.2, text: "“Cosmic Addis Arkestra — carry WiFi water up to the Highland Pueblo.”" },
        { sub: 7.2,  dur: 5.6, text: "“Shoulders pop six-eight in the courtyard sun!”" },
        { sub: 13.8, dur: 5.8, text: "“Eskista brass ringing off the chapel cross!”" },
        { sub: 20.6, dur: 5.8, text: "“Carry the cyan — water is our song!”" },
        { sub: 27.4, dur: 6.2, text: "“From Snake River Overlook up to Cosmic Addis!”" },
        { sub: 34.6, dur: 6.2, text: "“Drink from the shekla bowl — every voice connected!”" },
        { sub: 41.8, dur: 20.0, text: "“Cosmic Addis Arkestra — carry WiFi water up to the Highland Pueblo!”" }
      ]
    }
  ];

  function evaluateVocalTimeline(songSec) {
    const duration = 283.24;
    const t = ((songSec % duration) + duration) % duration;

    // Canonical Night-Post lyric lookup
    let canonicalLyric = LYRICS[0][1];
    for (let i = 0; i < LYRICS.length; i++) {
      if (t >= LYRICS[i][0]) canonicalLyric = LYRICS[i][1];
    }

    // Epoch lookup
    let epoch = SONG_EPOCHS[0];
    for (let i = 0; i < SONG_EPOCHS.length; i++) {
      if (t >= SONG_EPOCHS[i].t0 && t < SONG_EPOCHS[i].t1) {
        epoch = SONG_EPOCHS[i];
        break;
      }
    }

    // Active vocal section
    let sec = VOCAL_SECTIONS[0];
    for (let i = 0; i < VOCAL_SECTIONS.length; i++) {
      if (t >= VOCAL_SECTIONS[i].t0 && t < VOCAL_SECTIONS[i].t1) {
        sec = VOCAL_SECTIONS[i];
        break;
      }
    }

    const localT = t - sec.t0;
    let activeLine = sec.lines[0];
    for (let i = 0; i < sec.lines.length; i++) {
      if (localT >= sec.lines[i].sub) activeLine = sec.lines[i];
    }

    const lineElapsed = localT - activeLine.sub;
    const inPhrase = lineElapsed >= 0 && lineElapsed <= activeLine.dur;
    const cleanPhrase = (activeLine.vocal || activeLine.text).replace(/[“”"—·/]/g, " ").replace(/\s+/g, " ").trim();
    const words = cleanPhrase.split(" ").filter(Boolean);

    let viseme = "SIL";
    let visemeAmount = 0.0;
    let activeWord = "";
    let activeWordIdx = -1;
    let isBreathing = !inPhrase;

    if (inPhrase && words.length > 0) {
      const u = clamp(lineElapsed / Math.max(0.2, activeLine.dur), 0, 0.9999);
      activeWordIdx = Math.floor(u * words.length);
      activeWord = words[activeWordIdx] || "";
      const wordU = fract(u * words.length);
      const [onset, vowel, coda] = wordToPhonemePair(activeWord);

      if (onset && wordU < 0.22) {
        viseme = onset;
        visemeAmount = onset === "MM" ? 0.88 : 0.76;
      } else if (coda && wordU > 0.82) {
        viseme = coda;
        visemeAmount = coda === "MM" ? 0.84 : 0.70;
      } else {
        viseme = vowel;
        // Natural syllabic bell curve so jaw pulses smoothly on every sung syllable!
        const syllEnv = 0.62 + 0.36 * Math.sin(clamp((wordU - 0.12) / 0.74, 0, 1) * Math.PI);
        visemeAmount = clamp(syllEnv, 0.45, 0.92);
      }
    } else {
      // Breath intake between phrases!
      const breathPh = clamp((lineElapsed - activeLine.dur) / 0.85, 0, 1);
      if (breathPh > 0.12 && breathPh < 0.68) {
        viseme = "IH";
        visemeAmount = 0.22 * Math.sin(((breathPh - 0.12) / 0.56) * Math.PI);
      } else {
        viseme = "SIL";
        visemeAmount = 0.0;
      }
    }

    // 104 BPM 6/8 Ethio-jazz beat math (1 dotted-quarter beat = 60/104 = 0.57692s; 2-beat bar = 1.1538s; 6/8 compound bar = 1.7308s)
    const beatFloat = t * (104 / 60);
    const beatPhase = fract(beatFloat);
    const barIndex = Math.floor(beatFloat / 3); // ~1.73s per 3-beat measure
    const useAlt = (barIndex % 4) >= 2;

    return {
      songTime: t,
      epoch,
      canonicalLyric,
      lineText: activeLine.text,
      words,
      activeWord,
      activeWordIdx,
      viseme,
      visemeAmount,
      isBreathing,
      singing: inPhrase,
      emotion: (useAlt && sec.altEmotion) ? sec.altEmotion : sec.emotion,
      handGesture: (useAlt && sec.altHand) ? sec.altHand : sec.hand,
      isChorusDance: Boolean(sec.dance),
      beatFloat,
      beatPhase,
      barIndex
    };
  }

  /* ---------- 4. WebAudio Formant (300-2800Hz) & Percussion (60-160Hz) Song Engine ---------- */
  function createSongEngine(opts = {}) {
    const audioUrl = opts.audioUrl || "../zones/cyan-jerikan.ogg";
    let audioEl = null;
    let ctx = null;
    let analyser = null;
    let freqData = null;
    let sourceConnected = false;
    let playing = opts.autoPlay !== false;
    let audioUnmuted = false;
    let fallbackTime = opts.startTime !== undefined ? opts.startTime : 12.2;
    let prevPerc = 0;
    let beatPulse = 0;
    let vocalFormantEnv = 0;
    let percEnv = 0;
    let highBrassEnv = 0;

    function ensureAudioElement() {
      if (audioEl || typeof document === "undefined") return audioEl;
      audioEl = document.createElement("audio");
      audioEl.src = audioUrl;
      audioEl.loop = true;
      audioEl.preload = "auto";
      audioEl.crossOrigin = "anonymous";
      audioEl.currentTime = fallbackTime;
      return audioEl;
    }

    function connectWebAudio() {
      const el = ensureAudioElement();
      if (!el) return false;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      if (!ctx) {
        ctx = new AC();
      }
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      if (!sourceConnected) {
        try {
          const src = ctx.createMediaElementSource(el);
          analyser = ctx.createAnalyser();
          analyser.fftSize = 512; // 48000 / 512 = 93.75 Hz per bin!
          analyser.smoothingTimeConstant = 0.68;
          freqData = new Uint8Array(analyser.frequencyBinCount);
          const gain = ctx.createGain();
          gain.gain.value = 0.88;
          src.connect(analyser);
          analyser.connect(gain);
          gain.connect(ctx.destination);
          sourceConnected = true;
        } catch (_e) {
          // Safe fallback if MediaElementSource already bound
        }
      }
      return true;
    }

    async function toggleUnmute(forceState) {
      const want = forceState !== undefined ? Boolean(forceState) : !audioUnmuted;
      const el = ensureAudioElement();
      if (!el) return false;
      if (want) {
        connectWebAudio();
        try {
          if (Math.abs(el.currentTime - fallbackTime) > 0.6) {
            el.currentTime = fallbackTime % 283.0;
          }
        } catch (_e) { /* metadata still loading */ }
        el.muted = false;
        playing = true;
        try {
          await el.play();
          audioUnmuted = true;
        } catch (_err) {
          audioUnmuted = false;
        }
      } else {
        el.muted = true;
        el.pause();
        audioUnmuted = false;
      }
      return audioUnmuted;
    }

    function setPlaying(flag) {
      playing = Boolean(flag);
      if (audioEl && audioUnmuted) {
        if (playing) audioEl.play().catch(() => {});
        else audioEl.pause();
      }
      return playing;
    }

    function seek(sec) {
      fallbackTime = ((+sec % 283.24) + 283.24) % 283.24;
      if (audioEl) {
        try { audioEl.currentTime = fallbackTime; } catch (_e) { /* ignore */ }
      }
    }

    function sample(dt = 0.016) {
      const sDt = clamp(dt, 0.001, 0.08);
      const liveAudioActive = Boolean(audioUnmuted && audioEl && !audioEl.paused && ctx && ctx.state === "running");

      if (liveAudioActive) {
        fallbackTime = audioEl.currentTime || fallbackTime;
      } else if (playing) {
        fallbackTime = (fallbackTime + sDt) % 283.24;
      }

      const vox = evaluateVocalTimeline(fallbackTime);

      let rawPerc = 0;
      let rawVocal = 0;
      let rawHigh = 0;
      let gotLiveSpectrum = false;

      if (liveAudioActive && analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        // Bins 1..2 (~60-185 Hz): Kebero bass drum & bass guitar
        rawPerc = (freqData[1] + freqData[2]) / (2 * 255);
        // Bins 3..30 (~280-2812 Hz): Human vocal formants F1 + F2!
        let vSum = 0;
        for (let b = 3; b <= 30; b++) vSum += freqData[b];
        rawVocal = vSum / (28 * 255);
        // Bins 31..90 (~2900-8400 Hz): Addis brass & sibilance
        let hSum = 0;
        for (let b = 31; b <= 90; b++) hSum += freqData[b];
        rawHigh = hSum / (60 * 255);
        gotLiveSpectrum = (rawPerc + rawVocal + rawHigh) > 0.015;
      }

      if (!gotLiveSpectrum) {
        // Deterministic 104 BPM 6/8 Ethio-jazz rhythm & vocal formant envelope fallback!
        const ph = vox.beatPhase;
        const sub68 = fract(vox.beatFloat * 1.5);
        const kick = Math.exp(-ph * 5.4);
        const keberoOff = Math.exp(-fract(ph + 0.5) * 6.8) * 0.62;
        rawPerc = playing ? clamp(kick * 0.76 + keberoOff * 0.36, 0, 1) : 0.12;
        rawVocal = (playing && vox.singing)
          ? clamp(vox.visemeAmount * (0.72 + 0.28 * Math.sin(fallbackTime * 11.5)), 0.18, 0.96)
          : 0.06;
        rawHigh = playing ? clamp(0.18 + 0.42 * Math.exp(-sub68 * 4.8) * (vox.isChorusDance ? 1.15 : 0.75), 0, 1) : 0.08;
      }

      const flux = Math.max(0, rawPerc - prevPerc);
      prevPerc = lerp(prevPerc, rawPerc, clamp(sDt * 9.0, 0, 1));
      if (flux > 0.055 || rawPerc > 0.66) {
        beatPulse = Math.min(1.0, Math.max(beatPulse, rawPerc * 1.12));
      }
      beatPulse = Math.max(0, beatPulse - sDt * 2.8);

      percEnv = lerp(percEnv, rawPerc, clamp(sDt * 14.0, 0, 1));
      vocalFormantEnv = lerp(vocalFormantEnv, rawVocal, clamp(sDt * 18.0, 0, 1));
      highBrassEnv = lerp(highBrassEnv, rawHigh, clamp(sDt * 12.0, 0, 1));

      // Modulate syllable aperture with real-time WebAudio vocal formant energy when live!
      let finalVisAmt = vox.visemeAmount;
      if (gotLiveSpectrum && vox.singing && vox.viseme !== "MM") {
        finalVisAmt = clamp(vox.visemeAmount * (0.62 + 0.68 * vocalFormantEnv), 0.28, 0.95);
      }

      return {
        ...vox,
        visemeAmount: finalVisAmt,
        playing,
        audioUnmuted,
        liveSpectrum: gotLiveSpectrum,
        percEnv,
        vocalFormantEnv,
        highBrassEnv,
        beatPulse: clamp(beatPulse, 0, 1)
      };
    }

    return {
      sample,
      seek,
      setPlaying,
      toggleUnmute,
      isPlaying: () => playing,
      isUnmuted: () => audioUnmuted,
      getTime: () => fallbackTime,
      getAudioElement: ensureAudioElement
    };
  }

  /* ---------- 5. Procedural 35mm Filmstrip Texture (for Look 7 Spray Wall & Oxbow) ---------- */
  function createFilmStripTexture(T) {
    const filmCanvas = document.createElement("canvas");
    filmCanvas.width = 256;
    filmCanvas.height = 512;
    const fctx = filmCanvas.getContext("2d");
    fctx.fillStyle = "#161513";
    fctx.fillRect(0, 0, 256, 512);
    for (let row = 0; row < 16; row++) {
      const y = row * 32 + 6;
      fctx.fillStyle = "#efe9d8";
      fctx.fillRect(10, y, 16, 18);
      fctx.fillRect(230, y, 16, 18);
    }
    for (let fr = 0; fr < 4; fr++) {
      const y = fr * 128 + 12;
      const g = fctx.createLinearGradient(42, y, 214, y + 104);
      g.addColorStop(0, fr % 2 ? "#0d0d0d" : "#d8d4c8");
      g.addColorStop(0.5, "#747169");
      g.addColorStop(1, fr % 2 ? "#e9e5da" : "#181817");
      fctx.fillStyle = g;
      fctx.fillRect(42, y, 172, 104);
    }
    const filmTex = new T.CanvasTexture(filmCanvas);
    filmTex.wrapS = filmTex.wrapT = T.RepeatWrapping;
    return filmTex;
  }

  /* ---------- 6. Exact 15-Look Post-Process GPU Shader Rack + 3×3 Contact Sheet ---------- */
  function createPostProcessor(T, renderer) {
    const gl = renderer.getContext();
    const isWebGL2 = Boolean(renderer.capabilities && renderer.capabilities.isWebGL2);
    const hasHalfFloatRender = Boolean(
      (isWebGL2 && gl.getExtension("EXT_color_buffer_float")) ||
      gl.getExtension("EXT_color_buffer_half_float")
    );
    const sceneRtType = (hasHalfFloatRender && T.HalfFloatType) ? T.HalfFloatType : T.UnsignedByteType;

    // Single-sampled (samples: 0) so DepthTexture attachment is 100% FRAMEBUFFER_COMPLETE (gl.getError() === 0)!
    const rtScene = new T.WebGLRenderTarget(64, 64, {
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      type: sceneRtType,
      depthBuffer: true,
      stencilBuffer: false
    });
    rtScene.texture.generateMipmaps = false;
    rtScene.depthTexture = new T.DepthTexture(64, 64);
    rtScene.depthTexture.format = T.DepthFormat;
    rtScene.depthTexture.type = isWebGL2 && T.UnsignedIntType ? T.UnsignedIntType : T.UnsignedShortType;
    rtScene.depthTexture.minFilter = T.NearestFilter;
    rtScene.depthTexture.magFilter = T.NearestFilter;

    let rtA = new T.WebGLRenderTarget(64, 64, {
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      type: T.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false
    });
    rtA.texture.generateMipmaps = false;
    let rtB = rtA.clone();

    let curW = 64, curH = 64;
    function syncSize(w, h) {
      const pw = Math.max(2, Math.floor(w));
      const ph = Math.max(2, Math.floor(h));
      if (pw !== curW || ph !== curH) {
        curW = pw;
        curH = ph;
        rtScene.setSize(pw, ph);
        rtA.setSize(pw, ph);
        rtB.setSize(pw, ph);
      }
    }

    const filmTex = createFilmStripTexture(T);
    const postScene = new T.Scene();
    const postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const postQuad = new T.Mesh(new T.PlaneGeometry(2, 2), null);
    postQuad.frustumCulled = false;
    postScene.add(postQuad);

    const VS = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const colorConvertGLSL = `
      uniform float uExposure;
      uniform float uApplyTonemap;

      vec3 rrtAndOdtFit(vec3 v) {
        vec3 a = v * (v + 0.0245786) - 0.000090537;
        vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
        return a / b;
      }
      vec3 acesFilmic(vec3 col, float exposure) {
        mat3 inMat = mat3(
          vec3(0.59719, 0.07600, 0.02840),
          vec3(0.35458, 0.90834, 0.13383),
          vec3(0.04823, 0.01566, 0.83777)
        );
        mat3 outMat = mat3(
          vec3( 1.60475, -0.10208, -0.00327),
          vec3(-0.53108,  1.10813, -0.07276),
          vec3(-0.07367, -0.00605,  1.07602)
        );
        col *= exposure / 0.6;
        col = inMat * col;
        col = rrtAndOdtFit(col);
        col = outMat * col;
        return clamp(col, 0.0, 1.0);
      }
      float linToSrgb1(float c) {
        float v = max(c, 0.0);
        return v <= 0.0031308 ? v * 12.92 : (1.055 * pow(v, 1.0 / 2.4) - 0.055);
      }
      vec3 linearToSrgbVec(vec3 c) {
        return clamp(vec3(linToSrgb1(c.r), linToSrgb1(c.g), linToSrgb1(c.b)), 0.0, 1.0);
      }
      vec3 decodeSceneDisplay(vec3 hdr, float zb) {
        if (uApplyTonemap < 0.5) return clamp(hdr, 0.0, 1.0);
        float isBg = step(0.99995, zb);
        vec3 mapped = mix(acesFilmic(max(hdr, vec3(0.0)), uExposure), clamp(hdr, 0.0, 1.0), isBg);
        return linearToSrgbVec(mapped);
      }
    `;

    const accMat = new T.ShaderMaterial({
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tCur: { value: null },
        tDepth: { value: rtScene.depthTexture },
        tPrev: { value: null },
        uDamp: { value: 0.28 },
        uExposure: { value: 1.09 },
        uApplyTonemap: { value: 1.0 }
      },
      vertexShader: VS,
      fragmentShader: `
        uniform sampler2D tCur, tDepth, tPrev;
        uniform float uDamp;
        varying vec2 vUv;
        ${colorConvertGLSL}
        void main() {
          float zb = texture2D(tDepth, vUv).x;
          vec3 cur = decodeSceneDisplay(texture2D(tCur, vUv).rgb, zb);
          vec3 prv = texture2D(tPrev, vUv).rgb;
          gl_FragColor = vec4(max(cur, prv * uDamp), 1.0);
        }
      `
    });

    const lookMat = new T.ShaderMaterial({
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: rtScene.texture },
        tDepth: { value: rtScene.depthTexture },
        tTrail: { value: rtA.texture },
        tFilm: { value: filmTex },
        uRes: { value: new T.Vector2(800, 600) },
        uT: { value: 0 },
        uNear: { value: 0.02 },
        uFar: { value: 240.0 },
        uSoloLook: { value: 13 },
        uContactSheet: { value: 0 },
        uFilter: { value: new T.Vector3(1.02, 1.02, 1.12) },
        uBeatPulse: { value: 0.0 },
        uAudioBass: { value: 0.0 },
        uAudioHigh: { value: 0.0 },
        uExposure: { value: 1.09 },
        uApplyTonemap: { value: 1.0 }
      },
      vertexShader: VS,
      fragmentShader: `
        uniform sampler2D tScene, tDepth, tTrail, tFilm;
        uniform vec2 uRes;
        uniform float uT, uNear, uFar, uBeatPulse, uAudioBass, uAudioHigh;
        uniform int uSoloLook, uContactSheet;
        uniform vec3 uFilter;
        varying vec2 vUv;
        ${colorConvertGLSL}

        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float lumRaw(vec3 c) { return clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0); }
        float lumFiltered(vec3 c) { return clamp(dot(c * uFilter, vec3(0.30, 0.59, 0.11)), 0.0, 1.0); }
        float n2(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x),
                     mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float readDist(vec2 uv) {
          float zb = texture2D(tDepth, uv).x;
          return (uNear * uFar) / max(0.0001, uFar - zb * (uFar - uNear));
        }
        vec3 sampleDisplay(vec2 uv) {
          vec2 cuv = clamp(uv, vec2(0.001), vec2(0.999));
          float zb = texture2D(tDepth, cuv).x;
          return decodeSceneDisplay(texture2D(tScene, cuv).rgb, zb);
        }
        float drip(vec2 uv, vec2 effRes) {
          float cx = floor(uv.x * effRes.x / 6.0);
          if (h(vec2(cx, 7.0)) < 0.82) return 0.0;
          float len = 0.035 + 0.12 * h(vec2(cx, 3.0));
          float m = 0.0;
          for (int k = 1; k <= 5; k++) {
            float lk = lumRaw(sampleDisplay(vec2(uv.x, min(0.998, uv.y + len * float(k) / 5.0))));
            m = max(m, step(0.62, lk));
          }
          return m;
        }

        // Exact 3x3 Contact Sheet Look Mapping (Row 0 top -> Row 2 bottom, Col 0..2 left -> right)
        int pickContactLook(int slot) {
          if (slot == 0) return -1; // 01: RAW STUDIO PBR
          if (slot == 1) return 13; // 02: CYAN JERIKAN
          if (slot == 2) return 5;  // 03: SILVER GELATIN
          if (slot == 3) return 4;  // 04: WOODBLOCK
          if (slot == 4) return 9;  // 05: CYANOTYPE
          if (slot == 5) return 11; // 06: RISOGRAPH
          if (slot == 6) return 12; // 07: INK WASH
          if (slot == 7) return 3;  // 08: SILHOUETTE
          return 1;                 // 09: THE SET
        }

        float evalCyanMask(vec3 raw) {
          float cyanSig = (0.52 * raw.b + 0.48 * raw.g) - raw.r;
          float maxBG = max(raw.b, raw.g);
          float cyanRatio = cyanSig / max(maxBG, 0.04);
          float blueOverRed = (raw.b - raw.r) / max(raw.b, 0.04);
          float greenOverRed = (raw.g - raw.r) / max(raw.g, 0.04);
          // Concentric white-rimmed cyan ripple crests (0bc287c6.jpg) where specular white mixes with #33ccf2:
          float crestMask = smoothstep(0.66, 0.88, maxBG) * smoothstep(0.055, 0.17, cyanSig) * smoothstep(0.075, 0.21, blueOverRed);
          // Core selective cyan water stream, jerrycans & Mistletoe pack window (rejecting dark navy/slate cloth):
          float bodyMask = smoothstep(0.24, 0.44, cyanRatio)
                         * smoothstep(0.22, 0.44, blueOverRed)
                         * smoothstep(0.14, 0.34, greenOverRed)
                         * smoothstep(0.18, 0.34, maxBG);
          return clamp(max(bodyMask, crestMask), 0.0, 1.0);
        }

        vec3 evalLook(
          int mode, vec2 uv, vec2 effRes,
          vec3 raw, vec3 silverBase, vec3 tr, vec3 smoothRgb,
          float lp, float lBiSkin, float lBiRaw, float lMacroRaw, float ed, float edClean, float edBroad, float edDepth, float vg,
          float isGeo, float skinMask, float neutralBright, float catchSpark
        ) {
          if (mode < 0) return raw;
          vec2 px = uv * effRes;
          float cMask = evalCyanMask(raw);
          float isDaySky = (1.0 - isGeo) * smoothstep(0.22, 0.42, lumRaw(raw));
          vec3 col;

          if (mode == 0) {
            // 0 · LIGHT ALONE (Embers + sculptural silver portrait relief)
            float spk = smoothstep(0.995, 1.0, h(floor(px / 2.6))) * (0.48 + 0.36 * sin(uT * 0.95 + px.x * 0.1));
            vec3 em = mix(raw * 0.42, tr, 0.58) * smoothstep(0.10, 0.82, lp);
            col = mix(silverBase * 0.58, em * vec3(1.16, 0.72, 0.38) + spk * vec3(1.0, 0.76, 0.42), 0.62);
          } else if (mode == 1) {
            // 1 · THE SET (320-line CRT phosphor monitor with calibrated portrait gamma)
            float rows = 320.0;
            vec2 g = vec2(uv.x, (floor(uv.y * rows) + 0.5) / rows);
            vec3 scanCol = sampleDisplay(g);
            float ls = mix(lumFiltered(scanCol), lp, 0.72);
            float line = 0.87 + 0.13 * sin(uv.y * rows * 6.2831853);
            float sweep = smoothstep(0.05, 0.0, abs(fract(uv.y - uT * 0.04) - 0.5) - 0.45) * 0.045;
            vec3 crt = vec3(0.76, 0.92, 1.0) * (pow(clamp(ls * 1.18 + 0.03, 0.0, 1.0), 0.84) * line + sweep) * vg;
            col = mix(silverBase * 0.46, crt, 0.72);
          } else if (mode == 2) {
            // 2 · WARM CAVE (Thermal indigo -> magenta -> vermilion -> gold + portrait silver)
            float th = pow(clamp(lBiSkin * 1.08, 0.0, 1.0), 0.84);
            vec3 hm = th < 0.26 ? mix(vec3(0.09, 0.03, 0.16), vec3(0.46, 0.06, 0.48), th / 0.26)
                    : th < 0.58 ? mix(vec3(0.46, 0.06, 0.48), vec3(0.92, 0.26, 0.10), (th - 0.26) / 0.32)
                    : mix(vec3(0.92, 0.26, 0.10), vec3(1.0, 0.86, 0.34), (th - 0.58) / 0.42);
            col = mix(hm, silverBase * 0.96, 0.36);
          } else if (mode == 3) {
            // 3 · SILHOUETTE (Backlit Golden-Amber Lantern Paper + Deep Velvet Sumi Shadow Cutout + Warm Vermilion-Gold Key Plane)
            float fiber = n2(vec2(px.x / 58.0, px.y / 2.8)) * 0.55 + n2(px / 16.0) * 0.45;
            float lanternHalo = exp(-dot((uv - vec2(0.5, 0.54)) * vec2(1.20, 1.00), (uv - vec2(0.5, 0.54)) * vec2(1.20, 1.00)) * 1.75);
            vec3 lanternPaper = mix(vec3(0.86, 0.48, 0.18), vec3(1.00, 0.88, 0.52), clamp(lanternHalo * 0.82 + vg * 0.26, 0.0, 1.0))
                              * (0.94 + 0.08 * fiber);

            float dLinear = readDist(uv);
            float isBg = clamp((1.0 - isGeo) + smoothstep(5.40, 8.20, dLinear), 0.0, 1.0);

            vec3 velvetSumi = vec3(0.065, 0.050, 0.068);
            float litCut = smoothstep(0.38, 0.48, lBiSkin);
            vec3 litTissue = mix(vec3(0.80, 0.25, 0.12), vec3(0.98, 0.82, 0.44), smoothstep(0.46, 0.74, lBiSkin)) * (0.95 + 0.07 * fiber);
            vec3 puppet = mix(velvetSumi, litTissue, litCut);

            puppet = mix(puppet, lanternPaper * 0.90, neutralBright * 0.65);
            puppet = mix(velvetSumi, puppet, smoothstep(0.08, 0.18, lp));
            puppet = mix(puppet, vec3(1.00, 0.96, 0.82), catchSpark * 0.92);

            col = mix(puppet, lanternPaper, isBg);
          } else if (mode == 4) {
            // 4 · WOODBLOCK SCREENPRINT (735822c2.jpg 1:1 — 4-Spot-Color Graphic-Novel Screenprint:
            //   Cool Slate #5d6d7e/#6d7782/#7c8690 stone/doors/ground, Burnt-Sienna #8e4926 & Terracotta #c26b3b midtones,
            //   Sunlit Apricot-Sand #e8b282 lit planes, Warm Cream #f5dfc6 paper sky, Selective #33ccf2 Cyan, Sumi-Ink #181d26)
            float paperFiber = n2(vec2(px.x / 64.0, px.y / 2.4)) * 0.55 + n2(px / 11.0) * 0.45;
            vec3 sumiInk    = vec3(0.094, 0.114, 0.149); // #181d26 crisp sumi ink
            vec3 paperCream = vec3(0.961, 0.875, 0.776) * (0.965 + 0.048 * paperFiber); // #f5dfc6 warm screenprint stock

            // Separate cool basalt masonry, slate chapel doors & courtyard ground (B > R) from warm skin, terracotta, wood, donkey & cloth!
            float coolMask = isGeo * smoothstep(-0.012, 0.024, smoothRgb.b - smoothRgb.r) * (1.0 - skinMask) * (1.0 - cMask);

            vec3 slateStone = vec3(0.365, 0.427, 0.494); // #5d6d7e cool slate-blue stone masonry
            vec3 slateDoor  = vec3(0.427, 0.467, 0.510); // #6d7782 chapel double doors & shaded plinth
            vec3 slateFloor = vec3(0.486, 0.525, 0.565); // #7c8690 sunlit cool slate courtyard ground
            vec3 slateArch  = vec3(0.735, 0.755, 0.775); // #bbc1c6 pale limestone arch voussoirs

            vec3 siennaDeep = vec3(0.557, 0.286, 0.149); // #8e4926 graphic-novel burnt-sienna shadow plane
            vec3 terraMid   = vec3(0.753, 0.420, 0.235); // #c06b3c rich terracotta-sienna midtone
            vec3 apricotHi  = vec3(0.910, 0.698, 0.510); // #e8b282 sunlit apricot-sand lit facial & cloth plane
            vec3 creamHi    = vec3(0.965, 0.882, 0.788); // #f6e1c9 highest shamma sun crest

            // Pore-free facial/skin region mask (covers 100% of all 5 cast faces from deep shadow to sunlit forehead!)
            float wbWarmRB = smoothRgb.r - smoothRgb.b;
            float wbRelWarm = wbWarmRB / max(smoothRgb.r, 0.020);
            float wbSkinRegion = clamp(max(skinMask,
              isGeo * smoothstep(0.20, 0.42, wbRelWarm)
                    * smoothstep(0.008, 0.030, wbWarmRB)
                    * (1.0 - smoothstep(0.60, 0.80, lMacroRaw))
                    * smoothstep(0.028, 0.054, lMacroRaw)
            ), 0.0, 1.0);

            // 1) FACES / SKIN: 100% pore-free macro/bilateral plane luminance (0% 1-2px raw/smooth5 noise -> zero facial speckle!)
            float lSmooth5 = lumRaw(smoothRgb);
            float lFaceSmooth = mix(lBiRaw, lMacroRaw, 0.42);
            float lFacePlane = clamp(lFaceSmooth + clamp(lBiRaw - lMacroRaw, -0.16, 0.16) * 0.85, 0.0, 1.0);
            float wbSkinGamma = mix(0.60, 0.86, smoothstep(0.06, 0.28, lFacePlane));
            float lFaceBoost = pow(max(lFacePlane, 0.0001), wbSkinGamma) * 1.05;

            // 2) GARMENTS / WOOD / DONKEY: smooth 5-tap + bilateral relief (eliminates muddy 1px fur-shell noise on Mistletoe while carving bold coat pleats!)
            float lClothBase = mix(lSmooth5, lBiRaw, 0.48);
            // Lift dark warm donkey fur (lMacroRaw 0.06..0.24) cleanly out of mud while keeping black hair/brows/beard (<0.05) solid #181d26 sumi-ink!
            float darkWarmFur = isGeo * (1.0 - coolMask) * (1.0 - wbSkinRegion)
                              * smoothstep(0.045, 0.085, lMacroRaw) * (1.0 - smoothstep(0.15, 0.28, lMacroRaw));
            lClothBase = mix(lClothBase, pow(max(lClothBase, 0.0001), 0.70) * 1.06, darkWarmFur * 0.80);
            float valleyPull = min(0.0, lSmooth5 - lMacroRaw) * mix(2.75, 1.10, darkWarmFur);
            float ridgeLift  = max(0.0, lSmooth5 - lBiRaw) * 1.15;
            float lClothLocal = clamp(lClothBase + clamp(valleyPull + ridgeLift, -0.30, 0.20), 0.0, 1.0);

            float lq = mix(lClothLocal, lFaceBoost, wbSkinRegion * 0.98);
            // Soft cotton/linen highlight roll-off so white shammas & June's tunic break into Sunlit-Sand (#e8b282) + Burnt-Sienna (#8e4926) folds!
            lq = mix(lq, 0.49 + (lq - 0.49) * 0.46, neutralBright * 0.85);

            // Adaptive macro-albedo garment thresholds: keeps hair (<0.05) solid #181d26 ink, Mistletoe/Hanna top clean sienna, & tan coats bold wedges!
            float clothShCut  = mix(0.205, 0.355, smoothstep(0.18, 0.46, lMacroRaw)) - darkWarmFur * 0.055;
            float clothMidCut = mix(0.235, 0.505, smoothstep(0.15, 0.48, lMacroRaw));
            float clothHiCut  = mix(0.365, 0.605, smoothstep(0.16, 0.50, lMacroRaw));
            float shCut  = mix(clothShCut,  0.210, wbSkinRegion);
            float midCut = mix(clothMidCut, 0.325, wbSkinRegion);
            float hiCut  = mix(clothHiCut,  0.450, wbSkinRegion);
            vec3 warmBlocks = mix(sumiInk, siennaDeep, smoothstep(shCut, shCut + 0.028, lq));
            warmBlocks = mix(warmBlocks, terraMid, smoothstep(midCut, midCut + 0.036, lq));
            warmBlocks = mix(warmBlocks, apricotHi, smoothstep(hiCut, hiCut + 0.045, lq));
            warmBlocks = mix(warmBlocks, creamHi, smoothstep(0.80, 0.88, lq) * 0.55 * (1.0 - wbSkinRegion * 0.88));

            // Cool stone masonry, chapel double doors, shutters & sunlit slate ground quantization (solid #181d26 cast shadows & shutters!)
            float lCool = clamp(lSmooth5 + clamp(lSmooth5 - lBiRaw, -0.18, 0.18) * 0.85, 0.0, 1.0);
            float isLowerGround = 1.0 - smoothstep(0.18, 0.27, uv.y);
            float shadowCutCool = mix(0.30, 0.635, isLowerGround);
            vec3 coolBlocks = mix(sumiInk, slateStone, smoothstep(shadowCutCool, shadowCutCool + 0.035, lCool));
            coolBlocks = mix(coolBlocks, slateDoor, smoothstep(0.36, 0.44, lCool) * (1.0 - isLowerGround * 0.90));
            coolBlocks = mix(coolBlocks, slateFloor, smoothstep(0.64, 0.69, lCool));
            coolBlocks = mix(coolBlocks, slateArch, smoothstep(0.77, 0.84, lCool) * (1.0 - isLowerGround));

            vec3 wb = mix(warmBlocks, coolBlocks, coolMask);

            // Clean Sumi-Ink (#181d26) contour & structural fold linework:
            // Gate interiorEdge by 6px edBroad (wiping out 1-2px pore & donkey-fur mud!) and gate dLap speckles off faces!
            float wbInteriorEdge = min(edClean, edBroad * 1.22) * (1.0 - wbSkinRegion) * mix(1.0, 0.35, darkWarmFur);
            float wbDepthEdge = mix(edDepth, smoothstep(0.28, 0.58, edDepth), wbSkinRegion);
            float inkLine = clamp(max(smoothstep(0.16, 0.38, wbDepthEdge), smoothstep(0.075, 0.185, wbInteriorEdge)), 0.0, 1.0) * isGeo * (1.0 - cMask * 0.88);
            wb = mix(wb, sumiInk, inkLine * 0.96);

            // Selective #33ccf2 graphic-novel cyan spot-ink on water stream, concentric ripples, jerrycans & pack window!
            vec3 spotCyan = mix(vec3(0.180, 0.720, 0.860), vec3(0.220, 0.835, 0.960), smoothstep(0.24, 0.76, max(raw.b, raw.g)));
            wb = mix(wb, spotCyan, cMask);

            wb *= (0.968 + 0.045 * paperFiber);
            col = mix(wb, paperCream, isDaySky);
          } else if (mode == 5) {
            // 5 · SILVER GELATIN (Ansel Adams platinum-selenium 8x10 fiber print on #e6e1d6 paper)
            float pGrain = (h(floor(px) + vec2(3.1, 7.7)) - 0.5) * 0.012;
            vec3 dayPaper = vec3(0.902, 0.882, 0.839) * (0.962 + 0.032 * uv.y) + pGrain;
            float dLin5 = readDist(uv);
            float hMist5 = isGeo * smoothstep(8.2, 10.6, dLin5) * (1.0 - smoothstep(0.32, 0.44, uv.y));
            vec3 sg = mix(silverBase * (0.96 + 0.04 * vg), dayPaper, hMist5 * 0.62);
            col = mix(sg, dayPaper, isDaySky);
          } else if (mode == 6) {
            // 6 · THE CARD (Cream archival stock hatched & cross-engraved by light)
            vec2 gp = px / 4.8;
            float a = fract(gp.x + gp.y), b = fract(gp.x - gp.y);
            float ink = step(a, smoothstep(0.14, 0.82, 1.0 - lp) * 0.78);
            ink = max(ink, step(b, smoothstep(0.48, 0.96, 1.0 - lp) * 0.68));
            ink = max(ink, smoothstep(0.065, 0.19, ed) * 0.88);
            vec3 crd = mix(vec3(0.93, 0.90, 0.82) * (0.87 + 0.13 * vg), vec3(0.12, 0.11, 0.13), ink * 0.80);
            col = mix(crd, silverBase, 0.42);
          } else if (mode == 7) {
            // 7 · SPRAY WALL (Stenciled celluloid mural, paper contour halo & pigment drips)
            float wn = n2(px / 95.0) * 0.6 + n2(px / 22.0) * 0.3 + h(floor(px / 2.0)) * 0.1;
            float ml = smoothstep(0.06, 0.85, lumRaw(texture2D(tFilm, uv).rgb));
            vec3 wall = vec3(0.54, 0.51, 0.47) * (0.68 + 0.38 * wn) * (0.76 + 0.36 * ml);
            float dr = drip(uv, effRes) * (1.0 - skinMask * 0.88) * (1.0 - neutralBright);
            float edgeHalo = smoothstep(0.045, 0.15, ed);
            vec3 paste = mix(silverBase, vec3(0.96, 0.94, 0.89), edgeHalo * 0.85);
            col = mix(mix(wall, paste, smoothstep(0.20, 0.60, lp + edgeHalo * 0.40)), vec3(0.14, 0.12, 0.11), dr * 0.25);
            col = mix(col, silverBase, 0.36);
          } else if (mode == 8) {
            // 8 · WATERCOLOUR (Cold-press tooth, graphite underdrawing & translucent pigment wash)
            float tooth = n2(px / 2.4) * 0.6 + n2(px / 6.5) * 0.4;
            vec3 paper = vec3(0.96, 0.94, 0.89) * (0.94 + 0.07 * tooth);
            vec3 wash = mix(vec3(0.40, 0.56, 0.73), vec3(0.87, 0.71, 0.54), lp);
            vec3 wc = mix(paper, paper * wash, (0.32 + 0.54 * (1.0 - lp)) * (0.68 + 0.36 * tooth));
            wc = mix(wc, vec3(0.25, 0.27, 0.31), smoothstep(0.045, 0.11, ed) * 0.48);
            col = mix(wc, silverBase, 0.36);
          } else if (mode == 9) {
            // 9 · CYANOTYPE (Hand-brushed Prussian blue blueprint with deckle-edged sensitizer border)
            float brush = n2(vec2(px.x / 3.0, px.y / 130.0)) * 0.5 + n2(px / 52.0) * 0.5;
            vec2 q = abs(uv - 0.5) * 2.0;
            float coat = smoothstep(0.99, 0.915, max(q.x, q.y) + (n2(px / 22.0) - 0.5) * 0.055);
            float d = smoothstep(0.06, 0.91, silverBase.r + 0.045 * n2(px / 38.0));
            vec3 cyano = mix(vec3(0.06, 0.23, 0.55) * (0.86 + 0.22 * brush), vec3(0.94, 0.97, 1.0), d);
            col = mix(vec3(0.95, 0.94, 0.90), cyano, coat);
          } else if (mode == 10) {
            // 10 · GLASS (X-ray optical refraction contour edges over silver relief)
            float distContour = smoothstep(0.88, 0.985, sin(readDist(uv) * 2.4));
            vec3 xcol = vec3(0.80, 0.93, 1.0) * (smoothstep(0.025, 0.125, ed) * 1.15 + distContour * 0.20);
            col = mix(silverBase * 0.62, xcol + mix(raw, tr, 0.48) * 0.35, 0.58);
          } else if (mode == 11) {
            // 11 · RISOGRAPH STIPPLE (2ea91143.jpg 1:1 — High-frequency organic colored-pencil & Risograph dry-ink stipple:
            //   ZERO coarse polka-dot halftones! Deep indigo-violet #3d3678 shadows, warm coral-amber #cf856a midtones,
            //   and sparkling warm sunlit gold-cream #ffd996 -> #fcf2dc on lit facial planes, garments, duster coat, ground & paper sky!)
            float fineStipple = h(floor(px) + vec2(17.0, 53.0)) - 0.5;
            float medTooth    = n2(px * 0.72 + vec2(11.3, 4.7)) - 0.5;
            float paperWeave  = n2(vec2(px.x * 0.26, px.y * 0.54)) - 0.5;
            float stipple     = fineStipple * 0.54 + medTooth * 0.36 + paperWeave * 0.24;

            // Attenuate stipple amplitude on faces & eye catchlights so eyes/lashes/lips stay razor-clear while stone & cloth richly stipple!
            float sAmp = mix(0.21, 0.070, clamp(skinMask * 0.86 + catchSpark, 0.0, 1.0));
            // Pull ground cast shadows (~0.59 vs 0.73 sunlit courtyard floor) cleanly down into #453b80 indigo-violet stipple as in 2ea91143.jpg!
            float isGroundCastShadow = isGeo * (1.0 - skinMask) * (1.0 - smoothstep(0.18, 0.27, uv.y))
                                     * smoothstep(-0.01, 0.03, smoothRgb.b - smoothRgb.r)
                                     * (1.0 - smoothstep(0.62, 0.68, lumRaw(smoothRgb)));
            float lpRisoIn = mix(lp, lp * 0.36, isGroundCastShadow * 0.90);
            // ~12.5% warm sunlit-gold (#ffd996) highlight reach boost on lit facial planes (cheekbones, foreheads, nose bridges)!
            float faceLitPlane = skinMask * smoothstep(0.22, 0.44, lp) * (1.0 - neutralBright);
            float lRiso = pow(clamp(lpRisoIn * 1.14 + 0.025, 0.0, 1.0), 0.74);
            lRiso = clamp(lRiso + faceLitPlane * 0.128, 0.0, 1.0);
            float tR = clamp(lRiso + stipple * sAmp, 0.0, 1.0);

            vec3 c0 = vec3(0.137, 0.173, 0.455); // #232c74 deepest indigo-cobalt
            vec3 c1 = vec3(0.239, 0.212, 0.471); // #3d3678 rich indigo-violet cast shadow
            vec3 c2 = vec3(0.620, 0.396, 0.494); // #9e657e warm plum-berry transition
            vec3 c3 = vec3(0.812, 0.522, 0.416); // #cf856a warm dusty coral-amber midtone
            vec3 c4 = vec3(1.000, 0.851, 0.588); // #ffd996 sparkling sunlit gold-cream
            vec3 c5 = vec3(0.988, 0.949, 0.863); // #fcf2dc warm sunlit cream stock

            vec3 rs = tR < 0.24 ? mix(c0, c1, tR / 0.24)
                    : tR < 0.38 ? mix(c1, c2, (tR - 0.24) / 0.14)
                    : tR < 0.53 ? mix(c2, c3, (tR - 0.38) / 0.15)
                    : tR < 0.72 ? mix(c3, c4, (tR - 0.53) / 0.19)
                    : mix(c4, c5, (tR - 0.72) / 0.28);
            rs = mix(rs, c4, faceLitPlane * smoothstep(0.54, 0.72, tR) * 0.28);

            // Colored-pencil indigo-violet contour accent along masonry joints, folds & silhouettes (softened on faces for warm clarity!)
            float pencilLine = clamp(max(smoothstep(0.18, 0.45, edDepth) * 0.56, smoothstep(0.08, 0.25, edClean) * mix(0.50, 0.26, skinMask)), 0.0, 1.0) * isGeo;
            rs = mix(rs, vec3(0.200, 0.192, 0.490), pencilLine);

            // Water stream & pack window lift cleanly to sunlit cream-ice (#fffbdf / #e4f2fa) as in 2ea91143.jpg!
            vec3 risoWater = mix(vec3(0.875, 0.940, 0.980), vec3(1.000, 0.982, 0.875), smoothstep(0.32, 0.82, raw.g));
            rs = mix(rs, risoWater, cMask * 0.84);

            // Warm sunlit gold-cream stippled sky (#ffd996 -> #fcf2dc) + soft courtyard horizon blend
            vec3 risoSky = mix(c4, c5, clamp(0.70 + 0.22 * uv.y + stipple * 0.24, 0.0, 1.0));
            float dLin11 = readDist(uv);
            float hMist11 = isGeo * smoothstep(8.2, 10.6, dLin11) * (1.0 - smoothstep(0.32, 0.44, uv.y));
            rs = mix(rs, risoSky, hMist11 * 0.65);
            col = mix(rs, risoSky, isDaySky);
          } else if (mode == 12) {
            // 12 · INK WASH (Sumi-e ink dilutions on fibrous washi paper + vermilion stone seal)
            float fib = n2(vec2(px.x / 82.0, px.y / 2.2)) * 0.5 + n2(vec2(px.x / 3.0, px.y / 65.0)) * 0.5;
            vec3 paper = vec3(0.95, 0.93, 0.87) * (0.94 + 0.07 * fib);
            float dark = 1.0 - lp;
            float ink = smoothstep(0.22, 0.45, dark) * 0.24
                      + smoothstep(0.48, 0.73, dark) * 0.29
                      + smoothstep(0.76, 0.95, dark) * 0.31;
            vec3 iw = paper * (1.0 - ink * (0.90 + 0.10 * fib));
            vec2 sq = (uv - vec2(0.91, 0.14)) * vec2(effRes.x / max(1.0, effRes.y), 1.0);
            float seal = step(max(abs(sq.x), abs(sq.y)), 0.028) * step(0.28, n2(px / 3.0));
            col = mix(mix(iw, vec3(0.72, 0.10, 0.08), seal), silverBase, 0.38);
          } else {
            // 13 · CYAN JERIKAN · SILVER GELATIN (32b99d8c.jpg & 0bc287c6.jpg 1:1 —
            //   Continuous warm platinum-selenium Zone II–VIII curve, luminous skin specular sheen, crisp stone masonry,
            //   warm #e6e1d6 paper sky, soft sunlit dust horizon, and razor-clean selective #33ccf2 cyan water & pack window!)
            float pGrain = (h(floor(px) + vec2(5.3, 11.9)) - 0.5) * 0.011;
            vec3 dayPaper = vec3(0.902, 0.882, 0.839) * (0.965 + 0.030 * uv.y) + pGrain;
            float dLin13 = readDist(uv);
            float hMist13 = isGeo * smoothstep(8.2, 10.6, dLin13) * (1.0 - smoothstep(0.32, 0.44, uv.y));
            vec3 jBase = mix(silverBase * (0.965 + 0.035 * vg), dayPaper, hMist13 * 0.62);
            col = mix(jBase, dayPaper, isDaySky);

            float cBright = clamp(0.48 + 0.76 * max(raw.b, raw.g * 0.94) - raw.r * 0.10, 0.42, 1.18);
            vec3 coreCyan = mix(vec3(0.10, 0.70, 0.90), vec3(0.20, 0.80, 0.95), smoothstep(0.22, 0.76, max(raw.b, raw.g))) * cBright;
            // Preserve crisp white-rimmed concentric ripple rings (#e2faff) on specular water crests (0bc287c6.jpg)!
            float whiteRim = smoothstep(0.56, 0.84, min(raw.r, min(raw.g, raw.b)));
            vec3 finalCyan = mix(coreCyan, vec3(0.90, 0.98, 1.00), whiteRim * 0.80) * (0.98 + 0.04 * uBeatPulse);
            col = mix(col, finalCyan, cMask);
          }

          // Preserve razor-clean corneal catchlight spark across ALL 14 artistic looks!
          col = mix(col, vec3(0.97, 0.98, 0.99), catchSpark * 0.76);
          return clamp(col, 0.0, 1.0);
        }

        void main() {
          vec2 tileUv = vUv;
          vec2 effRes = uRes;
          int activeLook = uSoloLook;
          float muntinBorder = 0.0;

          if (uContactSheet == 1) {
            vec2 grid = vUv * 3.0;
            vec2 cell = floor(clamp(grid, vec2(0.0), vec2(2.9999)));
            tileUv = fract(grid);
            effRes = uRes / 3.0;
            int colIdx = int(cell.x + 0.5);
            int rowFromTop = 2 - int(cell.y + 0.5);
            activeLook = pickContactLook(rowFromTop * 3 + colIdx);

            vec2 pxInTile = tileUv * effRes;
            float distEdge = min(min(pxInTile.x, effRes.x - pxInTile.x), min(pxInTile.y, effRes.y - pxInTile.y));
            muntinBorder = 1.0 - smoothstep(1.4, 2.4, distEdge);
          }

          if (activeLook < 0) {
            vec3 rawOut = sampleDisplay(tileUv);
            if (muntinBorder > 0.01) {
              rawOut = mix(rawOut, vec3(0.07, 0.08, 0.085), muntinBorder);
            }
            gl_FragColor = vec4(rawOut, 1.0);
            return;
          }

          vec2 e = 1.25 / max(effRes, vec2(64.0));
          vec2 r1 = 6.0 / max(effRes, vec2(64.0));
          vec2 r2 = 14.0 / max(effRes, vec2(64.0));
          vec2 cuv = clamp(tileUv, vec2(0.001), vec2(0.999));
          float zb = texture2D(tDepth, cuv).x;
          float isGeo = 1.0 - step(0.99995, zb);

          vec2 uvE = clamp(tileUv + vec2(e.x, 0.0), vec2(0.002), vec2(0.998));
          vec2 uvW = clamp(tileUv - vec2(e.x, 0.0), vec2(0.002), vec2(0.998));
          vec2 uvN = clamp(tileUv + vec2(0.0, e.y), vec2(0.002), vec2(0.998));
          vec2 uvS = clamp(tileUv - vec2(0.0, e.y), vec2(0.002), vec2(0.998));

          vec3 raw = decodeSceneDisplay(texture2D(tScene, cuv).rgb, zb);
          vec3 cE = sampleDisplay(uvE);
          vec3 cW = sampleDisplay(uvW);
          vec3 cN = sampleDisplay(uvN);
          vec3 cS = sampleDisplay(uvS);

          // Linear depth silhouette & overlapping-fold edge detector (gated off the far courtyard ground-to-sky horizon dC > 7.8m!)
          float edDepth = 0.0;
          float farHorizonGate = 1.0;
          {
            float dC = min(readDist(cuv), 40.0);
            float zbMax = max(zb, max(max(texture2D(tDepth, uvN).x, texture2D(tDepth, uvS).x), max(texture2D(tDepth, uvE).x, texture2D(tDepth, uvW).x)));
            float touchesSky = step(0.99995, zbMax);
            farHorizonGate = 1.0 - touchesSky * smoothstep(7.8, 9.2, dC) * (1.0 - smoothstep(0.32, 0.44, tileUv.y));
            if (activeLook == 4 || activeLook == 11) {
              float dE = min(readDist(uvE), 40.0);
              float dW = min(readDist(uvW), 40.0);
              float dN = min(readDist(uvN), 40.0);
              float dS = min(readDist(uvS), 40.0);
              float dGrad = length(vec2(dE - dW, dN - dS)) / max(0.45, dC);
              float dLap  = abs(dE + dW + dN + dS - 4.0 * dC) / max(0.35, dC);
              edDepth = clamp(max(dGrad * 4.4, dLap * 5.2), 0.0, 1.5) * farHorizonGate;
            }
          }

          float rawL = lumRaw(raw);
          float blurL = 0.25 * (lumRaw(cE) + lumRaw(cW) + lumRaw(cN) + lumRaw(cS));
          float micro = rawL - blurL;
          float ed = length(vec2(lumFiltered(cE) - lumFiltered(cW), lumFiltered(cN) - lumFiltered(cS))) * 2.35 * farHorizonGate;

          // Only evaluate the 8-tap 28px bilateral plane filter on modes 2, 3, 4 (WARM CAVE, SILHOUETTE, WOODBLOCK) -> saves 16 texture reads/px on CYAN JERIKAN & SILVER GELATIN for locked 60 FPS!
          float lBase = lumFiltered(raw);
          float lBiRaw = mix(lBase, blurL, 0.75);
          float lMacroRaw = blurL;
          float edBroad = ed;
          if (activeLook == 2 || activeLook == 3 || activeLook == 4) {
            // Seed bilateral center from 4-neighbor blurL on woodblock so single-pixel pore spikes never bias bilateral weights!
            float lSeed = activeLook == 4 ? blurL : lBase;
            float biSum = lSeed * 1.25;
            float biW = 1.25;
            float macroSum = lSeed;
            float cR1E = 0.0, cR1W = 0.0, cR1N = 0.0, cR1S = 0.0;
            for (int k = 0; k < 8; k++) {
              float ang = float(k) * 0.78539816;
              vec2 dir = vec2(cos(ang), sin(ang));
              vec2 rad = (k == 0 || k == 2 || k == 4 || k == 6) ? r1 : r2;
              vec3 tapC = sampleDisplay(clamp(tileUv + dir * rad, vec2(0.003), vec2(0.997)));
              float tapL = lumFiltered(tapC);
              if (k == 0) cR1E = tapL;
              if (k == 2) cR1N = tapL;
              if (k == 4) cR1W = tapL;
              if (k == 6) cR1S = tapL;
              float w = exp(-abs(tapL - lSeed) * 6.0);
              biSum += tapL * w;
              biW += w;
              macroSum += tapL;
            }
            lBiRaw = biSum / max(0.001, biW);
            lMacroRaw = macroSum / 9.0;
            edBroad = length(vec2(cR1E - cR1W, cR1N - cR1S)) * 1.85;
          }

          // 1. Warm Melanin Portrait Detector (calibrated for HumanPhysicalV6 deep melanin lBiRaw 0.042..0.22 while keeping hair coils/beard < 0.036 crisp!)
          vec3 smoothRgb = 0.2 * (raw + cE + cW + cN + cS);
          float warmRB = smoothRgb.r - smoothRgb.b;
          float warmRG = smoothRgb.r - smoothRgb.g * 0.95;
          float relWarmRB = warmRB / max(smoothRgb.r, 0.025);
          float skinMask = isGeo
            * smoothstep(0.30, 0.54, relWarmRB)
            * smoothstep(0.012, 0.042, warmRB)
            * smoothstep(-0.005, 0.032, warmRG)
            * (1.0 - smoothstep(0.56, 0.78, lBiRaw))
            * smoothstep(0.034, 0.068, lBiRaw);

          // Pore-immune structural contour edge (rejects 1-2px pore grain on cheeks while preserving crisp brows, lashes & lips!)
          float edClean = mix(ed, min(ed, edBroad * 1.35), skinMask * 0.94);

          // 2. Pinpoint Corneal Specular Catchlight vs Sclera/Dental Enamel Soft Shoulder (~20% softer sclera on dark faces)
          float chroma = max(raw.r, max(raw.g, raw.b)) - min(raw.r, min(raw.g, raw.b));
          float catchSpark = isGeo * smoothstep(0.84, 0.95, rawL) * smoothstep(0.045, 0.14, micro);
          float neutralBright = isGeo * smoothstep(0.54, 0.76, rawL) * (1.0 - smoothstep(0.08, 0.20, chroma)) * (1.0 - catchSpark);
          float isScleraSpot = neutralBright * smoothstep(0.06, 0.20, rawL - blurL);

          // 3. Calibrated Portrait Luminance (lp), Luminous Grazing Skin Sheen & Warm Platinum-Selenium Fiber Print (silverBase)
          // Adaptive Zone III.5–V lift: lifts deep Fitzpatrick VI skin (0.06..0.22 -> #343230..#55514c..#7c766e) without pale double-lifting!
          float melGamma = mix(0.66, 0.95, smoothstep(0.08, 0.30, lBase));
          float melLift = pow(max(lBase, 0.0001), melGamma) * 1.03;
          float skinSheenBoost = skinMask * smoothstep(0.16, 0.44, rawL) * 0.046;
          float lp = mix(lBase, melLift, skinMask * 0.86) + skinSheenBoost;
          float melGammaBi = mix(0.66, 0.95, smoothstep(0.08, 0.30, lBiRaw));
          float melLiftBi = pow(max(lBiRaw, 0.0001), melGammaBi) * 1.03;
          float lBiSkin = mix(lBiRaw, melLiftBi, skinMask * 0.86);
          lp = clamp(lp + micro * (0.44 + 0.38 * skinMask), 0.0, 1.0);
          // Calm overly hot sclera/teeth into natural warm Zone VI.5–VII ivory (~0.58–0.70) so eyes never glow white on dark faces!
          lp = mix(lp, 0.54 + (lp - 0.54) * 0.44, neutralBright * 0.78);
          lp = mix(lp, lp * 0.82, isScleraSpot * 0.75);
          lBiSkin = mix(lBiSkin, 0.54 + (lBiSkin - 0.54) * 0.44, neutralBright * 0.78);

          float sCurve = smoothstep(0.010, 0.985, lp);
          float sTone = mix(lp, sCurve, 0.24);
          // Lift dark cast-iron / shadow floor (#26292e = 0.149, 0.161, 0.180 vs 0,0,0) on foreground geometry so
          // standpipe cap, collar rings & lever bar preserve crisp metallic form against dark doorways/shutters!
          float castIronToe = mix(0.156 + lp * 0.56, sTone, smoothstep(0.05, 0.30, sTone));
          sTone = mix(sTone, castIronToe, isGeo);
          float grain = (h(floor(tileUv * effRes) + fract(uT * 0.13) * 19.0) - 0.5) * 0.013 * (1.0 - catchSpark);
          sTone = clamp(sTone + grain, 0.0, 1.0);
          // Cool cast-iron Dmax floor (#26292e) in deepest Zone I.5–II shadows -> warm platinum-selenium fiber split across Zone III–VIII
          vec3 castIronShadowFloor = vec3(0.955, 1.032, 1.154) * sTone; // maps sTone=0.156 -> #26292e!
          vec3 warmCharcoalShadow  = vec3(1.022, 0.992, 0.960) * sTone;
          vec3 barytaPaper         = vec3(1.032, 0.996, 0.952) * sTone;
          vec3 shadowMix = mix(castIronShadowFloor, warmCharcoalShadow, smoothstep(0.16, 0.29, sTone));
          vec3 silverBase = clamp(mix(shadowMix, barytaPaper, smoothstep(0.24, 0.70, sTone)), 0.0, 1.0);
          silverBase = mix(silverBase, vec3(0.99, 0.99, 0.98), catchSpark * 0.85);

          vec3 tr = (activeLook == 0 || activeLook == 10) ? texture2D(tTrail, cuv).rgb : raw;
          float vg = smoothstep(1.42, 0.34, length((tileUv - 0.5) * vec2(clamp(effRes.x / max(1.0, effRes.y), 0.78, 1.25), 1.0)) * 1.40);

          vec3 outCol = evalLook(
            activeLook, tileUv, effRes,
            raw, silverBase, tr, smoothRgb,
            lp, lBiSkin, lBiRaw, lMacroRaw, ed, edClean, edBroad, edDepth, vg,
            isGeo, skinMask, neutralBright, catchSpark
          );

          if (muntinBorder > 0.01) {
            outCol = mix(outCol, vec3(0.07, 0.08, 0.085), muntinBorder);
          }
          gl_FragColor = vec4(outCol, 1.0);
        }
      `
    });

    const drawSizeVec = new T.Vector2();
    let activeLookObj = RAW_LOOK;
    let contactSheetOn = false;
    let inInternalRender = false;
    let lastGlError = 0;

    function setLook(idOrIdx) {
      activeLookObj = resolveLook(idOrIdx);
      return activeLookObj;
    }

    function setContactSheet(flag) {
      contactSheetOn = Boolean(flag);
      return contactSheetOn;
    }

    function render(scene, camera, dt = 0.016, nowSec = 0, audioMetrics = null, rawRenderFn = null) {
      const doRenderScene = rawRenderFn || ((sc, cam) => renderer.render(sc, cam));

      // Zero-interference fast path when set to RAW STUDIO PBR and Contact Sheet is off!
      if (!contactSheetOn && activeLookObj.idx < 0) {
        renderer.setRenderTarget(null);
        doRenderScene(scene, camera);
        return;
      }

      if (inInternalRender) {
        doRenderScene(scene, camera);
        return;
      }

      inInternalRender = true;
      try {
        renderer.getDrawingBufferSize(drawSizeVec);
        syncSize(drawSizeVec.x, drawSizeVec.y);

        const applyTm = (renderer.toneMapping && renderer.toneMapping !== T.NoToneMapping) ? 1.0 : 0.0;
        const exposure = renderer.toneMappingExposure !== undefined ? renderer.toneMappingExposure : 1.09;

        const prevTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(rtScene);
        renderer.clear(true, true, false);
        doRenderScene(scene, camera);

        // Trail accumulation ping-pong pass (needed strictly for Look 0 Light Alone & Look 10 Glass -> saves full-screen HalfFloat pass on Contact Sheet & Cyan Jerikan!)
        const needsTrail = !contactSheetOn && (activeLookObj.idx === 0 || activeLookObj.idx === 10);
        if (needsTrail) {
          accMat.uniforms.tCur.value = rtScene.texture;
          accMat.uniforms.tDepth.value = rtScene.depthTexture;
          accMat.uniforms.tPrev.value = rtA.texture;
          accMat.uniforms.uDamp.value = activeLookObj.trail;
          accMat.uniforms.uExposure.value = exposure;
          accMat.uniforms.uApplyTonemap.value = applyTm;
          postQuad.material = accMat;
          renderer.setRenderTarget(rtB);
          doRenderScene(postScene, postCam);
          const swapTmp = rtA;
          rtA = rtB;
          rtB = swapTmp;
        }

        // Final 15-Look or 3x3 Contact Sheet composite pass
        lookMat.uniforms.tScene.value = rtScene.texture;
        lookMat.uniforms.tDepth.value = rtScene.depthTexture;
        lookMat.uniforms.tTrail.value = rtA.texture;
        lookMat.uniforms.uRes.value.set(curW, curH);
        lookMat.uniforms.uT.value = nowSec;
        lookMat.uniforms.uNear.value = camera.near || 0.02;
        lookMat.uniforms.uFar.value = camera.far || 240.0;
        lookMat.uniforms.uSoloLook.value = activeLookObj.idx;
        lookMat.uniforms.uContactSheet.value = contactSheetOn ? 1 : 0;
        lookMat.uniforms.uExposure.value = exposure;
        lookMat.uniforms.uApplyTonemap.value = applyTm;
        lookMat.uniforms.uBeatPulse.value = audioMetrics ? (audioMetrics.beatPulse || 0) : 0;
        lookMat.uniforms.uAudioBass.value = audioMetrics ? (audioMetrics.percEnv || 0) : 0;
        lookMat.uniforms.uAudioHigh.value = audioMetrics ? (audioMetrics.highBrassEnv || 0) : 0;

        postQuad.material = lookMat;
        renderer.setRenderTarget(prevTarget || null);
        doRenderScene(postScene, postCam);
      } finally {
        inInternalRender = false;
      }
    }

    function checkGlError() {
      try {
        lastGlError = gl.getError();
      } catch (_e) {
        lastGlError = 0;
      }
      return lastGlError;
    }

    return {
      setLook,
      getLook: () => activeLookObj,
      setContactSheet,
      isContactSheet: () => contactSheetOn,
      render,
      syncSize,
      checkGlError,
      getState: () => ({
        lookId: activeLookObj.id,
        lookName: activeLookObj.name,
        lookIdx: activeLookObj.idx,
        contactSheet: contactSheetOn,
        bufferW: curW,
        bufferH: curH,
        rtType: sceneRtType === T.HalfFloatType ? "HalfFloat" : "UnsignedByte"
      })
    };
  }

  /* ---------- 7. Contact Sheet 3×3 Darkroom Plate Overlay Builder ---------- */
  function mountContactSheetOverlay(stageContainer, onSelectLook) {
    if (!stageContainer || typeof document === "undefined") return null;
    let gridEl = stageContainer.querySelector(".lamv-contact-overlay");
    if (!gridEl) {
      gridEl = document.createElement("div");
      gridEl.className = "lamv-contact-overlay";
      gridEl.hidden = true;
      gridEl.setAttribute("aria-label", "9-Look Live GPU Shader Contact Sheet");
      gridEl.innerHTML = CONTACT_SHEET_LOOKS.map(item => `
        <button type="button" class="lamv-cs-cell" data-cs-look="${item.id}" title="Click to solo ${item.label}">
          <span class="lamv-cs-badge"><em>${item.plate}</em> ${item.label} <small>· ${item.sub}</small></span>
        </button>
      `).join("");
      stageContainer.appendChild(gridEl);
      gridEl.querySelectorAll("[data-cs-look]").forEach(btn => {
        btn.addEventListener("click", e => {
          e.stopPropagation();
          if (onSelectLook) onSelectLook(btn.dataset.csLook);
        });
      });
    }
    return {
      el: gridEl,
      setVisible(v) { gridEl.hidden = !v; }
    };
  }

  /* ---------- 8. Seamless Integration into study/index.html (window.__study) ---------- */
  function injectSharedStyles() {
    if (typeof document === "undefined" || document.getElementById("lamv-styles")) return;
    const style = document.createElement("style");
    style.id = "lamv-styles";
    style.textContent = `
      .lamv-contact-overlay {
        position: absolute; inset: 0;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(3, 1fr);
        z-index: 4;
        pointer-events: none;
      }
      .lamv-contact-overlay[hidden] { display: none !important; }
      .lamv-cs-cell {
        position: relative;
        background: transparent;
        border: 0;
        padding: 0;
        margin: 0;
        cursor: pointer;
        pointer-events: auto;
        text-align: left;
      }
      .lamv-cs-cell:hover {
        box-shadow: inset 0 0 0 2px rgba(78, 232, 255, 0.72);
      }
      .lamv-cs-badge {
        position: absolute;
        left: 8px;
        top: 8px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 7px;
        border-radius: 5px;
        background: rgba(12, 15, 16, 0.78);
        border: 1px solid rgba(242, 238, 228, 0.24);
        color: #f4f0e6;
        font: 700 9.5px/1.15 ui-monospace, "SF Mono", Menlo, monospace;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        pointer-events: none;
      }
      .lamv-cs-badge em {
        font-style: normal;
        color: #4ee8ff;
      }
      .lamv-cs-badge small {
        font-weight: 500;
        opacity: 0.76;
        font-size: 8.5px;
      }
      /* Unobstructed 9-Look Contact Sheet layout in study/index.html & audition.html */
      body.lamv-cs-open .plate-head,
      body.lamv-cs-open #exp-hud,
      body.lamv-cs-open #aud-hud {
        opacity: 0 !important;
        pointer-events: none !important;
      }
      body.lamv-cs-open #director-row,
      body.lamv-cs-open #director-sliders,
      body.lamv-cs-open #mode-pills,
      body.lamv-cs-open #focus-pills {
        display: none !important;
      }
      #look-audition-row {
        display: flex;
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        gap: 4px;
        align-items: center;
        pointer-events: auto;
        padding-bottom: 1px;
      }
      #look-audition-row::-webkit-scrollbar { display: none; }
      .pill-look {
        flex: 0 0 auto;
        font-size: 9px !important;
        padding: 4px 8px !important;
        min-height: 23px !important;
        letter-spacing: 0.06em !important;
      }
      .pill-look-cs {
        border-color: rgba(12, 142, 172, 0.68) !important;
        background: rgba(220, 246, 250, 0.92) !important;
        color: #063b47 !important;
        font-weight: 700 !important;
      }
      body.night-mode .pill-look-cs {
        border-color: rgba(78, 232, 255, 0.65) !important;
        background: rgba(12, 44, 52, 0.90) !important;
        color: #9cf5ff !important;
      }
      .pill-look-cs.active, .pill-look-cs[aria-pressed="true"] {
        background: #0b7a92 !important;
        color: #f4fcfd !important;
        border-color: #0b7a92 !important;
      }
      body.night-mode .pill-look-cs.active, body.night-mode .pill-look-cs[aria-pressed="true"] {
        background: #4ee8ff !important;
        color: #04181d !important;
        border-color: #4ee8ff !important;
      }
      .pill-mv-btn {
        border-color: rgba(196, 102, 18, 0.70) !important;
        background: rgba(254, 240, 218, 0.94) !important;
        color: #5d2c04 !important;
        font-weight: 700 !important;
      }
      body.night-mode .pill-mv-btn {
        border-color: rgba(255, 190, 92, 0.68) !important;
        background: rgba(52, 32, 12, 0.90) !important;
        color: #ffd89a !important;
      }
      .pill-mv-btn.active, .pill-mv-btn[aria-pressed="true"] {
        background: #b8580a !important;
        color: #fffaf2 !important;
        border-color: #b8580a !important;
      }
      .lamv-mv-subbar {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        top: max(14px, env(safe-area-inset-top));
        max-width: min(620px, calc(100vw - 420px));
        padding: 7px 14px;
        border-radius: 999px;
        background: rgba(12, 16, 18, 0.84);
        border: 1px solid rgba(78, 232, 255, 0.45);
        color: #f4f1e8;
        font: 500 12px/1.3 "Instrument Serif", Georgia, serif;
        letter-spacing: 0.02em;
        z-index: 8;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 9px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.26);
      }
      .lamv-mv-subbar[hidden] { display: none !important; }
      .lamv-mv-epoch {
        font: 700 9px/1 ui-monospace, "SF Mono", Menlo, monospace;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: #4ee8ff;
        white-space: nowrap;
      }
      .lamv-mv-lyric b {
        color: #6df0ff;
        font-weight: 700;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .lamv-mv-vis {
        font: 700 8.5px/1 ui-monospace, "SF Mono", Menlo, monospace;
        padding: 3px 6px;
        border-radius: 4px;
        background: rgba(78, 232, 255, 0.16);
        color: #9bf5ff;
        white-space: nowrap;
      }
      .lamv-audition-link {
        font: 700 9px/1 Inter, system-ui, sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-decoration: none;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid rgba(28, 184, 212, 0.6);
        color: inherit;
        white-space: nowrap;
        flex: 0 0 auto;
      }
    `;
    document.head.appendChild(style);
  }

  function formatHighlightedLyricHtml(vox) {
    if (!vox || !vox.words || !vox.words.length) return vox ? vox.lineText : "";
    if (!vox.singing || vox.activeWordIdx < 0) {
      return `<span style="opacity:0.82">${vox.lineText}</span>`;
    }
    const out = vox.words.map((w, idx) => (idx === vox.activeWordIdx ? `<b>${w}</b>` : w));
    return `“${out.join(" ")}”`;
  }

  function attachToStudy(studyApi) {
    const T = window.THREE;
    if (!T || !studyApi || studyApi.__lamvAttached) return null;

    const renderer = studyApi.renderer;
    const scene = studyApi.scene;
    const camera = studyApi.camera;
    if (!renderer || !scene || !camera) return null;

    studyApi.__lamvAttached = true;
    injectSharedStyles();

    const origRender = renderer.render.bind(renderer);
    const post = createPostProcessor(T, renderer);
    const song = createSongEngine({ autoPlay: false, startTime: 12.2 });

    let mvModeActive = false;
    let lastAudioSample = null;
    let mvSavedOverride = null;

    const stageWrap = studyApi.wrap || document.getElementById("stage-wrap") || renderer.domElement.parentElement;
    const csOverlay = mountContactSheetOverlay(stageWrap, chosenLookId => {
      post.setContactSheet(false);
      post.setLook(chosenLookId);
      csOverlay.setVisible(false);
      syncStudyBarUI();
    });

    // Ensure nav link to ./audition.html exists in .nav-links
    const navLinks = document.querySelector(".nav-links");
    if (navLinks && !navLinks.querySelector('a[href*="audition.html"]')) {
      const a = document.createElement("a");
      a.href = "./audition.html";
      a.textContent = "♪ MV Audition";
      a.style.borderColor = "#0b8ba6";
      navLinks.insertBefore(a, navLinks.firstChild);
    }

    // Subtitle bar for in-place MV Audition inside study/index.html
    const mvSubBar = document.createElement("div");
    mvSubBar.className = "lamv-mv-subbar";
    mvSubBar.hidden = true;
    mvSubBar.innerHTML = `
      <span class="lamv-mv-epoch" id="lamv-sub-epoch">I · WELLHEAD</span>
      <span class="lamv-mv-lyric" id="lamv-sub-lyric">“Iron lever cracks before the rooster”</span>
      <span class="lamv-mv-vis" id="lamv-sub-vis">SIL</span>
      <button type="button" class="pill pill-look" id="lamv-sub-audio" style="pointer-events:auto">🔊 Audio</button>
    `;
    document.body.appendChild(mvSubBar);

    const subAudioBtn = document.getElementById("lamv-sub-audio");
    if (subAudioBtn) {
      subAudioBtn.addEventListener("click", async () => {
        const unmuted = await song.toggleUnmute();
        subAudioBtn.textContent = unmuted ? "🔊 Live OGG" : "🔇 Muted";
        subAudioBtn.classList.toggle("active", unmuted);
      });
    }

    // Inject Look / Contact Sheet / MV Audition pill row into .stage-bar
    const stageBar = document.querySelector(".stage-bar");
    let lookRow = document.getElementById("look-audition-row");
    if (stageBar && !lookRow) {
      lookRow = document.createElement("div");
      lookRow.className = "pill-row";
      lookRow.id = "look-audition-row";
      lookRow.setAttribute("aria-label", "14 Game GPU Shaders, 9-Look Contact Sheet and Music Video Audition");
      stageBar.insertBefore(lookRow, stageBar.firstChild);
    }

    let clayLookOverride = false;
    let userPinnedLook = false;

    function syncStudyBarUI() {
      if (!lookRow) return;
      const curLook = post.getLook();
      const csOn = post.isContactSheet();
      const isNativeClayScene = Boolean(typeof studyApi.isClayScene === "function" && studyApi.isClayScene());
      const clayActive = !csOn && (clayLookOverride || (isNativeClayScene && curLook.id === "raw"));

      lookRow.querySelectorAll("[data-look-id]").forEach(b => {
        const isAct = !csOn && !clayActive && b.dataset.lookId === curLook.id;
        b.classList.toggle("active", isAct);
        b.setAttribute("aria-pressed", String(isAct));
      });
      const clayBtn = lookRow.querySelector("[data-clay-look]");
      if (clayBtn) {
        clayBtn.classList.toggle("active", clayActive);
        clayBtn.setAttribute("aria-pressed", String(clayActive));
      }
      const csBtn = lookRow.querySelector("[data-contact-toggle]");
      if (csBtn) {
        csBtn.classList.toggle("active", csOn);
        csBtn.setAttribute("aria-pressed", String(csOn));
      }
      const mvBtn = lookRow.querySelector("[data-mv-toggle]");
      if (mvBtn) {
        mvBtn.classList.toggle("active", mvModeActive);
        mvBtn.setAttribute("aria-pressed", String(mvModeActive));
        mvBtn.textContent = mvModeActive ? "⏹ Stop MV Sync" : "▶ MV Song Sync";
      }
      mvSubBar.hidden = !mvModeActive;
    }

    if (lookRow) {
      let html = `<span class="row-tag">Look:</span>`;
      // Primary 5 Reference Look Pills first (Cyan Jerikan, Risograph Stipple, Woodblock Print, Raw PBR, Clay Sculpt)
      for (const lid of ["jerikan", "risograph", "woodblock", "raw"]) {
        const lObj = resolveLook(lid);
        html += `<button type="button" class="pill pill-look" data-look-id="${lObj.id}" aria-pressed="false" title="${lObj.name} — ${lObj.desc}">${lObj.short}</button>`;
      }
      html += `<button type="button" class="pill pill-look" data-clay-look="1" aria-pressed="false" title="CLAY SCULPT — Matte #7d7770 sculptor's clay form audit (0b07591c.jpg)">Clay Sculpt</button>`;
      html += `<span class="pill-sep" aria-hidden="true"></span>`;
      html += `<button type="button" class="pill pill-look pill-look-cs" data-contact-toggle="1" aria-pressed="false" title="Render live scene across 9 signature shaders simultaneously in a 3×3 darkroom grid">⊞ 9-Look Sheet</button>`;
      html += `<button type="button" class="pill pill-look pill-mv-btn" data-mv-toggle="1" aria-pressed="false" title="Drive active study actors with synced Cyan Jerikan vocals, phoneme visemes & 104 BPM groove">▶ MV Song Sync</button>`;
      html += `<a class="lamv-audition-link" href="./audition.html" title="Open Full-Screen 5-Set Music Video & Character Audition Theater">↗ MV Theater</a>`;
      html += `<span class="pill-sep" aria-hidden="true"></span>`;
      for (const lid of UI_LOOK_ORDER) {
        if (lid === "jerikan" || lid === "risograph" || lid === "woodblock" || lid === "raw") continue;
        const lObj = resolveLook(lid);
        html += `<button type="button" class="pill pill-look" data-look-id="${lObj.id}" aria-pressed="false" title="${lObj.name} — ${lObj.desc}">${lObj.short}</button>`;
      }
      lookRow.innerHTML = html;

      lookRow.querySelector("[data-contact-toggle]")?.addEventListener("click", () => {
        userPinnedLook = true;
        setContactSheet(!post.isContactSheet());
      });
      lookRow.querySelector("[data-mv-toggle]")?.addEventListener("click", () => {
        if (mvModeActive) stopMusicVideo();
        else startMusicVideo();
      });
      lookRow.querySelector("[data-clay-look]")?.addEventListener("click", () => {
        userPinnedLook = true;
        setLook("clay");
      });
      lookRow.querySelectorAll("[data-look-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          userPinnedLook = true;
          setLook(btn.dataset.lookId);
        });
      });
    }

    function setLook(idOrIdx, opts = {}) {
      if (!opts.fromSceneDefault) {
        userPinnedLook = true;
      }
      const rawStr = String(idOrIdx || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (rawStr === "clay" || rawStr === "clay_sculpt" || rawStr === "sculpt") {
        clayLookOverride = true;
        post.setLook("raw");
        if (post.isContactSheet()) {
          post.setContactSheet(false);
          if (csOverlay) csOverlay.setVisible(false);
          document.body.classList.remove("lamv-cs-open");
        }
        if (typeof studyApi.setClaySculptOverride === "function") {
          studyApi.setClaySculptOverride(true);
        }
        if (typeof studyApi.onLookChanged === "function") {
          studyApi.onLookChanged("clay");
        }
        syncStudyBarUI();
        return { id: "clay", short: "Clay Sculpt", name: "CLAY SCULPT", idx: -1 };
      }

      if (clayLookOverride) {
        clayLookOverride = false;
        if (typeof studyApi.setClaySculptOverride === "function") {
          studyApi.setClaySculptOverride(false);
        }
      } else if (typeof studyApi.isClayScene === "function" && studyApi.isClayScene() && rawStr === "raw" && !opts.fromSceneDefault) {
        // Allow clicking Raw PBR on R3 to inspect textured skin vs clicking Clay Sculpt to re-enable clay!
        if (typeof studyApi.setClaySculptOverride === "function") {
          studyApi.setClaySculptOverride(false);
        }
      }
      const lObj = post.setLook(idOrIdx);
      if (post.isContactSheet()) {
        post.setContactSheet(false);
        if (csOverlay) csOverlay.setVisible(false);
        document.body.classList.remove("lamv-cs-open");
      }
      if (typeof studyApi.onLookChanged === "function") {
        studyApi.onLookChanged(lObj.id);
      }
      syncStudyBarUI();
      return lObj;
    }

    function applySceneDefaultLook(defaultLookId) {
      if (userPinnedLook || post.isContactSheet()) {
        syncStudyBarUI();
        return post.getLook();
      }
      clayLookOverride = false;
      post.setLook(defaultLookId || "raw");
      if (typeof studyApi.onLookChanged === "function") {
        studyApi.onLookChanged(post.getLook().id);
      }
      syncStudyBarUI();
      return post.getLook();
    }

    function setContactSheet(flag) {
      const on = post.setContactSheet(flag);
      if (csOverlay) csOverlay.setVisible(on);
      document.body.classList.toggle("lamv-cs-open", on);
      syncStudyBarUI();
      return on;
    }

    function startMusicVideo(opts = {}) {
      mvModeActive = true;
      mvSavedOverride = window.NIGHT_POST_EMOTION_OVERRIDE || null;
      if (opts.time !== undefined) song.seek(+opts.time);
      song.setPlaying(true);
      if (opts.look !== undefined) {
        post.setLook(opts.look);
      } else if (post.getLook().id === "raw" && !post.isContactSheet()) {
        post.setLook("jerikan");
      }
      if (opts.unmute) {
        song.toggleUnmute(true).then(unmuted => {
          if (subAudioBtn) {
            subAudioBtn.textContent = unmuted ? "🔊 Live OGG" : "🔇 Muted";
            subAudioBtn.classList.toggle("active", unmuted);
          }
        });
      }
      syncStudyBarUI();
      return getLookState();
    }

    function stopMusicVideo() {
      mvModeActive = false;
      song.setPlaying(false);
      song.toggleUnmute(false);
      window.NIGHT_POST_EMOTION_OVERRIDE = mvSavedOverride;
      const actors = typeof studyApi.getActiveActors === "function" ? studyApi.getActiveActors() : [];
      for (const item of actors) {
        if (item && item.ch && item.ch.userData) {
          item.ch.userData.emotionOverride = null;
        }
      }
      syncStudyBarUI();
      return getLookState();
    }

    function stepMvActors(dt, nowSec) {
      if (!mvModeActive) return;
      lastAudioSample = song.sample(dt);
      const s = lastAudioSample;

      const epochEl = document.getElementById("lamv-sub-epoch");
      const lyricEl = document.getElementById("lamv-sub-lyric");
      const visEl = document.getElementById("lamv-sub-vis");
      if (epochEl) epochEl.textContent = s.epoch.name.split("·")[0].trim() + " · " + Math.floor(s.songTime) + "S";
      if (lyricEl) lyricEl.innerHTML = formatHighlightedLyricHtml(s);
      if (visEl) visEl.textContent = s.isBreathing && s.visemeAmount < 0.05 ? "BREATH" : `VIS: ${s.viseme}`;

      const mvPayload = {
        emotion: s.emotion,
        intensity: 0.72,
        speaking: false,
        viseme: s.viseme,
        visemeAmount: s.visemeAmount,
        handGestureL: s.handGesture,
        handGestureR: s.handGesture
      };
      window.NIGHT_POST_EMOTION_OVERRIDE = mvPayload;

      const actors = typeof studyApi.getActiveActors === "function" ? studyApi.getActiveActors() : [];
      for (let i = 0; i < actors.length; i++) {
        const item = actors[i];
        if (!item || !item.ch) continue;
        if (item.ch.userData) item.ch.userData.emotionOverride = mvPayload;
        if (item.ch._v4ExpCtrl && typeof item.ch._v4ExpCtrl.applyBoneAndShaderRig === "function") {
          item.ch._v4ExpCtrl.applyBoneAndShaderRig(dt, nowSec, {
            emotion: s.emotion,
            emotionIntensity: i === 0 ? 0.74 : 0.62,
            speaking: false,
            viseme: i === 0 || s.isChorusDance ? s.viseme : "SIL",
            visemeAmount: i === 0 ? s.visemeAmount : (s.isChorusDance ? s.visemeAmount * 0.75 : 0),
            handGestureL: s.handGesture,
            handGestureR: s.handGesture
          }, false);
        }
      }
    }

    // Hook cleanly into study.js customFrameHook / customRenderHook (with safe renderer.render fallback)
    if ("customRenderHook" in studyApi) {
      const prevFrameHook = studyApi.customFrameHook;
      studyApi.customFrameHook = function (dt, nowSec) {
        if (typeof prevFrameHook === "function") prevFrameHook(dt, nowSec);
        stepMvActors(dt, nowSec);
      };
      studyApi.customRenderHook = function (_r, sc, cam, dt, nowSec) {
        post.render(sc, cam, dt, nowSec, lastAudioSample, origRender);
      };
    } else {
      let lastHookMs = performance.now();
      renderer.render = function (sc, cam) {
        if (sc === scene && cam === camera) {
          const nowMs = performance.now();
          const dt = clamp((nowMs - lastHookMs) * 0.001, 0.001, 0.05);
          lastHookMs = nowMs;
          stepMvActors(dt, nowMs * 0.001);
          post.render(sc, cam, dt, nowMs * 0.001, lastAudioSample, origRender);
        } else {
          origRender(sc, cam);
        }
      };
    }

    function getLookState() {
      return {
        ...post.getState(),
        mvActive: mvModeActive,
        mvEpoch: lastAudioSample ? lastAudioSample.epoch.name : null,
        mvSongTime: +(song.getTime().toFixed(2)),
        mvLyric: lastAudioSample ? lastAudioSample.lineText : null,
        mvWord: lastAudioSample ? lastAudioSample.activeWord : null,
        mvViseme: lastAudioSample ? lastAudioSample.viseme : "SIL",
        audioUnmuted: song.isUnmuted(),
        glError: post.checkGlError()
      };
    }

    // Attach public methods directly onto window.__study
    studyApi.setLook = setLook;
    studyApi.applySceneDefaultLook = applySceneDefaultLook;
    studyApi.getLook = () => clayLookOverride ? { id: "clay", short: "Clay Sculpt", name: "CLAY SCULPT", idx: -1 } : post.getLook();
    studyApi.listLooks = () => ALL_LOOKS.map(l => ({ ...l }));
    studyApi.setContactSheet = setContactSheet;
    studyApi.startMusicVideo = startMusicVideo;
    studyApi.stopMusicVideo = stopMusicVideo;
    studyApi.seekMusicVideo = sec => { song.seek(sec); if (mvModeActive) lastAudioSample = song.sample(0.016); return getLookState(); };
    studyApi.getLookState = getLookState;

    // Support URL parameters (?look=jerikan&look=sheet&contact=1&mv=1&t=45) + scene default look
    try {
      const params = new URLSearchParams(window.location.search);
      const lookParam = (params.get("look") || "").toLowerCase();
      const isSheetLook = lookParam === "sheet" || lookParam === "contact" || lookParam === "9-look";
      if (lookParam && !isSheetLook) {
        setLook(lookParam);
      } else if (!isSheetLook && typeof studyApi.getActiveSceneDefaultLook === "function") {
        applySceneDefaultLook(studyApi.getActiveSceneDefaultLook());
      }
      if (isSheetLook || params.get("contact") === "1" || params.get("contactSheet") === "1") {
        userPinnedLook = true;
        setContactSheet(true);
      }
      if (params.get("mv") === "1") {
        startMusicVideo({
          time: params.get("t") !== null ? +params.get("t") : 12.2,
          look: (lookParam && !isSheetLook) ? lookParam : undefined
        });
      }
    } catch (_e) { /* ignore */ }

    syncStudyBarUI();
    return studyApi;
  }

  const LookAuditionMV = {
    version: "6.0.0-scion-print",
    RAW_LOOK,
    LOOKS,
    ALL_LOOKS,
    UI_LOOK_ORDER,
    CONTACT_SHEET_LOOKS,
    MODES,
    SONG_EPOCHS,
    LYRICS,
    MV_CAST,
    MV_SETS,
    MV_CUTS,
    MV_MOTIONS: [
      { id: "auto",           short: "Auto Epoch", clip: null,             desc: "Automatically selects Mesh2Motion CC0 clip per Cyan Jerikan epoch & set" },
      { id: "walk",           short: "Walk",       clip: "walk",           desc: "Mesh2Motion natural walking cycle" },
      { id: "walk-carry",     short: "Carry",      clip: "walk-carry",     desc: "Mesh2Motion 20L jerrycan carry stride" },
      { id: "idle-talking",   short: "Talk",       clip: "idle-talking",   desc: "Mesh2Motion expressive conversational gesture" },
      { id: "dance-arm-pump", short: "Dance",      clip: "dance-arm-pump", desc: "Mesh2Motion rhythmic arm-pump dance" },
      { id: "greeting",       short: "Greeting",   clip: "greeting",       desc: "Mesh2Motion warm highland greeting wave" },
      { id: "victory",        short: "Victory",    clip: "victory",        desc: "Mesh2Motion celebratory victory gesture" },
      { id: "procedural",     short: "Procedural", clip: null,             desc: "Pure procedural Scion rig pose (0% Mesh2Motion blend)" }
    ],
    resolveMotionClip(motionId, ctx) {
      const id = String(motionId || "auto").toLowerCase();
      if (id === "procedural") return { clip: null, blend: 0 };
      const found = LookAuditionMV.MV_MOTIONS.find(m => m.id === id);
      if (found && found.clip) return { clip: found.clip, blend: 0.88 };
      const c = ctx || {};
      if (c.steadyMacro) return { clip: "idle", blend: 0.35 };
      if (c.danceNow) return { clip: "dance-arm-pump", blend: 0.88 };
      if (c.hasPhone) return { clip: "walk-carry", blend: 0.78 };
      const setId = c.setId || "";
      if (setId === "cosmic_addis_finale") return { clip: "dance-arm-pump", blend: 0.88 };
      if (setId === "night_convoy_lantern") return { clip: "walk-carry", blend: 0.82 };
      if (setId === "oxbow_screen_chorus") return { clip: c.isLead ? "greeting" : "idle-talking", blend: 0.85 };
      if (setId === "relay_saddle_handoff") return { clip: "walk-carry", blend: 0.84 };
      return { clip: c.isLead ? "idle-talking" : "idle", blend: 0.85 };
    },
    resolveLook,
    wordToPhonemePair,
    evaluateVocalTimeline,
    formatHighlightedLyricHtml,
    createSongEngine,
    createPostProcessor,
    mountContactSheetOverlay,
    injectSharedStyles,
    attachToStudy
  };

  if (typeof window !== "undefined") {
    window.LookAuditionMV = LookAuditionMV;
    if (window.__study && window.__study.renderer) {
      attachToStudy(window.__study);
    } else if (typeof document !== "undefined") {
      window.addEventListener("DOMContentLoaded", () => {
        if (window.__study && window.__study.renderer) {
          attachToStudy(window.__study);
        }
      });
    }
  }
})();
