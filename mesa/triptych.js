/* MESA CHIP: the triptych behind the ziggurat. Three windows of leaded glass, painted in code on canvases, after the way Afewerk
   Tekle built The Total Liberation of Africa (Africa Hall, Addis Ababa, 1961): jewel colour, figures cut from big planes, and one
   heavy black line that sweeps through everything. The drawing here is this level's own:

     THEN                 it was dust        a herder and his zebu under a red sky, a pole whose wire carries nothing
     THEN AND NOW         it is data         Uncle Mesa lifts the torch, Anta's open hand beside him, the town behind
     NOW AND THE FUTURE   and it remembers   a child holds the chip up to a rising sun; the horned bike rides the grid toward it

   Every shard in all three windows is cut on rings around the torch flame, so the triptych is one burst of light.

   The glass tracks:
     - the sun. Its colour is thrown through the windows onto the sand, the ziggurat and anyone standing there, and the pool of
       colour swings and stretches with the time of day (1-6);
     - Uncle Mesa. Every painted eye follows him, and a glow walks behind the glass beside him;
     - the torch. Light leaves the flame in slow rings and crosses all three windows.

   MesaTriptych.paint(kind) -> { canvas, eyes, focus }  (kind: "then" | "now" | "future")
   MesaTriptych.create({ T, scene, heightAt, zone }) -> { group, panels, colliders, patch(material), step(dt, t, who, sun, k), lightAt(x, y, z), windowPoint(out) } */
