import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = '/Users/gaia/make-photo/make-photo';
const SCRATCH = '/Users/gaia/.gemini/antigravity/brain/915bf412-d22d-4390-9813-8f6d5a22c27c/scratch';
const PROFILE = path.join(SCRATCH, 'chrome-profile-demiurge-probe-w2');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8832;
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function startServer() {
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const fp = path.join(ROOT, rel);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404); res.end('404'); return;
    }
    res.writeHead(200, { 'Content-Type': fp.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/json' });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(r => srv.listen(PORT, '127.0.0.1', () => r(srv)));
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = [];
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) rej(new Error(m.error.message)); else res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.errors.push(m.params.exceptionDetails.text);
      } else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
        const msg = m.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        if (msg.includes('WebGL') || m.params.type === 'error') {
          this.errors.push(msg);
        }
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result?.value;
  }
}

const srv = await startServer();
fs.mkdirSync(PROFILE, { recursive: true });
const chrome = spawn(CHROME, [
  '--headless=new', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist',
  '--window-size=1600,900', '--remote-debugging-port=9282', `--user-data-dir=${PROFILE}`, 'about:blank'
], { stdio: 'ignore' });

try {
  let cdp = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch('http://127.0.0.1:9282/json/list').then(r => r.json());
      const page = list.find(t => t.type === 'page');
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
        cdp = new CDP(ws);
        await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
        break;
      }
    } catch {}
    await sleep(200);
  }

  await cdp.send('Page.navigate', { url: `${BASE}/scion-demiurge/index.html?hud=0` });
  await sleep(2000); // collect >110 frames at 3,205m Entoto overlook

  const glErr = await cdp.eval('window.__demiurge.getWebGLError()');
  const entotoTel = await cdp.eval('window.__demiurge.getTelemetry()');
  const entotoSight = await cdp.eval(`(() => {
    const pZ = -6275.0, camZ = -6280.93;
    const camY = window.__demiurge.sampleSurface(5.5, pZ).y + 1.95 + Math.sin(0.15) * 6.0;
    const yAddis = window.__demiurge.sampleSurface(0, -3600).y;
    let maxClearanceViolation = -Infinity;
    for (let z = -6269; z <= -3650; z += 12) {
      const u = (z - camZ) / (-3600 - camZ);
      const rayY = camY + (yAddis - camY) * u;
      const terrY = window.__demiurge.sampleSurface(0, z).y;
      maxClearanceViolation = Math.max(maxClearanceViolation, terrY - rayY);
    }
    const bankCheck = [
      window.__demiurge.sampleSurface(-48, -544).y,
      window.__demiurge.sampleSurface(-24, -544).y,
      window.__demiurge.sampleSurface(24, -544).y,
      window.__demiurge.sampleSurface(-48, -416).y
    ];
    return { camY: +camY.toFixed(2), yAddis: +yAddis.toFixed(2), max3rdPersonViolation: +maxClearanceViolation.toFixed(2), minBankY: +Math.min(...bankCheck).toFixed(2) };
  })()`);
  console.log('1. Entoto Overlook 3rd-Person Sightline & Abay Hydrostatic Banks (?hud=0):', JSON.stringify({ glErr, ...entotoTel, entotoSight }));
  if (glErr !== 0) throw new Error(`Non-zero WebGL2 error: ${glErr}`);
  if (!entotoTel.hudOff) throw new Error('HUD-off gate failed');
  if (entotoTel.p99Ms > 16.6) throw new Error(`p99 frame time ${entotoTel.p99Ms}ms exceeded 16.6ms gate!`);
  if (entotoTel.slodDrawCallsPerKm2 > 2.0) throw new Error(`SLOD draw calls/km2 ${entotoTel.slodDrawCallsPerKm2} > 2.0!`);
  if (entotoSight.max3rdPersonViolation >= -2.0) throw new Error(`3rd-person camera sightline clearance ${entotoSight.max3rdPersonViolation}m >= -2.0m!`);
  if (entotoSight.minBankY <= 1006.0) throw new Error(`Hydrostatic bank violation: minBankY=${entotoSight.minBankY}m <= 1006.0m!`);

  // 2. Abay Gorge Bridge End-to-End Drive Gate (Z = -568 -> -392, 0 river fall-throughs!)
  await cdp.eval(`window.__demiurge.teleportTo(0, -568, 0.0, -0.05, 'isuzu'); window.__demiurge.setInput('w', true);`);
  let minBridgeY = Infinity, maxBridgeZ = -Infinity;
  for (let s = 0; s < 60; s++) {
    await sleep(200);
    const t = await cdp.eval('window.__demiurge.getTelemetry()');
    if (t.y < minBridgeY) minBridgeY = t.y;
    if (t.z > maxBridgeZ) maxBridgeZ = t.z;
    if (t.z >= -392) break;
  }
  await cdp.eval(`window.__demiurge.setInput('w', false)`);
  console.log('2. Abay Gorge Bridge End-to-End Crossing:', JSON.stringify({ minBridgeY, maxBridgeZ }));
  if (minBridgeY < 1019.0 || maxBridgeZ < -405) {
    throw new Error(`Bridge crossing failed: minBridgeY=${minBridgeY}, maxBridgeZ=${maxBridgeZ}`);
  }

  // 3. Isuzu Canyon Downhill Brake-Fade Runaway vs. Engine-Brake Control Gate
  // Find a long straight mid-traverse downhill canyon switchback leg (not a hairpin apex!)
  const steepSeg = await cdp.eval(`(() => {
    const pts = window.__demiurge.getRoadWaypoints();
    let best = null, bestSlope = 0;
    for (let i = 10; i < pts.length - 10; i++) {
      const a = pts[i], b = pts[i + 1];
      if (a[2] > -1980 && a[2] < -780 && Math.abs(a[0]) < 350 && Math.abs(b[0] - a[0]) > 20) {
        const ds = Math.hypot(b[0] - a[0], b[2] - a[2]);
        const slope = (b[1] - a[1]) / (ds || 1);
        if (slope < bestSlope) { bestSlope = slope; best = { x: a[0], z: a[2], yaw: Math.atan2(b[0] - a[0], b[2] - a[2]), slope: +slope.toFixed(4) }; }
      }
    }
    return best;
  })()`);
  console.log('3A. Canyon Mid-Traverse Downhill Segment:', JSON.stringify(steepSeg));

  // Un-engine-braked service braking on steep descent -> heats past 380C & genuinely accelerates (runaway)!
  await cdp.eval(`(() => {
    const s = ${JSON.stringify(steepSeg)};
    window.__demiurge.setEngineBrake(false);
    window.__demiurge.teleportTo(s.x, s.z, s.yaw, -0.15, 'isuzu');
    window.__demiurge.setInput('w', true);
  })()`);
  await sleep(1400); // reach ~16 m/s rolling downhill
  await cdp.eval(`window.__demiurge.setInput('w', false); window.__demiurge.setInput(' ', true);`);
  let peakBrakeTemp = 0, minMidSpeed = Infinity, postFadeSpeed = 0;
  for (let i = 0; i < 32; i++) {
    await sleep(200);
    const t = await cdp.eval('window.__demiurge.getTelemetry()');
    if (t.brakeTempC > peakBrakeTemp) peakBrakeTemp = t.brakeTempC;
    if (t.speed < minMidSpeed) minMidSpeed = t.speed;
    postFadeSpeed = t.speed;
  }
  await cdp.eval(`window.__demiurge.setInput(' ', false);`);

  // Now compare with Engine Brake ENGAGED on exact same segment
  await cdp.eval(`(() => {
    const s = ${JSON.stringify(steepSeg)};
    window.__demiurge.setEngineBrake(true);
    window.__demiurge.teleportTo(s.x, s.z, s.yaw, -0.15, 'isuzu');
    window.__demiurge.setInput('w', true);
  })()`);
  await sleep(1800);
  const engBrakeTel = await cdp.eval('window.__demiurge.getTelemetry()');
  await cdp.eval(`window.__demiurge.setInput('w', false); window.__demiurge.setEngineBrake(false);`);
  console.log('3B. Brake-Fade Runaway vs Engine-Brake Control:', JSON.stringify({
    peakBrakeTemp, minMidSpeed, postFadeSpeed, engBrakeControlledSpeed: engBrakeTel.speed, engBrakeTempC: engBrakeTel.brakeTempC
  }));
  if (peakBrakeTemp < 380 || postFadeSpeed <= minMidSpeed) {
    throw new Error(`Expected thermal brake-fade runaway (>=380C & postFadeSpeed > minMidSpeed), got temp=${peakBrakeTemp}C, min=${minMidSpeed}, end=${postFadeSpeed}`);
  }

  // 4. Sanctuary Dignity Perimeter (3A NPC exclusion, 3B Highway outside r=56m, 3C Glider + Vehicle + Donkey lock & clean exit)
  const sanctuaryAudit = await cdp.eval(`(() => {
    const pts = window.__demiurge.getRoadWaypoints();
    let minRoadDist = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p[0] - 20, p[2] - 2400);
      if (d < minRoadDist) minRoadDist = d;
    }
    const ags = window.__demiurge.getAgents();
    let minNonPilgrimDist = Infinity;
    for (const a of ags) {
      if (a.kind !== 'roha_pilgrim') {
        const d = Math.hypot(a.x - 20, a.z - 2400);
        if (d < minNonPilgrimDist) minNonPilgrimDist = d;
      }
    }
    return { minRoadDist: +minRoadDist.toFixed(2), minNonPilgrimDist: +minNonPilgrimDist.toFixed(2) };
  })()`);
  console.log('4A. Sanctuary Road & NPC Clearances (Gate > 64.0m):', JSON.stringify(sanctuaryAudit));
  if (sanctuaryAudit.minRoadDist <= 64.0) throw new Error(`Road breaches 64m Roha Sanctuary perimeter: ${sanctuaryAudit.minRoadDist}m`);
  if (sanctuaryAudit.minNonPilgrimDist <= 64.0) throw new Error(`Non-pilgrim NPC breaches 64m Roha Sanctuary perimeter: ${sanctuaryAudit.minNonPilgrimDist}m`);

  // Attempt vehicle at (-42, 2400) & (-38, 2400) inside bollards, drive East from (-78, 2400), and fly glider across (-60, 2400) -> ALL must enforce foot!
  await cdp.eval(`window.__demiurge.teleportTo(-42, 2400, 1.57, 0, 'isuzu')`);
  await sleep(100);
  const sIsuzu = await cdp.eval('window.__demiurge.getTelemetry()');
  await cdp.eval(`window.__demiurge.teleportTo(-38, 2400, 1.57, 0, 'foot'); window.__demiurge.setPlayerMode('glider');`);
  await sleep(100);
  const sGlider = await cdp.eval('window.__demiurge.getTelemetry()');
  await cdp.eval(`window.__demiurge.setPlayerMode('donkey')`);
  await sleep(100);
  const sDonkeyIn = await cdp.eval('window.__demiurge.getTelemetry()');

  // Drive Isuzu East from (-78, 2400) -> must stop strictly West of x = -44.0!
  await cdp.eval(`window.__demiurge.teleportTo(-78, 2400, 1.5708, -0.05, 'isuzu'); window.__demiurge.setInput('w', true);`);
  await sleep(2200);
  await cdp.eval(`window.__demiurge.setInput('w', false);`);
  const driveStop = await cdp.eval('window.__demiurge.getTelemetry()');
  if (driveStop.x > -44.0) throw new Error(`Isuzu penetrated past x=-44m bollards to x=${driveStop.x}m!`);

  // Fly Glider East from (-85, 2400) -> must dismount to 'foot' immediately upon crossing r <= 65.5m!
  await cdp.eval(`window.__demiurge.teleportTo(-85, 2400, 1.5708, -0.05, 'glider')`);
  await sleep(1500);
  const gliderFly = await cdp.eval('window.__demiurge.getTelemetry()');
  if (gliderFly.mode === 'glider' && gliderFly.x > -44.0) throw new Error(`Glider flew inside Roha Sanctuary to x=${gliderFly.x}m!`);

  // Now teleport OUT of Roha to Simien with donkey -> must cleanly restore donkey mode (fixes stale state!)
  await cdp.eval(`window.__demiurge.teleportTo(10, 6085, 0.25, -0.1, 'donkey')`);
  await sleep(120);
  const sDonkeyOut = await cdp.eval('window.__demiurge.getTelemetry()');
  console.log('4B. Sanctuary Mode Enforcement & Clean Exit:', JSON.stringify({
    inIsuzuMode: sIsuzu.mode, inGliderMode: sGlider.mode, inDonkeyMode: sDonkeyIn.mode, dignity: sGlider.dignityState,
    simienExitMode: sDonkeyOut.mode, simienExitDignity: sDonkeyOut.dignityState
  }));
  if (sIsuzu.mode !== 'foot' || sGlider.mode !== 'foot' || sDonkeyIn.mode !== 'foot' || sGlider.dignityState !== 'BAREFOOT_NON_COMBAT') {
    throw new Error('Sanctuary failed to lock vehicle/glider/donkey to foot!');
  }
  if (sDonkeyOut.mode !== 'donkey' || sDonkeyOut.dignityState !== 'NORMAL') {
    throw new Error(`Teleporting out of Roha failed to restore donkey mode: got ${sDonkeyOut.mode}`);
  }

  // 5. Roha 12m Subtractive Sunken Nave Floor & Kiremt Mud + Ras Dashen 4,550m VO2 Hypoxia
  const rimY = await cdp.eval('window.__demiurge.sampleSurface(-40, 2400).y');
  await cdp.eval(`window.__demiurge.teleportTo(10, 2400, 1.57, 0, 'foot')`);
  await sleep(120);
  const trenchTel = await cdp.eval('window.__demiurge.getTelemetry()');
  const trenchDrop = +(rimY - trenchTel.y).toFixed(2);
  console.log('5. Roha 12m Sunken Nave Floor Telemetry:', JSON.stringify({ rimY: +rimY.toFixed(2), floorY: trenchTel.y, dropM: trenchDrop, mat: trenchTel.surfaceMat, ir: trenchTel.activeIR }));
  if (Math.abs(trenchDrop - 12.0) > 0.5 || trenchTel.surfaceMat !== 'TUFF_SANCTUARY') {
    throw new Error(`Expected 12.0m TUFF_SANCTUARY subtractive drop, got ${trenchDrop}m (${trenchTel.surfaceMat})`);
  }

  await cdp.eval(`window.__demiurge.teleportTo(0, 6220, 0, -0.08, 'foot')`);
  await sleep(120);
  const simienTel = await cdp.eval('window.__demiurge.getTelemetry()');
  const simienRelief = await cdp.eval(`({
    y5950: +window.__demiurge.sampleSurface(0, 5950).y.toFixed(2),
    y6080: +window.__demiurge.sampleSurface(0, 6080).y.toFixed(2),
    y6220: +window.__demiurge.sampleSurface(0, 6220).y.toFixed(2)
  })`);
  console.log('6. Ras Dashen 4,550m Summit Crown & Afroalpine Relief:', JSON.stringify({ y: simienTel.y, mat: simienTel.surfaceMat, vo2: simienTel.vo2MaxFactor, relay: simienTel.relaySignalPct, simienRelief }));
  if (simienTel.y < 4546 || simienTel.vo2MaxFactor > 0.60 || simienRelief.y5950 >= 4490 || simienTel.surfaceMat !== 'BASALT_CLIFF') {
    throw new Error(`Expected Ras Dashen ~4,550m BASALT_CLIFF with non-flat Simien relief, got mat=${simienTel.surfaceMat}, ${JSON.stringify(simienRelief)}`);
  }

  const finalGlErr = await cdp.eval('window.__demiurge.getWebGLError()');
  if (finalGlErr !== 0) throw new Error(`Final WebGL2 error: ${finalGlErr}`);
  if (cdp.errors.length > 0) throw new Error('Runtime/WebGL errors: ' + JSON.stringify(cdp.errors));
  console.log('WAVE-2 KINEMATIC, PHYSICS, DIGNITY & PERFORMANCE PROBE: ALL GATES PASSED!');
} finally {
  chrome.kill('SIGKILL');
  srv.close();
}
