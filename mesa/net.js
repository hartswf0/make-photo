/* MESA CHIP for two: one link, two phones, no account and no server of ours.

   The first player taps "Play with a friend" and sends the link (…/mesa/?with=amber-zebu-41). Whoever opens it joins as Anta. The
   two browsers talk to each other directly (WebRTC, through PeerJS: its public broker introduces them, then steps away). The first
   player's game is the one that counts: it runs the outlaws, the bike, the missions and every hit, and tells the other what it sees.
   Each player moves and aims on their own phone, so nothing feels late in the hand.

   MesaNet = { role: "solo" | "host" | "guest", code, live, send(obj), on(event, fn), host() -> link, link(), share() }
   Events: "join", "leave", and whatever the other side sends, by its `e` field.
   ?netlocal uses a BroadcastChannel instead of WebRTC, so two tabs of one browser can be tested without the broker. */
window.MesaNet = (() => {
  "use strict";
  const C = Object.assign({ id: "mesachip", title: "MESA CHIP", ready: () => !!window.__mesa, pitch: "A cyber-western of glass. Paint the outlaws, ride the horned bike, break the knight, carry the chip to the trough.", soloSmall: "Two phones, one link. No account.",
    guestLine: "You have been asked to ride. You are <b>Anta</b>, the second gun. Uncle Mesa is waiting at the gate.", guestSmall: "Stay close to him. When he takes the bike, you are on the back, shooting.", join: "Join as Anta", finding: "○ Finding Uncle Mesa…",
    inviteLine: "Send this link. Whoever opens it rides with you as Anta, the second gun.", shareText: "Ride with me in MESA CHIP. Open this and you are Anta, the second gun." }, window.DUO || {});   /* another edition sets window.DUO before this loads */
  const qs = new URLSearchParams(location.search), LOCAL = qs.has("netlocal"), H = {}, emit = (e, d) => (H[e] || []).forEach(f => { try { f(d); } catch (x) { console.warn("net", e, x); } });
  let code = (qs.get("with") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40), hosted = ""; try { hosted = sessionStorage.getItem("mesa.host") || ""; } catch (e) { }
  const N = { role: code && code !== hosted ? "guest" : code ? "host" : "solo", get code() { return code; }, live: false, status: "", on(e, f) { (H[e] = H[e] || []).push(f); }, send(o) { if (N.live && tx) try { tx(o); } catch (e) { } } };
  let tx = null, peer = null, tries = 0;
  const up = () => { if (N.live) return; N.live = true; setStatus(); emit("join"); }, down = () => { if (!N.live) return; N.live = false; tx = null; setStatus(); emit("leave"); if (N.role === "guest") setTimeout(open, 1500); };
  function open() { if (!code) return;
    if (LOCAL) { const ch = new BroadcastChannel("mesa-" + code), mine = N.role; ch.onmessage = m => { const d = m.data; if (!d || d._from === mine) return; if (d._hello) { if (!N.live) { ch.postMessage({ _hello: 1, _from: mine }); up(); } return; } if (d._bye) return down(); emit(d.e, d); }; tx = o => ch.postMessage(Object.assign({ _from: mine }, o)); ch.postMessage({ _hello: 1, _from: mine }); addEventListener("pagehide", () => ch.postMessage({ _bye: 1, _from: mine })); return; }
    if (!window.Peer) { N.status = "Two-player could not load."; return setStatus(); }
    const bind = c => { c.on("open", () => { tx = o => c.send(o); up(); }); c.on("data", d => { if (d && d.e) emit(d.e, d); }); c.on("close", down); c.on("error", down); };
    if (peer) try { peer.destroy(); } catch (e) { }
    if (N.role === "host") { peer = new window.Peer(C.id + "-" + code); peer.on("connection", c => { if (N.live) return c.close(); bind(c); }); peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) { } }); peer.on("error", e => { if (e && e.type === "unavailable-id") { N.status = "That room is already open in another tab."; setStatus(); } }); }
    else { peer = new window.Peer(); peer.on("open", () => bind(peer.connect(C.id + "-" + code, { reliable: true, serialization: "json" }))); peer.on("error", () => { if (!N.live && ++tries < 40) setTimeout(open, 2500); }); } }
  const A = ["amber", "cobalt", "crimson", "gold", "indigo", "jade", "ochre", "silver", "violet", "copper"], B = ["zebu", "kanaga", "krar", "prism", "iris", "mesa", "saguaro", "oasis", "torch", "horn"];
  N.link = () => location.origin + location.pathname + "?with=" + code + (LOCAL ? "&netlocal" : "");
  N.host = () => { if (N.role === "solo") { code = A[Math.floor(Math.random() * A.length)] + "-" + B[Math.floor(Math.random() * B.length)] + "-" + (10 + Math.floor(Math.random() * 90)); try { sessionStorage.setItem("mesa.host", code); } catch (e) { } N.role = "host"; history.replaceState(null, "", N.link()); open(); setStatus(); } return N.link(); };
  N.share = async () => { const url = N.host(), data = { title: C.title, text: C.shareText, url }; try { if (navigator.share) { await navigator.share(data); return "sent"; } } catch (e) { if (e && e.name === "AbortError") return "cancelled"; } try { await navigator.clipboard.writeText(url); return "copied"; } catch (e) { return "show"; } };

  /* ---------- the way in: one card, one or two buttons, then three hints that fade ---------- */
  const css = `#start{position:fixed;inset:0;z-index:12;display:grid;place-items:center;padding:24px;text-align:center;color:#fbf2e2;background:linear-gradient(rgba(20,12,8,.5),rgba(20,12,8,.86)),url(./share.jpg) center/cover #1a120c;transition:opacity .5s}
  #start.gone{opacity:0;pointer-events:none}#start .in{max-width:440px;display:grid;gap:14px;justify-items:center}
  #start h1{margin:0;font:700 clamp(42px,12vw,84px)/1 Georgia,serif;letter-spacing:.12em;color:#f2d04a;text-shadow:0 0 30px rgba(242,168,58,.5)}
  #start p{margin:0;font:italic 400 clamp(15px,4.2vw,19px)/1.45 Georgia,serif;text-wrap:balance}#start small{font:11px/1.5 ui-monospace,Menlo,monospace;letter-spacing:.06em;color:rgba(251,242,226,.75);text-wrap:balance}
  #start button{all:unset;cursor:pointer;box-sizing:border-box;width:min(100%,320px);padding:17px 18px;text-align:center;font:700 14px/1 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;background:#ff3aa8;color:#1a120c;border-radius:40px}
  #start button.two{background:none;color:#fbf2e2;border:1.5px solid rgba(251,242,226,.6)}#start button[disabled]{opacity:.45;pointer-events:none}#start button:focus-visible{outline:3px solid #2fd0d8;outline-offset:3px}
  #start .link{font:600 13px/1.4 ui-monospace,Menlo,monospace;color:#2fd0d8;word-break:break-all;user-select:all;-webkit-user-select:all;padding:10px 12px;border:1px dashed rgba(47,208,216,.6);width:min(100%,320px);box-sizing:border-box}
  #duo{position:fixed;right:calc(5vw + 52px);top:calc(18px + env(safe-area-inset-top,0px));z-index:6;display:none;padding:6px 12px;border-radius:20px;background:rgba(20,14,10,.6);border:1px solid rgba(251,242,226,.3);color:#fbf2e2;font:600 10px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
  #duo.on{display:block}#duo.live{border-color:#2fd0d8;color:#2fd0d8}body.cinema #duo{display:none}
  #coach{position:fixed;inset:0;z-index:5;pointer-events:none;opacity:0;transition:opacity .6s;font:italic 400 15px/1.3 Georgia,serif;color:#fbf2e2;text-shadow:0 1px 8px #000}#coach.on{opacity:1}
  #coach i{position:absolute;font-style:italic;text-align:center;width:38vw}#coach .l{left:4vw;bottom:26vh}#coach .r{right:4vw;top:36vh}#coach .f{right:4vw;bottom:calc(130px + env(safe-area-inset-bottom,0px));width:auto}
  #coach .l::before,#coach .r::before{content:"";display:block;width:64px;height:64px;margin:0 auto 8px;border:1.5px dashed rgba(251,242,226,.7);border-radius:50%}`;
  const $ = (h) => { const d = document.createElement("div"); d.innerHTML = h; return d.firstElementChild; };
  let card, duo, coach; const guest = N.role === "guest", touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  function setStatus() { if (!duo) return; duo.classList.toggle("on", N.role !== "solo"); duo.classList.toggle("live", N.live); duo.textContent = N.live ? "●● Two players" : N.status || (guest ? C.finding : "○ Waiting for your friend · send again"); const w = card && card.querySelector(".wait"); if (w) w.textContent = N.live ? "Your friend is here." : N.status || "Waiting for your friend. You can start now: they drop in beside you."; }
  function begin() { card.classList.add("gone"); setTimeout(() => card.remove(), 600); coach.classList.add("on"); const off = () => coach.classList.remove("on"); setTimeout(off, 7000); addEventListener("pointerdown", () => setTimeout(off, 2500), { once: true }); addEventListener("keydown", () => setTimeout(off, 2500), { once: true }); emit("begin"); }
  function invite() { const url = N.host(); card.querySelector(".in").innerHTML = `<h1 style="font-size:clamp(30px,9vw,54px)">FOR TWO</h1><p>${C.inviteLine}</p><div class="link">${url.replace(/^https?:\/\//, "")}</div><button data-a="send">Send the link</button><button class="two" data-a="go">Start playing</button><small class="wait"></small>`; setStatus(); }
  function ui() { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
    card = $(`<div id="start" role="dialog" aria-label="${C.title}"><div class="in"><h1>${C.title}</h1>${guest ? `<p>${C.guestLine}</p><button data-a="go" disabled>Loading…</button>${C.who ? `<button class="two" data-a="who">${C.who}</button>` : ""}<small>${C.guestSmall}</small>` : `<p>${C.pitch}</p><button data-a="go" disabled>Loading…</button><button class="two" data-a="two">Play with a friend</button>${C.who ? `<button class="two" data-a="who">${C.who}</button>` : ""}<small>${C.soloSmall}</small>`}</div></div>`);
    duo = $(`<div id="duo" role="button" tabindex="0"></div>`); coach = $(`<div id="coach">${touch ? `<i class="l">Left thumb<br>move</i><i class="r">Right thumb<br>look</i><i class="f">Hold to shoot ↓</i>` : `<i class="l" style="width:auto">W A S D move · arrows turn · Space shoot · Q dash · E do</i>`}</div>`);
    document.body.append(card, duo, coach); if (location.search.includes("trials") || qs.has("nostart")) { card.remove(); }
    card.addEventListener("click", async e => { const b = e.target.closest("button"); if (!b) return; const a = b.dataset.a; if (a === "go") begin(); if (a === "two") invite(); if (a === "who" && C.ready()) emit("who-open"); if (a === "send") { const r = await N.share(); b.textContent = r === "copied" ? "Link copied" : r === "sent" ? "Sent · send again" : "Send the link"; } });
    duo.addEventListener("click", async () => { if (N.live) return; const r = await N.share(); if (r === "copied") { duo.textContent = "Link copied"; setTimeout(setStatus, 1500); } });
    const t = setInterval(() => { if (!C.ready()) return; clearInterval(t); const b = card.querySelector('[data-a="go"]'); if (b) { b.disabled = false; b.textContent = guest ? C.join : "Play"; } }, 200);
    setStatus(); if (code) open(); }
  N.cardShow = on => { if (card && card.isConnected) card.style.display = on ? "" : "none"; };
  N.invite = () => { if (!card || !card.isConnected) { card = $(`<div id="start" role="dialog"><div class="in"></div></div>`); document.body.append(card); card.addEventListener("click", async e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.a === "go") { card.classList.add("gone"); setTimeout(() => card.remove(), 600); } if (b.dataset.a === "send") { const r = await N.share(); b.textContent = r === "copied" ? "Link copied" : "Sent · send again"; } }); } invite(); card.querySelector('[data-a="go"]').textContent = "Back to the game"; };
  if (document.body) ui(); else addEventListener("DOMContentLoaded", ui);
  return N;
})();
