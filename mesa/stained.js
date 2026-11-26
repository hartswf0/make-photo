/* Stained glass the island-ecology way (hartswf0/island-ecology, BEES ON A TRAIN / skill-analyzer.html): a real Voronoi of sites,
   built with d3-delaunay and drawn as vector cells (fill, then lead), "orders of magnitude faster than pixel-looping".
   The game renders at full speed as usual; this draws the glass over it on a 2D canvas.
     - the cutting: a fixed, jittered field of sites, cut once (Tekle: the glass never moves; the world is light behind it)
     - the nodes: live sites on the figures (Uncle Mesa, the knight, the outlaws, the bike), each with a ring of small cells, so the
       lead follows the bodies, the way skill-analyzer's nodes carry their own cells
     - each cell takes the light at its site from a small sample of the frame, saturated as backlit glass; figure cells get heavier lead
   MesaStained.create({ renderer, camera, T }) -> { draw(nodes), hide() } ; nodes: [{ p: Vector3, r: metres, heavy: bool }] */
(() => {
  "use strict";
  function create({ renderer, camera, T }) {
    const d3 = window.d3; if (!d3 || !d3.Delaunay) return null;
    const cv = document.createElement("canvas"); cv.id = "stained"; Object.assign(cv.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: 1, display: "none" });
    const gl = renderer.domElement; gl.after(cv);
    const ctx = cv.getContext("2d"); const sm = document.createElement("canvas"), sctx = sm.getContext("2d");   /* accelerated: the frame is scaled down on the GPU, and only the tiny result is read */
    let W = 0, H = 0, SW = 0, SH = 0, fixed = null, tint = null, px = null, fr = 0, VOR = null;
    let CELL = 30;   /* css px between sites of the fixed cutting: about 42 across, whatever the screen, so the cost is constant */
    function layout() {
      W = Math.round(innerWidth); H = Math.round(innerHeight); CELL = Math.max(18, W / 42); cv.width = W; cv.height = H; SW = Math.max(16, Math.round(W / 8)); SH = Math.max(9, Math.round(H / 8)); sm.width = SW; sm.height = SH; px = null; VOR = null;
      let s = 1961; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; fixed = [];
      for (let y = CELL * .5; y < H + CELL; y += CELL * .87) for (let x = (Math.round(y / CELL) % 2) * CELL * .5; x < W + CELL; x += CELL) fixed.push([x + (rnd() - .5) * CELL * .8, y + (rnd() - .5) * CELL * .8]);
      tint = fixed.map(() => [(rnd() - .5) * 18, (rnd() - .5) * .14]);   /* each pot of glass: its own hue shift and depth */
    }
    addEventListener("resize", () => { if (cv.style.display !== "none") layout(); });
    const v = new T.Vector3();
    function project(p) { v.copy(p).project(camera); if (v.z > 1 || v.z < -1) return null; return [(v.x * .5 + .5) * W, (-v.y * .5 + .5) * H]; }
    function rgb2hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
      if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
    function draw(nodes) {
      if (cv.style.display === "none") { cv.style.display = "block"; layout(); }
      if (W !== Math.round(innerWidth) || H !== Math.round(innerHeight)) layout();
      if (!px || (++fr & 1) === 0) { sctx.drawImage(gl, 0, 0, SW, SH); px = sctx.getImageData(0, 0, SW, SH).data; }   /* the light is read every other frame */
      /* the window: the world shows through the glass. Each piece tints what is behind it, the lead cuts it, and the figures
         stand clear in front of the window, so you can always see who is where. */
      const pts = fixed, vor = VOR || (VOR = d3.Delaunay.from(pts).voronoi([0, 0, W, H]));
      ctx.clearRect(0, 0, W, H); ctx.globalAlpha = .34;
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = pts[i]; const sx = Math.min(SW - 1, Math.max(0, Math.round(x / W * SW))), sy = Math.min(SH - 1, Math.max(0, Math.round(y / H * SH))), o = (sy * SW + sx) * 4;
        let [h, s, l] = rgb2hsl(px[o], px[o + 1], px[o + 2]); const tt = tint[i];
        h = (h + tt[0] * 2 + 360) % 360; s = Math.min(1, s * 1.6 + .3); l = Math.min(.7, Math.max(.25, l + tt[1]));   /* a pot of coloured glass over the light */
        ctx.beginPath(); vor.renderCell(i, ctx); ctx.fillStyle = `hsl(${h.toFixed(0)},${(s * 100).toFixed(0)}%,${(l * 100).toFixed(0)}%)`; ctx.fill();
      }
      ctx.lineJoin = "round"; ctx.strokeStyle = "#120c0a"; ctx.globalAlpha = .62; ctx.lineWidth = Math.max(1.2, CELL / 16); ctx.beginPath(); vor.render(ctx); ctx.stroke();   /* the lead */
      ctx.globalAlpha = .14; ctx.strokeStyle = "#fff6dc"; ctx.lineWidth = 1; ctx.beginPath(); vor.render(ctx); ctx.stroke(); ctx.globalAlpha = 1;   /* a glint along the cames */
      /* the figures in front of the window: the glass is cut away around them, and a heavy came rings each one */
      const circ = [];
      for (const nd of nodes || []) { const c = project(nd.p); if (!c) continue; const e = project(new T.Vector3(nd.p.x, nd.p.y + nd.r * 2.2, nd.p.z)); if (!e) continue; circ.push([c[0], c[1], Math.max(8, Math.min(160, Math.hypot(e[0] - c[0], e[1] - c[1])))]); }
      ctx.strokeStyle = "#120c0a"; ctx.lineWidth = Math.max(2.5, CELL / 7); ctx.globalAlpha = .85; ctx.beginPath(); for (const [x, y, r] of circ) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); } ctx.stroke();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "destination-out"; ctx.beginPath(); for (const [x, y, r] of circ) { ctx.moveTo(x + r - 1, y); ctx.arc(x, y, Math.max(1, r - ctx.lineWidth * .45), 0, Math.PI * 2); } ctx.fill(); ctx.globalCompositeOperation = "source-over";
    }
    function hide() { cv.style.display = "none"; }
    return { draw, hide };
  }
  window.MesaStained = { create };
})();
