// What the door cues describe, built: each carriage's chapter of the worlds file as things standing in the room.
// Every prop is also where its worlds' stubs are kept, so the carriages hold the corpus without anything floating in the aisle.
import * as THREE from 'three';
import { Batch, DIM } from './kit.js';
import { bayX } from './train.js';

const { L, HW, ROOF } = DIM;
export function buildProps(train, M) {
  const X = {   // a few materials the fit-outs do not have
    snow: new THREE.MeshLambertMaterial({ color: 0xe9eef0 }), pink: new THREE.MeshLambertMaterial({ color: 0xe58aa8 }), white: new THREE.MeshLambertMaterial({ color: 0xf1ede2 }),
    water: new THREE.MeshStandardMaterial({ color: 0x2bb8c9, transparent: true, opacity: .55, roughness: .1 }), green: new THREE.MeshBasicMaterial({ color: 0x38e07a }), gold: new THREE.MeshStandardMaterial({ color: 0xe0b23a, metalness: .9, roughness: .3, envMapIntensity: 1 }),
    mono: new THREE.MeshLambertMaterial({ color: 0x8c8c8a }), foam: new THREE.MeshLambertMaterial({ color: 0x3a3f46 }), hazard: new THREE.MeshLambertMaterial({ color: 0xe0b400 }), paper: new THREE.MeshLambertMaterial({ color: 0xe6dcc0 }),
    graf: [0xe0483a, 0x2f8fd0, 0xf0c020, 0x3cb46a, 0xd060c0].map(c => new THREE.MeshLambertMaterial({ color: c })) };
  const out = [], b = new Batch(); let car = null;
  // Drawn surfaces are what make a box read as a thing: numbers, chalk, print, dials. One small canvas each, cached by content.
  const texCache = new Map();
  function draw(key, w, h, fn) { if (!texCache.has(key)) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(key, new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); } return texCache.get(key); }
  const text = (str, o = {}) => draw('t:' + str + JSON.stringify(o), o.w || 512, o.h || 128, (q, w, h) => { q.fillStyle = o.bg || '#2a2118'; q.fillRect(0, 0, w, h); if (o.border !== false) { q.strokeStyle = o.fg || '#e8c98a'; q.lineWidth = 5; q.strokeRect(6, 6, w - 12, h - 12); }
    q.fillStyle = o.fg || '#e8c98a'; q.textAlign = 'center'; q.textBaseline = 'middle'; const lines = str.split('\n'); let size = o.size || Math.min(h * .62 / lines.length, 64); q.font = `${o.weight || 700} ${size}px ${o.font || 'Georgia, serif'}`;
    while (lines.some(l => q.measureText(l).width > w - 36) && size > 12) { size -= 3; q.font = `${o.weight || 700} ${size}px ${o.font || 'Georgia, serif'}`; } lines.forEach((l, k) => q.fillText(l, w / 2, h / 2 + (k - (lines.length - 1) / 2) * size * 1.15)); });
  /** A flat drawn surface in the carriage. ry turns it; rx tips it back. */
  function decal(mat, x, y, z, w, h, ry = 0, rx = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); car.group.add(m); return m; }
  const face = z => z > car.aisleZ ? Math.PI : 0;          // turn a decal toward the aisle
  /** The brass plaque that names a prop, low beside the aisle, tipped up to be read walking past. */
  function plaque(label, x, z) { const s = z > car.aisleZ ? 1 : -1, pz = car.aisleZ + s * (car.aisleHalf + .13); b.cyl(M.brass, x, .2, pz, .012, .012, .4, 6); decal(text(label.toUpperCase(), { w: 512, h: 112, bg: '#3a2a12', fg: '#f0d9a0', font: '"Arial Narrow", Arial, sans-serif', weight: 800 }), x, .44, pz, .34, .075, face(pz), -.5); }
  // small reusable builders
  const figure = (x, z, body, h = 1.6, head = M.walnut) => { b.cyl(body, x, h * .47, z, .15, .2, h * .62, 10); b.cyl(body, x, h * .12, z, .12, .14, h * .24, 8); b.sph(head, x, h * .87, z, .1, .12, .1); for (const e of [-1, 1]) b.cyl(body, x, h * .58, z + e * .2, .045, .05, h * .34, 6); };
  const crt = (x, y, z, s, screen, w = .56) => { b.box(M.crt, x, y, z, w, w * .82, .46); b.box(M.black, x, y, z - s * .232, w * .86, w * .68, .01); decal(screen, x, y, z - s * .24, w * .78, w * .6, s > 0 ? Math.PI : 0); b.cyl(M.iron, x + w * .34, y - w * .34, z - s * .236, .018, .018, .02, 8, Math.PI / 2); };
  const jar = (x, y, z, m = M.honey) => { b.cyl(m, x, y + .06, z, .042, .042, .11, 10); b.cyl(M.brass, x, y + .125, z, .044, .044, .018, 10); };
  const wheel = (x, y, z, r, m = M.black) => { b.cyl(m, x, y, z, r, r, .06, 14, Math.PI / 2); b.cyl(M.steel, x, y, z, r * .35, r * .35, .07, 8, Math.PI / 2); };
  const screens = { radar: draw('radar', 256, 256, (q, w) => { q.fillStyle = '#04140c'; q.fillRect(0, 0, w, w); q.strokeStyle = '#2fe07a'; q.lineWidth = 2; for (const r of [40, 80, 118]) { q.beginPath(); q.arc(128, 128, r, 0, 7); q.stroke(); } q.beginPath(); q.moveTo(128, 128); q.lineTo(230, 60); q.stroke(); q.fillStyle = '#2fe07a55'; q.beginPath(); q.moveTo(128, 128); q.arc(128, 128, 118, -.6, -.1); q.fill(); q.fillStyle = '#b8ffcf'; for (let k = 0; k < 60; k++) q.fillRect(150 + Math.cos(k) * 30 + (k * 7) % 40, 40 + Math.sin(k * 3) * 22 + (k * 5) % 30, 3, 3); }),
    map: draw('map', 256, 192, (q, w, h) => { q.fillStyle = '#03140a'; q.fillRect(0, 0, w, h); q.strokeStyle = '#38e07a'; q.lineWidth = 1.5; for (let k = 0; k < 9; k++) { q.beginPath(); q.moveTo(128, 96); q.quadraticCurveTo(128 + Math.cos(k) * 60, 20 + k * 8, 128 + Math.cos(k * 2.2) * 110, 96 + Math.sin(k * 1.7) * 80); q.stroke(); } q.fillStyle = '#38e07a'; for (let k = 0; k < 40; k++) q.fillRect((k * 53) % w, (k * 29) % h, 4, 3); q.font = '14px monospace'; q.fillText('TRACING…', 12, 180); }),
    faces: draw('faces', 256, 192, (q, w, h) => { q.fillStyle = '#1b2a22'; q.fillRect(0, 0, w, h); for (let k = 0; k < 70; k++) { const x = (k * 37) % w, y = 20 + ((k * 61) % (h - 40)); q.fillStyle = ['#c9a27a', '#8a6248', '#e0c2a0'][k % 3]; q.fillRect(x, y, 8, 9); q.strokeStyle = '#38e07a'; q.strokeRect(x - 3, y - 3, 14, 15); } }),
    bee: draw('beef', 256, 192, (q, w, h) => { q.fillStyle = '#f7e9b0'; q.fillRect(0, 0, w, h); q.fillStyle = '#f2b21e'; q.beginPath(); q.ellipse(128, 100, 62, 44, 0, 0, 7); q.fill(); q.fillStyle = '#231a10'; for (const x of [100, 128, 156]) q.fillRect(x - 7, 60, 14, 80); q.beginPath(); q.arc(70, 92, 26, 0, 7); q.fill(); q.fillStyle = '#fff'; q.beginPath(); q.arc(62, 86, 8, 0, 7); q.fill(); q.fillStyle = '#ffffffaa'; q.beginPath(); q.ellipse(140, 46, 40, 18, -.3, 0, 7); q.fill(); }) };
  /** Register a prop: title, where to stand to use it, and name fragments of the worlds it stands for. */
  const P = (title, x, y, z, worlds, label) => { out.push({ car: car.i, title, at: [x, y, z], worlds }); plaque(label || title.split(/[,;:]/)[0], x, z < car.aisleZ ? -1 : 1); };
  const begin = i => { car = train.cars[i]; }, end = () => b.build(car.group);

  // ---- 2 · dining car: sealed velocity (Bullet Train, Snowpiercer)
  begin(2);
  { const x = L / 2 - 1.2; for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) b.box(M.steel, x + c * .46 - .23, .3 + r * .44, -1.26, .44, .42, .3); b.box(M.black, x - .23, 1.18, -1.1, .4, .38, .02); b.box(X.gold, x - .23, 1.1, -1.18, .3, .2, .1);
    P('Smart lockers, one open on a silver briefcase', x, 1.2, -.9, ['smartlocker', 'lovesyou', 'firstclasscabin', 'breachedexterior']); }
  { const x = bayX(5) + 1.2; b.box(M.steel, x, .5, .22, .8, .9, .42); for (let k = 0; k < 6; k++) b.cyl(X.water, x - .3 + k * .12, 1.05, .22, .035, .035, .2, 8); for (const e of [-1, 1]) b.cyl(M.black, x + e * .3, .06, .22, .06, .06, .05, 10, Math.PI / 2);
    P('Concession cart, jammed in the aisle', x, 1.0, .1, ['concessioncart', 'quietcar', 'automatedtrainlavatory']); }
  { const x = bayX(4), z = -1.0; b.box(X.water, x, 1.0, z, .78, .42, .5); b.box(M.brass, x, .78, z, .82, .04, .54); b.box(M.brass, x, 1.22, z, .82, .03, .54); for (let k = 0; k < 4; k++) b.sph(X.graf[0], x - .25 + k * .17, .95 + (k % 2) * .1, z, .05, .03, .02);
    P('Sushi aquarium and its pump', x, 1.1, -.5, ['sushiaquarium', 'waterreclamation']); }
  { const x = bayX(3), z = 1.0; b.box(M.steel, x, 1.05, z, .6, .56, .5); b.box(M.black, x - .45, .79, z, .3, .04, .3); for (let k = 0; k < 3; k++) b.box(M.black, x - .45, .83 + k * .05, z, .16, .045, .09);
    P('Protein block machine', x, 1.1, .5, ['proteinblock', 'kronolestorage', 'kronolereserve', 'dentedoor', 'dented']); }
  { const x0 = bayX(1); b.box(M.brass, x0, 1.92, -1.05, 1.8, .03, .03); for (let k = 0; k < 5; k++) { b.sph(M.linen, x0 - .7 + k * .35, 1.62, -1.05, .09, .16, .09); b.cyl(M.iron, x0 - .7 + k * .35, 1.84, -1.05, .008, .008, .16, 4); }
    P('Butcher’s rail of hanging chickens', x0, 1.5, -.5, ['butcherstation', 'tailorstation']); }
  { const x = bayX(0) - .3; b.box(M.black, x, 1.45, -1.38, 1.5, .9, .03); b.box(M.wood, x, .98, -1.36, 1.56, .05, .06); for (let k = 0; k < 4; k++) b.box(X.white, x - .5 + k * .33, 1.5 + (k % 2) * .12, -1.36, .22, .02, .01);
    P('Blackboard: the anthem, in chalk', x, 1.3, -.5, ['classroomcar', 'intercomspeaker', 'sacredengine', 'wilfordpocketwatch']); }
  { const x = bayX(1), z = 1.25; for (let k = 0; k < 2; k++) b.box(M.steel, x + k * 1.0 - .5, .2, z, .95, .34, .36); b.box(M.steel, x - .5, .2, z - .32, .95, .3, .3); b.box(M.linen, x - .5, .38, z - .32, .7, .06, .22); b.sph(M.walnut, x - .82, .43, z - .32, .09);
    P('Prison drawer, a man asleep in it', x, .6, .55, ['prisondrawer', 'childlaborer', 'nightvision', 'hatchetblade']); }
  { const x = bayX(2) - .74; b.sph(X.pink, x, .95, -.95, .26, .34, .24); b.sph(X.pink, x, 1.38, -.95, .22); for (const e of [-1, 1]) b.sph(X.pink, x, 1.6, -.95 + e * .14, .07); b.sph(M.walnut, bayX(6), .8, .98, .11, .05, .06);
    P('Mascot suit, slumped; and the shoe', x + .5, 1.1, -.45, ['momomon', 'masonsshoe', 'violinstrings', 'greenhousecar']); }
  { const x = -L / 2 + 1.2; b.sph(X.snow, x, .12, .9, .9, .22, .5); b.sph(X.snow, x + .6, .08, .2, .6, .12, .4); for (let k = 0; k < 5; k++) b.box(M.glass, x - .2 + k * .12, .2 + k * .03, 1.2, .1, .14, .01, k);
    P('Shattered window; snow across the linen', x, .6, .5, ['shatteredwindow', 'frozenseoul', 'polarbear', 'frozenbody', 'yekaterina', 'frozenskyscraper', 'icejam']); }
  { // detail: dining car
    const lx = L / 2 - 1.2; for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const n = 520 + r * 2 + c + (r === 2 && c === 0 ? 7 : 0), px = lx + c * .46 - .23, py = .3 + r * .44; if (!(r === 2 && c === 0)) { decal(text('0' + n, { w: 128, h: 64, bg: '#7d8684', fg: '#1c2224', border: false, font: 'monospace' }), px, py + .1, -1.105, .2, .09); b.cyl(M.brass, px + .15, py - .05, -1.1, .02, .02, .03, 8, Math.PI / 2); } }
    b.box(M.steel, lx - .23, 1.14, -1.02, .34, .22, .09); b.box(M.iron, lx - .23, 1.27, -1.02, .12, .03, .02); for (const e of [-.1, .1]) b.box(M.brass, lx - .23 + e, 1.14, -.972, .03, .05, .01); decal(text('0527', { w: 128, h: 64, bg: '#111', fg: '#ffd35a', border: false, font: 'monospace' }), lx - .23, 1.36, -1.09, .2, .08);
    const cx = bayX(5) + 1.2; b.box(M.brass, cx + .46, 1.0, .22, .03, .03, .44); for (const e of [-.2, .2]) b.box(M.brass, cx + .46, .9, .22 + e, .03, .22, .03); b.box(M.steel, cx, .96, .22, .82, .02, .44); for (let k = 0; k < 4; k++) b.box(X.graf[k], cx - .28 + k * .15, .52, .0, .12, .16, .02); decal(text('WATER · TEA · NUTS', { w: 512, h: 96, bg: '#1f6e6a' }), cx, .72, -.0, .7, .13);
    const ax = bayX(4), az = -1.0; b.box(M.stone, ax, .82, az, .74, .05, .46); for (let k = 0; k < 5; k++) b.box(M.leaf, ax - .3 + k * .15, .93, az - .1 + (k % 2) * .16, .02, .18 + (k % 3) * .06, .05); for (let k = 0; k < 4; k++) { const fx = ax - .25 + k * .17, fy = .95 + (k % 2) * .1; b.sph(X.graf[0], fx, fy, az, .055, .03, .02); b.box(X.graf[0], fx - .06, fy, az, .03, .05, .005); }
    for (let k = 0; k < 6; k++) b.sph(X.white, ax + .28, .9 + k * .05, az + .1, .012); b.box(M.iron, ax + .5, .86, az, .14, .16, .2); for (let k = 0; k < 3; k++) { b.cyl(M.china, ax - .25 + k * .25, .775, az + .36, .08, .08, .012, 12); b.box(X.white, ax - .25 + k * .25, .8, az + .36, .07, .03, .035); b.box(X.graf[0], ax - .25 + k * .25, .822, az + .36, .07, .012, .036); }
    const mx = bayX(3), mz = 1.0; b.cyl(M.steel, mx, 1.44, mz, .22, .1, .22, 10); b.box(M.steel, mx - .34, .92, mz, .12, .1, .18, 0, .5); b.cyl(M.brass, mx + .32, 1.2, mz - .2, .012, .012, .22, 5, 0, .6); b.sph(M.red, mx + .38, 1.3, mz - .2, .03); decal(draw('gauge', 96, 96, (q) => { q.fillStyle = '#efe6cf'; q.beginPath(); q.arc(48, 48, 44, 0, 7); q.fill(); q.strokeStyle = '#222'; q.lineWidth = 4; q.stroke(); q.beginPath(); q.moveTo(48, 48); q.lineTo(74, 26); q.stroke(); }), mx, 1.12, mz - .255, .16, .16, Math.PI);
    const kx = bayX(1); for (let k = 0; k < 5; k++) { const px = kx - .7 + k * .35; b.sph(M.linen, px, 1.47, -1.05, .035, .05, .035); b.box(M.red, px, 1.42, -1.05, .012, .03, .03); for (const e of [-.03, .03]) b.cyl(M.bloom, px + e, 1.78, -1.05, .008, .008, .12, 4); }
    const bx = bayX(0) - .3; decal(draw('chalk', 512, 300, (q, w, h) => { q.fillStyle = '#16211c'; q.fillRect(0, 0, w, h); q.fillStyle = '#e9efe6'; q.font = 'italic 46px Georgia'; q.textAlign = 'center'; ['The train goes on', 'and on and on.', 'What happens if', 'the engine stops?'].forEach((l, k) => q.fillText(l, w / 2, 70 + k * 62)); q.strokeStyle = '#e9efe6'; q.lineWidth = 3; q.strokeRect(14, 14, w - 28, h - 28); }), bx, 1.45, -1.36, 1.42, .82); b.box(X.white, bx + .5, 1.02, -1.33, .12, .04, .05);
    const dx = bayX(1); b.box(X.graf[1], dx - .4, .37, 1.25 - .32, .5, .05, .26); b.sph(M.black, dx - .82, .47, 1.25 - .32, .095, .06, .09); for (let k = 0; k < 2; k++) b.box(M.brass, dx + k * 1.0 - .5, .2, 1.065, .2, .02, .02);
    const sx = bayX(2) - .74; for (const e of [-1, 1]) b.sph(M.black, sx + .2, 1.42, -.95 + e * .08, .028); b.sph(X.white, sx + .17, .95, -.95, .16, .22, .18); b.sph(M.red, sx + .22, 1.34, -.95, .03); b.box(M.walnut, bayX(6), .79, .98, .24, .06, .09); b.sph(M.walnut, bayX(6) + .1, .8, .98, .06, .05, .05); b.box(M.black, bayX(6) - .08, .76, .98, .1, .03, .09);
  }
  end();

  // ---- 3 · greenhouse: half for me, half for them (Honeyland)
  begin(3);
  { const x = 3.6; for (let k = 0; k < 9; k++) b.box(M.stone, x + (k % 3) * .7 - .7, .7 + Math.floor(k / 3) * .62, -1.12 + (k % 2) * .08, .8, .66, .5); b.box(M.black, x, 1.3, -.86, .5, .16, .06); b.box(M.honey, x, 1.3, -.84, .4, .1, .04); train.cars[3].glows.push([x, 1.3, -.8, .8, 0xffc04a]);
    P('Limestone cliff, comb glowing in the crevice', x, 1.2, -.4, ['limestonecrevice', 'spidercaves', 'halfforthem', 'macedonianbee']); }
  { const x = .6; b.cyl(M.walnut, x, .74, 1.0, .2, .22, 1.1, 10, 0, Math.PI / 2); b.cyl(M.black, x + .56, .74, 1.0, .12, .12, .02, 10, 0, Math.PI / 2);
    P('Hollowed tree-trunk hive', x, .9, .45, ['hollowedtree', 'verbaltransaction']); }
  { const x = -2.4; for (let k = 0; k < 7; k++) { const px = x + (k % 4) * .28 - .4, pz = -1.0 + Math.floor(k / 4) * .3; b.box(M.stone, px, .62, pz, .2, .18, .18); b.box(M.straw, px, .74, pz, .24, .06, .22); }
    P('The abandoned village, doll-size', x, .8, -.45, ['bekirlija', 'yugoslavarchive', 'colonycollapse']); }
  { const x = -5.2; b.box(M.wood, x, .62, 1.0, 1.7, .2, .62); b.box(X.graf[0], x - .1, .78, 1.0, 1.4, .14, .6); b.sph(M.linen, x + .6, .86, 1.0, .14, .08, .12); b.cyl(M.linen, x + .95, .8, .78, .02, .02, .14, 6); b.sph(M.lamp, x + .95, .9, .78, .025); train.cars[3].glows.push([x + .95, .9, .78, .5]);
    P('The winter bed, a candle beside it', x, .9, .45, ['winterboundbed']); }
  { const x = 6.4; b.box(M.wood, x, .78, -1.0, 1.0, .05, .5); for (let k = 0; k < 6; k++) b.cyl(M.honey, x - .36 + k * .14, .87, -1.05, .045, .045, .13, 8); b.cyl(M.brass, x + .36, .9, -.88, .012, .012, .22, 5); b.box(M.brass, x + .36, 1.0, -.88, .3, .01, .02);
    P('Market stall: honey by the jar, a brass scale', x, .95, -.45, ['skopjemarket', 'arrivalofhussein']); }
  { for (const [x, z] of [[-.8, .22], [-1.9, -.2]]) { b.box(M.walnut, x, .62, z, .9, .46, .34); b.box(M.walnut, x + .5, .78, z, .26, .26, .24); for (const e of [-.3, .3]) for (const s of [-.1, .1]) b.box(M.walnut, x + e, .2, z + s, .08, .4, .08); }
    P('Calves, wedged in the aisle', -1.3, .8, 0, ['arrivalofhussein', 'macedonianbeelineage']); }
  { const x = -7.2; for (let k = 0; k < 4; k++) { b.box(X.white, x + k * .5, .68, -1.02, .42, .34, .36); b.box(M.roof, x + k * .5, .87, -1.02, .46, .03, .4); }
    P('White box hives, opened too fast', x + .7, .9, -.45, ['langstroth', 'colonycollapsethreshold', 'apiculturalmuseum']); }
  { const x = 2.2; b.box(M.wood, x, .78, 1.02, .9, .05, .5); b.cyl(M.iron, x - .25, .86, 1.02, .12, .12, .03, 12); b.cyl(M.iron, x + .2, .86, 1.02, .12, .12, .03, 12); for (let k = 0; k < 6; k++) b.box(M.black, x - .35 + k * .14, 1.5, 1.2, .03, 1.0, .004);
    P('Editing bench; footage hanging like vines', x, 1.0, .5, ['editingroom', 'sundanceawards']); }
  { const x = -3.9; b.box(M.cream, x, .72, 1.05, .7, .4, .5); for (const e of [-.28, 0, .28]) b.cyl(M.cream, x + e, 1.02, .86, .04, .04, .22, 8); b.box(M.cream, x, 1.16, 1.05, .76, .06, .56); b.cyl(X.gold, x + .7, .7, 1.0, .05, .08, .3, 8);
    P('A small sun temple; a trophy among the tomatoes', x, .95, .5, ['egyptiansuntemple', 'sundance']); }
  { // detail: greenhouse
    const cx = 3.6; for (let k = 0; k < 7; k++) b.cyl(k % 3 ? M.honey : M.lamp, cx - .18 + (k % 4) * .12, 1.24 + Math.floor(k / 4) * .1 + (k % 2) * .05, -.83, .06, .06, .06, 6, Math.PI / 2); b.cyl(M.honey, cx + .05, 1.06, -.83, .012, .02, .22, 5); for (let k = 0; k < 4; k++) b.box(M.stone, cx - .9 + k * .55, .45 + k * .5, -.92, .3, .06, .16);
    const tx = .6; for (const e of [-.4, -.1, .25]) b.cyl(M.black, tx + e, .74, 1.0, .225, .225, .03, 10, 0, Math.PI / 2); for (const e of [-.4, .4]) b.box(M.wood, tx + e, .5, 1.0, .08, .1, .4); b.box(M.straw, tx, .98, 1.0, 1.2, .03, .5);
    const vx = -2.4; b.cyl(M.linen, vx + .5, .78, -1.12, .04, .05, .5, 8); b.sph(M.stone, vx + .5, 1.06, -1.12, .06, .08, .06); b.sph(M.cream, vx - .2, .76, -.74, .1, .08, .1);
    const bx = -5.2; b.box(M.walnut, bx + .86, .98, 1.0, .06, .7, .64); b.box(X.white, bx + .55, .86, 1.0, .3, .08, .4); b.sph(M.walnut, bx + .6, .93, 1.0, .09, .08, .09); b.sph(M.linen, bx + .6, .95, 1.0, .1, .06, .1); b.box(M.wood, bx + 1.0, .5, .74, .3, .5, .3);
    const mx = 6.4; for (const e of [-.3, .3]) { b.cyl(M.brass, mx + .36 + e * .45, .93, -.88, .07, .07, .012, 12); b.cyl(M.brass, mx + .36 + e * .45, .97, -.88, .004, .004, .08, 4); } for (let k = 0; k < 4; k++) b.box(k % 2 ? X.graf[0] : M.cream, mx - .38 + k * .25, 1.55, -1.0, .25, .03, .6, 0, 0, .25); for (const e of [-.5, .5]) b.cyl(M.wood, mx + e, 1.15, -1.25, .02, .02, .8, 6); decal(text('HONEY\nby the jar', { w: 256, h: 128, bg: '#6b4226' }), mx, 1.25, -.72, .5, .25);
    for (const [x, z] of [[-.8, .22], [-1.9, -.2]]) { for (const e of [-1, 1]) b.sph(M.walnut, x + .52, .93, z + e * .13, .05, .03, .06); b.box(M.linen, x + .65, .74, z, .06, .12, .18); b.box(X.white, x - .1, .7, z + .175, .34, .2, .01); b.cyl(M.walnut, x - .47, .62, z, .015, .01, .34, 5, 0, .3); for (const e of [-1, 1]) b.sph(M.black, x + .62, .82, z + e * .08, .02); }
    const hx = -7.2; for (let k = 0; k < 4; k++) { b.box(M.black, hx + k * .5, .56, -.835, .16, .025, .01); b.box(M.wood, hx + k * .5 - .2, .7, -1.02, .02, .06, .1); } for (let k = 0; k < 4; k++) b.box(M.wood, hx + 1.5 - .12 + k * .08, .98, -1.02, .02, .2, .3); b.box(M.roof, hx + 1.5, .9, -.72, .46, .03, .4, 0, .0, .7);
    const ex = 2.2; b.box(M.crt, ex + .05, .98, 1.18, .3, .26, .2); decal(screens.bee, ex + .05, .98, 1.075, .24, .19, Math.PI); for (let k = 0; k < 6; k++) decal(draw('strip', 32, 256, (q) => { q.fillStyle = '#17120e'; q.fillRect(0, 0, 32, 256); for (let y = 6; y < 256; y += 32) { q.fillStyle = '#c9a25a'; q.fillRect(6, y, 20, 22); q.fillStyle = '#eee'; q.fillRect(1, y + 4, 3, 5); q.fillRect(28, y + 4, 3, 5); } }), ex - .35 + k * .14, 1.5, 1.19, .05, 1.0, Math.PI);
    const sx = -3.9; decal(screens.bee, sx, .74, .795, .3, .22, Math.PI); b.box(M.cream, sx, 1.24, 1.05, .5, .1, .4); b.sph(X.gold, sx + .7, .9, 1.0, .07, .06, .07); for (const e of [-1, 1]) b.box(X.gold, sx + .7 + e * .08, .9, 1.0, .02, .08, .02);
  }
  end();

  // ---- 4 · apiary: the beekeepers
  begin(4);
  { const x = -6.2; b.box(M.black, x, 1.2, -1.36, 1.3, 1.5, .06); for (let k = 0; k < 6; k++) b.box(M.iron, x - .5 + k * .2, 1.2, -1.3, .04, 1.1, .05); b.box(M.walnut, x + .9, 1.2, -1.2, .06, 1.5, .5); for (let k = 0; k < 4; k++) b.cyl(M.honey, x + .9, .7 + k * .3, -1.05, .05, .05, .12, 8);
    P('A shelf of honey jars, swung open on rifles', x, 1.2, -.5, ['armoryconcealed', 'beachassault', 'overlookcommand']); }
  { const x = 6.6; b.cyl(M.steel, x, .5, 1.0, .34, .34, .9, 14); b.cyl(M.black, x, .96, 1.0, .3, .3, .02, 14); b.box(M.walnut, x, .1, 1.0, .5, .12, .5); for (let k = 0; k < 3; k++) b.box(X.graf[k], x - .1 + k * .1, .2, 1.0, .08, .02, .12);
    P('Honey centrifuge with a false bottom', x, .9, .45, ['falsebottom', 'anisetteterminal']); }
  { for (let k = 0; k < 16; k++) b.box(X.white, 3.6 - k * .2, .42, .78, .07, .8, .02); b.box(X.white, 2.1, .55, .78, 3.2, .05, .02); b.box(M.leaf, 2.1, .01, 1.05, 3.2, .02, .5); b.box(M.walnut, .4, .5, 1.0, .05, 1.0, .05); b.box(M.red, .4, 1.05, 1.0, .22, .16, .3);
    P('A white picket fence, a lawn, a mailbox', 2.2, .8, .4, ['whitepicketfence', 'rainyairport']); }
  { const x = -1.2; b.box(M.wood, x, .78, -1.05, .7, .05, .5); b.box(M.walnut, x, .9, -1.05, .44, .2, .03, .3); b.sph(M.linen, x, 1.15, -1.05, .1, .2, .1);
    P('A hive frame, still smouldering', x, 1.0, -.5, ['smolderinghive']); }
  { const x = -3.4; b.box(M.crt, x, .95, 1.1, .6, .5, .5); b.box(X.green, x, .97, .845, .46, .34, .01); b.box(M.iron, x + .9, .9, 1.15, .5, 1.7, .4); for (let k = 0; k < 6; k++) b.box(k % 2 ? X.green : M.red, x + .9, .3 + k * .26, .945, .3, .03, .01); b.box(M.honey, x + .9, .04, .9, .5, .02, .2);
    P('A terminal tracing the world; servers dripping honey', x + .4, 1.0, .5, ['globaltracing', 'offshorefinancial', 'concretestairwell', 'audiorecording']); }
  { const x = 1.4; b.box(M.glass, x, 1.05, -1.02, .8, 2.0, .7); for (const [ex, ez] of [[-.4, -.35], [.4, -.35], [-.4, .35], [.4, .35]]) b.box(M.iron, x + ex, 1.05, -1.02 + ez, .03, 2.0, .03); b.cyl(M.iron, x, .75, -1.02, .16, .2, 1.3, 8); b.sph(M.walnut, x, 1.55, -1.02, .12);
    P('A glass office, a man in a suit pounding on it', x, 1.2, -.45, ['glassenclosure', 'bostonfbi']); }
  { const x = 4.6; b.sph(M.steel, x, 2.0, -.9, .2); b.box(M.steel, x, .95, -1.2, 1.4, .06, .3); b.box(M.glass, x, 1.4, -1.34, 1.4, .8, .02); for (let k = 0; k < 5; k++) b.cyl(X.graf[k], x - .5 + k * .25, 1.06, -1.2, .03, .03, .18, 6);
    P('A mirrored bar under a slow disco ball', x, 1.1, -.5, ['highsocietynightclub']); }
  { const x = -L / 2 + 2.0; b.box(M.black, x, .7, .95, 2.0, 1.2, .9); b.box(M.iron, x - .5, 1.5, .95, .9, .5, .86); for (const e of [-.7, .7]) b.cyl(M.black, x + e, .25, .5, .26, .26, .2, 12, Math.PI / 2); b.box(M.red, x + 1.0, .6, .95, .02, .2, .6);
    P('The burned-out shell of an armoured truck', x + .6, 1.0, .35, ['wreckedtactical', 'rooftophelicopter']); }
  { // detail: apiary
    const rx = -6.2; for (let k = 0; k < 6; k++) { b.box(M.wood, rx - .5 + k * .2, .82, -1.29, .05, .4, .07); b.box(M.iron, rx - .5 + k * .2, 1.0, -1.27, .02, .1, .05); } for (let r = 0; r < 3; r++) { b.box(M.walnut, rx + .9, .56 + r * .3, -1.2, .08, .02, .5); for (let k = 0; k < 4; k++) jar(rx + .9, .58 + r * .3, -1.4 + k * .11); }
    const cx = 6.6; b.cyl(M.brass, cx + .36, .72, 1.0, .012, .012, .3, 5, 0, Math.PI / 2); b.cyl(M.wood, cx + .5, .62, 1.0, .02, .02, .14, 6); b.cyl(M.brass, cx - .36, .25, 1.0, .02, .03, .1, 6, 0, Math.PI / 2); for (const [ex, ez] of [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]]) b.cyl(M.iron, cx + ex, .03, 1.0 + ez, .025, .025, .06, 6); b.box(M.iron, cx + .14, .22, .78, .16, .03, .04); b.box(M.iron, cx + .2, .17, .78, .04, .1, .04); decal(text('PASSPORT', { w: 128, h: 96, bg: '#1e3a5f', fg: '#e8c98a' }), cx - .1, .25, .745, .12, .09, Math.PI);
    for (let k = 0; k < 16; k++) b.cyl(X.white, 3.6 - k * .2, .85, .78, .0, .04, .07, 4); b.box(M.iron, .4, 1.14, 1.0, .24, .04, .32); b.box(M.red, .52, 1.2, 1.17, .02, .12, .08); b.box(X.paper, .28, 1.06, .9, .02, .1, .16); for (let k = 0; k < 7; k++) b.sph(k % 2 ? M.bloom : M.red, 1.0 + k * .4, .06, 1.05 + (k % 3) * .1, .03);
    const fx = -1.2; for (const e of [-.2, .2]) b.box(M.wood, fx + e, .92, -1.05, .025, .3, .025); for (const e of [-.14, .14]) b.box(M.wood, fx, .92 + e, -1.05, .42, .025, .025); b.box(M.honey, fx - .1, .92, -1.05, .2, .26, .02); b.box(M.black, fx + .1, .92, -1.05, .2, .26, .022); for (let k = 0; k < 3; k++) b.sph(M.linen, fx + .1 + k * .04, 1.3 + k * .18, -1.05, .07 + k * .03); b.sph(M.red, fx + .12, .86, -1.04, .03);
    const tx = -3.4; decal(screens.map, tx, .97, .838, .44, .33, Math.PI); b.box(M.crt, tx, .7, .82, .5, .04, .2); for (let k = 0; k < 5; k++) { b.cyl(M.honey, tx + .78 + (k % 3) * .1, .5 - k * .08, .94, .012, .02, .12, 5); } b.sph(M.honey, tx + .9, .04, .86, .12, .02, .1);
    const gx = 1.4; b.box(M.black, gx, 1.22, -1.02, .1, .26, .02); b.box(M.red, gx, 1.2, -.86, .035, .22, .01); b.box(M.wood, gx, .5, -.8, .5, .04, .25); b.box(M.black, gx + .12, .56, -.8, .12, .05, .1); for (const e of [-1, 1]) b.cyl(M.iron, gx + e * .18, 1.5, -.82, .04, .04, .4, 6, .8);
    const bx = 4.6; b.cyl(M.iron, bx, 2.3, -.9, .006, .006, .5, 4); for (let k = 0; k < 14; k++) { const a = k * .45; b.box(X.white, bx + Math.cos(a) * .2, 2.0 + Math.sin(k * 1.3) * .12, -.9 + Math.sin(a) * .2, .04, .04, .01, -a); } for (let k = 0; k < 3; k++) { b.cyl(M.iron, bx - .45 + k * .45, .4, -.85, .02, .02, .8, 6); b.cyl(M.leather, bx - .45 + k * .45, .82, -.85, .14, .14, .05, 12); } decal(text('BAR', { w: 256, h: 128, bg: '#3a0f1a', fg: '#ff7ab0' }), bx, 1.7, -1.3, .5, .25);
    const kx = -L / 2 + 2.0; for (const e of [-.7, .7]) wheel(kx + e, .25, .5, .26); b.box(M.glass, kx - .5, 1.52, .5, .7, .36, .02); b.box(M.black, kx + .3, 1.36, .95, 1.3, .06, .86); for (let k = 0; k < 5; k++) b.box(M.iron, kx - .8 + k * .4, 1.42 + (k % 2) * .1, .7 + (k % 3) * .2, .08, .2, .06, k, .4); for (const e of [-1, 1]) b.box(M.black, kx + 1.06, .8, .95 + e * .62, .04, .9, .5, e * .9);
  }
  end();

  // ---- 5 · mirror corridor: the angels (monochrome, one wall of colour)
  begin(5);
  { for (let k = 0; k < 14; k++) b.box(X.graf[k % 5], 6.4 - k * .92, .3 + (k % 3) * .14, 1.38, .9, .5 + (k % 2) * .16, .03);
    P('The wall: graffiti, the only colour here', 2, .8, .9, ['berlinwallgraffiti', 'potsdamerplatz', 'berlinwall']); }
  { const x = 4.2, z = 1.12; b.cyl(M.steel, x, .5, z, .13, .16, 1.0, 8); b.box(M.steel, x, 1.2, z, .44, .5, .26); b.sph(M.steel, x, 1.62, z, .13, .16, .14); for (const e of [-1, 1]) b.cyl(M.steel, x, 1.1, z + e * .3, .05, .05, .6, 6);
    P('A suit of plate armour', x, 1.2, .6, ['proparmor', 'cannes']); }
  { const x = 1.0; b.box(X.paper, x, .02, .5, .3, .01, .22); b.box(M.walnut, x, .016, .5, .02, .012, .24);
    P('A notebook, a child’s hand writing in it', x, .5, .5, ['handke', 'songofchildhood', 'peterhandke']); }
  { const x = -2.2; b.box(M.brass, x, 1.75, .6, .02, .02, 1.3); for (const e of [-.6, .6]) b.cyl(M.linen, x, 2.0, .6 + e, .008, .008, .5, 4); for (const e of [-1, 1]) b.box(X.white, x, 1.55, .6 + e * .25, .4, .5, .03, 0, e * .5);
    P('A trapeze, swinging the width of the car', x, 1.5, .6, ['circusalekan', 'circus']); }
  { const x = -5.0; b.box(X.mono, x, .75, 1.12, .5, 1.5, .4); b.box(X.mono, x, 1.6, 1.12, .7, .3, .6); b.box(M.lamp, x, 1.6, .82, .2, .1, .01); for (let k = 0; k < 5; k++) b.box(M.iron, x + .6 + k * .2, .3, 1.2, .02, .6, .02);
    P('A watchtower over raked sand and wire', x, 1.2, .6, ['potsdamerplatzdeathstrip', 'anhalter']); }
  { const x = 6.0; b.box(M.iron, x, .86, 1.12, 1.0, .1, .44, 0, 0, .2); for (let k = 0; k < 8; k++) b.cyl(M.steel, x - .4 + k * .11, .95, 1.1, .02, .02, .05, 6); b.box(M.walnut, x, .42, 1.14, .9, .8, .4);
    P('A mixing desk, its meters twitching', x, 1.0, .6, ['hansastudios', 'nickcave', 'kaisersaal', 'grandhotel']); }
  { const x = -6.6; b.cyl(X.mono, x, .8, 1.1, .28, .32, 1.6, 6); b.cyl(X.mono, x, 1.75, 1.1, .1, .28, .4, 6); b.box(M.black, x, 1.0, .82, .14, .4, .02);
    P('The bombed stump of a church tower', x, 1.2, .6, ['kaiserwilhelm', 'victorycolumn']); }
  { for (const x of [5.2, -.4, -3.6]) { b.cyl(M.black, x, .85, -.12, .17, .2, 1.7, 8); b.sph(X.mono, x, 1.78, -.12, .11); }
    P('Men in overcoats, listening', -.4, 1.4, .3, ['statelibrary', 'berlinstatelibrary', 'ubahn', 'peterfalk', 'colortiming', 'original35mm']); }
  { // detail: mirror corridor
    decal(draw('graf', 1024, 256, (q, w, h) => { const C = ['#e0483a', '#2f8fd0', '#f0c020', '#3cb46a', '#d060c0', '#ffffff']; q.fillStyle = '#8f8a82'; q.fillRect(0, 0, w, h); for (let k = 0; k < 60; k++) { q.strokeStyle = q.fillStyle = C[k % 6]; q.lineWidth = 6 + (k % 4) * 5; q.beginPath(); const x = (k * 173) % w, y = 30 + (k * 97) % (h - 60); q.moveTo(x, y); q.bezierCurveTo(x + 60, y - 70, x + 90, y + 80, x + 160, y - 10); q.stroke(); if (k % 5 === 0) { q.font = '900 70px Impact, sans-serif'; q.fillText(['FREI', 'NOW', 'HIMMEL', 'KIND', 'ICH'][k % 5 === 0 ? (k / 5) % 5 : 0], x, y + 40); } } }), 0, .52, 1.355, 13.6, .9, Math.PI);
    const ax = 4.2, az = 1.12; b.box(M.black, ax, 1.62, az - .13, .16, .03, .01); b.cyl(M.red, ax, 1.86, az, .02, .05, .26, 6); for (const e of [-1, 1]) b.sph(M.steel, ax, 1.42, az + e * .26, .1, .08, .1); b.box(M.steel, ax + .16, .9, az - .28, .03, 1.2, .05); b.box(M.brass, ax + .16, 1.45, az - .28, .05, .04, .26); b.cyl(M.steel, ax, .98, az, .18, .2, .1, 8);
    const nx = 1.0; decal(draw('hand', 256, 192, (q, w, h) => { q.fillStyle = '#efe6cf'; q.fillRect(0, 0, w, h); q.strokeStyle = '#27324a'; q.lineWidth = 2.5; for (let l = 0; l < 6; l++) { q.beginPath(); for (let x = 16; x < w - 16 - (l === 5 ? 110 : 0); x += 6) q.lineTo(x, 28 + l * 28 + Math.sin(x * .4 + l) * 6 + Math.sin(x * .13) * 3); q.stroke(); } }), nx, .032, .5, .28, .2, 0, -Math.PI / 2); b.cyl(M.bloom, nx + .2, .035, .44, .008, .008, .16, 5, Math.PI / 2, .4);
    const tx = -2.2; b.sph(M.linen, tx, 1.93, .6, .09, .1, .09); b.cyl(M.red, tx, 1.72, .6, .1, .13, .34, 8); for (const e of [-1, 1]) b.cyl(M.linen, tx + .12, 1.52, .6 + e * .08, .035, .03, .4, 6, 0, 1.2);
    const wx = -5.0; for (const [ex, ez] of [[-.2, -.15], [.2, -.15], [-.2, .15], [.2, .15]]) b.box(M.iron, wx + ex, .4, 1.12 + ez, .04, .8, .04); b.cyl(M.lamp, wx, 1.6, .7, .03, .12, .22, 8, Math.PI / 2); b.box(M.cream, wx + 1.0, .012, 1.0, 1.6, .02, .5); for (let k = 0; k < 7; k++) b.cyl(M.iron, wx + .55 + k * .16, .62, 1.2, .07, .07, .012, 8, 0, Math.PI / 2);
    const mx = 6.0; decal(draw('faders', 256, 128, (q, w, h) => { q.fillStyle = '#1a1c1e'; q.fillRect(0, 0, w, h); for (let k = 0; k < 12; k++) { q.fillStyle = '#444'; q.fillRect(14 + k * 20, 14, 4, 80); q.fillStyle = k % 3 ? '#ddd' : '#e0483a'; q.fillRect(9 + k * 20, 30 + (k * 23) % 50, 14, 9); } q.fillStyle = '#ffd35a'; for (let k = 0; k < 4; k++) q.fillRect(14 + k * 58, 104, 44, 14); }), mx, .93, 1.1, .92, .4, Math.PI, -1.25); for (const e of [-.3, .3]) wheel(mx + e, 1.3, 1.32, .14, M.iron);
    const sx = -6.6; for (let k = 0; k < 5; k++) b.box(X.mono, sx - .2 + k * .1, 1.98 + (k % 2) * .12, 1.1, .08, .3 + (k % 3) * .1, .1); for (let k = 0; k < 3; k++) b.box(M.black, sx - .16 + k * .16, 1.3, .82, .08, .26, .02);
    for (const x of [5.2, -.4, -3.6]) { b.box(M.black, x - .1, 1.66, -.12, .05, .16, .03); b.cyl(M.black, x, .2, -.12, .2, .23, .4, 8); b.box(X.mono, x, 1.52, -.0, .2, .08, .06); }
    for (const e of [-1, 1]) b.plane(M.glass, -.4, 1.5, -.12 + e * .3, .5, .7, 0);
  }
  end();

  // ---- 6 · surveillance: the breach
  begin(6);
  { const x = 3.5; b.box(M.walnut, x, .76, -.62, 3.0, .05, .44); for (const e of [-1.3, 1.3]) b.box(M.walnut, x + e, .38, -.62, .06, .76, .4); for (let k = 0; k < 5; k++) { b.cyl(M.brass, x - 1.2 + k * .6, 1.0, -.72, .008, .008, .44, 4); b.box(X.graf[k], x - 1.13 + k * .6, 1.15, -.72, .14, .1, .005); b.box(X.paper, x - 1.2 + k * .6, .79, -.55, .2, .004, .28); }
    P('The treaty table: flags, unsigned papers', x, 1.0, -.2, ['diplomaticthreshold', 'ethicalframeworks', 'ijcai', 'senatevulnerability']); }
  { const x = -.2; b.box(M.steel, x, .78, .62, 1.8, .04, .4); for (let k = 0; k < 6; k++) { const px = x - .75 + k * .3; b.box(M.black, px, .83, .62, .1, .03, .1); for (const [ex, ez] of [[-.07, -.07], [.07, .07], [-.07, .07], [.07, -.07]]) b.cyl(M.iron, px + ex, .85, .62 + ez, .035, .035, .006, 8); }
    P('A bench of palm-size quadcopters', x, 1.0, .3, ['commercialorigin', 'academictestbed', 'agridyne', 'yolo', 'maven']); }
  { const x = -3.2; b.box(X.foam, x, 1.05, -.72, .9, 2.0, .5); for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) b.box(M.black, x - .28 + k * .28, .4 + r * .36, -.45, .2, .2, .12, .78, .78); b.box(M.black, x, 1.3, -.2, .1, .03, .1);
    P('An anechoic booth; one drone hovering in it', x, 1.2, -.1, ['psychoacoustic', 'graphicalthreshold', 'simulatedcampus']); }
  { const x = 1.0; b.box(M.steel, x, .6, .72, 1.7, .05, .5); b.box(X.white, x, .68, .72, 1.6, .1, .46); for (const e of [-.75, .75]) b.cyl(M.steel, x + e, .3, .72, .02, .02, .6, 6); b.box(M.glassRoof, x, 1.15, .72, 1.8, .9, .6);
    P('A gurney under a plastic tent', x, 1.0, .3, ['seoulstation', 'cdcintake', 'nozomi64', 'channeltrain']); }
  { const x = -5.6; for (let k = 0; k < 6; k++) { b.box(X.white, x + (k % 3) * .5, .3 + Math.floor(k / 3) * .4, .78, .44, .36, .4); b.box(X.hazard, x + (k % 3) * .5, .3 + Math.floor(k / 3) * .4, .575, .46, .06, .01); }
    P('White bee boxes, sealed with hazard tape', x + .5, .8, .35, ['davisapiary', 'evergreenprotocol', 'hivemind']); }
  { const x = -L / 2 + 1.6; b.box(M.ext, x, 1.1, -.9, 2.0, 2.0, .7); for (let k = 0; k < 9; k++) b.box(M.iron, x - .9 + k * .22, 1.1, -.54, .03, 2.0, .02); b.box(X.snow, x, 2.12, -.9, 2.0, .04, .7);
    P('A shipping container, frost on its doors', x, 1.1, -.2, ['evergreenprotocoltransport', 'lincolntunnel', 'eurotunnel', 'datachokepoint']); }
  { const x = 5.9; b.box(M.red, x, .84, .66, .22, .08, .16); b.box(M.red, x, .9, .66, .26, .04, .06); b.box(M.walnut, x, .4, .66, .4, .8, .3); b.box(M.crt, x - 1, 1.5, 1.2, .7, .5, .4); b.box(X.green, x - 1, 1.5, .995, .56, .38, .01);
    P('A red telephone that nobody answers; the radar', x, 1.0, .3, ['norad', 'seattlekillswitch', 'stadiumsurveillance', 'biometric', 'topographic']); }
  { // detail: surveillance
    const tx = 3.5; for (let k = 0; k < 5; k++) { decal(draw('treaty', 128, 160, (q, w, h) => { q.fillStyle = '#efe6cf'; q.fillRect(0, 0, w, h); q.fillStyle = '#333'; q.font = '700 13px Georgia'; q.fillText('CONVENTION', 16, 22); for (let l = 0; l < 9; l++) q.fillRect(12, 34 + l * 11, 104 - (l % 3) * 18, 3); q.strokeStyle = '#333'; q.beginPath(); q.moveTo(20, 146); q.lineTo(104, 146); q.stroke(); }), tx - 1.2 + k * .6, .796, -.55, .2, .27, 0, -Math.PI / 2); b.cyl(M.black, tx - 1.05 + k * .6, .8, -.5, .006, .006, .12, 4, Math.PI / 2, .5); b.box(M.brass, tx - 1.2 + k * .6, .82, -.78, .16, .05, .02); } b.cyl(M.iron, tx, .86, -.62, .01, .01, .16, 5); b.sph(M.black, tx, .95, -.62, .025);
    const qx = -.2; for (let k = 0; k < 6; k++) b.sph(M.red, qx - .75 + k * .3, .86, .62, .012); { const hx = qx + .3, hy = 1.25; b.box(M.black, hx, hy, .62, .12, .035, .12); for (const [ex, ez] of [[-.09, -.09], [.09, .09], [-.09, .09], [.09, -.09]]) { b.cyl(M.iron, hx + ex, hy + .03, .62 + ez, .05, .05, .005, 10); b.box(M.iron, hx + ex / 2, hy, .62 + ez / 2, .1, .012, .012, Math.atan2(ez, ex)); } b.sph(M.red, hx, hy - .03, .62, .014); }
    const bx = -3.2; b.box(M.black, bx, 1.3, -.2, .1, .03, .1); for (const [ex, ez] of [[-.08, -.08], [.08, .08], [-.08, .08], [.08, -.08]]) b.cyl(M.iron, bx + ex, 1.33, -.2 + ez, .045, .045, .005, 10); decal(text('SILENCE', { w: 256, h: 64, bg: '#101214', fg: '#e0483a', font: 'monospace' }), bx, 2.12, -.46, .5, .12);
    const gx = 1.0; for (const e of [-.7, .7]) wheel(gx + e, .06, .72, .05); b.cyl(M.steel, gx + .8, .95, .95, .012, .012, 1.3, 5); b.box(M.glassRoof, gx + .8, 1.5, .95, .12, .18, .04); b.sph(X.white, gx - .1, .76, .72, .5, .09, .18); b.sph(M.walnut, gx - .62, .78, .72, .09);
    const hx = -5.6, haz = draw('haz', 128, 32, (q) => { q.fillStyle = '#e0b400'; q.fillRect(0, 0, 128, 32); q.fillStyle = '#16130c'; for (let k = -2; k < 9; k++) { q.beginPath(); q.moveTo(k * 20, 32); q.lineTo(k * 20 + 16, 0); q.lineTo(k * 20 + 26, 0); q.lineTo(k * 20 + 10, 32); q.fill(); } }); for (let k = 0; k < 6; k++) decal(haz, hx + (k % 3) * .5, .3 + Math.floor(k / 3) * .4, .572, .46, .07); decal(text('QUARANTINE\nAPIS', { w: 256, h: 128, bg: '#f1ede2', fg: '#b3261e', font: 'monospace' }), hx + .5, .92, .78, .5, .25, 0, -Math.PI / 2);
    const cx = -L / 2 + 1.6; decal(text('SEALED · DO NOT OPEN', { w: 512, h: 96, bg: '#2f8a80', fg: '#f1ede2', font: '"Arial Narrow", Arial', weight: 800 }), cx, 1.55, -.535, 1.3, .24); b.box(M.brass, cx, 1.0, -.52, .1, .14, .05); for (const e of [-.5, .5]) b.cyl(M.steel, cx + e, 1.1, -.53, .02, .02, 1.9, 6);
    const px = 5.9; b.cyl(M.red, px, .95, .66, .03, .03, .2, 8, 0, Math.PI / 2); for (const e of [-.1, .1]) b.sph(M.red, px + e, .94, .66, .045); decal(draw('dial', 64, 64, (q) => { q.fillStyle = '#eee'; q.beginPath(); q.arc(32, 32, 28, 0, 7); q.fill(); q.fillStyle = '#b3261e'; for (let k = 0; k < 10; k++) { q.beginPath(); q.arc(32 + Math.cos(k * .63) * 19, 32 + Math.sin(k * .63) * 19, 4, 0, 7); q.fill(); } }), px, .885, .6, .1, .1, 0, -Math.PI / 2); for (let k = 0; k < 6; k++) b.cyl(M.red, px + .14 + k * .012, .7 - k * .05, .7, .012, .012, .04, 5);
    decal(screens.radar, px - 1, 1.5, .992, .5, .36, Math.PI); crt(px - 1.8, 1.5, 1.2, 1, screens.faces);
  }
  end();

  // ---- 7 · cinema: the arrival of a train (Heist 1855, Steam, Lumière)
  begin(7);
  { const x = 6.6; for (const e of [0, .9]) { b.box(M.iron, x - e, .6, -1.02, .8, 1.2, .6); b.box(M.iron, x - e + .3, .6, -.62, .06, 1.1, .5, .9); for (let k = 0; k < 4; k++) b.box(X.gold, x - e - .15 + (k % 2) * .26, .2 + Math.floor(k / 2) * .09, -.98, .24, .08, .12); } b.sph(M.linen, x - 1.5, .16, -.7, .18, .14, .18);
    P('Two safes; gold bars swapped for lead shot', x - .4, .9, -.35, ['guardvan', 'royalmint', 'chubbworkshop', 'chubblock', 'folkestone']); }
  { const x = 3.0; b.box(M.walnut, x, 1.3, 1.36, 2.4, 1.6, .16); for (let r = 0; r < 5; r++) for (let k = 0; k < 9; k++) { b.box(M.black, x - 1.05 + k * .26, .7 + r * .3, 1.27, .22, .26, .02); if ((r * 3 + k) % 3) b.box(X.paper, x - 1.05 + k * .26, .66 + r * .3, 1.25, .16, .1, .03); }
    P('The sorting wall of the night mail', x, 1.2, .8, ['mobilepostal', 'concentratedcorrespondence', 'granularsocial', 'kineticexchange']); }
  { const x = 4.9; b.box(M.iron, x, .6, -1.15, .9, 1.2, .4); b.box(M.lamp, x, .5, -.94, .4, .3, .01); train.cars[7].glows.push([x, .5, -.85, 1.4, 0xff7a2a]); b.box(M.black, x - .5, .1, -.8, .5, .2, .4);
    P('The firebox, and a fireman’s coal', x, .9, -.4, ['fireboxlabor', 'coalfirebox', 'humanmachine', 'steamlocomotive']); }
  { const x = .2; b.box(M.wood, x, .78, 1.2, 1.1, .05, .36); for (let k = 0; k < 7; k++) b.box(M.brass, x - .42 + k * .14, .82, 1.2, .02, .02, .12); b.box(M.linen, x + .3, .83, 1.12, .2, .05, .12); b.cyl(M.iron, x - 1.0, .4, 1.2, .2, .26, .8, 10); b.cyl(M.lamp, x - 1.0, .82, 1.2, .16, .16, .03, 10);
    P('Keys, wax impressions, a furnace pouring gold', x - .3, 1.0, .7, ['waxworkshop', 'smeltingfurnace', 'londonbridgeticket', 'greenman']); }
  { const x = L / 2 - 1.4; b.box(M.walnut, x, .9, .95, .9, 1.4, .7); b.box(M.walnut, x - .7, .6, .95, .5, .9, .7); b.sph(M.linen, x, 1.72, .95, .13, .12, .12); b.cyl(M.black, x, 1.3, .95, .2, .24, .7, 8);
    P('A judge’s bench and a dock', x - .4, 1.2, .35, ['oldbailey', 'scotlandyard', 'newgate']); }
  { const x = -2.6; for (let k = 0; k < 3; k++) b.cyl(M.steel, x + k * .5, .4, 1.15, .2, .2, .8, 12); for (let k = 0; k < 8; k++) b.cyl(M.iron, x - 1.2 - (k % 4) * .24, .5 + Math.floor(k / 4) * .3, 1.2, .11, .11, .04, 12, Math.PI / 2);
    P('Vats of silver emulsion; shelves of film cans', x, .9, .7, ['emulsionmixing', 'nitratenegative', 'editingsplicing', 'darkroom', 'lensgrinding']); }
  { const x = -5.6; for (const [ex, ez] of [[-.25, -.2], [.25, -.2], [0, .25]]) b.box(M.wood, x + ex, .6, -.85 + ez, .03, 1.25, .03, 0, ex * .5, ez * .5); b.box(M.walnut, x, 1.32, -.85, .26, .3, .22); b.cyl(M.brass, x - .18, 1.32, -.85, .05, .06, .1, 10, 0, Math.PI / 2); b.cyl(M.brass, x, 1.3, -.72, .01, .01, .12, 4, Math.PI / 2);
    P('A hand-cranked camera on a wooden tripod', x, 1.2, -.3, ['cinematographetripod', 'crankhandle', 'salonindien', 'projectionscreen', 'arclamp', 'meliesseat', 'mlisseat']); }
  { const x = -7.0; b.box(M.wood, x, .5, 1.05, .9, .08, .5); for (const e of [-.35, .35]) b.cyl(M.iron, x + e, .22, 1.05, .2, .2, .04, 12, Math.PI / 2); b.box(M.leather, x, .72, 1.05, .6, .36, .4); b.box(M.brass, x + 1.2, .9, 1.2, .3, .24, .3); b.box(M.iron, x - 1.2, 1.0, 1.2, .5, 1.6, .4); for (let k = 0; k < 5; k++) b.box(X.green, x - 1.2, .4 + k * .26, .995, .3, .03, .01);
    P('A luggage cart, a till, and a rack redrawing the film', x, .9, .5, ['luggagecart', 'boxofficetill', 'aiupscale', 'youtubecomment', 'pocketwatch', 'womaninplaid', 'childlooking', 'platformfloor', 'handpainted', 'traincarriagewindow']); }
  { // detail: cinema
    const sx = 6.6; for (const e of [0, .9]) { b.cyl(M.brass, sx - e + .34, .7, -.4, .06, .06, .03, 12, Math.PI / 2, .9); b.box(M.brass, sx - e + .36, .5, -.42, .02, .14, .02); for (const y of [.25, .95]) b.cyl(M.iron, sx - e + .4, y, -.72, .025, .025, .12, 6); decal(text('CHUBB', { w: 256, h: 64, bg: '#23282a', fg: '#c59a3e' }), sx - e, 1.05, -.715, .4, .1); } for (let k = 0; k < 3; k++) { b.sph(M.linen, sx - 1.5 + k * .3, .16, -.7 - (k % 2) * .2, .15, .13, .15); b.cyl(M.linen, sx - 1.5 + k * .3, .3, -.7 - (k % 2) * .2, .04, .07, .08, 6); }
    const wx = 3.0; b.box(M.wood, wx, .6, .98, 1.8, .05, .4); for (let k = 0; k < 3; k++) { b.sph(M.straw, wx - .6 + k * .6, .78, .98, .2, .16, .16); b.cyl(M.straw, wx - .6 + k * .6, .96, .98, .05, .1, .1, 6); } b.cyl(M.iron, wx + 1.6, 1.5, 1.2, .3, .3, .02, 14, Math.PI / 2); b.cyl(M.leather, wx + 1.6, 1.3, 1.2, .1, .22, .5, 8); decal(text('NIGHT MAIL', { w: 512, h: 96, bg: '#3a2416' }), wx, 2.16, 1.27, 1.2, .22, Math.PI);
    const fx = 4.9; b.box(M.iron, fx + .28, .5, -.9, .04, .4, .36, .7); for (let k = 0; k < 9; k++) b.sph(M.black, fx - .5 + (k % 3) * .16, .22 + Math.floor(k / 3) * .08, -.8 + (k % 2) * .16, .09); for (let k = 0; k < 4; k++) b.cyl(k % 2 ? M.lamp : M.red, fx - .12 + k * .08, .52, -.95, .0, .05, .2 + (k % 2) * .1, 5); b.cyl(M.wood, fx - .9, .5, -.5, .02, .02, 1.0, 6, 0, .5); b.box(M.iron, fx - .55, .18, -.5, .22, .02, .18, 0, .3);
    const kx = .2; for (let k = 0; k < 7; k++) { b.cyl(M.brass, kx - .42 + k * .14, .82, 1.13, .022, .022, .008, 10); b.box(M.brass, kx - .42 + k * .14, .82, 1.27, .012, .012, .06); } b.box(M.iron, kx + .48, .9, 1.2, .1, .14, .1); b.cyl(X.gold, kx - .8, .62, 1.2, .012, .012, .36, 5); b.box(M.iron, kx - .8, .42, 1.2, .3, .05, .12); b.box(X.gold, kx - .8, .46, 1.2, .2, .03, .07); b.cyl(M.iron, kx - 1.0, .95, 1.2, .1, .08, .16, 8, 0, .7);
    const jx = L / 2 - 1.4; b.cyl(M.wood, jx - .2, 1.64, .7, .04, .04, .12, 8, Math.PI / 2); b.cyl(M.wood, jx - .2, 1.62, .78, .012, .012, .2, 5); for (const e of [-1, 1]) b.sph(M.linen, jx, 1.62, .95 + e * .13, .07, .12, .06); decal(text('THE COURT', { w: 256, h: 64, bg: '#3a2416' }), jx - .455, 1.2, .95, .5, .12, -Math.PI / 2); for (let k = 0; k < 4; k++) b.box(M.wood, jx - .96, .75, .65 + k * .2, .03, .5, .03); b.box(M.wood, jx - .96, 1.02, .95, .05, .04, .7);
    const vx = -2.6; for (let k = 0; k < 3; k++) { b.cyl(M.linen, vx + k * .5, .81, 1.15, .18, .18, .01, 12); decal(text(['Ag', 'Br', 'KI'][k], { w: 64, h: 64, bg: '#efe6cf', fg: '#222', border: false }), vx + k * .5, .45, .948, .14, .14, Math.PI); } decal(draw('strip', 32, 256, () => {}), vx - 2.2, 1.4, 1.3, .06, 1.2, Math.PI); for (let k = 0; k < 8; k++) decal(text('№ ' + (k + 1), { w: 64, h: 64, bg: '#efe6cf', fg: '#222', border: false }), vx - 1.2 - (k % 4) * .24, .5 + Math.floor(k / 4) * .3, 1.178, .1, .1, Math.PI);
    const cx = -5.6; b.cyl(M.steel, cx - .26, 1.32, -.85, .03, .04, .04, 10, 0, Math.PI / 2); b.box(M.walnut, cx, 1.52, -.85, .2, .1, .14); b.cyl(M.wood, cx + .06, 1.24, -.68, .014, .014, .08, 5, 0, Math.PI / 2); b.cyl(M.black, cx + .16, 1.32, -.85, .09, .11, .14, 4, 0, Math.PI / 2);
    const lx = -7.0; for (let k = 0; k < 3; k++) { b.box([M.leather, M.walnut, M.velvet][k], lx - .1 + (k % 2) * .16, .66 + k * .22, 1.05, .56 - k * .1, .2, .36); for (const e of [-1, 1]) b.box(M.brass, lx - .1 + (k % 2) * .16 + e * .15, .66 + k * .22, .868, .02, .2, .01); } b.cyl(M.cream, lx + .3, 1.36, 1.05, .14, .14, .16, 12); for (let k = 0; k < 8; k++) b.cyl(M.china, lx + 1.1 + (k % 4) * .06, 1.05, 1.1 + Math.floor(k / 4) * .07, .018, .018, .02, 6); decal(text('TICKETS\n1 franc', { w: 256, h: 128, bg: '#7a1f1d', fg: '#f0d9a0' }), lx + 1.2, 1.4, 1.3, .44, .22, Math.PI);
    decal(draw('comments', 128, 512, (q, w, h) => { q.fillStyle = '#efe6cf'; q.fillRect(0, 0, w, h); for (let k = 0; k < 22; k++) { q.fillStyle = ['#b3261e', '#27324a', '#3c7a4a'][k % 3]; q.beginPath(); q.arc(14, 16 + k * 23, 6, 0, 7); q.fill(); q.fillStyle = '#333'; q.fillRect(26, 11 + k * 23, 60 + (k * 31) % 36, 3); q.fillRect(26, 18 + k * 23, 40 + (k * 17) % 50, 3); } }), lx - .55, 1.3, 1.3, .3, 1.7, Math.PI);
  }
  end();

  // ---- 8 · the hive: what is set in the comb
  begin(8);
  { const x = 5.6; b.box(M.iron, x, .34, 1.02, 1.5, .1, .5); for (let k = 0; k < 6; k++) b.box(X.white, x - .5 + (k % 3) * .5, .5 + Math.floor(k / 3) * .22, 1.02, .44, .2, .42); for (const e of [-.5, .5]) b.cyl(M.black, x + e, .2, .8, .14, .14, .1, 10, Math.PI / 2);
    P('A flatbed of white bee boxes, set in the comb', x, .8, .5, ['adeehoneyfarms']); }
  { const x = 2.6; b.box(M.steel, x, .7, -1.05, 1.8, .04, .3); for (let k = 0; k < 8; k++) { b.cyl(M.honey, x - .78 + k * .22, .8, -1.05, .05, .06, .14, 8); b.sph(M.honey, x - .78 + k * .22, .9, -1.05, .045); }
    P('A bottling line of plastic honey bears', x, .9, -.5, ['goldenblossom']); }
  { const x = -.4; for (let k = 0; k < 22; k++) b.sph(k % 3 ? M.bloom : M.black, x + ((k * 37) % 10) * .08 - .4, .1 + ((k * 13) % 5) * .06, .9 + ((k * 7) % 6) * .06, .07);
    P('A heap of plastic cartoon bee toys', x, .5, .5, ['beemovietoys', 'mcdonalds']); }
  { const x = -2.6; for (let k = 0; k < 4; k++) { b.box(M.crt, x - k * .5, .9, -1.1, .42, .34, .3); b.box(M.bloom, x - k * .5, .9, -.945, .32, .24, .01); }
    P('Computers rendering one bee, frame by frame', x - .7, 1.0, -.5, ['dreamworksrenderfarm', 'amagansett']); }
  { const x = 1.0; b.box(X.paper, x, ROOF - 1.0, .1, .5, 1.9, .01, .3); b.box(X.paper, x - .1, .04, .3, .5, .01, 1.2, .3);
    P('A printed script, unrolling from the ceiling', x, 1.2, .2, ['tumblrbeemovie']); }
  { const x = -5.2; b.box(M.walnut, x, .7, 1.0, .9, 1.1, .5); b.cyl(M.walnut, x - .2, 1.3, 1.0, .03, .03, .2, 6, 0, Math.PI / 2); b.sph(X.water, x + .25, 1.38, 1.0, .12); b.sph(X.graf[0], x + .25, 1.38, 1.0, .03, .02, .015);
    P('A ruling that a bee is a fish; a goldfish bowl', x, 1.1, .5, ['californiabeesasfish']); }
  { const x = -7.4; for (let k = 0; k < 3; k++) { b.box(X.white, x + k * .5, .7, -1.05, .42, .03, .3); for (let q = 0; q < 6; q++) b.sph(M.black, x + k * .5 - .15 + (q % 3) * .15, .73, -1.1 + Math.floor(q / 3) * .1, .02, .012, .012); }
    P('Trays of dead bees, each with a label', x + .5, .9, -.5, ['usdaccd']); }
  { // detail: hive
    const tx = 5.6; b.box(M.ext, tx + .98, .62, 1.02, .46, .5, .5); b.box(M.glass, tx + 1.2, .72, 1.02, .02, .24, .42); for (const e of [-.5, 0, .9]) wheel(tx + e, .2, .78, .14); for (const e of [-.3, .3]) b.box(M.red, tx + e, .72, .8, .03, .5, .01); 
    const bx = 2.6; for (let k = 0; k < 8; k++) { const px = bx - .78 + k * .22; for (const e of [-1, 1]) b.sph(M.honey, px + e * .035, .95, -1.05, .018); b.cyl(M.bloom, px, .98, -1.05, .0, .03, .05, 6); b.sph(M.honey, px, .8, -.99, .028); } for (let k = 0; k < 9; k++) b.cyl(M.steel, bx - .8 + k * .2, .66, -1.05, .03, .03, .28, 8, Math.PI / 2); decal(text('HONEY', { w: 256, h: 64, bg: '#f2b21e', fg: '#3a2406' }), bx, .5, -.88, .7, .16);
    const yx = -.4; for (let k = 0; k < 4; k++) { const px = yx - .3 + k * .22, pz = .92 + (k % 2) * .14, py = .42 + (k % 2) * .06; b.sph(M.bloom, px, py, pz, .1, .09, .09); b.cyl(M.black, px, py, pz, .095, .095, .03, 10, 0, Math.PI / 2); for (const e of [-1, 1]) { b.sph(X.white, px, py + .09, pz + e * .07, .05, .012, .04); b.sph(M.black, px + .08, py + .03, pz + e * .035, .016); } }
    const cx = -2.6; for (let k = 0; k < 4; k++) { decal(screens.bee, cx - k * .5, .9, -.94, .3, .22); b.box(M.crt, cx - k * .5, .68, -.86, .34, .03, .14); }
    const sx = 1.0, script = draw('script', 128, 512, (q, w, h) => { q.fillStyle = '#efe6cf'; q.fillRect(0, 0, w, h); q.fillStyle = '#2a2420'; for (let l = 0; l < 44; l++) { const ind = l % 4 === 0 ? 34 : 12; q.fillRect(ind, 10 + l * 11, (l % 4 === 0 ? 50 : 96) - (l * 13) % 22, 3); } }); decal(script, sx, ROOF - 1.02, .115, .48, 1.86, .3); decal(script, sx - .1, .052, .3, .48, 1.18, .3, -Math.PI / 2);
    const jx = -5.2; b.cyl(M.wood, jx - .2, 1.29, 1.0, .05, .05, .12, 8, Math.PI / 2); decal(text('A BEE\nIS A FISH', { w: 256, h: 160, bg: '#efe6cf', fg: '#2a2420' }), jx - .05, 1.262, .86, .3, .19, Math.PI, -Math.PI / 2); b.box(X.graf[0], jx + .2, 1.38, 1.0, .03, .03, .004); decal(text('RULING', { w: 256, h: 64, bg: '#3a2416' }), jx, .8, .745, .6, .15, Math.PI);
    const dx = -7.4; for (let k = 0; k < 3; k++) { b.box(X.paper, dx + k * .5 + .14, .72, -.92, .1, .005, .04); b.box(M.brass, dx + k * .5, .716, -1.2, .44, .01, .01); } b.cyl(M.brass, dx + 1.3, .74, -.95, .06, .06, .01, 12); b.cyl(M.wood, dx + 1.4, .74, -.9, .012, .012, .12, 5, Math.PI / 2, .6);
  }
  end();
  return out;
}