(() => {
  "use strict";
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const frac = x => x - Math.floor(x), hash = (a, b = 0) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  const LEAD = "#15100c", mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  /* ---------- drawing ---------- */
  function trace(q, pts, close, curve) { q.beginPath(); const n = pts.length;
    if (!curve) { pts.forEach((p, i) => i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1])); if (close) q.closePath(); return; }
    if (close) { q.moveTo(...mid(pts[n - 1], pts[0])); for (let i = 0; i < n; i++) q.quadraticCurveTo(pts[i][0], pts[i][1], ...mid(pts[i], pts[(i + 1) % n])); q.closePath(); }
    else { q.moveTo(...pts[0]); for (let i = 1; i < n - 1; i++) q.quadraticCurveTo(pts[i][0], pts[i][1], ...(i === n - 2 ? pts[n - 1] : mid(pts[i], pts[i + 1]))); if (n === 2) q.lineTo(...pts[1]); } }
  /* lead drawn with a broad nib held at 40 degrees: thick across the nib, thin along it, as a calligrapher's line is */
  function nib(q, draw, w) { q.strokeStyle = LEAD; q.lineJoin = q.lineCap = "round"; q.lineWidth = Math.max(1.5, w * .4); const n = Math.max(1, Math.round(w * .5));
    for (let k = -n; k <= n; k++) { q.save(); q.translate(k * .6, -k * .5); draw(); q.stroke(); q.restore(); } }
  /* a sheet of glass before it is cut: flat pieces of colour, each remembering its edge so the lead can follow it */
  function sheet(W, H) { const c = document.createElement("canvas"); c.width = W; c.height = H; const q = c.getContext("2d"), leads = [];
    const S = { c, q, W, H,
      piece(pts, fill, o = {}) { trace(q, pts, !o.open, o.curve); q.fillStyle = fill; q.fill(); if (o.lead !== 0) leads.push({ pts, close: !o.open, curve: o.curve, w: o.lead || 6 }); return S; },
      line(pts, w = 6, curve = true) { leads.push({ pts, close: false, curve, w }); return S; },
      disc(x, y, r, fill, lead) { q.beginPath(); q.arc(x, y, r, 0, TAU); q.fillStyle = fill; q.fill(); if (lead !== 0) leads.push({ arc: [x, y, r], w: lead || 6 }); return S; },
      lg(x0, y0, x1, y1, stops) { const g = q.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, col]) => g.addColorStop(t, col)); return g; },
      rg(x, y, r, stops) { const g = q.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([t, col]) => g.addColorStop(t, col)); return g; },
      cut(o) { shardify(c, o); return S; },
      onto(Q) { Q.drawImage(c, 0, 0); for (const l of leads) nib(Q, () => { if (l.arc) { Q.beginPath(); Q.arc(l.arc[0], l.arc[1], l.arc[2], 0, TAU); } else trace(Q, l.pts, l.close, l.curve); }, l.w); return S; } };
    return S; }

  /* cutting the sheet: jittered cells on rings around a focus, so every piece points at the light. Each cell keeps the drawing's
     colour and takes its own tone, as hand-blown glass does; lead runs where two cells meet. */
  function shardify(c, o) { const q = c.getContext("2d"), W = c.width, H = c.height, im = q.getImageData(0, 0, W, H), d = im.data, { fx, fy, ring, wid } = o, swirl = o.swirl || 0, seed = o.seed || 1, vary = o.vary ?? .18, lw = o.lead ?? 1.6;
    const maxR = Math.hypot(Math.max(fx, W - fx), Math.max(fy, H - fy)) + ring * 2, J = Math.ceil(maxR / ring) + 2, rings = [];
    for (let j = 0; j < J; j++) { const N = Math.max(5, Math.round(TAU * (j + .5) * ring / wid)), a = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) { const rr = (j + .18 + .64 * hash(i * 3.1 + seed, j * 7.3)) * ring, th = (i + .12 + .76 * hash(j * 5.7 + seed * 2, i * 1.3)) / N * TAU + j * swirl; a[i * 4] = fx + Math.cos(th) * rr; a[i * 4 + 1] = fy + Math.sin(th) * rr; a[i * 4 + 2] = hash(i + seed * 9, j * 2.7); a[i * 4 + 3] = hash(i * 1.7, j + seed * 5); } rings.push({ N, a }); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i4 = (y * W + x) * 4; if (d[i4 + 3] < 8) continue;
      const dx = x - fx, dy = y - fy, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx), j0 = Math.floor(r / ring); let b1 = 1e12, b2 = 1e12, s1 = 0, s2 = 0;
      for (let dj = -1; dj <= 1; dj++) { const j = j0 + dj; if (j < 0 || j >= J) continue; const R = rings[j], N = R.N, i0 = Math.floor(frac((th - j * swirl) / TAU) * N);
        for (let di = -1; di <= 1; di++) { const k = ((i0 + di) % N + N) % N * 4, ex = x - R.a[k], ey = y - R.a[k + 1], e = ex * ex + ey * ey; if (e < b1) { b2 = b1; b1 = e; s1 = R.a[k + 2]; s2 = R.a[k + 3]; } else if (e < b2) b2 = e; } }
      if (Math.sqrt(b2) - Math.sqrt(b1) < lw) { d[i4] = 21; d[i4 + 1] = 16; d[i4 + 2] = 12; continue; }
      let v = 1 - vary + 2 * vary * s1; if (s2 > .93) v *= 1.3; else if (s2 < .05) v *= .72; v *= .9 + .1 * hash(x >> 1, y >> 1); const warm = (s2 - .5) * vary * .9;
      d[i4] = Math.min(255, d[i4] * v * (1 + warm)); d[i4 + 1] = Math.min(255, d[i4 + 1] * v); d[i4 + 2] = Math.min(255, d[i4 + 2] * v * (1 - warm)); }
    q.putImageData(im, 0, 0); }

  /* ---------- the figures: frontal, long-faced, cut from planes, their eyes left open for the glass to fill ---------- */
  const SKIN = { deep: ["#472a19", "#6c4226", "#2c190f", "#8e5c34"], elder: ["#41281a", "#63402a", "#28170e", "#855a38"], umber: ["#5a3520", "#7d4e2c", "#38200f", "#a06a3c"], dusk: ["#3a2216", "#57341f", "#22130b", "#74482a"] };
  function face(q, cx, cy, s, o, eyes) { const sk = o.skin || SKIN.deep, X = x => cx + x * s, Y = y => cy + y * s, pt = a => a.map(([x, y]) => [X(x), Y(y)]), lw = Math.max(2, s * .018);
    const f = (pts, fill, curve, w) => { trace(q, pt(pts), true, curve); q.fillStyle = fill; q.fill(); if (w !== 0) nib(q, () => trace(q, pt(pts), true, curve), w || lw * 1.1); };
    const ln = (pts, w, curve = true) => nib(q, () => trace(q, pt(pts), false, curve), w || lw);
    f([[-.15, .36], [.15, .36], [.21, .8], [-.21, .8]], sk[2], false); f([[-.15, .36], [0, .52], [.02, .8], [-.21, .8]], sk[0], false, 0);   /* the neck */
    if (o.hair === "afro") f([[-.5, -.2], [-.44, -.56], [-.2, -.74], [.2, -.74], [.44, -.56], [.5, -.2], [.3, .0], [-.3, .0]], "#1b130f", true, lw * 1.6);
    if (o.hair === "crop") f([[-.37, -.16], [-.36, -.46], [-.14, -.56], [.14, -.56], [.36, -.46], [.37, -.16]], "#18110d", true, lw * 1.6);
    f([[-.3, -.3], [0, -.37], [.3, -.3], [.34, .04], [.22, .36], [0, .5], [-.22, .36], [-.34, .04]], sk[0], false, lw * 1.8);   /* the shield of the face */
    f([[.05, -.36], [.3, -.3], [.34, .04], [.22, .36], [.04, .49], [.11, .2], [.07, -.1]], sk[2], false);   /* its shadow side */
    f([[-.25, -.27], [0, -.335], [.03, -.15], [-.2, -.13]], sk[1], false);   /* brow */
    f([[-.315, .04], [-.12, .07], [-.1, .26], [-.21, .33]], sk[1], false);   /* cheek */
    f([[-.035, -.13], [.035, -.13], [.06, .17], [.1, .215], [0, .25], [-.1, .215], [-.06, .17]], sk[3], false);   /* the long nose */
    if (o.beard) { f([[-.33, .06], [-.2, .27], [-.1, .24], [0, .28], [.1, .24], [.2, .27], [.33, .06], [.3, .52], [.1, 1.0], [0, 1.08], [-.1, 1.0], [-.3, .52]], "#f3f0e7", false, lw * 1.8);
      f([[.06, .29], [.2, .27], [.33, .06], [.3, .52], [.1, 1.0], [.02, 1.06]], "#cfd9de", false, 0); for (const k of [-.2, -.1, 0, .1, .2]) ln([[k, .42], [k * .8, .7], [k * .35, .98]], lw * .7); }
    f([[-.11, .325], [-.03, .3], [0, .31], [.03, .3], [.11, .325], [0, .352]], "#24120c", false, 0); f([[-.1, .335], [.1, .335], [.05, .395], [-.05, .395]], o.beard ? "#6a3324" : "#7c3a2a", false, lw * .7);   /* the mouth */
    for (const sx of [-1, 1]) { const ex = sx * .158, ey = -.035; q.beginPath(); q.moveTo(X(ex - .105), Y(ey + .01)); q.quadraticCurveTo(X(ex), Y(ey - .1), X(ex + .105), Y(ey + .01)); q.quadraticCurveTo(X(ex), Y(ey + .075), X(ex - .105), Y(ey + .01)); q.closePath();
      q.fillStyle = "#f7f2e4"; q.fill(); q.strokeStyle = LEAD; q.lineWidth = lw * 1.3; q.stroke(); ln([[ex - .13, ey - .1], [ex, ey - .15], [ex + .13, ey - .11]], lw * 2.2);
      eyes.push({ x: X(ex), y: Y(ey - .005), r: s * .036, rx: s * .05, ry: s * .02 }); }
    if (o.glasses) { for (const sx of [-1, 1]) { q.beginPath(); q.arc(X(sx * .158), Y(-.035), s * .118, 0, TAU); q.fillStyle = "rgba(244,196,60,.3)"; q.fill(); q.strokeStyle = LEAD; q.lineWidth = s * .05; q.stroke(); q.strokeStyle = "#f8f5ec"; q.lineWidth = s * .03; q.stroke(); }
      q.beginPath(); q.moveTo(X(-.045), Y(-.06)); q.quadraticCurveTo(X(0), Y(-.09), X(.045), Y(-.06)); q.strokeStyle = "#f8f5ec"; q.lineWidth = s * .026; q.stroke(); }
    if (o.hair === "hat") { const h = o.hat || "#ece2c8", hd = o.hatDark || "#c9bb98"; f([[-.27, -.3], [-.23, -.7], [-.08, -.76], [.08, -.72], [.23, -.76], [.27, -.3]], h, false, lw * 1.8); f([[.06, -.72], [.23, -.76], [.27, -.3], [.1, -.3]], hd, false, 0);
      f([[-.27, -.4], [.27, -.4], [.27, -.33], [-.27, -.33]], o.band || "#2a4ab8", false, lw * .8); f([[-.7, -.3], [-.3, -.36], [.3, -.36], [.7, -.3], [.36, -.2], [-.36, -.2]], h, true, lw * 1.8); }
    if (o.hair === "wrap") { const w = o.wrap || "#f2c81e", w2 = o.wrap2 || "#d8342c"; f([[-.35, -.18], [-.4, -.5], [-.14, -.76], [.2, -.74], [.42, -.46], [.35, -.18], [0, -.3]], w, false, lw * 1.8);
      f([[-.38, -.36], [0, -.5], [.4, -.38], [.41, -.46], [0, -.6], [-.4, -.46]], w2, false, lw * .8); f([[.2, -.74], [.42, -.46], [.35, -.18], [.16, -.26]], "rgba(20,12,8,.28)", false, 0); } }
  function hand(q, x, y, s, rot, sk, open) { q.save(); q.translate(x, y); q.rotate(rot); const lw = Math.max(2, s * .05), f = (pts, fill, w) => { trace(q, pts.map(([a, b]) => [a * s, b * s]), true, false); q.fillStyle = fill; q.fill(); if (w !== 0) nib(q, () => trace(q, pts.map(([a, b]) => [a * s, b * s]), true, false), w || lw); };
    if (open) { f([[-.34, .5], [.34, .5], [.4, -.05], [-.4, -.05]], sk[0]); f([[.0, .5], [.34, .5], [.4, -.05], [.12, -.05]], sk[2], 0);
      [[-.39, -.52, .19], [-.19, -.68, .19], [.01, -.72, .19], [.21, -.6, .18]].forEach(([fx, top, w], i) => f([[fx, -.05], [fx + w, -.05], [fx + w - .02, top], [fx + .03, top - .03]], i > 1 ? sk[0] : sk[1]));
      f([[-.4, .3], [-.4, .0], [-.66, -.22], [-.74, -.12], [-.56, .18]], sk[1]); }
    else { f([[-.42, -.4], [.42, -.4], [.46, .4], [-.46, .4]], sk[0]); f([[.05, -.4], [.42, -.4], [.46, .4], [.1, .4]], sk[2], 0); for (const k of [-.2, .02, .24]) nib(q, () => trace(q, [[-.44 * s, k * s], [.44 * s, k * s]], false, false), lw * .7); f([[-.5, -.46], [-.2, -.46], [-.16, .0], [-.52, .0]], sk[1]); }
    q.restore(); }
  function lettering(q, W, H, band, title, verse, size, back) { const y0 = H - band, B = sheet(W, H); B.q.fillStyle = B.lg(0, y0, 0, H, back); B.q.fillRect(0, y0, W, band); B.cut({ fx: W / 2, fy: H + 900, ring: 46, wid: 58, seed: 7, vary: .22, lead: 1.5 }); q.drawImage(B.c, 0, 0);
    q.textAlign = "center"; try { q.letterSpacing = Math.round(size * .14) + "px"; } catch (e) { } q.font = `700 ${size}px Georgia, "Times New Roman", serif`; q.lineJoin = "round"; q.lineWidth = size * .22; q.strokeStyle = LEAD; q.strokeText(title, W / 2, y0 + band * .46); q.fillStyle = "#f6cf3e"; q.fillText(title, W / 2, y0 + band * .46);
    try { q.letterSpacing = Math.round(size * .1) + "px"; } catch (e) { } q.font = `italic 400 ${Math.max(31, Math.round(size * .6))}px Georgia, "Times New Roman", serif`; q.lineWidth = 7; q.strokeText(verse, W / 2, y0 + band * .83); q.fillStyle = "#c4f6f6"; q.fillText(verse, W / 2, y0 + band * .83); try { q.letterSpacing = "0px"; } catch (e) { }
    nib(q, () => trace(q, [[0, y0], [W, y0]], false, false), 8); }
  /* the iron that holds a window this size: saddle bars across, standing bars up, a frame */
  function iron(q, W, H, cols, rows) { q.strokeStyle = "#0d0a08"; q.lineWidth = 5; for (let i = 1; i < cols; i++) { q.beginPath(); q.moveTo(i * W / cols, 0); q.lineTo(i * W / cols, H); q.stroke(); } for (let j = 1; j < rows; j++) { q.beginPath(); q.moveTo(0, j * H / rows); q.lineTo(W, j * H / rows); q.stroke(); } q.lineWidth = 22; q.strokeRect(0, 0, W, H); }
  const sweep = (q, lines) => { for (const [pts, w] of lines) nib(q, () => trace(q, pts, false, true), w); };

  /* ---------- THEN AND NOW: it is data ---------- */
  function paintNow() { const W = 1024, H = 1664, F = [512, 300], c = document.createElement("canvas"); c.width = W; c.height = H; const q = c.getContext("2d"), eyes = [];
    const A = sheet(W, H); A.q.fillStyle = A.rg(F[0], F[1], 1300, [[0, "#fff8d0"], [.07, "#ffe45e"], [.22, "#f8bc28"], [.46, "#ee7c1e"], [.74, "#cf3a20"], [1, "#7c1622"]]); A.q.fillRect(0, 0, W, H);
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + .1, b = a + .075; A.piece([[F[0] + Math.cos(a) * 80, F[1] + Math.sin(a) * 80], [F[0] + Math.cos(a) * 1500, F[1] + Math.sin(a) * 1500], [F[0] + Math.cos(b) * 1500, F[1] + Math.sin(b) * 1500], [F[0] + Math.cos(b) * 80, F[1] + Math.sin(b) * 80]], k % 2 ? "rgba(255,246,196,.5)" : "rgba(255,222,110,.42)", { lead: 0 }); }
    /* blue wings in the upper sky, turning round the flame */
    [[-2.75, 470, 150, "#2a4ab8"], [-2.2, 400, 120, "#1f7fb8"], [-1.05, 380, 120, "#2a4ab8"], [-.45, 470, 150, "#1f6fb0"], [-2.5, 300, 80, "#2fb8c8"], [-.72, 300, 80, "#2fc0c8"], [-1.62, 250, 70, "#eaf6f2"], [-3.05, 610, 150, "#253a98"], [-.1, 610, 150, "#253a98"]].forEach(([a, R, L, col], i) => { const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6, aa = a + (t - .5) * L / R * 2; pts.push([F[0] + Math.cos(aa) * (R + Math.sin(t * Math.PI) * 46), F[1] + Math.sin(aa) * (R + Math.sin(t * Math.PI) * 46)]); }
      for (let k = 6; k >= 0; k--) { const t = k / 6, aa = a + (t - .5) * L / R * 2; pts.push([F[0] + Math.cos(aa) * (R - Math.sin(t * Math.PI) * 30), F[1] + Math.sin(aa) * (R - Math.sin(t * Math.PI) * 30)]); } A.piece(pts, col, { lead: 5 + i % 2 * 2 }); });
    /* the mesas on the horizon, and the dunes */
    A.piece([[0, 830], [90, 830], [112, 768], [262, 768], [286, 838], [420, 838], [442, 796], [560, 796], [586, 846], [760, 846], [782, 776], [932, 776], [952, 828], [1024, 828], [1024, 960], [0, 960]], "#5b3a92", { lead: 7 });
    A.piece([[0, 912], [160, 912], [192, 868], [332, 868], [352, 928], [640, 928], [672, 878], [862, 878], [886, 918], [1024, 918], [1024, 1010], [0, 1010]], "#27358f", { lead: 7 });
    A.piece([[0, 1000], [1024, 1000], [1024, 1664], [0, 1664]], A.lg(0, 1000, 0, 1600, [[0, "#e6a436"], [.5, "#d2702a"], [1, "#a23a22"]]), { lead: 0 });
    A.piece([[0, 1090], [240, 1030], [520, 1100], [820, 1040], [1024, 1100], [1024, 1200], [700, 1150], [380, 1210], [0, 1170]], "#f0bc4a", { curve: true, lead: 5 }); A.piece([[0, 1290], [300, 1240], [640, 1320], [1024, 1260], [1024, 1400], [600, 1420], [0, 1380]], "#c2562a", { curve: true, lead: 5 });
    A.cut({ fx: F[0], fy: F[1], ring: 56, wid: 36, swirl: .05, seed: 3, vary: .2 }).onto(q);
    /* cloth: the town behind them, Anta, the elder in white */
    const B = sheet(W, H);
    [[0, 150, "#d8342c", "#8f1c22"], [140, 300, "#2a9a5a", "#16683c"], [770, 905, "#2a4ab8", "#1b2f7c"], [890, 1024, "#f2a83a", "#b86a1e"]].forEach(([x0, x1, col, dk]) => { B.piece([[x0 - 8, 900], [x1 + 8, 900], [x1 + 24, 1580], [x0 - 24, 1580]], col, { lead: 7 }); B.piece([[(x0 + x1) / 2 + 10, 900], [x1 + 8, 900], [x1 + 24, 1580], [(x0 + x1) / 2 + 30, 1580]], dk, { lead: 0 }); });
    B.piece([[578, 946], [842, 946], [872, 1320], [552, 1320]], "#6f8040", { lead: 8 }); B.piece([[730, 946], [842, 946], [872, 1320], [760, 1320]], "#4c5a2a", { lead: 0 });   /* Anta's olive shirt */
    B.piece([[552, 1318], [872, 1318], [892, 1580], [536, 1580]], "#e0a628", { lead: 8 }); B.piece([[700, 1318], [724, 1318], [730, 1580], [706, 1580]], "#a8741a", { lead: 0 });   /* mustard trousers */
    B.piece([[792, 946], [826, 946], [640, 1300], [606, 1290]], "#b88040", { lead: 5 }); B.piece([[560, 1262], [676, 1262], [684, 1392], [552, 1392]], "#9a6a36", { lead: 6 }); B.piece([[560, 1262], [676, 1262], [680, 1304], [556, 1304]], "#7d5228", { lead: 4 });   /* the satchel */
    B.piece([[566, 1010], [640, 1000], [668, 1150], [654, 1206], [590, 1206]], "#7d8f48", { lead: 7 });   /* her raised forearm */
    B.piece([[230, 806], [565, 806], [628, 1580], [168, 1580]], "#f6f1e3", { lead: 9 }); B.piece([[230, 806], [300, 806], [252, 1580], [168, 1580]], "#cfdfe6", { lead: 0 }); B.piece([[470, 806], [565, 806], [628, 1580], [540, 1580]], "#dbe6e4", { lead: 0 });   /* the white shirt */
    B.piece([[262, 806], [348, 806], [424, 1580], [322, 1580]], "#f2c81e", { lead: 6 });   /* the woven band over his shoulder */
    B.piece([[486, 822], [590, 842], [560, 486], [486, 478]], "#fbf7ea", { lead: 8 }); B.piece([[540, 832], [590, 842], [560, 486], [530, 484]], "#d3e0e4", { lead: 0 });   /* the arm that lifts the torch */
    B.cut({ fx: W / 2, fy: -2600, ring: 118, wid: 30, seed: 11, vary: .15, lead: 1.4 }).onto(q);
    for (let k = 0; k < 9; k++) { const t = (k + .5) / 9, x = lerp(305, 373, t), y = lerp(830, 1560, t), s = 26; trace(q, [[x, y - s * 1.5], [x + s, y], [x, y + s * 1.5], [x - s, y]], true, false); q.fillStyle = ["#2a4ab8", "#d8342c", "#2a9a5a"][k % 3]; q.fill(); nib(q, () => trace(q, [[x, y - s * 1.5], [x + s, y], [x, y + s * 1.5], [x - s, y]], true, false), 3); }
    q.fillStyle = "#f2d04a"; q.fillRect(436, 1000, 92, 30); q.fillStyle = "#2a4ab8"; q.fillRect(436, 1030, 92, 30); q.textAlign = "center"; q.font = "700 21px Georgia, serif"; q.fillStyle = LEAD; q.fillText("MESA", 482, 1023); q.fillStyle = "#f6efe0"; q.fillText("CHIP", 482, 1053); nib(q, () => { q.beginPath(); q.rect(436, 1000, 92, 60); }, 4);
    sweep(q, [[[[0, 1480], [220, 1180], [120, 880], [0, 700]], 9], [[[1024, 1500], [900, 1240], [960, 1000], [1024, 820]], 9], [[[0, 330], [200, 420], [330, 560]], 7], [[[1024, 300], [860, 430], [800, 620]], 7], [[[150, 0], [330, 150], [470, 250]], 6], [[[880, 0], [700, 140], [556, 250]], 6], [[[60, 640], [110, 360], [300, 150], [512, 80], [724, 150], [914, 360], [964, 640]], 7]]);
    /* the torch: a brass bowl on a staff, and in the flame a chip of blue glass */
    const pc = (pts, fill, w, curve) => { trace(q, pts, true, curve); q.fillStyle = fill; q.fill(); if (w) nib(q, () => trace(q, pts, true, curve), w); };
    pc([[505, 470], [539, 470], [534, 390], [510, 390]], "#8a5a2a", 5); pc([[466, 356], [578, 356], [554, 398], [490, 398]], "#f2c84a", 6); pc([[522, 356], [578, 356], [554, 398], [528, 398]], "#c08a22", 0);
    pc([[512, 150], [566, 250], [580, 318], [546, 358], [478, 358], [444, 318], [458, 250]], "#f2601e", 7, true); pc([[512, 200], [548, 276], [552, 330], [526, 358], [498, 358], [472, 330], [476, 276]], "#ffd23a", 4, true); pc([[512, 246], [534, 306], [526, 352], [498, 352], [490, 306]], "#fffbe6", 3, true);
    pc([[512, 296], [530, 316], [512, 336], [494, 316]], "#2fd0d8", 3);
    hand(q, 522, 478, 62, .05, SKIN.elder, false);
    [[95, 822, 150, { hair: "hat", hat: "#3a2c22", hatDark: "#241a14", band: "#d8342c", skin: SKIN.umber }], [228, 812, 150, { hair: "wrap", wrap: "#f2c81e", wrap2: "#2a9a5a", skin: SKIN.dusk }], [842, 818, 150, { hair: "wrap", wrap: "#e85aa8", wrap2: "#f6efe0", skin: SKIN.umber }], [958, 808, 150, { hair: "hat", hat: "#8a5a34", hatDark: "#5e3a20", band: "#f2d04a", skin: SKIN.deep }]].forEach(([x, y, s, o]) => face(q, x, y, s, o, eyes));
    face(q, 712, 786, 232, { hair: "crop", skin: SKIN.deep }, eyes); hand(q, 612, 1010, 96, -.12, SKIN.deep, true);
    face(q, 398, 612, 262, { hair: "hat", hat: "#efe6cc", hatDark: "#cfc19c", band: "#2a4ab8", beard: true, glasses: true, skin: SKIN.elder }, eyes);
    lettering(q, W, H, 116, "THEN AND NOW", "it is data", 58, [[0, "#1b2a6a"], [1, "#0f1a44"]]); iron(q, W, H, 4, 8);
    return { canvas: c, eyes, focus: F, W, H }; }

  /* ---------- THEN: it was dust ---------- */
  function paintThen() { const W = 768, H = 1536, F = [1330, 119], c = document.createElement("canvas"); c.width = W; c.height = H; const q = c.getContext("2d"), eyes = [];
    const A = sheet(W, H); A.q.fillStyle = A.lg(0, 0, 0, 760, [[0, "#2a1238"], [.38, "#7a1626"], [.72, "#c8321e"], [1, "#ea7222"]]); A.q.fillRect(0, 0, W, H);
    A.piece([[0, 250], [240, 300], [520, 260], [768, 330], [768, 400], [500, 340], [230, 380], [0, 330]], "#5a163a", { curve: true, lead: 5 }); A.piece([[0, 440], [300, 480], [768, 430], [768, 500], [320, 540], [0, 500]], "#a82420", { curve: true, lead: 5 });
    A.disc(196, 612, 104, "#f08a26", 7).disc(196, 612, 62, "#ffc44a", 5);
    for (const [x, y, s] of [[440, 250, 86], [596, 164, 58], [300, 140, 46]]) A.piece([[x - s, y - s * .18], [x - s * .5, y - s * .42], [x, y], [x + s * .5, y - s * .42], [x + s, y - s * .18], [x + s * .46, y - s * .2], [x, y + s * .2], [x - s * .46, y - s * .2]], "#190f14", { lead: 4 });   /* vultures */
    A.piece([[0, 700], [70, 700], [96, 648], [252, 648], [272, 708], [430, 708], [456, 658], [602, 658], [626, 712], [768, 712], [768, 810], [0, 810]], "#3c1a4c", { lead: 7 });
    A.piece([[0, 772], [180, 772], [206, 740], [360, 740], [384, 786], [768, 786], [768, 850], [0, 850]], "#27102f", { lead: 6 });
    A.piece([[0, 840], [768, 840], [768, 1536], [0, 1536]], A.lg(0, 840, 0, 1460, [[0, "#c07a2e"], [.5, "#9c5024"], [1, "#6e3018"]]), { lead: 0 });
    A.piece([[0, 900], [260, 868], [520, 920], [768, 880], [768, 960], [500, 990], [0, 960]], "#d29a44", { curve: true, lead: 5 }); A.piece([[0, 1180], [300, 1130], [768, 1200], [768, 1300], [320, 1250], [0, 1290]], "#8a4420", { curve: true, lead: 5 });
    A.piece([[626, 420], [650, 420], [664, 860], [634, 860]], "#2a1a14", { lead: 5 }); A.piece([[584, 470], [694, 452], [696, 474], [586, 494]], "#2a1a14", { lead: 4 }); A.line([[590, 482], [470, 560], [380, 548]], 3).line([[690, 462], [740, 540], [768, 548]], 3);   /* the pole, and the wire that carries nothing */
    A.cut({ fx: F[0], fy: F[1], ring: 56, wid: 36, swirl: .05, seed: 3, vary: .22 }).onto(q);
    const B = sheet(W, H);
    B.piece([[486, 1040], [768, 1010], [768, 1470], [470, 1470]], "#7a2e1e", { lead: 8 }); B.piece([[520, 1040], [600, 960], [690, 1020]], "#5a2218", { curve: true, lead: 6 });   /* the zebu's body and hump */
    B.piece([[138, 946], [438, 910], [478, 1470], [100, 1470]], "#c89a4a", { lead: 9 }); B.piece([[330, 924], [438, 910], [478, 1470], [370, 1470]], "#8f6230", { lead: 0 }); B.piece([[138, 946], [438, 910], [446, 1004], [128, 1048]], "#6c7c8c", { lead: 6 }); B.piece([[128, 1048], [446, 1004], [448, 1034], [126, 1080]], "#d8342c", { lead: 4 });   /* the herder's shawl */
    B.cut({ fx: W / 2, fy: -2600, ring: 118, wid: 30, seed: 17, vary: .16, lead: 1.4 }).onto(q);
    sweep(q, [[[[0, 1420], [200, 1250], [140, 1100]], 8], [[[768, 560], [600, 600], [380, 700]], 6], [[[0, 80], [240, 170], [500, 110], [768, 180]], 6]]);
    /* the zebu, face on: the long horns the bike will carry */
    const pc = (pts, fill, w, curve) => { trace(q, pts, true, curve); q.fillStyle = fill; q.fill(); if (w) nib(q, () => trace(q, pts, true, curve), w); };
    for (const s of [-1, 1]) { const X = x => 588 + s * x, h = [[X(46), 880], [X(128), 820], [X(160), 700], [X(138), 590]]; q.lineCap = "round"; trace(q, h, false, true); q.strokeStyle = LEAD; q.lineWidth = 34; q.stroke(); q.strokeStyle = "#efe6d0"; q.lineWidth = 22; q.stroke(); trace(q, [h[2], h[3]], false, false); q.strokeStyle = "#cdbf9c"; q.lineWidth = 12; q.stroke();
      pc([[X(52), 900], [X(118), 884], [X(128), 916], [X(60), 934]], "#6a2a1a", 4); }
    pc([[530, 872], [646, 872], [634, 1040], [588, 1090], [542, 1040]], "#8a3a22", 7); pc([[592, 874], [646, 872], [634, 1040], [592, 1084]], "#5e2416", 0); pc([[560, 1036], [616, 1036], [606, 1078], [570, 1078]], "#2a1410", 4); pc([[588, 880], [606, 930], [588, 1000], [570, 930]], "#b05a34", 3);
    for (const s of [-1, 1]) { const ex = 588 + s * 36, ey = 930; q.beginPath(); q.ellipse(ex, ey, 11, 7, s * .35, 0, TAU); q.fillStyle = "#f7f2e4"; q.fill(); q.strokeStyle = LEAD; q.lineWidth = 3; q.stroke(); eyes.push({ x: ex, y: ey, r: 5, rx: 5, ry: 2.5 }); }
    nib(q, () => trace(q, [[92, 560], [118, 1000], [150, 1470]], false, true), 12); q.strokeStyle = "#4a2e1c"; q.lineWidth = 7; trace(q, [[92, 560], [118, 1000], [150, 1470]], false, true); q.stroke();   /* his staff */
    face(q, 292, 760, 214, { hair: "wrap", wrap: "#b8a078", wrap2: "#7a2e1e", skin: SKIN.dusk }, eyes); hand(q, 120, 1020, 70, .1, SKIN.dusk, false);
    lettering(q, W, H, 112, "THEN", "it was dust", 56, [[0, "#3a1420"], [1, "#1c0a12"]]); iron(q, W, H, 3, 8);
    return { canvas: c, eyes, focus: F, W, H }; }

  /* ---------- NOW AND THE FUTURE: and it remembers ---------- */
  function paintFuture() { const W = 768, H = 1536, F = [-562, 119], SUN = [500, 700], c = document.createElement("canvas"); c.width = W; c.height = H; const q = c.getContext("2d"), eyes = [];
    const A = sheet(W, H); A.q.fillStyle = A.lg(0, 0, 0, 780, [[0, "#0d3446"], [.3, "#167c80"], [.62, "#58cbc2"], [1, "#f6ecb0"]]); A.q.fillRect(0, 0, W, H);
    for (let k = 0; k < 12; k++) { const a = -Math.PI + k / 12 * Math.PI + .05, b = a + .1; A.piece([[SUN[0], SUN[1]], [SUN[0] + Math.cos(a) * 1100, SUN[1] + Math.sin(a) * 1100], [SUN[0] + Math.cos(b) * 1100, SUN[1] + Math.sin(b) * 1100]], "rgba(255,248,210,.3)", { lead: 0 }); }
    A.disc(SUN[0], SUN[1], 236, "#f6c64a", 6).disc(SUN[0], SUN[1], 176, "#ffe27a", 5).disc(SUN[0], SUN[1], 118, "#fff8dc", 5);
    for (const [x, y, s] of [[90, 90, 20], [250, 60, 14], [420, 120, 24], [620, 70, 16], [700, 210, 20], [160, 230, 14], [340, 250, 12], [560, 300, 12]]) A.piece([[x, y - s * 1.6], [x + s * .35, y - s * .35], [x + s * 1.2, y], [x + s * .35, y + s * .35], [x, y + s * 1.6], [x - s * .35, y + s * .35], [x - s * 1.2, y], [x - s * .35, y - s * .35]], s > 18 ? "#fff6c8" : "#f2d04a", { lead: 3 });   /* stars */
    [[18, 52, 330, "#d8342c"], [62, 100, 410, "#2fd0d8"], [110, 150, 290, "#f2d04a"], [160, 196, 460, "#2a4ab8"], [206, 244, 380, "#e85aa8"], [254, 286, 500, "#2fd0d8"]].forEach(([x0, x1, top, col]) => A.piece([[x0, top], [x1, top], [x1, 800], [x0, 800]], col, { lead: 5 }));   /* the curtain wall */
    A.piece([[0, 780], [768, 780], [768, 1536], [0, 1536]], A.lg(0, 780, 0, 1460, [[0, "#e2f6f0"], [.5, "#a6dcdc"], [1, "#62b4c2"]]), { lead: 0 });
    A.piece([[520, 780], [590, 780], [768, 880], [768, 1010]], "#fbf0b4", { lead: 4 });   /* the road of light */
    for (let k = 0; k <= 12; k++) { const a = Math.PI * (.04 + k / 12 * .92); A.line([[SUN[0] + Math.cos(a) * 60, 780 + Math.sin(a) * 4], [SUN[0] + Math.cos(a) * 1400, 780 + Math.sin(a) * 1400]], 2.5, false); } for (let k = 1; k <= 9; k++) { const y = 780 + 700 * Math.pow(k / 9, 1.9); A.line([[0, y], [768, y]], 2.5, false); }   /* the Supersurface */
    A.cut({ fx: F[0], fy: F[1], ring: 56, wid: 36, swirl: .05, seed: 3, vary: .18 }).onto(q);
    const B = sheet(W, H);
    B.piece([[352, 990], [668, 960], [730, 1470], [330, 1470]], "#2a4ab8", { lead: 9 }); B.piece([[560, 970], [668, 960], [730, 1470], [610, 1470]], "#1b2f7c", { lead: 0 }); B.piece([[352, 990], [668, 960], [676, 1040], [348, 1076]], "#f2c81e", { lead: 5 }); B.piece([[348, 1076], [676, 1040], [678, 1066], [346, 1104]], "#2a9a5a", { lead: 4 });   /* her robe */
    B.piece([[150, 1166], [398, 1166], [430, 1470], [126, 1470]], "#f6f1e3", { lead: 8 }); B.piece([[320, 1166], [398, 1166], [430, 1470], [350, 1470]], "#cfdfe6", { lead: 0 });   /* the child's shirt */
    B.piece([[156, 1180], [214, 1166], [258, 726], [214, 722]], "#f6f1e3", { lead: 7 }); B.piece([[334, 1166], [392, 1180], [334, 722], [290, 726]], "#e3ecec", { lead: 7 });   /* both arms up */
    B.cut({ fx: W / 2, fy: -2600, ring: 118, wid: 30, seed: 23, vary: .15, lead: 1.4 }).onto(q);
    sweep(q, [[[[768, 1440], [640, 1220], [700, 1000]], 8], [[[0, 560], [200, 640], [330, 600]], 6], [[[0, 40], [300, 180], [768, 20]], 6]]);
    const pc = (pts, fill, w, curve) => { trace(q, pts, true, curve); q.fillStyle = fill; q.fill(); if (w) nib(q, () => trace(q, pts, true, curve), w); };
    /* the horned bike, small on the road, riding at the sun: two riders, a red tail light and the streak it leaves */
    { q.save(); q.translate(686, 880); q.scale(.68, .68); const x = 0, y = 0; pc([[x - 5, y + 44], [x + 5, y + 44], [x + 150, y + 250], [x + 96, y + 262]], "rgba(216,32,40,.7)", 0); pc([[x - 12, y - 6], [x + 12, y - 6], [x + 14, y + 52], [x - 14, y + 52]], LEAD, 0, true); pc([[x - 30, y - 60], [x + 30, y - 60], [x + 26, y + 6], [x - 26, y + 6]], "#1c1410", 0); pc([[x - 24, y - 92], [x + 24, y - 92], [x + 30, y - 52], [x - 30, y - 52]], "#6f8040", 3);
      q.beginPath(); q.arc(x, y - 110, 20, 0, TAU); q.fillStyle = "#18110d"; q.fill(); pc([[x - 40, y - 138], [x + 40, y - 138], [x + 22, y - 150], [x + 16, y - 172], [x - 16, y - 172], [x - 22, y - 150]], "#efe6cc", 3);
      for (const s of [-1, 1]) { trace(q, [[x + s * 20, y - 66], [x + s * 78, y - 74], [x + s * 122, y - 96], [x + s * 138, y - 132]], false, true); q.lineCap = "round"; q.strokeStyle = LEAD; q.lineWidth = 13; q.stroke(); q.strokeStyle = "#efe6d0"; q.lineWidth = 7; q.stroke(); }
      q.beginPath(); q.arc(x, y + 34, 9, 0, TAU); q.fillStyle = "#ff2a30"; q.fill(); q.strokeStyle = LEAD; q.lineWidth = 3; q.stroke(); q.restore(); }
    /* the chip, held up: the land's memory, a square of blue glass with gold traces */
    { const x = 274, y = 628, s = 74; q.fillStyle = A.rg(x, y, 250, [[0, "rgba(180,250,255,.75)"], [.5, "rgba(120,235,240,.25)"], [1, "rgba(120,235,240,0)"]]); q.fillRect(x - 250, y - 250, 500, 500);
      for (let k = 0; k < 4; k++) for (const t of [-.5, 0, .5]) { const a = k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), p = (u, v) => [x + ca * u - sa * v, y + sa * u + ca * v]; pc([p(s, t * s - 7), p(s + 30, t * s - 7), p(s + 30, t * s + 7), p(s, t * s + 7)], "#f2c84a", 2.5); }
      pc([[x - s, y - s], [x + s, y - s], [x + s, y + s], [x - s, y + s]], "#2fd0d8", 7); pc([[x - s, y - s], [x + s, y - s], [x - s, y + s]], "#7fecee", 0); pc([[x - 34, y - 34], [x + 34, y - 34], [x + 34, y + 34], [x - 34, y + 34]], "#f6cf3e", 5); pc([[x, y - 22], [x + 22, y], [x, y + 22], [x - 22, y]], "#fffbe6", 3); nib(q, () => { q.beginPath(); q.rect(x - s, y - s, s * 2, s * 2); }, 7); }
    hand(q, 232, 716, 50, -.1, SKIN.umber, false); hand(q, 314, 716, 50, .1, SKIN.umber, false);
    face(q, 512, 824, 222, { hair: "wrap", wrap: "#f2c81e", wrap2: "#2a4ab8", skin: SKIN.deep }, eyes);
    face(q, 274, 1016, 190, { hair: "afro", skin: SKIN.umber }, eyes); hand(q, 396, 1196, 74, -.5, SKIN.deep, true);
    lettering(q, W, H, 112, "NOW AND THE FUTURE", "and it remembers", 44, [[0, "#0f3c48"], [1, "#082028"]]); iron(q, W, H, 3, 8);
    return { canvas: c, eyes, focus: F, W, H }; }
  const paint = kind => kind === "then" ? paintThen() : kind === "future" ? paintFuture() : paintNow();

  /* ---------- the windows in the world ---------- */
  const VERSE = ["Then: the land was dust, and the dust kept nobody's name.", "Then and now: one hand lifts the light, and the dust learns to read.", "Now and after: the land is glass, and it remembers everyone who crossed it."];
  function create({ T, scene, heightAt, zone }) {
    const group = new T.Group(), colliders = [], y0 = heightAt(zone.x, zone.z), BASE = 7.6, ZP = zone.z - 17.6, WING = .3;
    const P = [paintThen(), paintNow(), paintFuture()], dims = [[13, 26], [18, 29.25], [13, 26]];
    const stone = new T.MeshStandardMaterial({ color: 0xd0aa80, roughness: .95 }), ironM = new T.MeshStandardMaterial({ color: 0x1a1512, roughness: .5, metalness: .6 });
    /* one atlas of all three, for the light they throw */
    const AT = document.createElement("canvas"); AT.width = 2048; AT.height = 1024; const aq = AT.getContext("2d"); aq.fillStyle = "#000"; aq.fillRect(0, 0, 2048, 1024); const slots = [[64, 512], [672, 640], [1408, 512]];
    P.forEach((p, i) => aq.drawImage(p.canvas, slots[i][0], 0, slots[i][1], 1024)); const atlas = new T.CanvasTexture(AT); atlas.colorSpace = T.SRGBColorSpace; atlas.generateMipmaps = true; atlas.minFilter = T.LinearMipmapLinearFilter;
    const U = { uTL: { value: atlas }, uTLM: { value: [new T.Matrix4(), new T.Matrix4(), new T.Matrix4()] }, uTLR: { value: dims.map(([w, h], i) => new T.Vector4(w, h, slots[i][0] / 2048, slots[i][1] / 2048)) }, uTLSun: { value: new T.Vector3(0, 1, 0) }, uTLK: { value: 0 } };
    const TIME = { value: 0 }, BACK = { value: 1 }, panels = [];
    P.forEach((p, i) => { const [w, h] = dims[i], tx = new T.CanvasTexture(p.canvas); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 8;
      const m = new T.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: .8, roughness: .16, metalness: .1, side: T.DoubleSide });
      const ppm = p.W / w, focus = new T.Vector2((p.focus[0] - p.W / 2) / ppm, (p.H / 2 - p.focus[1]) / ppm), walk = new T.Vector3(0, 0, 0);
      m.customProgramCacheKey = () => "triptych-window"; m.onBeforeCompile = sh => { sh.uniforms.uTFocus = { value: focus }; sh.uniforms.uTWalk = { value: walk }; sh.uniforms.uTTime = TIME; sh.uniforms.uTBack = BACK;
        sh.vertexShader = "varying vec2 vTP;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vTP = position.xy;");
        sh.fragmentShader = "varying vec2 vTP; uniform vec2 uTFocus; uniform vec3 uTWalk; uniform float uTTime; uniform float uTBack;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          { float d = distance(vTP, uTFocus), ring = pow(.5 + .5 * sin(d * .62 - uTTime * 1.15), 4.), near = exp(-dot(vTP - uTWalk.xy, vTP - uTWalk.xy) / 26.) * uTWalk.z;
            totalEmissiveRadiance *= uTBack * (.72 + .5 * ring * exp(-d * .035)) + near * 1.5; }`); };
      const mesh = new T.Mesh(new T.PlaneGeometry(w, h), m), g = new T.Group(); mesh.position.y = h / 2; g.add(mesh);
      for (const [fw, fh, fx, fy] of [[w + .7, .5, 0, h + .1], [w + .7, .5, 0, -.1], [.5, h + .6, -w / 2 - .1, h / 2], [.5, h + .6, w / 2 + .1, h / 2]]) { const b = new T.Mesh(new T.BoxGeometry(fw, fh, .7), ironM); b.position.set(fx, fy, 0); b.castShadow = true; g.add(b); }
      const a = (1 - i) * WING, hx = (i - 1) * 9.45; g.rotation.y = a; g.position.set(i === 1 ? 0 : hx + (i - 1) * Math.cos(WING) * (w / 2 + .35), y0 + BASE, i === 1 ? ZP : ZP + Math.sin(WING) * (w / 2 + .35)); group.add(g);
      /* the wall it stands on, as tall as the ziggurat */
      const wall = new T.Mesh(new T.BoxGeometry(w + 1.2, BASE, 1.6), stone); wall.position.set(0, -BASE / 2, 0); wall.castShadow = wall.receiveShadow = true; g.add(wall); colliders.push({ type: "box", x: g.position.x, y: y0 + BASE / 2, z: g.position.z, hx: w / 2 + .6, hy: BASE / 2 + h / 2, hz: .8, ry: a, tag: "triptych" }); colliders[colliders.length - 1].y = y0 + (BASE + h) / 2;
      /* the pupils: small dark glass, moved inside each painted eye */
      const pup = new T.InstancedMesh(new T.CircleGeometry(1, 14), new T.MeshBasicMaterial({ color: 0x120c08 }), p.eyes.length); pup.position.z = .03; mesh.add(pup); pup.frustumCulled = false;
      const E = p.eyes.map(e => ({ x: (e.x - p.W / 2) / ppm, y: (p.H / 2 - e.y) / ppm, r: e.r / ppm, rx: e.rx / ppm, ry: e.ry / ppm, ox: 0, oy: .6 }));
      panels.push({ g, mesh, w, h, walk, focus, pup, E, inv: new T.Matrix4(), name: ["Then", "Then and Now", "Now and the Future"][i] }); });
    scene.add(group); group.updateMatrixWorld(true);
    panels.forEach((p, i) => { p.inv.copy(p.g.matrixWorld).invert(); U.uTLM.value[i].copy(p.inv); });

    /* the light the windows throw: any material patched here takes the glass's colour where the sun comes through it */
    function patch(m) { if (!m || !m.isMeshStandardMaterial || m.userData.triLight) return; m.userData.triLight = true; const prev = m.onBeforeCompile, pk = m.customProgramCacheKey ? m.customProgramCacheKey() : ""; m.customProgramCacheKey = () => pk + "|trilight";
      m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); Object.assign(sh.uniforms, U);
        sh.vertexShader = "varying vec3 vTLW;\n" + sh.vertexShader.replace("#include <project_vertex>", "vTLW = (modelMatrix * vec4(transformed, 1.)).xyz;\n#include <project_vertex>");
        sh.fragmentShader = `varying vec3 vTLW; uniform sampler2D uTL; uniform mat4 uTLM[3]; uniform vec4 uTLR[3]; uniform vec3 uTLSun; uniform float uTLK;
          vec4 triLight(vec3 P){ vec4 acc = vec4(0.); if (uTLK < .01) return acc;
            for (int i = 0; i < 3; i++) { vec3 p = (uTLM[i] * vec4(P, 1.)).xyz, d = mat3(uTLM[i]) * uTLSun; if (p.z < .1 || d.z > -.03) continue; float s = -p.z / d.z; vec2 uv = vec2((p.x + d.x * s) / uTLR[i].x + .5, (p.y + d.y * s) / uTLR[i].y);
              vec2 e = smoothstep(vec2(0.), vec2(.012), uv) * smoothstep(vec2(0.), vec2(.012), 1. - uv); float a = e.x * e.y * (1. - smoothstep(150., 340., s)); if (a <= 0.) continue;
              vec3 c = texture2D(uTL, vec2(uTLR[i].z + uv.x * uTLR[i].w, uv.y), log2(1. + s * .05)).rgb; acc += vec4(c * a, a); }
            return acc * uTLK; }
          ` + sh.fragmentShader.replace("void main() {", "void main() {\n vec4 tl = triLight(vTLW);")
          .replace("#include <color_fragment>", "#include <color_fragment>\n { float ta = min(tl.a, 1.); vec3 tc = tl.rgb / max(tl.a, 1e-4); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (tc * 2.3 + .05), ta * .92); }")
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += tl.rgb * .2;"); };
      m.needsUpdate = true; }

    const _l = new T.Vector3(), _d = new T.Vector3(), _m3 = new T.Matrix3(), _mm = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3();
    /* which window's light falls on this point: 0, 1, 2, or -1 */
    function lightAt(x, y, z) { if (U.uTLK.value < .05) return -1; for (let i = 0; i < 3; i++) { const p = panels[i]; _l.set(x, y, z).applyMatrix4(p.inv); _d.copy(U.uTLSun.value).applyMatrix3(_m3.setFromMatrix4(p.inv)); if (_l.z < .1 || _d.z > -.03) continue; const s = -_l.z / _d.z, u = (_l.x + _d.x * s) / p.w + .5, v = (_l.y + _d.y * s) / p.h; if (u > 0 && u < 1 && v > 0 && v < 1 && s < 95) return i; } return -1; }
    function windowPoint(out, i = 1, u = Math.random(), v = Math.random()) { const p = panels[i]; return out.set((u - .5) * p.w, v * p.h, .1).applyMatrix4(p.g.matrixWorld); }

    function step(dt, t, who, sun, k) { TIME.value = t; U.uTLSun.value.copy(sun); const north = clamp(-sun.z * 1.6, 0, 1), up = clamp(sun.y * 9, 0, 1); U.uTLK.value = north * up * k; BACK.value = (.55 + .75 * north * up) * (.4 + .6 * k);
      for (const p of panels) { _l.copy(who).applyMatrix4(p.inv); const near = clamp(1 - (Math.abs(_l.z) - 4) / 70, 0, 1) * (Math.abs(_l.x) < p.w / 2 + 12 ? 1 : 0); p.walk.set(clamp(_l.x, -p.w / 2, p.w / 2), clamp(_l.y - p.h / 2 + 4, -p.h / 2, p.h / 2), lerp(p.walk.z, near, 1 - Math.exp(-dt * 2)));
        const seen = _l.z > 0 && _l.length() < 150; p.E.forEach((e, n) => { let tx, ty; if (seen) { const dx = _l.x - e.x, dy = (_l.y - p.h / 2) - e.y + 1.5, L = Math.hypot(dx, dy), g = Math.min(1, L / (_l.z * .55 + 3)); tx = dx / (L || 1) * g; ty = dy / (L || 1) * g; } else { const dx = p.focus.x - e.x, dy = p.focus.y - e.y, L = Math.hypot(dx, dy) || 1; tx = dx / L * .85; ty = dy / L * .85; }
          const kk = 1 - Math.exp(-dt * (3 + (n % 3))); e.ox = lerp(e.ox, tx, kk); e.oy = lerp(e.oy, ty, kk); _mm.compose(_p.set(e.x + e.ox * e.rx, e.y + e.oy * e.ry, 0), _q.identity(), _s.set(e.r, e.r, 1)); p.pup.setMatrixAt(n, _mm); }); p.pup.instanceMatrix.needsUpdate = true; } }
    return { group, panels, colliders, patch, step, lightAt, windowPoint, VERSE, base: y0 + BASE, z: ZP };
  }
  window.MesaTriptych = { paint, create, VERSE, kit: { sheet, nib, trace, iron, shardify, LEAD } };
})();
