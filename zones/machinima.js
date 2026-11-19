/* In-World 3D Machinima Director, 2086 Explainer Trailer, Full-Song Music Video & Video Recorder
   for Donkey Water (MONOLITH-3 Zones & 2086 Night Post · Bidirectional V2G Edition).
   Exposes window.createMachinimaDirector(env) and window.__machinima. */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const fmtMMSS = sec => {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const LYRIC_CUES = [
    [0, "Warm Scion C60 cassette wakes before the rooster."],
    [12, "“Iron lever cracks before the rooster / My hands know the cold of it.”"],
    [28, "“Cyan jerikan balanced on my shoulder blade / Stone steps climbing toward a blue-lit door.”"],
    [45, "“Take this water from my well / Will you carry what I cannot.”"],
    [62, "“Carry the cyan up the ridge with me / Hooves on cobble and the tape is turning.”"],
    [94, "“Kidase hums beneath the kiosk awning / Static blooms across the dial.”"],
    [118, "“My father dubbed his Tezeta onto ferric / Every slosh a metronome.”"],
    [152, "“Carry the cyan up the ridge with me / Brass comes back and the crates are spinning.”"],
    [186, "“Rope creaks · Wind holds its breath · The drums step out · And the basin fills.”"],
    [220, "“Cosmic Addis Arkestra — carry WiFi water up to the Highland Pueblo.”"]
  ];

  function lyricAt(sec) {
    let out = LYRIC_CUES[0][1];
    for (const [ts, line] of LYRIC_CUES) {
      if (sec >= ts) out = line;
    }
    return out;
  }

  function injectMachinimaDOM() {
    if (document.getElementById("machinima-bar")) return;
    const style = document.createElement("style");
    style.id = "machinima-styles";
    style.textContent = `
      body.machinima-active #world-loader,
      body.machinima-active #top-left,
      body.machinima-active #reel-col,
      body.machinima-active #rack-tray,
      body.machinima-active #platebox,
      body.machinima-active #focus-dock,
      body.machinima-active #wedge-wrap,
      body.machinima-active #keys,
      body.machinima-active #toast,
      body.machinima-active #thirst-alert,
      body.machinima-active #ppc-hud,
      body.machinima-active #cam-frame,
      body.machinima-active #reticle,
      body.machinima-active #cinema-intro,
      body.machinima-active #np-screening-card,
      body.machinima-active #np-dispatch-modal,
      body.machinima-active #field-status,
      body.machinima-active #field-tools,
      body.machinima-active #field-move,
      body.machinima-active #field-actions,
      body.machinima-active #field-intro {
        display: none !important;
      }
      body.machinima-active:not(.machinima-no-bars) .letterbox {
        height: min(6.2vh, 42px) !important;
        opacity: 1 !important;
        display: block !important;
      }
      #machinima-card {
        position: fixed;
        left: max(16px, env(safe-area-inset-left));
        bottom: calc(max(10px, env(safe-area-inset-bottom)) + 70px);
        width: min(480px, calc(100vw - 32px));
        padding: 8px 12px 9px;
        border-radius: 9px;
        background: rgba(12, 16, 15, 0.70);
        border: 1px solid rgba(107, 232, 220, 0.30);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #f3efe4;
        z-index: 26;
        pointer-events: none;
        text-align: left;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.44);
      }
      #machinima-card[hidden], #machinima-bar[hidden], #mach-dolly-row[hidden] {
        display: none !important;
      }
      #mach-kicker {
        display: block;
        font: 700 9.5px/1.2 ui-monospace, "SF Mono", Menlo, monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #6be8dc;
        margin-bottom: 3px;
      }
      #mach-title {
        margin: 0;
        font: 400 clamp(15px, 2.1vw, 20px)/1.16 "Instrument Serif", "Iowan Old Style", Georgia, serif;
        color: #fffaf0;
      }
      #mach-explain {
        margin: 4px 0 0;
        font: 400 clamp(11px, 1.4vw, 12.5px)/1.38 Inter, system-ui, sans-serif;
        color: rgba(243, 239, 228, 0.86);
      }
      #mach-lyric {
        margin: 4px 0 0;
        font: italic 400 11.5px/1.28 Georgia, serif;
        color: #eab965;
      }
      #machinima-bar {
        position: fixed;
        left: 50%;
        bottom: max(8px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        width: min(760px, calc(100vw - 20px));
        padding: 7px 10px;
        border-radius: 11px;
        background: rgba(10, 18, 19, 0.88);
        border: 1px solid rgba(242, 237, 226, 0.22);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 27;
        display: flex;
        flex-direction: column;
        gap: 5px;
        pointer-events: auto;
      }
      .mach-top-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #mach-scrub {
        flex: 1;
        height: 6px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.16);
        position: relative;
        cursor: pointer;
        overflow: hidden;
      }
      #mach-scrub-fill {
        display: block;
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #18b4ff, #6be8dc);
      }
      #mach-clock {
        font: 600 10px/1 ui-monospace, Menlo, monospace;
        color: #d7e8e6;
        white-space: nowrap;
      }
      .mach-btns {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .mach-btn {
        font: 600 9.5px/1 Inter, system-ui, sans-serif;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        padding: 5px 8px;
        border-radius: 999px;
        border: 1px solid rgba(242, 237, 226, 0.26);
        background: rgba(20, 32, 33, 0.9);
        color: #f2ede2;
        cursor: pointer;
        text-decoration: none;
        white-space: nowrap;
      }
      .mach-btn:hover { border-color: #6be8dc; color: #6be8dc; }
      .mach-btn[aria-pressed="true"] {
        background: #6be8dc;
        border-color: #6be8dc;
        color: #071918;
      }
      .mach-btn.rec-btn[data-recording="true"] {
        background: #d93829;
        border-color: #ff7b6e;
        color: #fff;
      }
      .mach-btn.save-btn {
        background: #eab965;
        border-color: #eab965;
        color: #16120a;
      }
      .mach-btn[hidden] { display: none !important; }
      @media (max-width: 640px) {
        #machinima-card {
          left: 10px;
          width: calc(100vw - 20px);
          bottom: calc(max(8px, env(safe-area-inset-bottom)) + 98px);
          padding: 7px 10px 8px;
        }
        #mach-explain { font-size: 10.5px; line-height: 1.32; }
        #mach-lyric { font-size: 10.5px; }
        .mach-btn { padding: 4px 7px; font-size: 8.5px; }
      }
    `;
    document.head.appendChild(style);

    const card = document.createElement("aside");
    card.id = "machinima-card";
    card.hidden = true;
    card.setAttribute("aria-live", "polite");
    card.innerHTML = `
      <span id="mach-kicker">EXPLAINER TRAILER · ACT I</span>
      <h2 id="mach-title">Overlook Wellhead &amp; The 4 L Chalk Window</h2>
      <p id="mach-explain"></p>
      <p id="mach-lyric"></p>
    `;
    document.body.appendChild(card);

    const bar = document.createElement("div");
    bar.id = "machinima-bar";
    bar.hidden = true;
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "In-World Machinima Director & Recorder");
    bar.innerHTML = `
      <div class="mach-top-row">
        <div id="mach-scrub" role="slider" aria-label="Scrub machinima timeline" tabindex="0"><span id="mach-scrub-fill"></span></div>
        <span id="mach-clock">00:00 / 01:30</span>
      </div>
      <div class="mach-btns">
        <button type="button" class="mach-btn" id="mach-mode-trailer" aria-pressed="true">🎬 Trailer</button>
        <button type="button" class="mach-btn" id="mach-mode-mv" aria-pressed="false">♫ Music Video</button>
        <button type="button" class="mach-btn" id="mach-mode-dolly" aria-pressed="false">🎥 Dolly Cam</button>
        <button type="button" class="mach-btn" id="mach-play" aria-label="Play or pause machinima">⏸ Pause</button>
        <button type="button" class="mach-btn" id="mach-prev" aria-label="Previous shot">‹ Shot</button>
        <button type="button" class="mach-btn" id="mach-next" aria-label="Next shot">Shot ›</button>
        <button type="button" class="mach-btn" id="mach-cc" aria-pressed="true" title="Toggle cinema captions & burn-in">CC</button>
        <button type="button" class="mach-btn rec-btn" id="mach-rec" data-recording="false">● Rec Video</button>
        <a class="mach-btn save-btn" id="mach-save" hidden download="donkey-water-machinima.webm">⬇ Save Video</a>
        <a class="mach-btn" id="mach-studio-link" href="../study/studio.html" title="Open Bidirectional Game ↔ Video Production Studio">◫ V2G Studio</a>
        <button type="button" class="mach-btn" id="mach-exit">× Exit</button>
      </div>
      <div class="mach-btns" id="mach-dolly-row" hidden>
        <button type="button" class="mach-btn" data-dolly-cue="dance">Cast Eskista</button>
        <button type="button" class="mach-btn" data-dolly-cue="pump">Pump Well</button>
        <button type="button" class="mach-btn" data-dolly-cue="camera">8×10 Rig</button>
        <button type="button" class="mach-btn" data-dolly-cue="pour">Pour Cans</button>
        <button type="button" class="mach-btn" data-dolly-cue="bars">Letterbox</button>
      </div>
    `;
    document.body.appendChild(bar);
  }

  function createMachinimaDirector(env) {
    const {
      T, canvas, camera, state, donkey, wagon, cast, relays, forestGroves,
      fieldRigGroup, pourGroup, donkeyGlider, contrailL, contrailR,
      audio, audioEl, driveSurfaceAt, setRegion, initRain,
      applyLevelChaseCamera, applyLevelFPSCamera, poseRoofRider, poseGlider,
      toggleInWorldVideo, updateHUD, toast, hasAhiya = false
    } = env;

    injectMachinimaDOM();
    // Hide recursive Studio link when embedded inside study/studio.html iframe
    const studioLinkEl = document.getElementById("mach-studio-link");
    if (studioLinkEl && window.self !== window.top) studioLinkEl.hidden = true;

    const cardEl = document.getElementById("machinima-card");
    const barEl = document.getElementById("machinima-bar");
    const dollyRowEl = document.getElementById("mach-dolly-row");
    const kickerEl = document.getElementById("mach-kicker");
    const titleEl = document.getElementById("mach-title");
    const explainEl = document.getElementById("mach-explain");
    const lyricEl = document.getElementById("mach-lyric");
    const scrubEl = document.getElementById("mach-scrub");
    const scrubFillEl = document.getElementById("mach-scrub-fill");
    const clockEl = document.getElementById("mach-clock");
    const playBtn = document.getElementById("mach-play");
    const ccBtn = document.getElementById("mach-cc");
    const recBtn = document.getElementById("mach-rec");
    const saveLink = document.getElementById("mach-save");

    const camPos = new T.Vector3();
    const camLook = new T.Vector3();
    const tmpTarget = new T.Vector3();

    let active = false;
    let mode = "trailer"; // "trailer" | "musicvideo" | "dolly"
    let playing = true;
    let timeSec = 0;
    let currentShotIdx = -1;
    let captionsOn = window.self === window.top;
    let letterboxOn = true;
    let dollyCue = "dance";
    let savedSnapshot = null;

    // Free dolly state
    const dolly = { x: -16, y: 158.2, z: 3.5, yaw: 1.45, pitch: -0.06, fov: 47 };

    // Recording state
    let recCanvas = null, recCtx = null, mediaRecorder = null;
    let recChunks = [], recStartTime = 0, recBytes = 0, recBlobUrl = "", recExt = "webm";

    function safeCamPos(x, y, z, minClearance = 1.45) {
      const g = driveSurfaceAt(x, z);
      camPos.set(x, Math.max(g + minClearance, y), z);
    }

    // Transform local coordinates of Highland Pueblo group (-776, -30, rot.y = 0.30) to world XZ
    const PUEBLO_COS = Math.cos(0.30);
    const PUEBLO_SIN = Math.sin(0.30);
    function puebloWorldXZ(lx, lz) {
      return [
        -776.0 + lx * PUEBLO_COS + lz * PUEBLO_SIN,
        -30.0 - lx * PUEBLO_SIN + lz * PUEBLO_COS
      ];
    }

    const compSurf = (x, z) => Math.max(driveSurfaceAt(x, z), driveSurfaceAt(-1680, 775) + 0.52);

    function placeActor(id, x, z, heading, pose, speech = "", surfFn = driveSurfaceAt) {
      const ch = cast?.byId?.[id];
      if (!ch) return null;
      if (ch.group.parent !== cast.group) cast.group.add(ch.group);
      ch.group.visible = true;
      ch.state.pose = pose || "idle";
      ch.place(x, z, heading, surfFn);
      ch.setSpeech(speech);
      return ch;
    }

    function updateActor(id, dt, nowSec, opts) {
      const ch = cast?.byId?.[id];
      if (!ch || !ch.group.visible) return null;
      ch.update(dt, nowSec, Object.assign({ surfaceAt: driveSurfaceAt, beatPulse: state.beatPulse }, opts));
      return ch;
    }

    function seatImaniInWagon() {
      const im = cast?.byId?.imani;
      if (!im || !wagon?.chassis) return;
      if (im.group.parent !== wagon.chassis) wagon.chassis.add(im.group);
      im.group.visible = true;
      im.group.position.set(0.38, 0.44, 0.32);
      im.group.rotation.set(0, 0, 0, "YXZ");
      if (im.label) im.label.sprite.visible = false;
    }

    function stageWagonAt(x, z, heading, withRoofDonkey = true) {
      wagon.x = x;
      wagon.z = z;
      wagon.y = driveSurfaceAt(x, z);
      wagon.heading = heading;
      wagon.speed = 0;
      wagon.pitch = 0;
      wagon.roll = 0;
      wagon.steerAngle = 0;
      wagon.group.position.set(wagon.x, wagon.y, wagon.z);
      wagon.group.rotation.set(0, heading, 0, "YXZ");
      state.donkeyOnRoof = withRoofDonkey;
      if (withRoofDonkey) {
        state.roofMountT = 1;
        poseRoofRider(0.016);
      }
      seatImaniInWagon();
    }

    function clearStageEffects() {
      state.gliding = false;
      state.drivingCart = false;
      state.riding = false;
      state.donkeyOnRoof = false;
      state.lidarOn = false;
      state.lidarStrength = 0;
      state.soloLook = 13; // CYAN JERIKAN: full natural RGB orthographic textures + selective living cyan glow
      state.modeIdx = 0;
      state.filterIdx = 5;
      if (donkeyGlider) donkeyGlider.visible = false;
      if (contrailL?.line) contrailL.line.visible = false;
      if (contrailR?.line) contrailR.line.visible = false;
      if (pourGroup) pourGroup.visible = false;
      if (fieldRigGroup) fieldRigGroup.visible = false;
      state.pourAnim = null;
      // Return any temporarily moved cast back to cast.group and hide speech bubbles
      if (cast?.list) {
        for (const ch of cast.list) {
          if (ch.group.parent !== cast.group) cast.group.add(ch.group);
          ch.setSpeech("");
          if (ch.label) ch.label.sprite.visible = false;
        }
      }
    }

    /* =========================================================================
       12-ACT 2086 EXPLAINER TRAILER (90.0 SECONDS)
       Acts I–VI showcase the 6 Donkey-Method V2G scenes directly at 00:00–00:51
       (`wellhead`, `compound`, `oxbow`, `cooling`, `convoy`, `hill`), followed
       by Acts VII–XII covering Spatial Radio, Woody Cruiser, Silver Ford,
       8×10 Lidar Zones 0–X, Winged Woody Flight, and the 6/8 Eskista Finale.
       ========================================================================= */
    const TRAILER_DURATION = 90.0;
    const packTouchPt = new T.Vector3();
    const overlookPumpGrips = {
      pumpGripL: new T.Vector3(),
      pumpGripR: new T.Vector3(),
      pumpGripWorld: new T.Vector3(),
      pumpBarDir: new T.Vector3(),
      pumpPhase: 0
    };

    const TRAILER_SHOTS = [
      /* ACT I · V1 OVERLOOK WELLHEAD (0.0s – 8.5s) */
      {
        id: "act1_wellhead", sceneKey: "wellhead", t0: 0.0, t1: 8.5,
        kicker: "ACT I · OVERLOOK WELLHEAD & 4 L CHALK WINDOW",
        title: "Imani at the Dawn Standpipe · June’s Cup & Mistletoe",
        explain: "Pump 20 L of living cyan water at Overlook Wellhead (P). Imani drives the cast-iron lever and checks Mistletoe’s 4 L chalk sight-window while June raises her tin cup.",
        quote: "“Iron lever cracks before the rooster — Mum left the camera running eight more seconds.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.pumpFlow = 1.0;
          state.focusDist = 3.4;
          stageWagonAt(-30.5, 5.2, -Math.PI * 0.52, false);
          donkey.place(-21.35, -7.85, 0.16, driveSurfaceAt);
          placeActor("imani", -23.04, -6.20, Math.PI * 0.5, "pump", "");
          placeActor("june", -20.88, -5.88, -0.18, "micCup", "");
          placeActor("witness_tomas", -23.85, -7.35, 0.72, "queueWait", "");
          initRain();
          audio.pumpClank();
        },
        step(u, dt, nowSec) {
          state.pumpFlow = 1.0;
          // Pre-step Overlook standpipe lever to the exact phase night-post.js / zones.js renders this frame (`0.000m` IK lock!)
          const nextLeverPhase = state.pumpLeverPhase + dt * 4.5;
          const hasOvPump = typeof window.stepStandpipePump === "function" && window.__npStandpipePumps?.overlook;
          if (hasOvPump) {
            window.stepStandpipePump("overlook", nextLeverPhase, overlookPumpGrips, { rawLeverSign: true, flowScale: 1.0 });
          }
          const pumpOpts = hasOvPump ? {
            pose: "pump",
            pumpPhase: overlookPumpGrips.pumpPhase,
            pumpGripL: overlookPumpGrips.pumpGripL,
            pumpGripR: overlookPumpGrips.pumpGripR,
            worldGripL: overlookPumpGrips.pumpGripL,
            worldGripR: overlookPumpGrips.pumpGripR,
            pumpGripWorld: overlookPumpGrips.pumpGripWorld,
            pumpBarDir: overlookPumpGrips.pumpBarDir,
            lookAt: overlookPumpGrips.pumpGripWorld
          } : { pose: "pump", pumpPhase: -nextLeverPhase };

          if (u < 0.46) {
            // Cut A (kf02 & V1_sheet): Imani pumping the cast-iron lever with cyan discharge into basin while June holds cup!
            const k = u / 0.46;
            donkey.place(-21.35, -7.85, 0.16, driveSurfaceAt);
            donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
            placeActor("imani", -23.04, -6.20, Math.PI * 0.5, "pump", "");
            placeActor("june", -20.88, -5.88, -0.18, "micCup", "");
            placeActor("witness_tomas", -23.85, -7.35, 0.72, "queueWait", "");
            updateActor("imani", dt, nowSec, pumpOpts);
            updateActor("june", dt, nowSec, { pose: "micCup", lookAt: camera.position });
            updateActor("witness_tomas", dt, nowSec, { pose: "queueWait", lookAt: donkey.group.position });
            const wy = driveSurfaceAt(-22.2, -6.2);
            safeCamPos(lerp(-21.65, -21.15, k), wy + lerp(1.16, 1.28, k), lerp(-2.75, -3.05, k), 0.85);
            camLook.set(lerp(-21.95, -21.75, k), wy + 1.06, -6.25);
          } else {
            // Cut B (World Bible Page 1 saddle.jpg): Imani checking Mistletoe's glowing 4 L chalk window while June raises her cup!
            const k = (u - 0.46) / 0.54;
            donkey.place(-20.95, -11.40, 0.24, driveSurfaceAt);
            donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
            const dh = donkey.state.heading;
            const sideX = Math.cos(dh), sideZ = -Math.sin(dh);
            const fwdX = Math.sin(dh), fwdZ = Math.cos(dh);
            packTouchPt.set(
              donkey.state.x + sideX * 0.38 + fwdX * 0.06,
              donkey.group.position.y + 0.94,
              donkey.state.z + sideZ * 0.38 + fwdZ * 0.06
            );
            placeActor("imani", -20.18, -11.42, 0.12, "touchPack", "");
            placeActor("june", -19.34, -11.55, 0.04, "micCup", "");
            placeActor("witness_tomas", -23.04, -6.20, Math.PI * 0.5, "pump", "");
            updateActor("imani", dt, nowSec, { pose: "touchPack", packTarget: packTouchPt, lookAt: donkey.group.position });
            updateActor("june", dt, nowSec, { pose: "micCup", lookAt: camera.position });
            updateActor("witness_tomas", dt, nowSec, pumpOpts);
            const dy = donkey.group.position.y;
            safeCamPos(lerp(-20.28, -19.84, k), dy + lerp(0.94, 1.16, k), lerp(-8.42, -8.76, k), 0.72);
            camLook.set(lerp(-20.20, -20.04, k), dy + lerp(0.98, 1.10, k), -11.42);
          }
        }
      },

      /* ACT II · V2 DAYLIGHT COMPOUND 2-PERSON UNLOAD & TERRACOTTA BOWL POUR (8.5s – 17.5s) */
      {
        id: "act2_compound_unload", sceneKey: "compound", t0: 8.5, t1: 17.5,
        kicker: hasAhiya ? "ACT II · DAYLIGHT COMPOUND UNLOAD & TERRACOTTA BOWL" : "ACT II · HIGHLAND COURTYARD 20 KG SADDLE UNLOAD",
        title: hasAhiya ? "Two-Person 20 L Jerrycan Heave & Clay Bowl Pour" : "Two-Handed 20 L Saddle Unload & Courtyard Basin Pour",
        explain: hasAhiya
          ? "Outside the hidmo mud-plaster doorway and wind-billowing linen sheet, two carriers untie the sisal hitch, heave the 20 L WATER = WIFI can off the sawbuck, and pour into the wheel-thrown terracotta bowl."
          : "Carriers brace together to untie the braided sisal hitch, lift the heavy 20 L jerrycan clear of Mistletoe's wooden sawbuck, and pour living cyan water into the courtyard basin.",
        quote: "“Two people take the handles before the pack frame comes away — a clay bowl waits beside the tap.”",
        setup() {
          clearStageEffects();
          if (hasAhiya) {
            setRegion("ahiya");
            state.focusDist = 3.8;
            // Mistletoe staged cleanly on the +0.52m raised pad with >1.2m silhouette clearance from Biruk & doorway curtain!
            donkey.place(-1683.56, 773.92, 1.45, compSurf);
            placeActor("aunt_lemlem", -1684.08, 772.35, 0.35, "auntSing", "", compSurf);
            if (typeof cast?.stepCompoundUnload !== "function") {
              placeActor("compound_lead", -1682.42, 774.08, -1.52, "unloadHandoff", "", compSurf) ||
                placeActor("saba", -1682.42, 774.08, -1.52, "heaveSaddle20kg", "", compSurf);
              placeActor("compound_partner", -1681.72, 774.02, -1.68, "unloadHandoff", "", compSurf) ||
                placeActor("rahel", -1681.72, 774.02, -1.68, "tieRope", "", compSurf);
              placeActor("compound_child", -1684.00, 775.04, 1.78, "holdPhone", "", compSurf) ||
                placeActor("escort_yared", -1684.00, 775.04, 1.78, "phoneGlow", "", compSurf);
            }
          } else {
            setRegion("tetons");
            state.focusDist = 3.8;
            donkey.place(-776.8, -26.2, 1.48, driveSurfaceAt);
            placeActor("imani", -775.95, -26.15, -1.52, "heaveSaddle20kg", "");
            placeActor("june", -775.25, -26.35, -1.45, "childReceive20kg", "");
            placeActor("queue_4", -776.55, -25.25, -2.85, "tieRope", "");
          }
          initRain();
          audio.pourSplash(0);
        },
        step(u, dt, nowSec) {
          if (hasAhiya) {
            setRegion("ahiya");
            donkey.place(-1683.56, 773.92, 1.45, compSurf);
            donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, compSurf);
            updateActor("aunt_lemlem", dt, nowSec, { pose: "auntSing", surfaceAt: compSurf });

            const saddlePos = { x: -1682.58, z: 774.02 };
            const bowlPos = { x: -1680.85, z: 774.35 };
            const unloadPhase = clamp(0.06 + u * 0.84, 0, 0.90);
            if (typeof cast?.stepCompoundUnload === "function") {
              cast.stepCompoundUnload(dt, nowSec, {
                phase: unloadPhase,
                saddlePos,
                bowlPos,
                childX: -1684.00,
                childZ: 775.04,
                surfaceAt: driveSurfaceAt
              });
            } else {
              // Seamless fallback choreography if characters.js helper is not yet active
              const carryT = smooth(0.28, 0.62, u);
              const pouring = u >= 0.60;
              const lx = lerp(-1682.42, -1681.32, carryT);
              const lz = lerp(774.08, 774.36, carryT);
              const leadId = cast?.byId?.compound_lead ? "compound_lead" : "saba";
              const partId = cast?.byId?.compound_partner ? "compound_partner" : "rahel";
              const childId = cast?.byId?.compound_child ? "compound_child" : "escort_yared";
              placeActor(leadId, lx, lz, pouring ? 1.48 : lerp(-1.52, 1.48, carryT), pouring ? "basinPour20kg" : "heaveSaddle20kg", "", compSurf);
              placeActor(partId, lx + 0.68, lz - 0.12, -1.58, pouring ? "pour" : "tieRope", "", compSurf);
              placeActor(childId, -1684.00, 775.04, 1.78, "phoneGlow", "", compSurf);
              updateActor(leadId, dt, nowSec, { pose: pouring ? "basinPour20kg" : "heaveSaddle20kg", unloadRole: "lead", unloadPhase: unloadPhase, saddlePos, bowlPos, surfaceAt: compSurf });
              updateActor(partId, dt, nowSec, { pose: pouring ? "pour" : "tieRope", unloadRole: "partner", unloadPhase: unloadPhase, saddlePos, bowlPos, surfaceAt: compSurf });
              updateActor(childId, dt, nowSec, { pose: "phoneGlow", surfaceAt: compSurf });
            }

            // Close-to-medium courtyard tracking shot on the +0.52m raised pad (panned ~0.38m left to exclude right-edge post!)
            const cy = compSurf(-1680, 775);
            const pourFocus = smooth(0.40, 0.84, u);
            safeCamPos(
              lerp(-1682.72, -1681.62, u),
              cy + lerp(1.26, 1.04, pourFocus),
              lerp(777.46, 776.68, pourFocus),
              0.84
            );
            camLook.set(
              lerp(-1682.40, -1681.60, pourFocus),
              cy + lerp(1.04, 0.72, pourFocus),
              lerp(773.58, 774.12, pourFocus)
            );
          } else {
            // /zones/ Western Basin courtyard fallback
            const cy = driveSurfaceAt(-776.0, -26.0);
            donkey.place(-776.8, -26.2, 1.48, driveSurfaceAt);
            donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
            const pouring = u > 0.52;
            const ix = lerp(-775.95, -775.15, smooth(0.25, 0.62, u));
            placeActor("imani", ix, -26.15, pouring ? 1.52 : -1.52, pouring ? "basinPour20kg" : "heaveSaddle20kg", "");
            updateActor("imani", dt, nowSec, { pose: pouring ? "basinPour20kg" : "heaveSaddle20kg" });
            updateActor("june", dt, nowSec, { pose: "childReceive20kg" });
            updateActor("queue_4", dt, nowSec, { pose: "tieRope" });
            safeCamPos(lerp(-776.2, -774.8, u), cy + lerp(1.32, 1.12, u), -23.1, 0.92);
            camLook.set(lerp(-776.1, -775.1, u), cy + lerp(1.05, 0.85, u), -26.2);
          }
        }
      },

      /* ACT III · V3 COTTONWOOD OXBOW DOUBLE LINEN SCREENING (17.5s – 26.0s) */
      {
        id: "act3_oxbow_sheet", sceneKey: "oxbow", t0: 17.5, t1: 26.0,
        kicker: "ACT III · COTTONWOOD OXBOW DOUBLE LINEN SCREENING",
        title: "Root-Bowl Pour, Living Audience & Billowing Forest Sheets",
        explain: "Makeda pours living cyan water into the gnarled cottonwood root-bowl while Etta shades the beam, the yard watches WF–08 on double pegged linen, and the harmony answers live.",
        quote: "“Put down that Ruth made the picture. Leave a space for who was laughing.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.focusDist = 4.6;
          for (const g of forestGroves) {
            if (g.station === "oxbow" || Math.hypot((g.x || 0) - (-510), (g.z || 0) - 96) < 60) {
              g.unlocked = true;
              g.grow = 1.0;
            }
          }
          donkey.place(-506.2, 102.4, -2.62, driveSurfaceAt);
          placeActor("makeda", -511.25, 98.45, 1.85, "kneelPour", "");
          placeActor("etta", -508.55, 97.15, -1.65, "shadeScreen", "");
          placeActor("old_bride", -509.80, 98.80, -2.68, "screenWatch", "");
          placeActor("june", -508.20, 99.85, -2.65, "screenWatch", "");
          placeActor("hood_watcher_1", -506.95, 97.35, -2.48, "screenWatch", "");
          placeActor("hood_watcher_2", -506.25, 98.45, -2.55, "screenWatch", "");
          if (hasAhiya && cast?.byId?.aunt_lemlem) {
            placeActor("aunt_lemlem", -511.75, 97.05, 0.88, "auntSing", "");
          } else {
            placeActor("nell", -511.75, 97.05, 0.88, "sing", "");
          }
          initRain();
        },
        step(u, dt, nowSec) {
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          tmpTarget.set(-510.0, driveSurfaceAt(-510, 96) + 2.35, 96.0);
          updateActor("makeda", dt, nowSec, { pose: "kneelPour" });
          updateActor("etta", dt, nowSec, { pose: "shadeScreen", lookAt: tmpTarget });
          // Living audience poses (`screenWatch` + `auntSing`, falling back cleanly if older pose table)
          const watchPose = cast?.byId?.old_bride ? "screenWatch" : "seatedWatch";
          updateActor("old_bride", dt, nowSec, { pose: watchPose, seated: true, lookAt: tmpTarget });
          updateActor("june", dt, nowSec, { pose: "screenWatch", lookAt: tmpTarget });
          updateActor("hood_watcher_1", dt, nowSec, { pose: "screenWatch", lookAt: tmpTarget });
          updateActor("hood_watcher_2", dt, nowSec, { pose: "screenWatch", lookAt: tmpTarget });
          if (hasAhiya && cast?.byId?.aunt_lemlem) {
            updateActor("aunt_lemlem", dt, nowSec, { pose: "auntSing", lookAt: camera.position });
          } else {
            updateActor("nell", dt, nowSec, { pose: "sing", lookAt: camera.position });
          }
          const oy = driveSurfaceAt(-510.0, 98.2);
          safeCamPos(lerp(-509.55, -506.75, u), oy + lerp(1.22, 1.66, u), lerp(101.65, 101.28, u), 1.00);
          camLook.set(lerp(-511.35, -509.05, u), oy + lerp(1.04, 1.76, u), lerp(98.05, 96.15, u));
        }
      },

      /* ACT IV · V4 HIGHLAND PUEBLO WIRE-GLASS REGISTRY & CYAN SERVER VAULT (26.0s – 34.5s) */
      {
        id: "act4_cooling_vault", sceneKey: "cooling", t0: 26.0, t1: 34.5,
        kicker: "ACT IV · WIRE-GLASS REGISTRY & CYAN LIQUID-COOLING VAULT",
        title: "Three Dividing Hoses · Tess’s Ledger & Wet Server Sanctuary",
        explain: "Nine liters cool the Highland Pueblo server racks behind Georgian diamond wire-glass — curving cyan coolant tubes snake across a mirror-wet floor toward the lit white cross.",
        quote: "“Tess takes nine liters on the clean side of the exchanger. The inner rack comes up.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.focusDist = 4.5;
          donkey.place(-776.8, -26.8, 2.85, driveSurfaceAt);
          placeActor("imani", -776.1, -26.4, 2.85, "walk", "");
          const [tessX, tessZ] = puebloWorldXZ(3.56, -1.24);
          placeActor("tess", tessX, tessZ, 0.30, "clerkWindow", "");
          placeActor("queue_1", -773.45, -28.85, -1.35, "queueWait", "");
          placeActor("queue_2", -773.85, -27.75, -1.45, "queueWait", "");
          placeActor("queue_3", -774.25, -26.65, -1.52, "queueWait", "");
          placeActor("queue_4", -774.65, -25.55, -1.60, "queueWait", "");
          initRain();
        },
        step(u, dt, nowSec) {
          donkey.place(-776.8, lerp(-26.2, -28.0, Math.min(1, u * 1.4)), 2.85, driveSurfaceAt);
          donkey.update(dt, { throttle: u < 0.34 ? 0.45 : 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          updateActor("tess", dt, nowSec, { pose: "clerkWindow" });
          for (const qid of ["queue_1", "queue_2", "queue_3", "queue_4"]) {
            updateActor(qid, dt, nowSec, { pose: "queueWait", lookAt: donkey.group.position });
          }

          const py = driveSurfaceAt(-776.0, -30.0);
          if (u < 0.32) {
            // Cut A (village.jpg): 3-branch hoses + tin mug foreground, stone & hidmo houses, village queue!
            const v = u / 0.32;
            placeActor("imani", -776.0, lerp(-26.0, -28.0, v), 2.85, "walk", "");
            updateActor("imani", dt, nowSec, { pose: "walk", carryCan: true });
            safeCamPos(lerp(-775.6, -774.9, v), py + lerp(1.58, 1.78, v), lerp(-22.3, -23.6, v), 1.22);
            camLook.set(-775.9, py + 1.38, -30.8);
          } else {
            // Cut B (window.jpg -> kf07 / V4_sheet): Axial push along local x = 2.45 straight through diamond wire-glass
            // past Tess's counter into the glowing cyan liquid-cooling server corridor & lit white cross!
            const w = smooth(0.32, 1.0, u);
            const lz = lerp(1.28, -1.62, w);
            const [cx, cz] = puebloWorldXZ(2.45, lz);
            const [tx, tz] = puebloWorldXZ(2.45, -7.35);
            safeCamPos(cx, py + lerp(1.56, 1.58, w), cz, 1.04);
            camLook.set(tx, py + lerp(1.54, 1.40, w), tz);
          }
        }
      },

      /* ACT V · V5 AHIYA NIGHT RIDGE CONVOY & DOMED CROSS-BEACON SANCTUARY (34.5s – 43.5s) */
      {
        id: "act5_night_convoy", sceneKey: "convoy", t0: 34.5, t1: 43.5,
        kicker: hasAhiya ? "ACT V · AHIYA NIGHT RIDGE & CROSS-BEACON DOME" : "ACT V · ABYSSAL WHALE FLUKE FILM CATHEDRAL",
        title: hasAhiya ? "Smartphone-Lit Gabi Procession & Cyan Ground Mesh" : "Drowned Rib-Arch Sheet & Kelp Filmstrip Cathedral",
        explain: hasAhiya
          ? "Draped gabi-shawl carriers and youths light the dark basalt ascent with glowing cyan phones, climbing over Ahiya’s Delaunay ground mesh toward the domed stone Cross-Beacon sanctuary."
          : "Between the ribs of the Whale Fluke wreck, Dawit keeps two wooden chairs before a double-ending cloth under glowing kelp filmstrip arches.",
        quote: hasAhiya
          ? "“Keep the wrong take too — that’s the only one where we all came in together.”"
          : "“Two screenings went out on the tide. Both poles kept their seats.”",
        setup() {
          clearStageEffects();
          if (hasAhiya) {
            setRegion("ahiya");
            state.focusDist = 4.2;
            donkey.place(-1577.0, 629.0, -2.46, driveSurfaceAt);
            placeActor("aunt_lemlem", -1612.2, 592.2, 0.62, "auntSing", "");
          } else {
            setRegion("abyss");
            state.focusDist = 6.0;
            donkey.place(-1065.8, -22.8, -2.55, driveSurfaceAt);
            placeActor("dawit", -1066.8, -24.2, -2.55, "screenWatch", "");
            placeActor("imani", -1064.6, -23.4, -2.52, "holdCup", "");
          }
          initRain();
        },
        step(u, dt, nowSec) {
          if (hasAhiya) {
            setRegion("ahiya");
            const hdg = -2.463; // Climbing NW from (-1576, 630) straight toward Cross-Beacon (-1610, 590)
            const sinH = Math.sin(hdg), cosH = Math.cos(hdg);
            const rightX = cosH, rightZ = -sinH;
            const cx = lerp(-1576.8, -1591.5, u);
            const cz = lerp(629.2, 611.2, u);

            donkey.place(cx, cz, hdg, driveSurfaceAt);
            donkey.update(dt, { throttle: 0.62, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
            updateActor("aunt_lemlem", dt, nowSec, { pose: "auntSing" });

            // Place the walking gabi-shawl procession around Mistletoe on the glowing cyan network ridge!
            const walkPose = "convoyWalk";
            const filmPose = "filmConvoy";
            const formation = [
              ["rahel",          -0.95,  0.55, walkPose],
              ["escort_yared",    0.92,  0.68, filmPose],
              ["saba",           -1.55, -0.75, walkPose],
              ["convoy_elder_1",  1.35, -0.82, walkPose],
              ["convoy_elder_2", -0.35, -1.65, filmPose]
            ];
            for (const [id, sideOff, fwdOff, pName] of formation) {
              if (!cast?.byId?.[id]) continue;
              const ax = cx + rightX * sideOff + sinH * fwdOff;
              const az = cz + rightZ * sideOff + cosH * fwdOff;
              placeActor(id, ax, az, hdg, pName, "");
              updateActor(id, dt, nowSec, { pose: pName, enablePhoneLight: true });
            }

            const gy = driveSurfaceAt(cx, cz);
            const bcy = driveSurfaceAt(-1610, 590);
            if (u < 0.48) {
              // Cut A (kf09 / kf11 / kf12): Low-angle front-quarter tracking dolly capturing upward cyan smartphone glow on faces & shawls!
              const k = u / 0.48;
              const camX = cx + sinH * lerp(3.45, 2.95, k) + rightX * 0.42;
              const camZ = cz + cosH * lerp(3.45, 2.95, k) + rightZ * 0.42;
              safeCamPos(camX, gy + lerp(1.08, 1.20, k), camZ, 0.88);
              camLook.set(cx - rightX * 0.08, gy + 1.14, cz - rightZ * 0.08);
            } else {
              // Cut B (kf10): Sweeping low-angle OTS dolly behind the climbing convoy over cyan Delaunay lines toward the domed Cross-Beacon & sky beam!
              const k = (u - 0.48) / 0.52;
              const camX = cx - sinH * lerp(4.2, 4.9, k) + rightX * lerp(1.05, 0.65, k);
              const camZ = cz - cosH * lerp(4.2, 4.9, k) + rightZ * lerp(1.05, 0.65, k);
              safeCamPos(camX, gy + lerp(1.42, 1.72, k), camZ, 1.02);
              camLook.set(
                lerp(cx + sinH * 9.0, -1610.0, 0.58),
                lerp(gy + 1.55, bcy + 5.8, 0.54),
                lerp(cz + cosH * 9.0, 590.0, 0.58)
              );
            }
          } else {
            // /zones/ Abyssal Whale Fluke fallback
            const fy = driveSurfaceAt(-1066, -24);
            donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
            updateActor("dawit", dt, nowSec, { pose: "idle" });
            updateActor("imani", dt, nowSec, { pose: "holdCup" });
            safeCamPos(lerp(-1062.8, -1064.2, u), fy + lerp(1.45, 1.85, u), lerp(-19.5, -20.8, u), 1.10);
            camLook.set(-1069.2, fy + 1.95, -27.4);
          }
        }
      },

      /* ACT VI · V6 HILL ARCHIVE REC PPC OPERATOR DESK (43.5s – 51.5s) */
      {
        id: "act6_hill_rec_ppc", sceneKey: "hill", t0: 43.5, t1: 51.5,
        kicker: hasAhiya ? "ACT VI · HILL ARCHIVE REC PPC SURVEILLANCE DESK" : "ACT VI · HALF DOME EAST APRON SEEP RELAY",
        title: hasAhiya ? "Logging the Night Crossing · Clipboard & VHF Dispatch" : "Granite Shelf Seep Pump & Phone Relay",
        explain: hasAhiya
          ? "Cutting straight from the ridge into Hill Archive: Daniel logs the crossing on his clipboard while Hanna tracks the live REC PPC monitor and calls in on VHF radio."
          : "High on Half Dome’s East Granite Apron, Alma tends the narrow licensed seep pump while Mistletoe broadcasts across the Sierra notch.",
        quote: hasAhiya
          ? "“One operator logs the crossing. Another clears a space on the shelf for the returning rehearsal.”"
          : "“She has left a flat place on the granite shelf for a new camera.”",
        setup() {
          clearStageEffects();
          if (hasAhiya) {
            setRegion("ahiya");
            state.focusDist = 2.8;
            // Park Mistletoe just outside the Hill Archive bay so Ahiya region & WiFi field stay active
            donkey.place(-1765.0, 547.4, Math.PI, driveSurfaceAt);
            placeActor("ppc_op_male", -1765.85, 541.55, Math.PI * 0.86, "recDesk", "");
            placeActor("ppc_op_female", -1764.15, 541.55, -Math.PI * 0.86, "recDesk", "");
          } else {
            setRegion("ridge");
            state.focusDist = 4.6;
            donkey.place(436.2, 35.4, -2.35, driveSurfaceAt);
            placeActor("alma", 437.4, 36.2, -2.35, "phoneGlow", "");
            placeActor("imani", 435.4, 36.8, -2.20, "touchPack", "");
          }
          initRain();
        },
        step(u, dt, nowSec) {
          if (hasAhiya) {
            setRegion("ahiya");
            donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
            updateActor("ppc_op_male", dt, nowSec, { pose: "recDesk", opRole: "log" });
            updateActor("ppc_op_female", dt, nowSec, { pose: "recDesk", opRole: "radio" });
            const hy = driveSurfaceAt(-1765.0, 540.0);
            // Clean medium over-the-shoulder glide keeping the center REC PPC monitor & laptop completely open (kf08!)
            safeCamPos(lerp(-1765.24, -1764.76, u), hy + 1.44, lerp(542.94, 542.66, u), 1.15);
            camLook.set(-1765.0, hy + 1.48, 540.06);
          } else {
            const ay = driveSurfaceAt(436.8, 35.8);
            donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
            updateActor("alma", dt, nowSec, { pose: "phoneGlow" });
            updateActor("imani", dt, nowSec, { pose: "idle", carryCan: true });
            safeCamPos(lerp(433.2, 434.0, u), ay + 1.55, lerp(39.4, 38.6, u), 1.15);
            camLook.set(436.8, ay + 1.22, 35.6);
          }
        }
      },

      /* ACT VII · SPATIAL SCION RADIO & WATER = WIFI PACK JUGS (51.5s – 58.0s) */
      {
        id: "act7_donkey_radio", sceneKey: "wellhead", t0: 51.5, t1: 58.0,
        kicker: "ACT VII · MISTLETOE & SPATIAL SCION RADIO",
        title: "WATER = WIFI Saddle Jugs & Bounded Cyan Rain",
        explain: "The song broadcasts from Mistletoe’s Scion pack speakers with 3D distance falloff. Cyan rain falls strictly inside WiFi reach — keep her watered or she collapses!",
        quote: "“Cyan jerikan balanced on my shoulder blade · Hooves on cobble and the tape is turning.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.focusDist = 5.0;
          state.pingTimer = 4.0;
          donkey.place(-28.0, 0.6, -1.52, driveSurfaceAt);
          placeActor("imani", -27.8, 1.75, -1.52, "walk", "");
          placeActor("june", -26.8, 2.35, -1.52, "walk", "");
        },
        step(u, dt, nowSec) {
          const x = lerp(-26.5, -39.5, u), z = lerp(0.8, 1.3, u);
          donkey.place(x, z, -1.54, driveSurfaceAt);
          donkey.update(dt, { throttle: 0.65, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          placeActor("imani", x + 0.35, z + 1.15, -1.54, "walk", "");
          placeActor("june", x + 1.15, z + 1.75, -1.54, "walk", "");
          updateActor("imani", dt, nowSec, { pose: "walk", carryCan: true });
          updateActor("june", dt, nowSec, { pose: "walk" });
          const dy = donkey.group.position.y;
          safeCamPos(x - lerp(4.2, 3.4, u), dy + lerp(1.45, 1.82, u), z + lerp(3.4, 4.1, u), 1.25);
          camLook.set(x + 0.2, dy + 1.22, z + 0.85);
        }
      },

      /* ACT VIII · CRUISER WOODY & MORAINE SWITCHBACK (58.0s – 64.5s) */
      {
        id: "act8_woody_radar", sceneKey: "wellhead", t0: 58.0, t1: 64.5,
        kicker: "ACT VIII · CRUISER WOODY & HEADING-UP RADAR",
        title: "Drive or Reverse Anywhere — Zero Fences",
        explain: "Hop into the 1940s Woody (C) with Mistletoe on the roof-deck. Tap Reverse to back toward the lens, or cruise Moraine Switchback past Nell’s stone bakery oven.",
        quote: "“Carry the cyan up the ridge with me · Every slosh a metronome.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.focusDist = 11.0;
          stageWagonAt(-25.0, -12.0, -2.85, true);
          placeActor("nell", -45.4, -164.6, 0.65, "wave", "");
          placeActor("kaleb", -51.2, -166.4, 1.15, "idle", "");
        },
        step(u, dt, nowSec) {
          let wx, wz, hdg, spd;
          if (u < 0.28) {
            const r = smooth(0, 0.28, u);
            wx = lerp(-27.5, -24.2, r);
            wz = lerp(-24.0, -13.0, r);
            hdg = -2.84;
            spd = -16.5;
          } else {
            const f = smooth(0.28, 1.0, u);
            wx = lerp(-24.2, -41.0, f);
            wz = lerp(-13.0, -112.0, f);
            hdg = -2.96;
            spd = 24.0;
          }
          wagon.x = wx; wagon.z = wz; wagon.y = driveSurfaceAt(wx, wz); wagon.heading = hdg; wagon.speed = spd;
          wagon.group.position.set(wagon.x, wagon.y, wagon.z);
          wagon.group.rotation.set(0, hdg, 0, "YXZ");
          for (const w of wagon.wheels) w.spin.rotation.x -= (spd * dt) / 0.394;
          poseRoofRider(dt);
          seatImaniInWagon();
          cast?.byId?.imani?.update(dt, nowSec, { pose: "drive", carryCan: false, beatPulse: state.beatPulse });
          updateActor("nell", dt, nowSec, { pose: "wave" });
          const sinH = Math.sin(hdg), cosH = Math.cos(hdg);
          const distBack = u < 0.28 ? lerp(9.2, 6.4, u / 0.28) : 9.4;
          safeCamPos(wx - sinH * distBack + 2.1, wagon.y + 3.8, wz - cosH * distBack, 1.8);
          camLook.set(wx + sinH * 5.0, wagon.y + 2.1, wz + cosH * 5.0);
        }
      },

      /* ACT IX · SILVER FORD FERRY & 72 JERRYCANS (64.5s – 71.0s) */
      {
        id: "act9_pour_jerrycans", sceneKey: "oxbow", t0: 64.5, t1: 71.0,
        kicker: "ACT IX · SILVER FORD FERRY & 72 JERRYCANS",
        title: "Etta, the Ferrymen Brothers & Cistern Ignition",
        explain: "At Silver Ford, the two ferrymen brothers check the chalked flood post while Etta signs custody slips — pouring (F) fills every depot jerrycan in sequence.",
        quote: "“Etta signs two slips: the wedding for the yard sheet, the last eight seconds for June.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.focusDist = 6.2;
          const ford = relays.find(r => r.id === "ford") || relays[2];
          donkey.place(ford.x + 2.8, ford.z + 2.5, -2.25, driveSurfaceAt);
          placeActor("imani", ford.x + 1.8, ford.z + 3.2, -2.45, "basinPour20kg", "");
          // Stage Etta & Tadesse >2.1m clear of the Silver Ford shin-height cyan flow conduit
          placeActor("etta", ford.x + 1.85, ford.z - 3.35, 0.25, "wave", "");
          placeActor("ferry_bekele", -252.2, -52.4, 1.85, "pointPost", "");
          placeActor("ferry_tadesse", -242.8, -60.6, -2.25, "idle", "");
          audio.pourSplash(1);
        },
        step(u, dt, nowSec) {
          const ford = relays.find(r => r.id === "ford") || relays[2];
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          updateActor("imani", dt, nowSec, { pose: "basinPour20kg" });
          updateActor("etta", dt, nowSec, { pose: "wave" });
          updateActor("ferry_bekele", dt, nowSec, { pose: "pointPost" });
          updateActor("ferry_tadesse", dt, nowSec, { pose: "idle" });
          if (ford) {
            if (ford.poolMesh) ford.poolMesh.position.y = lerp(0.10, 0.44, u);
            const nC = ford.cans.length;
            for (let i = 0; i < nC; i++) ford.cans[i].userData.setFill(clamp(u * (nC + 1) - i, 0, 1));
          }
          const ang = lerp(0.45, 1.55, u), rad = lerp(6.6, 5.2, u);
          safeCamPos(ford.x + Math.cos(ang) * rad, ford.y + lerp(1.85, 2.55, u), ford.z + Math.sin(ang) * rad, 1.35);
          camLook.set(ford.x + 0.8, ford.y + 1.12, ford.z + 0.4);
        }
      },

      /* ACT X · ANSEL ADAMS ZONES 0–X & 8×10 LIDAR (71.0s – 77.5s) */
      {
        id: "act10_zones_camera", sceneKey: "wellhead", t0: 71.0, t1: 77.5,
        kicker: "ACT X · ANSEL ADAMS ZONES 0–X & LIDAR",
        title: "8×10 Mahogany Field Camera & Tonal Zone Shaders",
        explain: "Deploy the 8×10 view camera (B), scan elevation contours with Lidar (L), sync tonal zones to the song (T), and expose contact plates (Space) onto waking film trees.",
        quote: "“You don’t take a photograph, you make it — Zones 0 through X.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.soloLook = -1;
          state.modeIdx = 1;
          state.lidarOn = true;
          state.lidarStrength = 0.85;
          state.focusDist = 24.0;
          const ox = -33.5, oz = 2.0, oy = driveSurfaceAt(ox, oz);
          if (fieldRigGroup) {
            fieldRigGroup.position.set(ox, oy, oz);
            fieldRigGroup.rotation.y = -1.55;
            fieldRigGroup.visible = true;
          }
          donkey.place(-36.2, -0.8, -1.45, driveSurfaceAt);
          placeActor("imani", ox + 0.1, oz + 0.72, -1.55, "camera", "");
          placeActor("june", -32.2, 0.4, -1.75, "micCup", "");
          audio.shutter();
        },
        step(u, dt, nowSec) {
          state.lidarStrength = 0.78;
          state.focusDist = lerp(8.0, 165.0, smooth(0.15, 0.85, u));
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          updateActor("imani", dt, nowSec, { pose: "camera", carryCan: false });
          updateActor("june", dt, nowSec, { pose: "micCup" });
          const base = driveSurfaceAt(-33.5, 2.0);
          safeCamPos(lerp(-29.2, -30.5, u), base + lerp(1.65, 2.35, u), lerp(4.2, -1.6, u), 1.35);
          camLook.set(-42.0, base + 1.35, 0.2);
        }
      },

      /* ACT XI · WINGED WOODY FLIGHT & 10 KELP-FILM GROVES (77.5s – 84.0s) */
      {
        id: "act11_glider_forest", sceneKey: "cooling", t0: 77.5, t1: 84.0,
        kicker: "ACT XI · WINGED WOODY & COOLING VALLEY FLIGHT",
        title: "Soar Over the Cooling Reservoir & Wake 10 Film Groves",
        explain: "Fly the winged Woody (J, Shift for thermal lift) above the highland river and concrete cooling plant to wake all 10 living 35mm Kelp-Film Forest groves!",
        quote: "“Three wet seasons later the cottonwood shoot put out a leaf with square sprocket holes.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.gliding = true;
          state.donkeyOnRoof = true;
          state.glideOpen = 1;
          if (donkeyGlider) { donkeyGlider.visible = true; donkeyGlider.scale.setScalar(1); }
          for (const g of forestGroves) { g.unlocked = true; g.grow = 1.0; }
          seatImaniInWagon();
          audio.glideWhoosh();
        },
        step(u, dt, nowSec) {
          const gx = lerp(-690, -764, u), gz = lerp(-8, -22, u);
          const gy = Math.max(driveSurfaceAt(gx, gz) + 22, lerp(112, 92, u));
          const hdg = -1.72 + Math.sin(u * Math.PI) * 0.14;
          Object.assign(state.glide, { x: gx, y: gy, z: gz, heading: hdg, speed: 44, vy: -2.0, bank: Math.sin(u * TAU) * 0.14 });
          poseGlider(dt);
          seatImaniInWagon();
          cast?.byId?.imani?.update(dt, nowSec, { pose: "drive", carryCan: false, beatPulse: state.beatPulse });
          const sinH = Math.sin(hdg), cosH = Math.cos(hdg);
          safeCamPos(gx - sinH * 12.8 + cosH * 4.8, gy + 4.8, gz - cosH * 12.8 - sinH * 4.8, 2.2);
          camLook.set(gx + sinH * 9.0, gy - 1.2, gz + cosH * 9.0);
        }
      },

      /* ACT XII · COSMIC ADDIS 6/8 ESKISTA FINALE (84.0s – 90.0s) */
      {
        id: "act12_eskista_finale", sceneKey: "compound", t0: 84.0, t1: TRAILER_DURATION,
        kicker: "ACT XII · COSMIC ADDIS 6/8 ESKISTA FINALE",
        title: "Highland Pueblo Yard · Dance, Screen & Record",
        explain: "Deliver living water across both circuits, press K to dance 6/8 Eskista with the cast, or tap ● Rec Video below to export your own Machinima!",
        quote: "“Cosmic Addis Arkestra — carry WiFi water up to the Highland Pueblo!”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.focusDist = 7.5;
          const px = -776.5, pz = -26.5;
          donkey.place(px, pz, 0.45, driveSurfaceAt);
          placeActor("imani", px - 1.6, pz + 1.7, 0.55, "eskista", "");
          placeActor("june", px + 1.4, pz + 1.8, -0.45, "eskista", "");
          placeActor("etta", px - 2.6, pz + 0.2, 1.15, "eskista", "");
          placeActor("makeda", px + 2.5, pz + 0.3, -1.15, "eskista", "");
          placeActor("queue_1", px - 1.2, pz - 1.8, 2.6, "eskista", "");
          placeActor("queue_2", px + 1.3, pz - 1.7, -2.6, "eskista", "");
          initRain();
          audio.relayChime(true);
        },
        step(u, dt, nowSec) {
          const px = -776.5, pz = -26.5;
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          const ph = nowSec * 9.6;
          donkey.group.position.y = driveSurfaceAt(px, pz) + Math.abs(Math.sin(ph)) * 0.14;
          donkey.group.rotation.y = 0.45 + Math.sin(ph * 0.5) * 0.24;
          for (const id of ["imani", "june", "etta", "makeda", "queue_1", "queue_2"]) {
            updateActor(id, dt, nowSec, { pose: "eskista", beatPulse: Math.max(0.45, state.beatPulse) });
          }
          const py = driveSurfaceAt(px, pz);
          const ang = lerp(-0.45, 0.65, u), rad = lerp(5.6, 8.6, u);
          safeCamPos(px + Math.sin(ang) * rad, py + lerp(1.75, 3.05, u), pz + Math.cos(ang) * rad, 1.35);
          camLook.set(px - 0.4, py + 1.40, pz - 0.5);
        }
      }
    ];

    /* =========================================================================
       FULL-SONG MACHINIMA MUSIC VIDEO (283 SECONDS / 04:43)
       Choreographed across all 12 Donkey-Method acts & song epochs!
       ========================================================================= */
    const MV_DURATION = 283.0;
    const MV_SHOTS = [
      { t0: 0,   t1: 20,  kicker: "EPOCH I · WELLHEAD AWAKENING", title: "Iron Lever Before the Rooster & 4 L Chalk Window", actIdx: 0 },
      { t0: 20,  t1: 42,  kicker: "EPOCH I · SHOULDER JERIKAN", title: "WATER = WIFI Saddle Jugs Along the Rim", actIdx: 6 },
      { t0: 42,  t1: 62,  kicker: "EPOCH II · HOOVES ON COBBLE", title: "Cruiser Woody Down Moraine Switchback", actIdx: 7 },
      { t0: 62,  t1: 88,  kicker: "EPOCH II · SILVER FORD RELAY", title: "Etta, the Ferrymen & Cistern Ignition", actIdx: 8 },
      { t0: 88,  t1: 118, kicker: "EPOCH III · COTTONWOOD OXBOW", title: "Root-Bowl Pour & Double Linen Screening", actIdx: 2 },
      { t0: 118, t1: 140, kicker: "EPOCH III · TEZETA ONTO FERRIC", title: "8×10 Tonal Strata & Lidar Ridge Scan", actIdx: 9 },
      { t0: 140, t1: 162, kicker: "EPOCH IV · FERRIC DROP", title: "Winged Woody Over the Cooling Valley", actIdx: 10 },
      { t0: 162, t1: 186, kicker: "EPOCH IV · COOLING SANCTUARY", title: "Diamond Wire-Glass & Wet Cyan Server Tubes", actIdx: 3 },
      { t0: 186, t1: 214, kicker: "EPOCH V · AHIYA NIGHT CONVOY", title: hasAhiya ? "Smartphone Gabi Procession & Cross-Beacon Dome" : "Abyssal Whale Fluke Film Cathedral", actIdx: 4 },
      { t0: 214, t1: 234, kicker: "EPOCH V · HILL ARCHIVE REC PPC", title: hasAhiya ? "Daniel & Hanna at the REC PPC Radio Desk" : "Half Dome East Apron Seep Relay", actIdx: 5 },
      { t0: 234, t1: 258, kicker: "EPOCH VI · DAYLIGHT COMPOUND", title: hasAhiya ? "Two-Person 20 L Unload & Terracotta Bowl Pour" : "Highland Courtyard 20 L Saddle Unload", actIdx: 1 },
      { t0: 258, t1: MV_DURATION, kicker: "EPOCH VI · ARKESTRA FINALE", title: "All Cast 6/8 Eskista in Highland Pueblo", actIdx: 11 }
    ];

    function activeTimeline() {
      return mode === "musicvideo" ? MV_SHOTS : TRAILER_SHOTS;
    }
    function totalDuration() {
      return mode === "musicvideo" ? MV_DURATION : TRAILER_DURATION;
    }

    function takeSnapshot() {
      savedSnapshot = {
        x: state.x, y: state.y, z: state.z, yaw: state.yaw, pitch: state.pitch,
        region: state.region, modeIdx: state.modeIdx, filterIdx: state.filterIdx,
        stopIdx: state.stopIdx, soloLook: state.soloLook, focusDist: state.focusDist,
        lidarOn: state.lidarOn, lidarStrength: state.lidarStrength,
        drivingCart: state.drivingCart, wagonCruise: state.wagonCruise,
        riding: state.riding, gliding: state.gliding, donkeyOnRoof: state.donkeyOnRoof,
        spatialAudio: state.spatialAudio,
        fov: camera.fov,
        wagon: { x: wagon.x, y: wagon.y, z: wagon.z, heading: wagon.heading },
        donkey: { x: donkey.state.x, z: donkey.state.z, heading: donkey.state.heading },
        relaysLit: relays.map(r => ({
          lit: r.lit,
          poolY: r.poolMesh ? r.poolMesh.position.y : 0.08,
          fills: r.cans.map(c => c.userData.fill || 0)
        })),
        grovesUnlocked: forestGroves.map(g => ({ unlocked: g.unlocked, grow: g.grow }))
      };
    }

    function restoreSnapshot() {
      if (!savedSnapshot) return;
      clearStageEffects();
      const s = savedSnapshot;
      setRegion(s.region);
      Object.assign(state, {
        x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch,
        modeIdx: s.modeIdx, filterIdx: s.filterIdx, stopIdx: s.stopIdx,
        soloLook: s.soloLook, focusDist: s.focusDist,
        lidarOn: s.lidarOn, lidarStrength: s.lidarStrength,
        drivingCart: s.drivingCart, wagonCruise: 0,
        riding: s.riding, gliding: false, donkeyOnRoof: s.drivingCart,
        spatialAudio: s.spatialAudio
      });
      audio.setSpatialMode(s.spatialAudio);
      wagon.x = s.wagon.x; wagon.y = s.wagon.y; wagon.z = s.wagon.z; wagon.heading = s.wagon.heading; wagon.speed = 0;
      wagon.group.position.set(wagon.x, wagon.y, wagon.z);
      wagon.group.rotation.set(0, wagon.heading, 0, "YXZ");
      donkey.place(s.donkey.x, s.donkey.z, s.donkey.heading, driveSurfaceAt);
      s.relaysLit.forEach((snapR, idx) => {
        const r = relays[idx];
        if (!r) return;
        r.lit = snapR.lit;
        if (r.poolMesh) r.poolMesh.position.y = snapR.poolY;
        r.cans.forEach((c, ci) => c.userData.setFill(snapR.fills[ci] ?? (r.lit ? 1 : 0)));
      });
      s.grovesUnlocked.forEach((snapG, idx) => {
        const g = forestGroves[idx];
        if (!g) return;
        g.unlocked = snapG.unlocked;
        g.grow = snapG.grow;
      });
      cast?.resetHomes();
      camera.fov = s.fov;
      camera.updateProjectionMatrix();
      applyLevelFPSCamera(state.x, state.y, state.z, state.yaw, state.pitch);
      initRain();
      savedSnapshot = null;
    }

    function syncUI() {
      document.body.classList.toggle("machinima-active", active);
      document.body.classList.toggle("machinima-no-bars", active && !letterboxOn);
      barEl.hidden = !active;
      dollyRowEl.hidden = !active || mode !== "dolly";
      cardEl.hidden = !active || !captionsOn || mode === "dolly";

      document.getElementById("mach-mode-trailer").setAttribute("aria-pressed", String(mode === "trailer"));
      document.getElementById("mach-mode-mv").setAttribute("aria-pressed", String(mode === "musicvideo"));
      document.getElementById("mach-mode-dolly").setAttribute("aria-pressed", String(mode === "dolly"));
      ccBtn.setAttribute("aria-pressed", String(captionsOn));
      playBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
      playBtn.hidden = mode === "dolly";
      document.getElementById("mach-prev").hidden = mode === "dolly";
      document.getElementById("mach-next").hidden = mode === "dolly";
    }

    function enterShot(idx) {
      currentShotIdx = idx;
      if (mode === "trailer") {
        const sh = TRAILER_SHOTS[idx];
        if (!sh) return;
        sh.setup();
        kickerEl.textContent = sh.kicker;
        titleEl.textContent = sh.title;
        explainEl.textContent = sh.explain;
        explainEl.hidden = false;
      } else if (mode === "musicvideo") {
        const mv = MV_SHOTS[idx];
        if (!mv) return;
        const baseAct = TRAILER_SHOTS[mv.actIdx] || TRAILER_SHOTS[0];
        baseAct.setup();
        kickerEl.textContent = mv.kicker;
        titleEl.textContent = mv.title;
        explainEl.textContent = "";
        explainEl.hidden = true;
      }
    }

    function start(nextMode = "trailer", startAt = 0) {
      if (toggleInWorldVideo) toggleInWorldVideo(false);
      if (state.introActive && env.finishIntro) env.finishIntro(true);
      if (!active) takeSnapshot();
      active = true;
      mode = nextMode;
      playing = true;
      timeSec = clamp(startAt, 0, mode === "musicvideo" ? MV_DURATION - 0.1 : TRAILER_DURATION - 0.1);
      currentShotIdx = -1;

      audio.setSpatialMode(false);
      if (audioEl) {
        audio.connectTape(audioEl);
        if (mode === "musicvideo") {
          try { audioEl.currentTime = timeSec; } catch {}
        }
        if (audioEl.paused) audioEl.play().catch(() => {});
      }

      if (mode === "dolly") {
        clearStageEffects();
        dolly.x = camera.position.x;
        dolly.y = Math.max(driveSurfaceAt(camera.position.x, camera.position.z) + 1.75, camera.position.y);
        dolly.z = camera.position.z;
        dolly.yaw = state.yaw;
        dolly.pitch = state.pitch;
        applyDollyCue(dollyCue);
      } else {
        const list = activeTimeline();
        let idx = list.findIndex(s => timeSec >= s.t0 && timeSec < s.t1);
        if (idx < 0) idx = 0;
        enterShot(idx);
      }
      syncUI();
      updateHUD();
    }

    function stop() {
      if (!active) return;
      if (mediaRecorder && mediaRecorder.state !== "inactive") stopRecording(false);
      active = false;
      currentShotIdx = -1;
      restoreSnapshot();
      syncUI();
      updateHUD();
    }

    function toggle(defaultMode = "trailer") {
      if (active) stop();
      else start(defaultMode, 0);
    }

    function seek(sec) {
      if (!active) start("trailer", sec);
      if (mode === "dolly") return;
      const dur = totalDuration();
      timeSec = clamp(sec, 0, dur - 0.05);
      if (mode === "musicvideo" && audioEl) {
        try { audioEl.currentTime = timeSec; } catch {}
      }
      const list = activeTimeline();
      let idx = list.findIndex(s => timeSec >= s.t0 && timeSec < s.t1);
      if (idx < 0) idx = list.length - 1;
      if (idx !== currentShotIdx) enterShot(idx);
    }

    function getSceneRange(sceneKey) {
      const idx = TRAILER_SHOTS.findIndex(s => s.sceneKey === sceneKey || s.id === sceneKey);
      if (idx < 0) return null;
      const sh = TRAILER_SHOTS[idx];
      return { idx, id: sh.id, sceneKey: sh.sceneKey, t0: sh.t0, t1: sh.t1 };
    }

    function jumpToScene(sceneKey) {
      const range = getSceneRange(sceneKey);
      if (!range) return false;
      if (!active || mode !== "trailer") start("trailer", range.t0 + 0.08);
      else seek(range.t0 + 0.08);
      return true;
    }

    function setPlaying(nextPlaying) {
      playing = Boolean(nextPlaying);
      if (mode === "musicvideo" && audioEl) {
        if (playing) audioEl.play().catch(() => {});
        else audioEl.pause();
      }
      syncUI();
    }

    function stepShot(delta) {
      if (!active || mode === "dolly") return;
      const list = activeTimeline();
      const next = ((currentShotIdx + delta) % list.length + list.length) % list.length;
      seek(list[next].t0 + 0.05);
    }

    function applyDollyCue(cue) {
      dollyCue = cue;
      if (cue === "bars") {
        letterboxOn = !letterboxOn;
        syncUI();
        return;
      }
      const cx = dolly.x - Math.sin(dolly.yaw) * 6.5;
      const cz = dolly.z - Math.cos(dolly.yaw) * 6.5;
      donkey.place(cx, cz, dolly.yaw + Math.PI, driveSurfaceAt);
      if (cue === "dance") {
        if (fieldRigGroup) fieldRigGroup.visible = false;
        placeActor("imani", cx - 1.5, cz + 0.8, dolly.yaw + Math.PI, "dance", "ESKISTA TAKE");
        placeActor("june", cx + 1.5, cz + 0.8, dolly.yaw + Math.PI, "dance", "COSMIC ADDIS");
      } else if (cue === "pump") {
        placeActor("imani", cx - 1.2, cz, dolly.yaw + Math.PI, "pump", "WELLHEAD PUMP TAKE");
      } else if (cue === "camera") {
        if (fieldRigGroup) {
          fieldRigGroup.position.set(cx - 1.1, driveSurfaceAt(cx - 1.1, cz + 0.9), cz + 0.9);
          fieldRigGroup.rotation.y = dolly.yaw;
          fieldRigGroup.visible = true;
        }
        placeActor("imani", cx - 1.1, cz + 1.55, dolly.yaw, "camera", "8×10 CAMERA TAKE");
      } else if (cue === "pour") {
        placeActor("imani", cx - 1.2, cz + 0.6, dolly.yaw + Math.PI, "basinPour20kg", "CYAN POUR TAKE");
      }
    }

    /* ---------- Video + Audio Machinima Recorder ---------- */
    function pickMimeType() {
      if (typeof MediaRecorder === "undefined") return "";
      const types = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4"
      ];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
      }
      return "";
    }

    function startRecording() {
      if (typeof MediaRecorder === "undefined") {
        toast("Video recording is not supported in this browser.");
        return false;
      }
      if (mediaRecorder && mediaRecorder.state !== "inactive") return true;
      const portrait = canvas.height > canvas.width;
      const rw = portrait ? 720 : 1280;
      const rh = portrait ? 1280 : 720;
      if (!recCanvas) {
        recCanvas = document.createElement("canvas");
        recCtx = recCanvas.getContext("2d");
      }
      recCanvas.width = rw;
      recCanvas.height = rh;

      const vStream = recCanvas.captureStream ? recCanvas.captureStream(30) : null;
      if (!vStream) {
        toast("Canvas stream capture unavailable.");
        return false;
      }
      const tracks = [...vStream.getVideoTracks()];
      const aStream = audio.getRecordStream ? audio.getRecordStream(audioEl) : null;
      if (aStream) {
        for (const at of aStream.getAudioTracks()) tracks.push(at);
      }
      const combined = new MediaStream(tracks);
      const mime = pickMimeType();
      recExt = mime.includes("mp4") ? "mp4" : "webm";
      recChunks = [];
      recBytes = 0;
      saveLink.hidden = true;

      try {
        mediaRecorder = mime ? new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 4500000 }) : new MediaRecorder(combined);
      } catch {
        mediaRecorder = new MediaRecorder(combined);
      }

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          recChunks.push(e.data);
          recBytes += e.data.size;
        }
      };
      mediaRecorder.onstop = () => {
        if (!recChunks.length) return;
        if (recBlobUrl) URL.revokeObjectURL(recBlobUrl);
        const blob = new Blob(recChunks, { type: mediaRecorder.mimeType || "video/webm" });
        recBytes = blob.size;
        recBlobUrl = URL.createObjectURL(blob);
        saveLink.href = recBlobUrl;
        saveLink.download = `donkey-water-${mode}-${Date.now()}.${recExt}`;
        saveLink.textContent = `⬇ Save .${recExt.toUpperCase()} (${(blob.size / (1024 * 1024)).toFixed(1)} MB)`;
        saveLink.hidden = false;
      };

      afterRender();
      mediaRecorder.start(200);
      recStartTime = performance.now();
      recBtn.dataset.recording = "true";
      recBtn.textContent = "■ Stop Rec";
      if (audioEl && audioEl.paused) audioEl.play().catch(() => {});
      return true;
    }

    function stopRecording(autoDownload = false) {
      if (!mediaRecorder || mediaRecorder.state === "inactive") return Promise.resolve(recBytes);
      return new Promise(resolve => {
        const prevStop = mediaRecorder.onstop;
        mediaRecorder.onstop = ev => {
          if (prevStop) prevStop(ev);
          recBtn.dataset.recording = "false";
          recBtn.textContent = "● Rec Video";
          if (autoDownload && saveLink.href) saveLink.click();
          resolve(recBytes);
        };
        mediaRecorder.stop();
      });
    }

    function afterRender() {
      if (!mediaRecorder || mediaRecorder.state === "inactive" || !recCtx || !recCanvas) return;
      const W = recCanvas.width, H = recCanvas.height;
      recCtx.fillStyle = "#080d0e";
      recCtx.fillRect(0, 0, W, H);

      const sw = canvas.width || W, sh = canvas.height || H;
      const scale = Math.max(W / sw, H / sh);
      const dw = sw * scale, dh = sh * scale;
      recCtx.drawImage(canvas, (W - dw) * 0.5, (H - dh) * 0.5, dw, dh);

      if (letterboxOn) {
        const barH = Math.round(H * 0.064);
        recCtx.fillStyle = "#050809";
        recCtx.fillRect(0, 0, W, barH);
        recCtx.fillRect(0, H - barH, W, barH);
      }

      if (captionsOn && mode !== "dolly") {
        const padX = Math.round(W * 0.04);
        const boxY = H - Math.round(H * 0.195);
        const boxW = Math.round(W * 0.56);
        const boxH = Math.round(H * 0.11);
        recCtx.fillStyle = "rgba(7, 14, 15, 0.74)";
        recCtx.fillRect(padX, boxY, boxW, boxH);
        recCtx.strokeStyle = "rgba(107, 232, 220, 0.45)";
        recCtx.lineWidth = 2;
        recCtx.strokeRect(padX, boxY, boxW, boxH);

        recCtx.fillStyle = "#6be8dc";
        recCtx.font = `700 ${Math.round(H * 0.015)}px monospace`;
        recCtx.fillText(kickerEl.textContent || "", padX + 14, boxY + Math.round(boxH * 0.28));

        recCtx.fillStyle = "#fffaf0";
        recCtx.font = `600 ${Math.round(H * 0.023)}px Georgia, serif`;
        recCtx.fillText(titleEl.textContent || "", padX + 14, boxY + Math.round(boxH * 0.60));

        const sub = (mode === "trailer" ? explainEl.textContent : lyricEl.textContent) || "";
        recCtx.fillStyle = "#eab965";
        recCtx.font = `italic ${Math.round(H * 0.016)}px Georgia, serif`;
        recCtx.fillText(sub.slice(0, 96), padX + 14, boxY + Math.round(boxH * 0.86));
      }
    }

    /* ---------- Per-Frame Camera & Actor Choreography Step ---------- */
    function stepCamera(dt, nowSec, input) {
      if (!active) return false;

      if (mode === "dolly") {
        const spd = (input.turbo ? 28 : 11) * dt;
        const sx = Math.sin(dolly.yaw), cz = Math.cos(dolly.yaw);
        dolly.x += (-sx * input.fwdInput + cz * input.sideInput) * spd;
        dolly.z += (-cz * input.fwdInput - sx * input.sideInput) * spd;
        const upDown = (env.keys?.KeyE ? 1 : 0) - (env.keys?.KeyQ ? 1 : 0);
        dolly.y = Math.max(driveSurfaceAt(dolly.x, dolly.z) + 1.4, dolly.y + upDown * spd * 0.75);
        applyLevelFPSCamera(dolly.x, dolly.y, dolly.z, dolly.yaw, dolly.pitch);
        state.x = dolly.x; state.y = dolly.y; state.z = dolly.z;
        donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
        for (const id of ["imani", "june"]) {
          const ch = cast?.byId?.[id];
          if (ch) ch.update(dt, nowSec, { pose: dollyCue === "bars" ? "idle" : dollyCue, beatPulse: state.beatPulse });
        }
        clockEl.textContent = mediaRecorder?.state === "recording"
          ? `● REC ${fmtMMSS((performance.now() - recStartTime) / 1000)}`
          : "FREE DOLLY · WASD + Q/E";
        scrubFillEl.style.width = "100%";
        return true;
      }

      const dur = totalDuration();
      if (playing) {
        if (mode === "musicvideo" && audioEl && !audioEl.paused && Number.isFinite(audioEl.currentTime)) {
          const diff = audioEl.currentTime - timeSec;
          if (Math.abs(diff) > 0.45 && audioEl.currentTime < dur) timeSec = audioEl.currentTime;
          else timeSec += dt;
        } else {
          timeSec += dt;
        }
        if (timeSec >= dur) {
          if (mediaRecorder && mediaRecorder.state === "recording") {
            stopRecording(false);
          }
          timeSec = 0;
          currentShotIdx = -1;
          if (mode === "musicvideo" && audioEl) {
            try { audioEl.currentTime = 0; } catch {}
          }
        }
      }

      const list = activeTimeline();
      let idx = list.findIndex(s => timeSec >= s.t0 && timeSec < s.t1);
      if (idx < 0) idx = list.length - 1;
      if (idx !== currentShotIdx) enterShot(idx);

      const shot = list[idx];
      const rawU = clamp((timeSec - shot.t0) / Math.max(0.01, shot.t1 - shot.t0), 0, 1);

      if (mode === "trailer") {
        shot.step(rawU, dt, nowSec);
      } else {
        const baseAct = TRAILER_SHOTS[shot.actIdx] || TRAILER_SHOTS[0];
        const [r0, r1] = shot.subRange || [0, 1];
        const mappedU = lerp(r0, r1, rawU);
        baseAct.step(mappedU, dt, nowSec);
        if (shot.camAlt) {
          camPos.x += Math.sin(rawU * Math.PI) * 2.4;
          camPos.y += 0.85;
        }
      }

      applyLevelChaseCamera(camPos, camLook);
      state.x = camPos.x;
      state.y = camPos.y;
      state.z = camPos.z;

      const songT = (mode === "musicvideo" && audioEl && !audioEl.paused && audioEl.currentTime > 0.5)
        ? audioEl.currentTime : timeSec;
      lyricEl.textContent = (mode === "trailer" && shot.quote) ? shot.quote : lyricAt(songT % 283);

      const recTag = mediaRecorder?.state === "recording" ? `● REC ${fmtMMSS((performance.now() - recStartTime) / 1000)} · ` : "";
      clockEl.textContent = `${recTag}${idx + 1}/${list.length} · ${fmtMMSS(timeSec)} / ${fmtMMSS(dur)}`;
      scrubFillEl.style.width = `${clamp((timeSec / dur) * 100, 0, 100).toFixed(1)}%`;
      return true;
    }

    function onLookDrag(dx, dy) {
      if (!active || mode !== "dolly") return false;
      dolly.yaw -= dx * 0.0045;
      dolly.pitch = clamp(dolly.pitch - dy * 0.0038, -0.82, 0.82);
      return true;
    }

    /* ---------- Wire Machinima Bar Controls & Studio PostMessage Bridge ---------- */
    document.getElementById("mach-mode-trailer").addEventListener("click", () => start("trailer", 0));
    document.getElementById("mach-mode-mv").addEventListener("click", () => start("musicvideo", 0));
    document.getElementById("mach-mode-dolly").addEventListener("click", () => start("dolly", 0));
    playBtn.addEventListener("click", () => setPlaying(!playing));
    document.getElementById("mach-prev").addEventListener("click", () => stepShot(-1));
    document.getElementById("mach-next").addEventListener("click", () => stepShot(1));
    ccBtn.addEventListener("click", () => { captionsOn = !captionsOn; syncUI(); });
    recBtn.addEventListener("click", () => {
      if (mediaRecorder && mediaRecorder.state === "recording") stopRecording(false);
      else startRecording();
    });
    document.getElementById("mach-exit").addEventListener("click", stop);

    scrubEl.addEventListener("click", e => {
      if (mode === "dolly") return;
      const r = scrubEl.getBoundingClientRect();
      const frac = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
      seek(frac * totalDuration());
    });

    dollyRowEl.querySelectorAll("[data-dolly-cue]").forEach(btn => {
      btn.addEventListener("click", () => applyDollyCue(btn.dataset.dollyCue));
    });

    window.addEventListener("message", e => {
      const msg = e?.data;
      if (!msg || msg.type !== "np-studio") return;
      if (msg.cmd === "jumpScene" && msg.scene) {
        if (!jumpToScene(msg.scene) && Number.isFinite(msg.t)) seek(msg.t);
      } else if (msg.cmd === "seek" && Number.isFinite(msg.t)) {
        seek(msg.t);
      } else if (msg.cmd === "setPlaying") {
        setPlaying(msg.playing);
      } else if (msg.cmd === "setMode" && msg.mode) {
        start(msg.mode, Number.isFinite(msg.t) ? msg.t : 0);
      }
    });

    // Honor optional URL deep-link `?shot=<sceneKey>` or `&t=<seconds>` after initial boot
    setTimeout(() => {
      try {
        const qp = new URLSearchParams(location.search);
        const shotParam = qp.get("shot") || qp.get("scene");
        const tParam = parseFloat(qp.get("t") || "");
        if (shotParam && (qp.get("trailer") === "1" || active)) {
          jumpToScene(shotParam);
        } else if (Number.isFinite(tParam) && active) {
          seek(tParam);
        }
      } catch {}
    }, 30);

    const api = {
      isActive: () => active,
      getMode: () => mode,
      areCaptionsHidden: () => active && !captionsOn,
      start,
      stop,
      toggle,
      seek,
      jumpToScene,
      getSceneRange,
      setPlaying,
      stepShot,
      startRecording,
      stopRecording,
      stepCamera,
      afterRender,
      onLookDrag,
      getShots: () => TRAILER_SHOTS.map((s, idx) => ({
        idx, id: s.id, sceneKey: s.sceneKey, t0: s.t0, t1: s.t1, kicker: s.kicker, title: s.title
      })),
      getState: () => {
        const list = activeTimeline();
        const cur = list[currentShotIdx] || null;
        const base = mode === "musicvideo" && cur ? TRAILER_SHOTS[cur.actIdx] : cur;
        return {
          active,
          mode,
          playing,
          t: +timeSec.toFixed(2),
          duration: totalDuration(),
          shotIdx: currentShotIdx,
          shotCount: list.length,
          shotId: base ? base.id : "",
          sceneKey: base ? base.sceneKey : "",
          kicker: kickerEl.textContent,
          title: titleEl.textContent,
          captionsOn,
          recording: Boolean(mediaRecorder && mediaRecorder.state === "recording"),
          recordedBytes: recBytes,
          hasSavedClip: !saveLink.hidden && Boolean(recBlobUrl),
          castCount: cast ? cast.list.length : 0
        };
      }
    };

    window.__machinima = api;
    return api;
  }

  window.createMachinimaDirector = createMachinimaDirector;
})();
