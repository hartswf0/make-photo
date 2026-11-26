/* The soundtrack: a small radio any edition can carry. It streams albums from the MOTO halls (hartswf0.github.io/moto), listed
   in soundtrack/albums.json: for each album its name, its hall page and its tracks.

     <script src="../soundtrack/soundtrack.js" data-album="glass" data-albums="glass,yegelle,deepsea"></script>

   data-album is the album it opens on; data-albums is the set the album button steps through (default: all of them).
   It starts on the first touch or key, since a browser will not play before one. A track that will not load is skipped.
   The last album and track are remembered for each edition. window.Soundtrack = { next, prev, toggle, album, audio }. */
(() => {
  "use strict";
  const me = document.currentScript, here = me.src.replace(/[^/]*$/, ""), want = me.dataset.album || "", only = (me.dataset.albums || "").split(",").filter(Boolean), KEY = "soundtrack:" + location.pathname;
  const css = `#st{position:fixed;left:6vw;bottom:calc(58px + env(safe-area-inset-bottom,0px));z-index:6;display:flex;align-items:center;gap:6px;max-width:min(88vw,460px);padding:5px 6px 5px 10px;background:rgba(18,14,12,.6);border:1px solid rgba(243,237,226,.28);color:#f3ede2;font:11px/1.25 ui-monospace,Menlo,Consolas,monospace}
  #st .w{min-width:0;flex:1;display:grid}#st .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:italic 13px/1.3 Georgia,serif}#st a{color:rgba(243,237,226,.7);text-decoration:none;letter-spacing:.1em;text-transform:uppercase;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #st button{all:unset;cursor:pointer;min-width:30px;height:30px;text-align:center;border:1px solid rgba(243,237,226,.28);font:600 12px/30px ui-monospace,Menlo,monospace;color:#f3ede2}#st button:focus-visible{outline:2px solid #f2a83a}
  body.touch #st{bottom:auto;top:calc(128px + env(safe-area-inset-top,0px))}body.cinema #st{display:none}`;
  const el = document.createElement("div"); el.id = "st"; el.setAttribute("role", "group"); el.setAttribute("aria-label", "Soundtrack");
  el.innerHTML = `<div class="w"><span class="t">Soundtrack</span><a target="_blank" rel="noopener">loading…</a></div><button data-a="prev" aria-label="Previous track">‹</button><button data-a="toggle" aria-label="Play or pause">▶</button><button data-a="next" aria-label="Next track">›</button><button data-a="album" aria-label="Next album" title="Next album">♪</button>`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); (document.body || document.documentElement).appendChild(el);
  const audio = new Audio(); audio.preload = "none"; audio.volume = .55; let base = "", albums = [], ai = 0, ti = 0, started = false, fails = 0;
  const T = el.querySelector(".t"), A = el.querySelector("a"), P = el.querySelector('[data-a="toggle"]');
  const show = () => { const a = albums[ai]; if (!a) return; const t = a.tracks[ti], name = t.t.replace(/^Someone Wrote My First Winter - /, ""); T.textContent = name; T.title = name; A.textContent = `${a.label} · ${ti + 1}/${a.tracks.length} ↗`; A.href = a.page; P.textContent = audio.paused ? "▶" : "❙❙"; try { localStorage.setItem(KEY, JSON.stringify({ k: a.key, i: ti })); } catch (e) { } };
  const load = play => { const a = albums[ai]; if (!a) return; audio.src = base + a.tracks[ti].u; if (play) audio.play().catch(() => { }); show(); };
  const step = d => { const a = albums[ai]; ti = (ti + d + a.tracks.length) % a.tracks.length; load(started); };
  const api = { audio, next: () => step(1), prev: () => step(-1), toggle() { started = true; if (!audio.src) load(true); else if (audio.paused) audio.play().catch(() => { }); else audio.pause(); }, album() { ai = (ai + 1) % albums.length; ti = 0; load(started); } };
  audio.addEventListener("ended", () => step(1)); audio.addEventListener("play", () => { fails = 0; show(); }); audio.addEventListener("pause", show);
  audio.addEventListener("error", () => { if (started && ++fails < 4) step(1); });
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { e.stopPropagation(); api[b.dataset.a](); } });
  const first = () => { if (started || !albums.length) return; started = true; load(true); removeEventListener("pointerdown", first, true); removeEventListener("keydown", first, true); };
  addEventListener("pointerdown", e => { if (!el.contains(e.target)) first(); }, true); addEventListener("keydown", first, true);
  fetch(here + "albums.json").then(r => r.json()).then(d => { base = d.base; albums = only.length ? only.map(k => d.albums.find(a => a.key === k)).filter(Boolean) : d.albums; if (!albums.length) albums = d.albums;
    let k = want, i = 0; try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) { k = s.k; i = s.i; } } catch (e) { }
    ai = Math.max(0, albums.findIndex(a => a.key === k)); if (albums[ai].key !== k) ai = Math.max(0, albums.findIndex(a => a.key === want)); ti = albums[ai].key === k ? Math.min(i, albums[ai].tracks.length - 1) : 0; show(); }).catch(() => { A.textContent = "soundtrack unavailable"; });
  window.Soundtrack = api;
})();
