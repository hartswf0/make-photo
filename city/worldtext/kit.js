// Atlantis Object Kit — Small Things of Atlantis (adapted from wygwyl/world/city3d/kit.mjs)
// Distinguishes:
//   1. Symbolic Object Stripe ("The Line" at 4/10 of small object height)
//   2. Physical +4.00 m Flood Datum ("line post" datum band & facade wear/access boundary)
//   3. Cyan Kintsugi Seam (light and ceramic repair only)

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TOKENS = {
  salt: '#ecebe4',
  ceramic: '#f1eee7',
  seam: '#18b4ff',
  verdigris: '#5f9c8a',
  iron: '#23292e',
  brick: '#7a3426',
  tide: '#14303e',
  sodium: '#ffb35c',
  neon: '#e24fd8',
  stone: '#8c8e8c',
  ink: '#ece6da',
};

const C = (k) => new THREE.Color(TOKENS[k] || k);
const cyl = (r1, r2, h, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s).translate(0, h / 2, 0);
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => {
  g.rotateX(rx);
  g.rotateY(ry);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
};
const P = (geo, col, glow = 0) => ({ geo, col, glow });
const OBJECT_STRIPE = (r, y, s = 16) =>
  P(at(new THREE.CylinderGeometry(r * 1.04, r * 1.04, Math.max(0.03, y * 0.035), s), 0, y, 0), 'salt');

