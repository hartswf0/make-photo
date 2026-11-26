/* THE FOUR TRIALS: MESA CHIP as a game. Uncle Mesa meets the glass knight in the sunken cathedral four times, once in each
   PAE-09 SCION world, and each world's way of seeing is the rule of the fight.
     I   Tekle     only light moves: the knight breaks only while it stands in the travelling column of light; elsewhere the paint
                   just colours the glass.
     II  1985      the rack focus: hold your aim until it is sharp. Only steady, focused shots land.
     III Mambety   the griot keeps time on a plucked string. On the beat a shot breaks double; off it, it barely scratches.
     IV  Moebius   every hit blooms. Hit again inside the bloom and the chain grows: x2, x3, x4.
   Four falls per trial. The clock and the falls make the score. Enter or the Play button starts; Esc leaves the trials.
   It talks to the game only through window.__mesa and three hooks the game calls: __trials.hit(point, colour) -> damage,
   __trials.fall(), __trials.win(). */
(() => {
  "use strict";
  const TRIALS = [
    { lens: "tekle", n: "I", title: "Leaded light", after: "Afewerk Tekle", rule: "Only light moves. Paint the knight while it stands in the column of light." },
    { lens: "lucas85", n: "II", title: "Shard light", after: "Lucasfilm, 1985", rule: "Hold your aim until it is sharp. Only focused shots break the glass." },
    { lens: "mambety", n: "III", title: "Told", after: "Djibril Diop Mambéty", rule: "Shoot on the beat of the string. On the beat, double. Off it, a scratch." },
    { lens: "moebius", n: "IV", title: "The line", after: "Mœbius and Otomo", rule: "Every hit blooms. Hit again inside the bloom to chain it." },
  ];
  let HP = 16; try { const q = +new URLSearchParams(location.search).get('trialhp'); if (q > 0) HP = q; } catch (e) { }   /* trialhp: a shorter knight, for testing on slow machines */
  const FALLS = 4, BEAT = .75, WINDOW = .17, BLOOM = .6;
  const css = `
  #trials-hud{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:6;display:none;gap:14px;align-items:center;padding:8px 14px;background:rgba(18,12,10,.58);border:1px solid rgba(242,208,74,.35);border-radius:3px;font:600 11px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#f4e8d2;pointer-events:none;max-width:calc(100vw - 32px)}
  #trials-hud.on{display:flex}#trials-hud .n{font:700 20px/1 Georgia,serif;color:#f2d04a;letter-spacing:.05em}
  #trials-hud .bar{width:160px;height:8px;background:rgba(255,255,255,.12);position:relative}#trials-hud .bar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#d8342c,#f2d04a);transition:width .15s}
  #trials-hud .cue{min-width:118px;text-align:center;padding:3px 6px;border:1px solid rgba(255,255,255,.25)}#trials-hud .cue.hot{background:#2fd0d8;color:#0b0d10;border-color:#2fd0d8}
  #trials-hud .falls b{color:#e85aa8}
  #trials-card{position:fixed;inset:0;z-index:7;display:none;place-items:center;background:radial-gradient(ellipse at center,rgba(20,12,8,.72),rgba(10,6,4,.9));color:#f4e8d2;text-align:center;padding:24px}
  #trials-card.on{display:grid}#trials-card .k{font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.3em;text-transform:uppercase;color:#2fd0d8}
  #trials-card h2{font:700 clamp(40px,8vw,92px)/1 Georgia,serif;letter-spacing:.06em;margin:14px 0 6px;color:#f2d04a}
  #trials-card .a{font:italic 400 clamp(15px,2vw,20px)/1.5 Georgia,serif;color:#f4e8d2;opacity:.85}
  #trials-card p{max-width:560px;margin:18px auto 22px;font:400 clamp(15px,2vw,19px)/1.55 Georgia,serif}
  #trials-card button{font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;padding:12px 18px;background:#f2d04a;color:#1a1410;border:0;cursor:pointer}
  #trials-card button.ghost{background:none;color:#f4e8d2;border:1px solid rgba(255,255,255,.35);margin-left:8px}
  #trials-card table{margin:10px auto 18px;border-collapse:collapse;font:500 13px/1.6 ui-monospace,Menlo,monospace}#trials-card td{padding:2px 12px;text-align:left}#trials-card td:last-child{text-align:right;color:#f2d04a}
  #trials-play{font:inherit}`;
  function boot() {
    const M = window.__mesa; if (!M || !M.T) return setTimeout(boot, 400);
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const hud = document.createElement("div"); hud.id = "trials-hud"; hud.innerHTML = `<span class="n"></span><span class="t"></span><span class="bar" title="The knight"><i></i></span><span class="cue"></span><span class="falls"></span><span class="clock"></span>`; document.body.appendChild(hud);
    const card = document.createElement("div"); card.id = "trials-card"; card.setAttribute("role", "dialog"); document.body.appendChild(card);
    const bar = document.querySelector(".bar .modes"); const play = document.createElement("button"); play.type = "button"; play.id = "trials-play"; play.textContent = "Trials"; play.title = "The four trials (Enter)";
    if (bar) bar.appendChild(play);
    const $ = s => hud.querySelector(s); const T = M.T, K = M.KNIGHT, S = M.st;
    let ac = null; function tick(f = 196, g = .18, d = .5) { try { ac = ac || new AudioContext(); const o = ac.createOscillator(), v = ac.createGain(), t = ac.currentTime; o.type = "triangle"; o.frequency.value = f; v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(v).connect(ac.destination); o.start(t); o.stop(t + d); } catch (e) { } }

    /* the column of light for Tekle's trial: it travels the cathedral floor; the knight is breakable only inside it */
    const PIT = M.W.PIT, CY = M.W.cathedralY;
    const beam = new T.Mesh(new T.CylinderGeometry(2.8, 3.2, 26, 24, 1, true), new T.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: .34, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    const pool = new T.Mesh(new T.CircleGeometry(3.3, 32), new T.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: .35, depthWrite: false, blending: T.AdditiveBlending })); pool.rotation.x = -Math.PI / 2;
    beam.visible = pool.visible = false; M.scene.add(beam, pool);
    window.__trialsG = null; const G = { on: false, i: 0, t: 0, falls: 0, hp: HP, chain: 0, lastHit: -9, results: [], phase: "idle", beamX: 0, beamZ: PIT.z, beatT: 0, onBeat: false, lastBeat: 0 };

    function show(html) { card.innerHTML = html; card.classList.add("on"); const b = card.querySelector("button[data-go]"); if (b) setTimeout(() => b.focus(), 50); }
    function hide() { card.classList.remove("on"); }
    function intro(i) {
      const tr = TRIALS[i]; G.phase = "card"; M.LENS.set(tr.lens); M.lensUI && M.lensUI();
      show(`<div><div class="k">Trial ${tr.n} of IV · after ${tr.after}</div><h2>${tr.title}</h2><div class="a">Uncle Mesa and the knight of glass</div><p>${tr.rule}</p><button type="button" data-go>Begin</button><button type="button" class="ghost" data-quit>Leave the trials</button></div>`);
      card.querySelector("[data-go]").onclick = () => begin(i); card.querySelector("[data-quit]").onclick = quit;
    }
    function begin(i) {
      hide(); G.on = true; G.i = i; G.t = 0; G.falls = 0; G.chain = 0; G.lastHit = -9; G.phase = "fight"; window.__trials = API;
      /* back to the top of the cathedral steps, gun drawn; the knight waits in the glass */
      S.x = 0; S.z = PIT.z + 22; S.y = CY; S.heading = Math.PI; S.mode = "foot"; S.ink = 100; S.vy = 0;
      K.state = "window"; K.t = 0; K.hp = HP; K.cool = 1.5;
      if (!S.gun) { dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" })); dispatchEvent(new KeyboardEvent("keyup", { code: "KeyR" })); }
      beam.visible = pool.visible = TRIALS[i].lens === "tekle"; hud.classList.add("on"); M.say(TRIALS[i].rule, 4); tick(392, .2, .8);
    }
    function quit() { G.on = false; G.phase = "idle"; window.__trials = null; hide(); hud.classList.remove("on"); beam.visible = pool.visible = false; M.LENS.set("plain"); M.lensUI && M.lensUI(); }
    function score(t, falls) { return Math.max(100, Math.round(3000 - t * 25 - falls * 400)); }
    function finish() {
      const tot = G.results.reduce((a, r) => a + r.score, 0); G.on = false; window.__trials = null; hud.classList.remove("on"); beam.visible = pool.visible = false;
      show(`<div><div class="k">The four trials</div><h2>Every shard holding its colour</h2><table>${G.results.map((r, k) => `<tr><td>${TRIALS[k].n} · ${TRIALS[k].title}</td><td>${r.t.toFixed(1)} s · ${r.falls} fall${r.falls === 1 ? "" : "s"}</td><td>${r.score}</td></tr>`).join("")}<tr><td>Total</td><td></td><td>${tot}</td></tr></table><p>Uncle Mesa lowers the gun and sits on the lowest step. The light moves on across the pieces.</p><button type="button" data-go>Play again</button><button type="button" class="ghost" data-quit>Back to the world</button></div>`);
      card.querySelector("[data-go]").onclick = () => { G.results = []; intro(0); }; card.querySelector("[data-quit]").onclick = quit;
      try { localStorage.setItem("mesa-trials-best", Math.max(tot, +localStorage.getItem("mesa-trials-best") || 0)); } catch (e) { }
    }
    const API = {
      get hp() { return HP; },
      hit(q, col) {
        if (!G.on || G.phase !== "fight") return 1; const tr = TRIALS[G.i], now = G.t; let d = 0, msg = "";
        if (tr.lens === "tekle") { const inLight = Math.hypot(K.x - G.beamX, K.z - G.beamZ) < 3.3; d = inLight ? 1 : 0; msg = inLight ? "" : "Not in the light: the paint only colours the glass."; }
        else if (tr.lens === "lucas85") { const sharp = S.steady > .82; d = sharp ? 1 : 0; msg = sharp ? "" : "Out of focus. Hold the aim."; }
        else if (tr.lens === "mambety") { const ph = (G.beatT % BEAT), on = ph < WINDOW || ph > BEAT - WINDOW; d = on ? 2 : .25; if (on) tick(784, .12, .25); }
        else { if (now - G.lastHit < BLOOM) G.chain = Math.min(4, G.chain + 1); else G.chain = 1; G.lastHit = now; d = G.chain; }
        if (msg && Math.random() < .25) M.say(msg, 1.4);
        return d;
      },
      fall() { if (!G.on || G.phase !== "fight") return; G.falls++;
        /* he gets up: the knight steps back and waits a breath, so a fall is a beat of the fight and not the end of it */
        setTimeout(() => { if (K.state === "hunt" || K.state === "strike") { const a = Math.atan2(K.x - S.x, K.z - S.z); K.x = Math.max(-PIT.hx + 1.5, Math.min(PIT.hx - 1.5, S.x + Math.sin(a) * 7)); K.z = Math.max(PIT.z - PIT.hz + 2, Math.min(PIT.z + PIT.hz - 2, S.z + Math.cos(a) * 7)); K.state = "hunt"; K.cool = 3; } }, 500); if (G.falls >= FALLS) { G.phase = "lost"; setTimeout(() => {
        show(`<div><div class="k">Trial ${TRIALS[G.i].n} · ${TRIALS[G.i].title}</div><h2>He goes down</h2><p>Four times the glass sword put him on the mirror floor. He gets up.</p><button type="button" data-go>Try again</button><button type="button" class="ghost" data-quit>Leave the trials</button></div>`);
        card.querySelector("[data-go]").onclick = () => begin(G.i); card.querySelector("[data-quit]").onclick = quit; }, 1400); } },
      win() { if (!G.on || G.phase !== "fight") return; G.phase = "won"; const r = { t: G.t, falls: G.falls, score: score(G.t, G.falls) }; G.results[G.i] = r; tick(523, .2, 1.2); setTimeout(() => tick(784, .18, 1.4), 180);
        setTimeout(() => { if (G.i < TRIALS.length - 1) intro(G.i + 1); else finish(); }, 2600); },
    };
    let last = performance.now();
    function loop(now) {
      requestAnimationFrame(loop); const dt = Math.min(.1, ((now || performance.now()) - last) / 1000); last = now || performance.now(); if (!G.on) return;
      if (G.phase === "fight") G.t += dt;
      if (G.lastK === "strike" && K.state === "hunt") K.cool = Math.max(K.cool, 3.2); G.lastK = K.state;   /* in the trials the knight takes a breath after each cut */
      const tr = TRIALS[G.i];
      if (tr.lens === "tekle") { /* the light moves on across the fight: it sweeps over the knight every few seconds, a window to strike */ const kx = K.state === "window" ? 0 : K.x, kz = K.state === "window" ? PIT.z : K.z; G.beamX += (kx + Math.sin(G.t * .7) * 5.5 - G.beamX) * Math.min(1, dt * 1.5); G.beamZ += (kz + Math.cos(G.t * .5) * 3 - G.beamZ) * Math.min(1, dt * 1.5); beam.position.set(G.beamX, CY + 13, G.beamZ); pool.position.set(G.beamX, CY + .05, G.beamZ);
        const inL = Math.hypot(K.x - G.beamX, K.z - G.beamZ) < 3.3; $(".cue").textContent = inL ? "In the light" : "In the glass"; $(".cue").classList.toggle("hot", inL); }
      else if (tr.lens === "lucas85") {   /* the focus is earned: moving, turning or spraying throws it, so you plant and fire in bursts */
        const mv = Math.hypot(S.x - (G.px ?? S.x), S.z - (G.pz ?? S.z)) / Math.max(dt, 1e-3) + Math.abs(S.heading - (G.ph ?? S.heading)) / Math.max(dt, 1e-3) * 2; G.px = S.x; G.pz = S.z; G.ph = S.heading;
        if (mv > .6) S.steady = Math.max(0, S.steady - dt * 2.5); if (S.recoil > .05) S.steady = Math.max(0, S.steady - dt * 1.6);
        const sh = S.steady > .82; $(".cue").textContent = S.gun ? (sh ? "Sharp" : "Focusing " + Math.round(S.steady * 100) + "%") : (document.body.classList.contains("touch") ? "Hold FIRE" : "Draw (R)"); $(".cue").classList.toggle("hot", sh && S.gun); }
      else if (tr.lens === "mambety") { const prev = G.beatT % BEAT; G.beatT += dt; const ph = G.beatT % BEAT; if (ph < prev) tick(196 + (Math.floor(G.beatT / BEAT) % 4 === 0 ? 98 : 0), .16, .5); const on = ph < WINDOW || ph > BEAT - WINDOW; $(".cue").textContent = on ? "On the beat ×2" : "· · ·"; $(".cue").classList.toggle("hot", on); }
      else { const live = G.t - G.lastHit < BLOOM; $(".cue").textContent = live ? "Bloom ×" + Math.min(4, G.chain + 1) : "Chain ×1"; $(".cue").classList.toggle("hot", live); }
      $(".n").textContent = tr.n; $(".t").textContent = tr.title; $(".bar i").style.width = Math.max(0, K.hp / HP * 100) + "%";
      $(".falls").innerHTML = "Falls <b>" + "●".repeat(G.falls) + "</b>" + "○".repeat(Math.max(0, FALLS - G.falls)); $(".clock").textContent = G.t.toFixed(1) + " s";
    }
    window.__trialsG = G; window.__trialsBegin = begin; requestAnimationFrame(loop);
    function title() { const best = (() => { try { return +localStorage.getItem("mesa-trials-best") || 0; } catch (e) { return 0; } })();
      G.results = []; show(`<div><div class="k">MESA CHIP · a cyber-western of glass</div><h2>The Four Trials</h2><div class="a">Uncle Mesa and the knight of glass, four times, in four ways of seeing</div><p>Under the dune the floor is glass. Each trial is the same fight told in another language: Tekle's leaded light, the 1985 shard light, Mambéty's telling, Mœbius's line. ${document.body.classList.contains('touch') ? 'Left thumb moves, right thumb looks, hold FIRE to spray paint, DASH to dodge the sword.' : 'WASD to move, R to draw, hold Space or click to spray paint, Shift to run.'}${best ? `<br><br>Best: ${best}` : ""}</p><button type="button" data-go>Play</button><button type="button" class="ghost" data-quit>Wander the world</button></div>`);
      card.querySelector("[data-go]").onclick = () => intro(0); card.querySelector("[data-quit]").onclick = quit; }
    play.onclick = title;
    addEventListener("keydown", e => { if (e.code === "Enter" && !card.classList.contains("on") && !G.on) title(); else if (e.code === "Escape" && (G.on || card.classList.contains("on"))) quit(); });
    try { if (new URLSearchParams(location.search).has("trials")) title(); } catch (e) { }
  }
  boot();
})();
