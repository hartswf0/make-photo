// headless Metal WebGL screenshot + FPS: node tools/shot.js <out-prefix> [port]
const { chromium } = require("/Users/gaia/node_modules/playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (f.endsWith("/")) f += "demo.html";
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".html") ? "text/html" : "application/octet-stream" }); r.end(d); } }); });
(async () => {
  const out = process.argv[2] || "/tmp/hf", port = +process.argv[3] || 8791; await new Promise(r => srv.listen(port, r));
  const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 640 } }); const errs = [];
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); }); p.on("pageerror", e => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port}/demo.html`); await p.waitForTimeout(1500);
  const shot = async (n) => p.screenshot({ path: `${out}_${n}.jpg`, type: "jpeg", quality: 72 });
  const set = (id, v) => p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input")); }, [id, v]);
  const res = {};
  await shot("bust_rest");
  res.fps_bust = await p.evaluate(() => new Promise(r => { let n = 0, t = performance.now(); const f = () => { n++; performance.now() - t > 2000 ? r(n * 1000 / (performance.now() - t)) : requestAnimationFrame(f); }; f(); }));
  await set("lean", 24); await set("flex", -22); await shot("bust_lean24_ext22");
  await p.click('[data-m="wire"]'); await shot("bust_wire"); await p.click('[data-m="xray"]'); await set("lean", 0); await set("flex", 0); await p.click('[data-v="full"]'); await set("pro", 160); await set("esk", 1); await shot("full_xray_pro160");
  await p.click('[data-m="solid"]'); await set("ik", 0.4); await set("pro", 0); await shot("full_ik");
  res.fps_full = await p.evaluate(() => new Promise(r => { let n = 0, t = performance.now(); const f = () => { n++; performance.now() - t > 2000 ? r(n * 1000 / (performance.now() - t)) : requestAnimationFrame(f); }; f(); }));
  res.glError = await p.evaluate(() => document.getElementById("hud").textContent);
  res.errors = errs; console.log(JSON.stringify(res)); await b.close(); srv.close();
})();