export const KIT = {
  'tide lamp': {
    h: 5.6,
    datumKind: 'symbolic-stripe (2.24 m = 4/10 height)',
    about: 'Street lamp: verdigris column, ceramic sleeve at hand height carrying the symbolic 4/10 object stripe, ceramic ring head with cyan repair seam and sodium lamp eye. Brightens on the hot minute when tide gates rise.',
    parts: () => [
      P(cyl(0.09, 0.12, 5.2, 10), 'verdigris'),
      P(cyl(0.16, 0.16, 1.4, 16).translate(0, 1.4, 0), 'ceramic'),
      OBJECT_STRIPE(0.16, 2.24),
      P(cyl(0.2, 0.24, 0.3, 16), 'iron'),
      P(at(new THREE.TorusGeometry(0.42, 0.07, 10, 32), 0, 5.4, 0), 'ceramic'),
      P(at(new THREE.TorusGeometry(0.35, 0.02, 6, 32), 0, 5.4, 0), 'seam', 1),
      P(at(new THREE.CircleGeometry(0.3, 24), 0, 5.4, 0), 'sodium', 2),
      P(at(new THREE.CircleGeometry(0.3, 24), 0, 5.4, 0, 0, Math.PI), 'sodium', 2),
    ],
  },
  'line post': {
    h: 4.6,
    datumKind: 'physical-flood-datum (+4.00 m)',
    datum: true,
    about: 'Physical flood datum post set in the street. Its salt band sits at exactly +4.00 m above sea datum (distinct from symbolic 4/10 object stripes) so the true Fall flood line on every surrounding wall can be read against it.',
    parts: () => [
      P(cyl(0.14, 0.17, 4.6, 12), 'ceramic'),
      P(cyl(0.2, 0.22, 0.25, 12), 'iron'),
      P(cyl(0.18, 0.18, 0.12, 12).translate(0, 4.6, 0), 'verdigris'),
      P(at(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 16), 0, 4.0, 0), 'salt'),
      ...[0.9, 1.7, 2.6].map((y) => P(at(new THREE.BoxGeometry(0.3, 0.02, 0.3), 0, y, 0), 'iron')),
      P(at(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 12), 0, 4.6, 0), 'seam', 1),
    ],
  },
  bollard: {
    h: 1.0,
    datumKind: 'symbolic-stripe (0.40 m = 4/10 height)',
    about: 'Ceramic quay bollard, verdigris-capped, symbolic 4/10 salt stripe at 0.40 m along pedestrian edges and canal steps.',
    parts: () => [
      P(cyl(0.16, 0.19, 0.9, 14), 'ceramic'),
      OBJECT_STRIPE(0.18, 0.4, 14),
      P(cyl(0.2, 0.2, 0.1, 14).translate(0, 0.9, 0), 'verdigris'),
      P(at(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.0, 0), 'verdigris'),
    ],
  },
  bench: {
    h: 0.9,
    datumKind: 'kintsugi-seam',
    about: 'Ceramic slab on two iron frames with an emissive cyan kintsugi seam across the seat where it broke and was mended. Always oriented toward water.',
    parts: () => [
      P(at(new THREE.BoxGeometry(2.0, 0.09, 0.5), 0, 0.46, 0), 'ceramic'),
      P(at(new THREE.BoxGeometry(2.0, 0.42, 0.07), 0, 0.72, 0.24, -0.18), 'ceramic'),
      P(at(new THREE.BoxGeometry(0.024, 0.016, 0.5), 0.3, 0.51, 0, 0, 0.5), 'seam', 1),
      ...[-0.85, 0.85].map((x) => P(at(new THREE.BoxGeometry(0.06, 0.46, 0.46), x, 0.23, 0), 'iron')),
    ],
  },
  'tide board': {
    h: 2.7,
    datumKind: 'live-tide-clock (12.42 h)',
    board: true,
    about: 'Posted by the Tide Office at every pier and courtyard: next two gate risings and live height in mono type on tide-blue slate.',
    parts: () => [
      P(cyl(0.06, 0.06, 2.7, 8).translate(-0.7, 0, 0), 'iron'),
      P(cyl(0.06, 0.06, 2.7, 8).translate(0.7, 0, 0), 'iron'),
      P(at(new THREE.BoxGeometry(1.6, 1.1, 0.08), 0, 1.4, 0), 'ceramic'),
      P(at(new THREE.TorusGeometry(0.22, 0.04, 8, 24), 0, 2.45, 0), 'ceramic'),
    ],
  },
  shelter: {
    h: 2.9,
    datumKind: 'ceramic-canopy + seam',
    about: 'Transit shelter: curved white ceramic canopy with a cyan seam along its leading edge, glass windbreak, and ceramic bench.',
    parts: () => {
      const sh = new THREE.Shape();
      sh.absarc(0, 0, 2.4, Math.PI * 0.18, Math.PI * 0.82, false);
      sh.absarc(0, 0, 2.28, Math.PI * 0.82, Math.PI * 0.18, true);
      const canopy = new THREE.ExtrudeGeometry(sh, { depth: 4.2, bevelEnabled: false });
      canopy.translate(0, 0.65, -2.1);
      canopy.rotateY(Math.PI / 2);
      return [
        P(canopy, 'ceramic'),
        P(at(new THREE.BoxGeometry(4.2, 0.03, 0.03), 0, 2.98, 1.1), 'seam', 1),
        P(at(new THREE.BoxGeometry(4.0, 2.3, 0.04), 0, 1.25, -0.8), 'glass'),
        ...[-2, 2].map((x) => P(cyl(0.05, 0.05, 2.9, 8).translate(x, 0, -0.8), 'verdigris')),
        P(at(new THREE.BoxGeometry(2.6, 0.08, 0.45), 0, 0.46, -0.45), 'ceramic'),
      ];
    },
  },
  'poem plaque': {
    h: 1.3,
    datumKind: 'symbolic-stripe (4/10 plate)',
    plaque: true,
    about: 'Ceramic reading plaque on a verdigris stand marking where one of the 14 poems is spoken in the city.',
    parts: () => [
      P(cyl(0.05, 0.07, 1.0, 8), 'verdigris'),
      P(at(new THREE.BoxGeometry(0.9, 0.6, 0.05), 0, 1.0, 0, -0.35), 'ceramic'),
      P(at(new THREE.BoxGeometry(0.9, 0.02, 0.06), 0, 0.94, 0.02, -0.35), 'seam', 1),
    ],
  },
  'ward sign': {
    h: 3.2,
    datumKind: 'ward-boundary-ring',
    ward: true,
    about: 'Ward boundary post and ceramic disc ringed with a cyan seam and the district palette band.',
    parts: () => [
      P(cyl(0.05, 0.06, 3.2, 8), 'iron'),
      P(at(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 28), 0, 2.8, 0, Math.PI / 2), 'ceramic'),
      P(at(new THREE.TorusGeometry(0.45, 0.03, 6, 28), 0, 2.8, 0.03), 'seam', 1),
    ],
  },
  'salt fountain': {
    h: 1.6,
    datumKind: 'first-tide-basin',
    about: 'Ring basin of white ceramic and stone fed from the harbor; Salt Guild carriers draw First Tide cups here before climbing the Salt Stair.',
    parts: () => [
      P(at(new THREE.TorusGeometry(1.2, 0.18, 12, 40), 0, 0.5, 0, Math.PI / 2), 'ceramic'),
      P(cyl(1.1, 1.1, 0.4, 32), 'stone'),
      P(at(new THREE.CircleGeometry(1.08, 32), 0, 0.42, 0, -Math.PI / 2), 'tide'),
      P(cyl(0.08, 0.1, 1.2, 8), 'verdigris'),
      P(at(new THREE.ConeGeometry(0.25, 0.9, 12, 1, true), 0, 1.6, 0), 'glass'),
    ],
  },
  planter: {
    h: 1.4,
    datumKind: 'symbolic-stripe (0.28 m = 4/10 tub)',
    about: 'Ceramic street tub with symbolic 4/10 stripe and coastal agave cluster.',
    parts: () => [
      P(cyl(0.5, 0.42, 0.7, 20), 'ceramic'),
      OBJECT_STRIPE(0.47, 0.28, 20),
      P(cyl(0.46, 0.46, 0.05, 20).translate(0, 0.66, 0), 'brick'),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) =>
        P(at(new THREE.ConeGeometry(0.06, 0.8, 4), Math.cos(i) * 0.15, 0.95, Math.sin(i) * 0.15, 0, i, 0.5 * Math.cos(i * 2)), 'verdigris')
      ),
    ],
  },
  'archive frame': {
    h: 1.8,
    datumKind: 'canon-witness-panel',
    frame: true,
    about: 'Ceramic-framed canon panel mounted on district walls showing the archive photograph registered nearest that street.',
    parts: () => [
      P(at(new THREE.BoxGeometry(1.5, 1.0, 0.06), 0, 1.6, 0), 'ceramic'),
      P(at(new THREE.BoxGeometry(1.5, 0.025, 0.07), 0, 1.5, 0.01), 'salt'),
      P(at(new THREE.BoxGeometry(0.02, 1.0, 0.07), 0.22, 1.6, 0.01), 'seam', 1),
    ],
  },
};

