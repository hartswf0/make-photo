/* The soundtrack: a small radio any edition can carry. It streams albums from the MOTO halls (hartswf0.github.io/moto), listed in
   soundtrack/albums.json (every hall: name, hall page, tracks), and can also hand over to a score the edition plays itself.

     <script src="../soundtrack/soundtrack.js" data-album="firstwintera" data-score="MesaScore"></script>

   data-album  the album it opens on.
   data-score  the name of a global with { start(), mute(bool) }: the edition's own score. It is then the first choice, and the default.
   A picker chooses the source (the score, or any hall); then pause and next track. It starts on the first touch or key, since a
   browser will not play before one. A track that will not load is skipped. The last choice is remembered for each edition.
   window.Soundtrack = { next, toggle, pick(key), audio }. */
(() => {
  "use strict";
  const me = document.currentScript, here = me.src.replace(/[^/]*$/, ""), want = me.dataset.album || "", scoreName = me.dataset.score || "", KEY = "soundtrack2:" + location.pathname;
  const css = `#st{position:fixed;left:6vw;bottom:calc(58px + env(safe-area-inset-bottom,0px));z-index:6;display:flex;align-items:center;gap:5px;max-width:min(88vw,430px);padding:4px 5px 4px 8px;background:rgba(18,14,12,.55);border:1px solid rgba(243,237,226,.25);color:#f3ede2;font:11px/1.25 ui-monospace,Menlo,Consolas,monospace}
  #st .w{min-width:0;flex:1;display:grid;gap:1px}#st .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:italic 12px/1.3 Georgia,serif}
  #st select{all:unset;max-width:100%;color:rgba(243,237,226,.8);letter-spacing:.08em;text-transform:uppercase;font:600 9px/1.5 ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}#st select option{color:#111;text-transform:none}
  #st button{all:unset;cursor:pointer;min-width:30px;height:30px;text-align:center;border:1px solid rgba(243,237,226,.25);font:600 12px/30px ui-monospace,Menlo,monospace;color:#f3ede2}#st button:focus-visible,#st select:focus-visible{outline:2px solid #f2a83a}
  body.touch #st{bottom:auto;top:calc(84px + env(safe-area-inset-top,0px));left:5vw;max-width:56vw;padding:2px 3px 2px 6px;background:rgba(18,14,12,.4)}body.touch #st .t{font-size:11px}body.touch #st button{min-width:26px;height:26px;line-height:26px}body.cinema #st{display:none}
  @media (orientation:landscape){body.touch #st{top:72px;left:max(4vw,env(safe-area-inset-left,0px));max-width:34vw}}`;
  const el = document.createElement("div"); el.id = "st"; el.setAttribute("role", "group"); el.setAttribute("aria-label", "Music");
  el.innerHTML = `<div class="w"><select aria-label="Music source"><option>♪ loading…</option></select><span class="t"></span></div><button data-a="toggle" aria-label="Play or pause">▶</button><button data-a="next" aria-label="Next track">›</button>`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); (document.body || document.documentElement).appendChild(el);
  const audio = new Audio(); audio.preload = "none"; audio.volume = .55; let base = "", albums = [], cur = scoreName ? "score" : want, ti = 0, started = false, fails = 0, off = false;
  const T = el.querySelector(".t"), SEL = el.querySelector("select"), P = el.querySelector('[data-a="toggle"]'), score = () => scoreName && window[scoreName], album = () => albums.find(a => a.key === cur);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ k: cur, i: ti })); } catch (e) { } };
  const show = () => { const a = album(); T.textContent = cur === "score" ? "written for this world; it follows the fight" : a ? `${ti + 1}/${a.tracks.length} · ${a.tracks[ti].t.replace(/^Someone Wrote My First Winter - /, "")}` : ""; P.textContent = (cur === "score" ? off : audio.paused) ? "▶" : "❙❙"; SEL.value = cur; };
  const play = () => { const s = score(); if (cur === "score") { audio.pause(); if (s) { s.start(); s.mute(off); } } else { if (s) s.mute(true); const a = album(); if (a) { audio.src = base + a.tracks[ti].u; if (!off) audio.play().catch(() => { }); } } show(); save(); };
  const api = { audio, next() { const a = album(); if (!a) return; ti = (ti + 1) % a.tracks.length; play(); }, toggle() { started = true; off = !off; if (cur === "score") { const s = score(); if (s) { s.start(); s.mute(off); } } else if (off) audio.pause(); else if (audio.src) audio.play().catch(() => { }); else play(); show(); }, pick(k) { cur = k; ti = 0; off = false; started = true; play(); } };
  audio.addEventListener("ended", () => api.next()); audio.addEventListener("play", () => { fails = 0; show(); }); audio.addEventListener("pause", show); audio.addEventListener("error", () => { if (started && cur !== "score" && ++fails < 4) api.next(); });
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (b) api[b.dataset.a](); }); SEL.addEventListener("change", () => api.pick(SEL.value)); for (const ev of ["pointerdown", "keydown"]) el.addEventListener(ev, e => e.stopPropagation());
  const first = () => { if (started) return; started = true; play(); }; addEventListener("pointerdown", e => { if (!el.contains(e.target)) first(); }, true); addEventListener("keydown", e => { if (!el.contains(e.target)) first(); }, true);
  fetch(here + "albums.json").then(r => r.json()).then(d => { base = d.base; albums = d.albums; SEL.innerHTML = (scoreName ? `<option value="score">♪ The score</option>` : "") + albums.map(a => `<option value="${a.key}">♪ ${a.label.replace(/</g, "")}</option>`).join("");
    try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && (s.k === "score" ? scoreName : albums.some(a => a.key === s.k))) { cur = s.k; ti = s.i || 0; } } catch (e) { }
    if (cur !== "score" && !album()) cur = albums.some(a => a.key === want) ? want : albums[0].key; const a = album(); if (a) ti = Math.min(ti, a.tracks.length - 1); show(); if (started) play(); }).catch(() => { T.textContent = "music unavailable"; });
  window.Soundtrack = api;
})();
