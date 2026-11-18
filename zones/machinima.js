/* In-World 3D Machinima Director, Explainer Trailer, Full-Song Music Video & Video Recorder
   for Donkey Water (MONOLITH-3 Zones & 2086 Night Post).
   Exposes window.createMachinimaDirector(env). */
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
        height: min(6.5vh, 46px) !important;
        opacity: 1 !important;
        display: block !important;
      }
      #machinima-card {
        position: fixed;
        left: 50%;
        bottom: calc(max(12px, env(safe-area-inset-bottom)) + 86px);
        transform: translateX(-50%);
        width: min(690px, calc(100vw - 24px));
        padding: 11px 16px 12px;
        border-radius: 10px;
        background: rgba(8, 15, 16, 0.80);
        border: 1px solid rgba(107, 232, 220, 0.36);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #f3efe4;
        z-index: 26;
        pointer-events: none;
        text-align: left;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.48);
      }
      #machinima-card[hidden], #machinima-bar[hidden], #mach-dolly-row[hidden] {
        display: none !important;
      }
      #mach-kicker {
        display: block;
        font: 700 10px/1.2 ui-monospace, "SF Mono", Menlo, monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #6be8dc;
        margin-bottom: 4px;
      }
      #mach-title {
        margin: 0;
        font: 400 clamp(16px, 2.4vw, 22px)/1.18 "Instrument Serif", "Iowan Old Style", Georgia, serif;
        color: #fffaf0;
      }
      #mach-explain {
        margin: 5px 0 0;
        font: 400 clamp(11.5px, 1.6vw, 13.5px)/1.42 Inter, system-ui, sans-serif;
        color: rgba(243, 239, 228, 0.88);
      }
      #mach-lyric {
        margin: 5px 0 0;
        font: italic 400 12px/1.3 Georgia, serif;
        color: #eab965;
      }
      #machinima-bar {
        position: fixed;
        left: 50%;
        bottom: max(10px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        width: min(760px, calc(100vw - 20px));
        padding: 8px 10px;
        border-radius: 12px;
        background: rgba(10, 18, 19, 0.90);
        border: 1px solid rgba(242, 237, 226, 0.24);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 27;
        display: flex;
        flex-direction: column;
        gap: 6px;
        pointer-events: auto;
      }
      .mach-top-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #mach-scrub {
        flex: 1;
        height: 7px;
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
        font: 600 10.5px/1 ui-monospace, Menlo, monospace;
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
        font: 600 10px/1 Inter, system-ui, sans-serif;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        padding: 6px 8px;
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
          bottom: calc(max(10px, env(safe-area-inset-bottom)) + 114px);
          padding: 8px 11px 9px;
        }
        #mach-explain { font-size: 11px; line-height: 1.34; }
        #mach-lyric { font-size: 11px; }
        .mach-btn { padding: 5px 7px; font-size: 9px; }
      }
    `;
    document.head.appendChild(style);

    const card = document.createElement("aside");
    card.id = "machinima-card";
    card.hidden = true;
    card.setAttribute("aria-live", "polite");
    card.innerHTML = `
      <span id="mach-kicker">EXPLAINER TRAILER · ACT I</span>
      <h2 id="mach-title">Overlook Wellhead &amp; The 20L Chalk Law</h2>
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
        <span id="mach-clock">00:00 / 01:16</span>
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

    let active = false;
    let mode = "trailer"; // "trailer" | "musicvideo" | "dolly"
    let playing = true;
    let timeSec = 0;
    let currentShotIdx = -1;
    let captionsOn = true;
    let letterboxOn = true;
    let dollyCue = "dance";
    let savedSnapshot = null;

    // Free dolly state
    const dolly = { x: -16, y: 158.2, z: 3.5, yaw: 1.45, pitch: -0.06, fov: 47 };

    // Recording state
    let recCanvas = null, recCtx = null, mediaRecorder = null;
    let recChunks = [], recStartTime = 0, recBytes = 0, recBlobUrl = "", recExt = "webm";

    function safeCamPos(x, y, z, minClearance = 1.55) {
      const g = driveSurfaceAt(x, z);
      camPos.set(x, Math.max(g + minClearance, y), z);
    }

    function placeActor(id, x, z, heading, pose, speech = "") {
      const ch = cast?.byId?.[id];
      if (!ch) return null;
      if (ch.group.parent !== cast.group) cast.group.add(ch.group);
      ch.group.visible = true;
      ch.state.pose = pose || "idle";
      ch.place(x, z, heading, driveSurfaceAt);
      ch.setSpeech(speech);
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
      state.soloLook = 13; // CYAN JERIKAN: crisp 2086 silver-gelatin print + selective living cyan water
      state.modeIdx = 0;
      state.filterIdx = 5;
      if (donkeyGlider) donkeyGlider.visible = false;
      if (contrailL?.line) contrailL.line.visible = false;
      if (contrailR?.line) contrailR.line.visible = false;
      if (pourGroup) pourGroup.visible = false;
      if (fieldRigGroup) fieldRigGroup.visible = false;
      state.pourAnim = null;
    }

    /* ---------- 9-ACT EXPLAINER TRAILER (76 SECONDS) — FRAMED DIRECTLY ON THE 2086 WORLD BIBLE PLATES ---------- */
    const TRAILER_DURATION = 76.0;
    const packTouchPt = new T.Vector3();
    const TRAILER_SHOTS = [
      {
        id: "act1_wellhead", t0: 0, t1: 8.5,
        kicker: "ACT I · THE SADDLE WINDOW & 20L CHALK LAW",
        title: "Imani, June & Mistletoe at the Dawn Pump",
        explain: "Pump 20 L of living cyan water at the Overlook Wellhead (P). Mistletoe's canvas panniers carry local WiFi & cinema reels — 4 L below the chalk mark belong to her survival.",
        quote: "“Iron lever cracks before the rooster — Mum left the camera running eight more seconds.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.pumpFlow = 1.0;
          state.focusDist = 3.2;
          // Open gravel earth south of Overlook deck: Mistletoe, Imani & June facing toward the lens (`saddle.jpg`!)
          donkey.place(-20.95, -11.4, 0.24, driveSurfaceAt);
          stageWagonAt(-29.5, 4.8, -Math.PI * 0.52, false);
          // Imani right beside Mistletoe's +X flank (0.62 m away -> natural bent elbows!), open duster & wrench belt facing lens!
          placeActor("imani", -20.18, -11.42, 0.12, "touchPack", "");
          placeActor("june", -19.34, -11.55, 0.04, "holdCup", "");
          placeActor("witness_tomas", -22.85, -6.05, 1.42, "pump", "");
          initRain();
          audio.pumpClank();
        },
        step(u, dt, nowSec) {
          state.pumpFlow = 1.0;
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          const dh = donkey.state.heading;
          const sideX = Math.cos(dh), sideZ = -Math.sin(dh);
          const fwdX = Math.sin(dh), fwdZ = Math.cos(dh);
          packTouchPt.set(
            donkey.state.x + sideX * 0.38 + fwdX * 0.06,
            donkey.group.position.y + 0.94,
            donkey.state.z + sideZ * 0.38 + fwdZ * 0.06
          );
          cast?.byId?.imani?.update(dt, nowSec, { pose: "touchPack", packTarget: packTouchPt, beatPulse: state.beatPulse, lookAt: donkey.group.position });
          cast?.byId?.june?.update(dt, nowSec, { pose: "holdCup", beatPulse: state.beatPulse, lookAt: camera.position });
          cast?.byId?.witness_tomas?.update(dt, nowSec, { pose: "pump", pumpPhase: state.pumpLeverPhase, beatPulse: state.beatPulse });
          // Low-angle 8x10 composition recreating World Bible Page 1 (`saddle.jpg`)!
          const dy = donkey.group.position.y;
          safeCamPos(lerp(-20.25, -19.85, u), dy + lerp(0.92, 1.18, u), lerp(-8.45, -8.75, u), 0.72);
          camLook.set(lerp(-20.22, -20.05, u), dy + lerp(0.96, 1.12, u), -11.42);
        }
      },
      {
        id: "act2_donkey_radio", t0: 8.5, t1: 17.0,
        kicker: "ACT II · MISTLETOE & SPATIAL SCION RADIO",
        title: "3D Burro Broadcast & Bounded Cyan Rain",
        explain: "The song broadcasts from Mistletoe's Scion pack speakers with 3D distance falloff. Cyan rain falls strictly inside WiFi reach — keep her watered or she collapses!",
        quote: "“Cyan jerikan balanced on my shoulder blade · Hooves on cobble and the tape is turning.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.focusDist = 5.2;
          state.pingTimer = 4.0;
          donkey.place(-28.0, 0.6, -1.52, driveSurfaceAt);
          placeActor("imani", -27.8, 1.75, -1.52, "walk", "");
          placeActor("june", -26.8, 2.35, -1.52, "walk", "");
        },
        step(u, dt, nowSec) {
          const x = lerp(-26.5, -39.5, u), z = lerp(0.8, 1.3, u);
          donkey.place(x, z, -1.54, driveSurfaceAt);
          donkey.update(dt, { throttle: 0.65, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          const im = placeActor("imani", x + 0.35, z + 1.15, -1.54, "walk", "");
          const jn = placeActor("june", x + 1.15, z + 1.75, -1.54, "walk", "");
          im?.update(dt, nowSec, { pose: "walk", carryCan: true, beatPulse: state.beatPulse });
          jn?.update(dt, nowSec, { pose: "walk", beatPulse: state.beatPulse });
          const dy = donkey.group.position.y;
          safeCamPos(x - lerp(4.2, 3.4, u), dy + lerp(1.45, 1.85, u), z + lerp(3.4, 4.2, u), 1.25);
          camLook.set(x + 0.2, dy + 1.22, z + 0.85);
        }
      },
      {
        id: "act3_woody_radar", t0: 17.0, t1: 25.5,
        kicker: "ACT III · CRUISER WOODY & HEADING-UP RADAR",
        title: "Drive or Reverse Anywhere — Zero Fences",
        explain: "Hop into the 1940s Woody (C) with Mistletoe on the roof-deck. Tap Reverse to back toward the screen, or cruise Moraine Switchback past Nell's bakery oven.",
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
          cast?.byId?.nell?.update(dt, nowSec, { pose: "wave", beatPulse: state.beatPulse });
          const sinH = Math.sin(hdg), cosH = Math.cos(hdg);
          const distBack = u < 0.28 ? lerp(9.2, 6.4, u / 0.28) : 9.4;
          safeCamPos(wx - sinH * distBack + 2.1, wagon.y + 3.8, wz - cosH * distBack, 1.8);
          camLook.set(wx + sinH * 5.0, wagon.y + 2.1, wz + cosH * 5.0);
        }
      },
      {
        id: "act4_pour_jerrycans", t0: 25.5, t1: 34.0,
        kicker: "ACT IV · SILVER FORD FERRY & 72 JERRYCANS",
        title: "Etta, the Ferrymen & Cistern Ignition",
        explain: "At Silver Ford, the two ferrymen brothers check the chalked flood post while Etta signs custody slips — pouring (F) fills every depot jerrycan in sequence.",
        quote: "“Etta signs two slips: the wedding for the yard sheet, the last eight seconds for June.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.focusDist = 6.2;
          const ford = relays.find(r => r.id === "ford") || relays[2];
          donkey.place(ford.x + 2.8, ford.z + 2.5, -2.25, driveSurfaceAt);
          placeActor("imani", ford.x + 1.8, ford.z + 3.2, -2.45, "pour", "");
          placeActor("etta", ford.x + 3.4, ford.z - 1.9, -1.10, "wave", "");
          placeActor("ferry_bekele", -252.2, -52.4, 1.85, "pointPost", "");
          placeActor("ferry_tadesse", -241.5, -59.2, -2.25, "idle", "");
          audio.pourSplash(1);
        },
        step(u, dt, nowSec) {
          const ford = relays.find(r => r.id === "ford") || relays[2];
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          cast?.byId?.imani?.update(dt, nowSec, { pose: "pour", beatPulse: state.beatPulse });
          cast?.byId?.etta?.update(dt, nowSec, { pose: "wave", beatPulse: state.beatPulse });
          cast?.byId?.ferry_bekele?.update(dt, nowSec, { pose: "pointPost", beatPulse: state.beatPulse });
          cast?.byId?.ferry_tadesse?.update(dt, nowSec, { pose: "idle", beatPulse: state.beatPulse });
          if (ford) {
            if (ford.poolMesh) ford.poolMesh.position.y = lerp(0.10, 0.44, u);
            const nC = ford.cans.length;
            for (let i = 0; i < nC; i++) ford.cans[i].userData.setFill(clamp(u * (nC + 1) - i, 0, 1));
          }
          const ang = lerp(0.45, 1.55, u), rad = lerp(6.8, 5.4, u);
          safeCamPos(ford.x + Math.cos(ang) * rad, ford.y + lerp(1.9, 2.6, u), ford.z + Math.sin(ang) * rad, 1.35);
          camLook.set(ford.x + 0.8, ford.y + 1.15, ford.z + 0.4);
        }
      },
      {
        id: "act5_zones_camera", t0: 34.0, t1: 42.5,
        kicker: "ACT V · ANSEL ADAMS ZONES 0–X & LIDAR",
        title: "8×10 Field Camera & Song-Resonant Tonal Looks",
        explain: "Deploy the 8×10 mahogany view camera (B), scan elevation contours with Lidar (L), sync tonal zones to the song (T), and expose contact plates (Space) onto film trees.",
        quote: "“You don’t take a photograph, you make it — Zones 0 through X.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.soloLook = -1; // Unlock 11 Tonal Zone shaders specifically for Act V!
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
          placeActor("june", -32.2, 0.4, -1.75, "holdCup", "");
          audio.shutter();
        },
        step(u, dt, nowSec) {
          state.lidarStrength = 0.78;
          state.focusDist = lerp(8.0, 165.0, smooth(0.15, 0.85, u));
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          cast?.byId?.imani?.update(dt, nowSec, { pose: "camera", carryCan: false, beatPulse: state.beatPulse });
          cast?.byId?.june?.update(dt, nowSec, { pose: "holdCup", beatPulse: state.beatPulse });
          const base = driveSurfaceAt(-33.5, 2.0);
          safeCamPos(lerp(-29.2, -30.5, u), base + lerp(1.65, 2.35, u), lerp(4.2, -1.6, u), 1.35);
          camLook.set(-42.0, base + 1.35, 0.2);
        }
      },
      {
        id: "act6_glider_forest", t0: 42.5, t1: 51.0,
        kicker: "ACT VI · WINGED WOODY & COOLING VALLEY FLIGHT",
        title: "Soar Over the Cooling Reservoir & Wake 10 Film Groves",
        explain: "Fly the winged Woody (J, Shift for thermal lift) above the highland river & concrete cooling facility to wake all 10 living 35mm Kelp-Film Forest groves!",
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
      {
        id: "act7_cottonwood_grove", t0: 51.0, t1: 59.5,
        kicker: "ACT VII · COTTONWOOD OXBOW ROOT-BOWL & GROVE SCREEN",
        title: "Pouring into the Living Roots · Shading the Beam",
        explain: "At Cottonwood Oxbow, Makeda kneels to pour living cyan water into the gnarled cottonwood root-bowl while Etta shades a projected face on pegged forest linen.",
        quote: "“Put down that Ruth made the picture. Leave a space for who was laughing.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.focusDist = 4.6;
          donkey.place(-506.4, 102.6, -2.6, driveSurfaceAt);
          placeActor("makeda", -511.25, 98.45, 1.85, "kneelPour", "");
          placeActor("etta", -508.55, 97.15, -1.65, "shadeScreen", "");
          placeActor("old_bride", -509.8, 98.8, -2.68, "seatedWatch", "");
          placeActor("hood_watcher_1", -506.9, 97.2, -0.45, "idle", "");
          placeActor("june", -507.8, 100.4, -2.65, "listen", "");
          initRain();
        },
        step(u, dt, nowSec) {
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
          cast?.byId?.makeda?.update(dt, nowSec, { pose: "kneelPour", beatPulse: state.beatPulse });
          cast?.byId?.etta?.update(dt, nowSec, { pose: "shadeScreen", beatPulse: state.beatPulse });
          cast?.byId?.old_bride?.update(dt, nowSec, { pose: "seatedWatch", beatPulse: state.beatPulse });
          cast?.byId?.hood_watcher_1?.update(dt, nowSec, { pose: "idle", beatPulse: state.beatPulse });
          cast?.byId?.june?.update(dt, nowSec, { pose: "listen", beatPulse: state.beatPulse });
          const oy = driveSurfaceAt(-510, 98.2);
          // Unobstructed lateral glide from kneeling Makeda's glowing root-bowl across Etta & the pegged forest sheets (`grove.jpg`!)
          safeCamPos(lerp(-509.4, -506.6, u), oy + lerp(1.18, 1.68, u), lerp(101.4, 101.2, u), 1.02);
          camLook.set(lerp(-511.6, -509.2, u), oy + lerp(0.88, 1.72, u), lerp(98.1, 96.2, u));
        }
      },
      {
        id: "act8_registry_and_ahiya", t0: 59.5, t1: 68.0,
        kicker: hasAhiya ? "ACT VIII · WIRE-GLASS REGISTRY & AHIYA NIGHT ROUTE" : "ACT VIII · HIGHLAND PUEBLO YARD & WIRE-GLASS REGISTRY",
        title: hasAhiya ? "Splitter Hoses, Glowing Night Phones & REC PPC Desk" : "Stone Houses, Three Dividing Hoses & Tess's Window",
        explain: hasAhiya
          ? "At Highland Pueblo, three splitter hoses feed cooling, cup & cinema; across Ahiya Highlands, glowing phones light the night convoy under the Hill Archive REC PPC monitor."
          : "In Highland Pueblo's stone-and-corrugated yard, villagers queue beside clotheslines and dividing cyan hoses while Tess stamps the ledger behind wire glass.",
        quote: hasAhiya
          ? "“Keep the wrong take too — that’s the only one where we all came in together.”"
          : "“Three branches visible from one yard: cooling tank, public cup, and cinema bowl.”",
        setup() {
          clearStageEffects();
          setRegion("tetons");
          state.focusDist = 5.0;
          donkey.place(-777.2, -26.4, 2.85, driveSurfaceAt);
          placeActor("imani", -776.4, -27.3, 2.85, "walk", "");
          placeActor("tess", -773.3, -31.8, 0.30, "clerkWindow", "");
          // Queue villagers facing across the yard toward the donkey & manifold (`village.jpg`!)
          placeActor("queue_1", -773.4, -28.8, -1.35, "queueWait", "");
          placeActor("queue_2", -773.8, -27.7, -1.45, "queueWait", "");
          placeActor("queue_3", -774.2, -26.6, -1.52, "queueWait", "");
          placeActor("queue_4", -774.6, -25.5, -1.60, "queueWait", "");
          if (hasAhiya) {
            placeActor("rahel", -1455.2, 761.2, 0.08, "convoyPhoneWalk", "");
            placeActor("escort_yared", -1456.0, 761.0, 0.10, "convoyPhoneWalk", "");
            placeActor("ppc_op_male", -1765.85, 541.55, Math.PI * 0.86, "deskWrite", "");
            placeActor("ppc_op_female", -1764.15, 541.55, -Math.PI * 0.86, "deskNotes", "");
          }
          initRain();
        },
        step(u, dt, nowSec) {
          if (!hasAhiya || u < 0.50) {
            setRegion("tetons");
            const k = hasAhiya ? (u / 0.50) : u;
            donkey.place(-777.2, lerp(-25.4, -28.4, k), 2.85, driveSurfaceAt);
            donkey.update(dt, { throttle: 0.45, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
            const im = placeActor("imani", -776.4, lerp(-26.3, -29.3, k), 2.85, "walk", "");
            im?.update(dt, nowSec, { pose: "walk", carryCan: true, beatPulse: state.beatPulse });
            cast?.byId?.tess?.update(dt, nowSec, { pose: "clerkWindow", beatPulse: state.beatPulse });
            for (const qid of ["queue_1", "queue_2", "queue_3", "queue_4"]) {
              cast?.byId?.[qid]?.update(dt, nowSec, { pose: "queueWait", beatPulse: state.beatPulse, lookAt: donkey.group.position });
            }
            const py = driveSurfaceAt(-775.8, -26.5);
            if (k < 0.62) {
              // Wide village yard composition (`village.jpg`!): 3-branch hoses + tin mug foreground, stone houses, queue, cooling plant & Tetons!
              const v = k / 0.62;
              safeCamPos(lerp(-775.8, -775.2, v), py + lerp(1.55, 1.95, v), lerp(-22.2, -23.5, v), 1.25);
              camLook.set(-776.2, py + 1.35, -30.5);
            } else {
              // Intimate wire-glass Registry window shot looking past counter & sample cup at Tess (`window.jpg`!)
              const w = (k - 0.62) / 0.38;
              const wy = driveSurfaceAt(-776.0, -30.0);
              safeCamPos(lerp(-772.9, -773.45, w), wy + 1.48, -29.45, 1.15);
              camLook.set(-773.3, wy + 1.44, -32.0);
            }
          } else if (u < 0.78) {
            // Ahiya Night Convoy on flat basalt plateau (boots & hooves cleanly on ground!): Rahel & Yared with upward blue phone glow (`convoy.jpg`!)
            setRegion("ahiya");
            const k = (u - 0.50) / 0.28;
            const dz = lerp(760.2, 763.2, k);
            donkey.place(-1454.35, dz, 0.06, driveSurfaceAt);
            donkey.update(dt, { throttle: 0.55, steer: 0, pace: 0, near: 1, drop: 0 }, driveSurfaceAt);
            const rh = placeActor("rahel", -1455.25, dz + 0.42, 0.06, "convoyPhoneWalk", "");
            const yr = placeActor("escort_yared", -1456.05, dz + 0.28, 0.08, "convoyPhoneWalk", "");
            rh?.update(dt, nowSec, { pose: "convoyPhoneWalk", beatPulse: state.beatPulse });
            yr?.update(dt, nowSec, { pose: "convoyPhoneWalk", beatPulse: state.beatPulse });
            const ay = driveSurfaceAt(-1455.2, dz);
            safeCamPos(-1455.15, ay + 1.18, dz + 2.75, 0.95);
            camLook.set(-1455.15, ay + 1.08, dz + 0.15);
          } else {
            // Hill Archive `REC PPC` Desk: Daniel & Hanna logging at the monitor cubicle (`desk.jpg`!)
            setRegion("ahiya");
            cast?.byId?.ppc_op_male?.update(dt, nowSec, { pose: "deskWrite", beatPulse: state.beatPulse });
            cast?.byId?.ppc_op_female?.update(dt, nowSec, { pose: "deskNotes", beatPulse: state.beatPulse });
            const hy = driveSurfaceAt(-1765, 540);
            const k = (u - 0.78) / 0.22;
            safeCamPos(lerp(-1765.18, -1764.82, k), hy + 1.46, 542.95, 1.18);
            camLook.set(-1765.0, hy + 1.48, 540.1);
          }
        }
      },
      {
        id: "act9_eskista_finale", t0: 68.0, t1: TRAILER_DURATION,
        kicker: "ACT IX · COSMIC ADDIS ESKISTA FINALE",
        title: "Highland Pueblo Village · Dance, Shoot & Record",
        explain: "Deliver all 72 jerrycans to light the Highland Pueblo blue door, press K to dance Eskista with the cast, or tap ● Rec Video below to export your own Machinima!",
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
            cast?.byId?.[id]?.update(dt, nowSec, { pose: "eskista", beatPulse: Math.max(0.45, state.beatPulse) });
          }
          const py = driveSurfaceAt(px, pz);
          const ang = lerp(-0.45, 0.65, u), rad = lerp(5.6, 8.8, u);
          safeCamPos(px + Math.sin(ang) * rad, py + lerp(1.75, 3.15, u), pz + Math.cos(ang) * rad, 1.35);
          camLook.set(px - 0.4, py + 1.42, pz - 0.5);
        }
      }
    ];

    /* ---------- FULL-SONG MACHINIMA MUSIC VIDEO (283 SECONDS / 04:43) ---------- */
    const MV_DURATION = 283.0;
    const MV_SHOTS = [
      { t0: 0,   t1: 14,  kicker: "EPOCH I · WELLHEAD AWAKENING", title: "Imani, June & Mistletoe's Cyan Saddle Window", actIdx: 0 },
      { t0: 14,  t1: 28,  kicker: "EPOCH I · WELLHEAD AWAKENING", title: "Iron Lever Before the Rooster", actIdx: 0, camAlt: 1 },
      { t0: 28,  t1: 45,  kicker: "EPOCH I · SHOULDER JERIKAN", title: "Cyan Jerikan Balanced on My Shoulder Blade", actIdx: 1 },
      { t0: 45,  t1: 62,  kicker: "EPOCH II · HOOVES ON COBBLE", title: "Cruiser Woody Down Moraine Switchback", actIdx: 2 },
      { t0: 62,  t1: 94,  kicker: "EPOCH II · SILVER FORD RELAY", title: "Etta, the Ferrymen & Cistern Ignition", actIdx: 3 },
      { t0: 94,  t1: 118, kicker: "EPOCH III · COTTONWOOD OXBOW", title: "Pouring into the Living Roots · Shading the Beam", actIdx: 6 },
      { t0: 118, t1: 140, kicker: "EPOCH III · TEZETA ONTO FERRIC", title: "8×10 Tonal Strata & Lidar Ridge Scan", actIdx: 4 },
      { t0: 140, t1: 165, kicker: "EPOCH IV · FERRIC DROP", title: "Winged Woody Over the Cooling Reservoir", actIdx: 5 },
      { t0: 165, t1: 196, kicker: "EPOCH IV · HIGHLAND PUEBLO", title: "Stone Houses, Splitter Hoses & Registry Window", actIdx: 7, subRange: [0, 0.50] },
      { t0: 196, t1: 232, kicker: "EPOCH V · NIGHT POST CONVOY", title: hasAhiya ? "Glowing Phones & Hill Archive REC PPC" : "Cottonwood Oxbow Double Linen Projection", actIdx: hasAhiya ? 7 : 6, subRange: hasAhiya ? [0.50, 1.0] : [0.2, 1.0] },
      { t0: 232, t1: MV_DURATION, kicker: "EPOCH VI · ARKESTRA FINALE", title: "All Cast Eskista in Highland Pueblo", actIdx: 8 }
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
      s.relaysLit.forEach(( snapR, idx ) => {
        const r = relays[idx];
        if (!r) return;
        r.lit = snapR.lit;
        if (r.poolMesh) r.poolMesh.position.y = snapR.poolY;
        r.cans.forEach((c, ci) => c.userData.setFill(snapR.fills[ci] ?? (r.lit ? 1 : 0)));
      });
      s.grovesUnlocked.forEach(( snapG, idx ) => {
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

      // Switch audio to full studio stereo during machinima & start tape
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
      if (!active || mode === "dolly") return;
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
        placeActor("imani", cx - 1.2, cz + 0.6, dolly.yaw + Math.PI, "pour", "CYAN POUR TAKE");
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

      afterRender(); // Prime first frame immediately
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

      // Cover-fit WebGL canvas into recording frame
      const sw = canvas.width || W, sh = canvas.height || H;
      const scale = Math.max(W / sw, H / sh);
      const dw = sw * scale, dh = sh * scale;
      recCtx.drawImage(canvas, (W - dw) * 0.5, (H - dh) * 0.5, dw, dh);

      if (letterboxOn) {
        const barH = Math.round(H * 0.068);
        recCtx.fillStyle = "#050809";
        recCtx.fillRect(0, 0, W, barH);
        recCtx.fillRect(0, H - barH, W, barH);
      }

      if (captionsOn && mode !== "dolly") {
        const padX = Math.round(W * 0.06);
        const boxY = H - Math.round(H * 0.20);
        const boxW = W - padX * 2;
        const boxH = Math.round(H * 0.115);
        recCtx.fillStyle = "rgba(7, 14, 15, 0.76)";
        recCtx.fillRect(padX, boxY, boxW, boxH);
        recCtx.strokeStyle = "rgba(107, 232, 220, 0.5)";
        recCtx.lineWidth = 2;
        recCtx.strokeRect(padX, boxY, boxW, boxH);

        recCtx.fillStyle = "#6be8dc";
        recCtx.font = `700 ${Math.round(H * 0.016)}px monospace`;
        recCtx.fillText(kickerEl.textContent || "", padX + 16, boxY + Math.round(boxH * 0.28));

        recCtx.fillStyle = "#fffaf0";
        recCtx.font = `600 ${Math.round(H * 0.025)}px Georgia, serif`;
        recCtx.fillText(titleEl.textContent || "", padX + 16, boxY + Math.round(boxH * 0.60));

        const sub = (mode === "trailer" ? explainEl.textContent : lyricEl.textContent) || "";
        recCtx.fillStyle = "#eab965";
        recCtx.font = `italic ${Math.round(H * 0.017)}px Georgia, serif`;
        recCtx.fillText(sub.slice(0, 108), padX + 16, boxY + Math.round(boxH * 0.86));
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
          // Gently lock to master audio clock when tape is actively playing
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

    /* ---------- Wire Machinima Bar Controls ---------- */
    document.getElementById("mach-mode-trailer").addEventListener("click", () => start("trailer", 0));
    document.getElementById("mach-mode-mv").addEventListener("click", () => start("musicvideo", 0));
    document.getElementById("mach-mode-dolly").addEventListener("click", () => start("dolly", 0));
    playBtn.addEventListener("click", () => {
      playing = !playing;
      if (mode === "musicvideo" && audioEl) {
        if (playing) audioEl.play().catch(() => {});
        else audioEl.pause();
      }
      syncUI();
    });
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

    return {
      isActive: () => active,
      getMode: () => mode,
      areCaptionsHidden: () => active && !captionsOn,
      start,
      stop,
      toggle,
      seek,
      stepShot,
      startRecording,
      stopRecording,
      stepCamera,
      afterRender,
      onLookDrag,
      getState: () => ({
        active,
        mode,
        playing,
        t: +timeSec.toFixed(2),
        duration: totalDuration(),
        shotIdx: currentShotIdx,
        shotCount: activeTimeline().length,
        kicker: kickerEl.textContent,
        title: titleEl.textContent,
        captionsOn,
        recording: Boolean(mediaRecorder && mediaRecorder.state === "recording"),
        recordedBytes: recBytes,
        hasSavedClip: !saveLink.hidden && Boolean(recBlobUrl),
        castCount: cast ? cast.list.length : 0
      })
    };
  }

  window.createMachinimaDirector = createMachinimaDirector;
})();