const MAT = {};
export function materialFor(col, glow) {
  const k = col + glow;
  if (MAT[k]) return MAT[k];
  const c = C(col);
  const m =
    col === 'glass'
      ? new THREE.MeshStandardMaterial({
          color: 0xbfe8f0,
          roughness: 0.08,
          metalness: 0.2,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: c,
          roughness: col === 'ceramic' || col === 'salt' ? 0.36 : col === 'verdigris' ? 0.48 : 0.62,
          metalness: col === 'verdigris' || col === 'iron' ? 0.52 : 0.04,
          emissive: glow ? c : new THREE.Color(0x000000),
          emissiveIntensity: glow ? 1.5 : 0,
        });
  if (glow) m.userData.glow = glow;
  MAT[k] = m;
  return m;
}

export function buildObject(name) {
  const spec = KIT[name] || KIT['tide lamp'];
  const g = new THREE.Group();
  for (const p of spec.parts()) {
    const m = new THREE.Mesh(p.geo, materialFor(p.col, p.glow));
    m.castShadow = p.col !== 'glass';
    m.receiveShadow = p.col !== 'glass';
    g.add(m);
  }
  if (spec.board) {
    const tb = tideBoardTexture();
    tb.userData.draw(new Date(), (d) => 0.9 * Math.sin((2 * Math.PI * (d.getTime() / 36e5)) / 12.42));
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.48, 0.98),
      new THREE.MeshBasicMaterial({ map: tb })
    );
    face.position.set(0, 1.4, 0.045);
    g.add(face);
  }
  return g;
}

