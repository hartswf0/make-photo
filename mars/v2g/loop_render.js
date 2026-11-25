// Renders the Mars level for the video-to-game loop: node loop_render.js <url> <tune.json> <out-prefix>
// Writes <out>-street.png and <out>-street-mask.png (the main street, the film's framing), and <out>-future.png / -future-mask.png (after the storm).
// Needs Playwright with Chromium. Software GL is slow, so the game is stepped with __mars.sim instead of played in real time.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [url, tunePath, out] = process.argv.slice(2), tune = JSON.parse(fs.readFileSync(tunePath, 'utf8'));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await pg.addInitScript(t => { window.MARS_TUNE = t; }, tune);
  await pg.goto(url); await pg.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  await pg.addStyleTag({ content: '.top,.bar,#line,#study{visibility:hidden!important}' });
  const snap = async name => {
    await pg.evaluate(() => { window.__mars.paused = true; window.__mars.mask(false); }); await pg.waitForTimeout(1500); await pg.screenshot({ path: `${out}-${name}.png` });
    await pg.evaluate(() => window.__mars.mask(true)); await pg.waitForTimeout(1500); await pg.screenshot({ path: `${out}-${name}-mask.png` });
    await pg.evaluate(() => { window.__mars.mask(false); window.__mars.paused = false; });
  };
  await pg.evaluate(() => window.__mars.sim(3, { throttle: 1, steer: 0, pace: 1 })); await snap('street');
  await pg.evaluate(() => { window.__mars.callStorm(); for (let i = 0; i < 60 && window.__mars.STORM.phase !== 'clear'; i++) window.__mars.sim(1, { throttle: .4, steer: 0, pace: 0 }); window.__mars.sim(3, { throttle: 0 }); });
  await snap('future');
  await b.close();
})();
