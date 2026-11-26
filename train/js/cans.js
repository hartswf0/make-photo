// All people are SPAM: an upright tin with small metal arms and legs, a gold pull-tab lid and two eyes.
// One builder for the traveler and every passenger; the label says which flavor they are.
import * as THREE from 'three';

export const FLAVORS = [['CLASSIC', '#17307a', '#ffd92e'], ['LITE', '#1c8fc4', '#ffffff'], ['HOT & SPICY', '#b3261e', '#ffb52e'], ['BACON', '#6b1f1a', '#f3d6a0'], ['TERIYAKI', '#6a1f8a', '#ffd92e'], ['HOT HONEY', '#e8a21a', '#5a1a0c'], ['JALAPEÑO', '#2f7a3a', '#fff3b0'], ['TURKEY', '#c98a1a', '#3a2406']];
const texCache = new Map();
function label(k) { if (!texCache.has(k)) { const [name, a, b] = FLAVORS[k % FLAVORS.length], c = document.createElement('canvas'); c.width = 256; c.height = 320; const q = c.getContext('2d'); q.fillStyle = a; q.fillRect(0, 0, 256, 320); q.fillStyle = b; q.font = '900 84px "Arial Black", Impact, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('SPAM', 128, 70, 240);
    q.fillStyle = '#e9a26a'; q.fillRect(34, 150, 188, 96); q.fillStyle = '#c96a4a'; q.fillRect(34, 186, 188, 22); q.fillStyle = b; q.font = '800 26px Arial, sans-serif'; q.fillText(name, 128, 124, 236); q.fillStyle = '#fff'; q.font = '700 15px Arial'; q.fillText('NET WT 12 OZ', 128, 292);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(k, t); } return texCache.get(k); }
const tin = new THREE.MeshStandardMaterial({ color: 0xb9bfc2, metalness: .9, roughness: .28 }), gold = new THREE.MeshStandardMaterial({ color: 0xe0b23a, metalness: .9, roughness: .3 }), meat = new THREE.MeshLambertMaterial({ color: 0xe9968a }), white = new THREE.MeshBasicMaterial({ color: 0xffffff }), black = new THREE.MeshBasicMaterial({ color: 0x111111 });
const W = .6, H = .82, D = .4, LEG = .42, limbG = new THREE.CylinderGeometry(.035, .035, 1, 8), bodyG = new THREE.BoxGeometry(W, H, D), jointG = new THREE.SphereGeometry(.06, 8, 6);
export function makeCan(k = 0) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.position.y = LEG + H / 2;
  const side = new THREE.MeshStandardMaterial({ map: label(k), roughness: .4, metalness: .25 }), plain = new THREE.MeshStandardMaterial({ color: FLAVORS[k % FLAVORS.length][1], roughness: .4, metalness: .25 });
  const box = new THREE.Mesh(bodyG, [plain, plain, tin, tin, side, side]); box.castShadow = true; body.add(box);
  const loaf = new THREE.Mesh(new THREE.BoxGeometry(W * .86, .2, D * .8), meat); loaf.position.y = H / 2 - .06; body.add(loaf);
  const lid = new THREE.Group(); lid.position.set(0, H / 2, -D / 2); body.add(lid); const top = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, .035, D * 1.02), gold); top.position.set(0, .018, D / 2); const tab = new THREE.Mesh(new THREE.TorusGeometry(.055, .014, 6, 12), gold); tab.rotation.x = Math.PI / 2; tab.position.set(0, .045, D * .78); lid.add(top, tab);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), white), p = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), black); e.position.set(s * .13, H * .33, D / 2 + .02); p.position.set(s * .13, H * .33, D / 2 + .07); body.add(e, p); }
  const limb = (x, y, len) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0); const m = new THREE.Mesh(limbG, tin); m.scale.y = len; m.position.y = -len / 2; const j = new THREE.Mesh(jointG, tin); j.position.y = -len; j.scale.set(1.3, .7, 1.8); pivot.add(m, j); return pivot; };
  const legs = [-1, 1].map(s => { const l = limb(s * .17, LEG, LEG); g.add(l); return l; }), arms = [-1, 1].map(s => { const a = limb(s * (W / 2 + .03), H * .12, .36); body.add(a); return a; });
  let ph = Math.random() * 6, open = 0;
  return { group: g, k, /** speed in m/s; sitting folds the legs forward; lidOpen 0..1 shows the loaf */
    update(dt, speed, sitting, lidOpen = 0) { const w = Math.min(1, speed / .5); ph += dt * (4 + speed * 5) * (w > .05 ? 1 : .15); const sw = Math.sin(ph) * .7 * w;
      legs[0].rotation.x = sitting ? -1.5 : sw; legs[1].rotation.x = sitting ? -1.5 : -sw; arms[0].rotation.x = -sw * .8 + (lidOpen > .3 ? -2.2 * lidOpen : 0); arms[1].rotation.x = sw * .8; arms[0].rotation.z = -.12; arms[1].rotation.z = .12;
      body.position.y = (sitting ? .12 : LEG) + H / 2 + Math.abs(Math.sin(ph)) * .03 * w; body.rotation.z = Math.sin(ph) * .05 * w; body.rotation.y = Math.sin(ph * .5) * .04 * (1 - w);
      open += (lidOpen - open) * Math.min(1, dt * 10); lid.rotation.x = -open * 1.3; loaf.position.y = H / 2 - .06 + open * .12; } };
}