export function kitGeometry(name) {
  const body = [];
  const glow = [];
  for (const p of KIT[name].parts()) {
    if (p.col === 'glass') continue;
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo).clone();
    const c = C(p.col);
    const a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) {
      a[i] = c.r;
      a[i + 1] = c.g;
      a[i + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    for (const k of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    }
    (p.glow ? glow : body).push(g);
  }
  return { body: mergeGeometries(body), glow: glow.length ? mergeGeometries(glow) : null };
}

export const EMBLEM_SVG = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="42" fill="none" stroke="${TOKENS.ceramic}" stroke-width="7"/><line x1="8" y1="66.8" x2="92" y2="66.8" stroke="${TOKENS.salt}" stroke-width="4"/><path d="M58 9 L52 30 L60 41 L49 58 L55 70 L47 91" fill="none" stroke="${TOKENS.seam}" stroke-width="3" stroke-linecap="round"/></svg>`;

export function drawEmblem(x, cx, cy, r, ink = TOKENS.ceramic) {
  x.save();
  x.strokeStyle = ink;
  x.lineWidth = r * 0.16;
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.stroke();
  x.strokeStyle = TOKENS.salt;
  x.lineWidth = r * 0.09;
  x.beginPath();
  x.moveTo(cx - r, cy + r * 0.4);
  x.lineTo(cx + r, cy + r * 0.4);
  x.stroke();
  x.strokeStyle = TOKENS.seam;
  x.lineWidth = r * 0.07;
  x.lineCap = 'round';
  x.beginPath();
  [
    [0.19, -0.98],
    [0.05, -0.48],
    [0.24, -0.21],
    [-0.02, 0.19],
    [0.12, 0.48],
    [-0.07, 0.98],
  ].forEach(([a, b], i) => (i ? x.lineTo(cx + a * r, cy + b * r) : x.moveTo(cx + a * r, cy + b * r)));
  x.stroke();
  x.restore();
}

export function tideBoardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 352;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.draw = (now, tideAt) => {
    const x = c.getContext('2d');
    x.fillStyle = TOKENS.tide;
    x.fillRect(0, 0, 512, 352);
    drawEmblem(x, 446, 64, 34);
    x.fillStyle = TOKENS.salt;
    x.font = '600 24px ui-monospace, Menlo, monospace';
    x.fillText('THE TIDE OFFICE', 28, 52);
    x.font = '16px ui-monospace, Menlo, monospace';
    x.fillStyle = '#9fb8c0';
    x.fillText('NEXT TWO GATES (12H 25M)', 28, 84);
    const period = 12.42 * 3600e3;
    const phase = (((now.getTime() / period) % 1) + 1) % 1;
    const nextHigh = new Date(now.getTime() + (((0.25 - phase + 1) % 1) * period));
    for (let i = 0; i < 2; i++) {
      const d = new Date(nextHigh.getTime() + i * period);
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      x.fillStyle = TOKENS.salt;
      x.font = '700 58px ui-monospace, Menlo, monospace';
      x.fillText(`${hh}:${mm}`, 28, 158 + i * 90);
      x.font = '20px ui-monospace, Menlo, monospace';
      x.fillStyle = TOKENS.seam;
      x.fillText('+3.40 m', 246, 136 + i * 90);
      x.fillStyle = '#9fb8c0';
      x.fillText('GATES OPEN', 246, 162 + i * 90);
    }
    x.fillStyle = TOKENS.seam;
    x.fillRect(28, 182, 456, 3);
    const h = tideAt(now);
    const rising = Math.cos((2 * Math.PI * now.getTime()) / period) > 0;
    x.fillStyle = '#9fb8c0';
    x.font = '18px ui-monospace, Menlo, monospace';
    x.fillText(`NOW ${h >= 0 ? '+' : ''}${h.toFixed(2)} m | ${rising ? 'FLOODING' : 'EBBING'}`, 28, 330);
    t.needsUpdate = true;
  };
  return t;
}
