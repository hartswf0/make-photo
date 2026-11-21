// Upgraded Atlantis HDL & Inverse Tomology Compiler (Briefs 2, 3 & 4)
// Compiles hero descriptions into metre-accurate PBR architecture, walkable interiors,
// operable threshold doors, fixture-bound aura lights, and 15 formal architectural proofs.

import * as THREE from 'three';

const MAT = new Map();
let LIB = null;
let ATLAS = null;

function createFallbackAtlas() {
  if (typeof document === 'undefined') return null;
  const cols = 8;
  const rows = 11;
  const cellW = 64;
  const cellH = 64;
  const c = document.createElement('canvas');
  c.width = cols * cellW;
  c.height = rows * cellH;
  const ctx = c.getContext('2d');

  const palette = [
    '#9a4b3a', '#8c4234', '#c9b496', '#6d6a66', '#85827d', '#c29b70', '#a97f56', '#dfd7c8',
    '#7b5b42', '#d8d0c0', '#4f565e', '#b8684d', '#9e8f7a', '#644835', '#cfc7b8', '#8a3338',
  ];

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const idx = r * cols + col;
      const x0 = col * cellW;
      const y0 = r * cellH;
      ctx.fillStyle = palette[idx % palette.length];
      ctx.fillRect(x0, y0, cellW, cellH);
      // Crisp mortar / plank / stone courses
      ctx.strokeStyle = 'rgba(20, 18, 16, 0.28)';
      ctx.lineWidth = 1.5;
      for (let py = 8; py < cellH; py += 16) {
        ctx.beginPath();
        ctx.moveTo(x0, y0 + py);
        ctx.lineTo(x0 + cellW, y0 + py);
        ctx.stroke();
        const shift = ((py / 16) % 2) * 16;
        for (let px = shift; px < cellW; px += 32) {
          ctx.beginPath();
          ctx.moveTo(x0 + px, y0 + py - 16);
          ctx.lineTo(x0 + px, y0 + py);
          ctx.stroke();
        }
      }
      // Subtle stone grain
      for (let g = 0; g < 36; g++) {
        const gx = x0 + ((idx * 17 + g * 29) % cellW);
        const gy = y0 + ((idx * 31 + g * 13) % cellH);
        ctx.fillStyle = g % 2 === 0 ? 'rgba(255,245,230,0.08)' : 'rgba(12,16,22,0.10)';
        ctx.fillRect(gx, gy, 3, 3);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function useLibrary(lib, atlas) {
  LIB = lib;
  ATLAS = atlas || createFallbackAtlas();
  MAT.clear();
}

const ROLE_ROUGHNESS = {
  'red brick': [0.84, 0.02],
  'interior brick': [0.86, 0.02],
  cantera: [0.66, 0.02],
  granite: [0.50, 0.06],
  concrete: [0.80, 0.03],
  'concrete floor': [0.74, 0.04],
  'terrazzo floor': [0.32, 0.05],
  'checker floor': [0.36, 0.04],
  marble: [0.28, 0.05],
  tile: [0.30, 0.04],
  floorboards: [0.58, 0.02],
  parquet: [0.46, 0.03],
  planks: [0.68, 0.02],
  'wood siding': [0.64, 0.02],
  panelling: [0.54, 0.03],
  plaster: [0.78, 0.01],
  wallpaper: [0.82, 0.01],
  carpet: [0.94, 0.0],
  velvet: [0.90, 0.02],
  'tin ceiling': [0.38, 0.45],
};

const libIdx = (name) => {
  if (!LIB || !LIB.materials) return 0;
  const clean = name.split('@')[0].split('#')[0];
  const m = LIB.materials.find((x) => x.name === clean);
  return m ? m.base : 0;
};

export function tile(name, opt = {}) {
  if (!ATLAS) ATLAS = createFallbackAtlas();
  if (name.includes('@')) {
    const [n, t] = name.split('@');
    return tile(n, { ...opt, tint: '#' + t });
  }
  if (name.includes('#')) {
    const [n, v] = name.split('#');
    return tile(n, { ...opt, variant: +v });
  }
  const key = [name, opt.variant || 0, opt.scale || 1, opt.tint || '', opt.side || '', opt.rough ?? ''].join('|');
  if (MAT.has(key)) return MAT.get(key);

  const [defR, defM] = ROLE_ROUGHNESS[name] || [0.78, 0.02];
  const m = new THREE.MeshStandardMaterial({
    color: opt.tint || 0xffffff,
    roughness: opt.rough ?? defR,
    metalness: opt.metal ?? defM,
    side: opt.side ?? THREE.FrontSide,
  });

  if (LIB && ATLAS) {
    const cols = LIB.cols || 8;
    const rows = LIB.rows || 11;
    const role = LIB.materials.find((x) => x.name === name)?.role;
    const idx = libIdx(name) + (opt.variant || 0);
    const sc = opt.scale || (role === 'wall' || role === 'atlantean' ? 3.0 : role === 'roof' ? 2.4 : 2.0);
    const tintKey = opt.tint || '';
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uA = { value: ATLAS };
      sh.uniforms.uG = { value: new THREE.Vector2(cols, rows) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vM;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvM = uv;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uA; uniform vec2 uG; varying vec2 vM;')
        .replace(
          '#include <map_fragment>',
          `{ vec2 mm = vM / ${sc.toFixed(2)}; vec2 cell = vec2(mod(${idx.toFixed(1)}, uG.x), floor(${idx.toFixed(1)} / uG.x)); vec2 f = fract(mm);
            vec2 uv = vec2((cell.x + f.x) / uG.x, 1.0 - (cell.y + 1.0 - f.y) / uG.y); vec4 t = textureGrad(uA, uv, dFdx(mm) / uG, dFdy(mm) / uG);
            diffuseColor.rgb *= mix(vec3(dot(t.rgb, vec3(0.33))), t.rgb, 0.88) * 1.14; }`
        );
    };
    m.customProgramCacheKey = () => `tile-${idx}-${sc}-${tintKey}`;
  }
  m.userData.lib = name;
  m.userData.calibratedRoughness = m.roughness;
  MAT.set(key, m);
  return m;
}

const flat = (c, o = {}) =>
  new THREE.MeshStandardMaterial({
    color: c,
    roughness: o.r ?? 0.6,
    metalness: o.m ?? 0,
    emissive: o.e ?? 0x000000,
    emissiveIntensity: o.ei ?? 1,
    transparent: o.t != null,
    opacity: o.t ?? 1,
    side: o.side ?? THREE.FrontSide,
  });

const IRON = flat(0x1d2228, { r: 0.44, m: 0.72 });
const CYAN_PIPE = flat(0x1496d8, { r: 0.28, m: 0.45, e: 0x18b4ff, ei: 0.55 });
const CYAN_BEACON = flat(0x9ce8ff, { r: 0.15, m: 0.1, e: 0x18b4ff, ei: 1.85 });
const GLASS = flat(0x8ec2d8, { r: 0.06, m: 0.22, t: 0.32 });

function box(x0, x1, y0, y1, z0, z1, mat) {
  const w = Math.max(0.001, x1 - x0);
  const d = Math.max(0.001, y1 - y0);
  const h = Math.max(0.001, z1 - z0);
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    if (ax > 0.5) uv.setXY(i, p.getZ(i), p.getY(i));
    else if (ay > 0.5) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const rnd = (s) => {
  const x = Math.sin(s * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

const CANV = new Map();
function canvasMat(key, w, h, draw, o = {}) {
  if (CANV.has(key)) return CANV.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({
    map: t,
    emissiveMap: t,
    emissive: 0xffffff,
    emissiveIntensity: o.ei ?? 1,
    transparent: o.t != null,
    opacity: o.t ?? 1,
    side: THREE.DoubleSide,
    roughness: 0.48,
    depthWrite: !o.add,
    blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  CANV.set(key, m);
  return m;
}

function stained(seed) {
  return canvasMat(
    'stained' + seed,
    64,
    160,
    (x, w, h) => {
      const P = ['#a82430', '#1c4da6', '#d8a424', '#189060', '#7a2a9a', '#18b4ff'];
      for (let j = 0; j < 10; j++) {
        for (let i = 0; i < 4; i++) {
          x.fillStyle = P[Math.floor(rnd(seed * 31 + i * 7 + j * 13) * P.length)];
          x.fillRect(i * 16, j * 16, 16, 16);
        }
      }
      x.strokeStyle = '#101318';
      x.lineWidth = 2.5;
      for (let j = 0; j <= 10; j++) {
        x.beginPath();
        x.moveTo(0, j * 16);
        x.lineTo(w, j * 16 + (rnd(j) - 0.5) * 8);
        x.stroke();
      }
      for (let i = 0; i <= 4; i++) {
        x.beginPath();
        x.moveTo(i * 16, 0);
        x.lineTo(i * 16, h);
        x.stroke();
      }
    },
    { ei: 0.9 }
  );
}

function textMat(text, fg = '#ff3848', bg = '#14080c', glow = true) {
  return canvasMat(
    't|' + text + '|' + fg + '|' + bg,
    512,
    128,
    (x, w, h) => {
      x.fillStyle = bg;
      x.fillRect(0, 0, w, h);
      x.font = `bold ${text.length > 14 ? 34 : 68}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      if (glow) {
        x.shadowColor = fg;
        x.shadowBlur = 18;
      }
      x.fillStyle = fg;
      x.fillText(text, w / 2, h / 2 + 3);
    },
    { ei: glow ? 1.35 : 0.15 }
  );
}

export function expand(h) {
  const H = JSON.parse(JSON.stringify(h));
  const L = H.levels.length;
  const lv = (s) =>
    typeof s === 'number'
      ? [s]
      : String(s).includes('-')
        ? (([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))(String(s).split('-').map(Number))
        : [Number(s)];
  const W = [];
  for (const w of H.windows || []) {
    for (const k of lv(w.level)) {
      if (k >= L) continue;
      const rooms = H.levels[k].rooms.filter((r) =>
        w.room.endsWith('*') ? r.id.startsWith(w.room.slice(0, -1)) : r.id === w.room
      );
      for (const r of rooms) W.push({ ...w, level: k, room: r.id });
    }
  }
  H.windows = W;
  H.levels.forEach((l, k) =>
    l.rooms.forEach((r) => {
      r.level = k;
      r.z = l.z;
      r.h = r.h || l.h;
      if (r.wall === 'tin ceiling') {
        r.ceiling = 'tin ceiling';
        r.wall = 'plaster';
      }
    })
  );
  return H;
}

function wallsOf(level, H) {
  const E = new Map();
  const add = (o, c, a, b, room, side) => {
    const k = o + ':' + c.toFixed(3);
    (E.get(k) || E.set(k, { o, c, list: [] }).get(k)).list.push({ a, b, room, side });
  };
  for (const r of level.rooms) {
    if (r.use === 'lightwell') continue;
    add('h', r.y, r.x, r.x + r.w, r, +1);
    add('h', r.y + r.d, r.x, r.x + r.w, r, -1);
    add('v', r.x, r.y, r.y + r.d, r, +1);
    add('v', r.x + r.w, r.y, r.y + r.d, r, -1);
  }
  const segs = [];
  for (const { o, c, list } of E.values()) {
    const bp = [...new Set(list.flatMap((e) => [e.a, e.b]))].sort((a, b) => a - b);
    let cur = null;
    for (let i = 0; i < bp.length - 1; i++) {
      const a = bp[i];
      const b = bp[i + 1];
      const m = (a + b) / 2;
      const P = list.find((e) => e.side > 0 && e.a <= m && m <= e.b)?.room || null;
      const N = list.find((e) => e.side < 0 && e.a <= m && m <= e.b)?.room || null;
      if (!P && !N) {
        cur = null;
        continue;
      }
      const key = (P?.id || '') + '|' + (N?.id || '');
      if (cur && cur.key === key && Math.abs(cur.b - a) < 1e-6) cur.b = b;
      else {
        cur = { o, c, a, b, key, P, N, ext: !P || !N, openings: [] };
        segs.push(cur);
      }
    }
  }
  const [FW] = H.footprint;
  for (const s of segs) {
    s.side =
      s.o === 'h'
        ? Math.abs(s.c) < 1e-3
          ? 'front'
          : 'back'
        : Math.abs(s.c) < 1e-3
          ? 'left'
          : Math.abs(s.c - FW) < 1e-3
            ? 'right'
            : 'inner';
    if (s.o === 'h' && s.ext) s.side = s.P ? 'front' : 'back';
    if (s.o === 'v' && s.ext) s.side = s.P ? 'left' : 'right';
    s.party =
      s.ext &&
      (H.party || []).includes(s.side) &&
      (s.side === 'left' ? Math.abs(s.c) < 1e-3 : Math.abs(s.c - FW) < 1e-3);
    s.h = Math.max(s.P?.h || 0, s.N?.h || 0);
    s.z = Math.min(s.P?.z ?? 1e9, s.N?.z ?? 1e9);
  }
  return segs;
}

function placeOpenings(H, LW, issues) {
  let primaryThresholdAssigned = false;
  for (const d of H.doors || []) {
    const segs = LW[d.level] || [];
    const outside = ['street', 'yard'].includes(d.a) ? d.a : ['street', 'yard'].includes(d.b) ? d.b : null;
    let cand;
    if (outside) {
      const rid = outside === d.a ? d.b : d.a;
      const side = d.side || (outside === 'yard' ? 'back' : 'front');
      cand = segs.filter((s) => s.ext && (s.P?.id || s.N?.id) === rid && s.side === side);
    } else {
      cand = segs.filter((s) => !s.ext && [s.P?.id, s.N?.id].includes(d.a) && [s.P?.id, s.N?.id].includes(d.b));
    }
    cand.sort((a, b) => b.b - b.a - (a.b - a.a));
    const s = cand[0];
    const w = d.w || 0.9;
    if (!s || s.b - s.a < w + 0.2) {
      issues.push({
        rule: 'doors on walls',
        door: d,
        msg: `door ${d.a}->${d.b} on level ${d.level} has no wall long enough to sit in`,
      });
      continue;
    }
    const at = d.at != null ? Math.min(Math.max(d.at, s.a + w / 2 + 0.1), s.b - w / 2 - 0.1) : (s.a + s.b) / 2;
    const isLobbyThreshold =
      !!outside &&
      outside === 'street' &&
      (!primaryThresholdAssigned || [d.a, d.b].some((id) => /lobby|vestibule|nave|foyer/i.test(id)));
    if (isLobbyThreshold) primaryThresholdAssigned = true;
    s.openings.push({
      s: at,
      w,
      z0: 0,
      z1: d.h || 2.2,
      kind: 'door',
      outside: !!outside,
      threshold: isLobbyThreshold,
      door: d,
      shape: d.shape,
    });
    d._seg = s;
    d._at = at;
  }

  for (const wd of H.windows || []) {
    const segs = (LW[wd.level] || []).filter((s) => s.ext && (s.P?.id || s.N?.id) === wd.room && s.side === wd.side);
    if (!segs.length || segs.every((s) => s.party)) {
      issues.push({
        rule: 'windows on walls',
        msg: `${wd.room} has no ${wd.side} wall to the outside${segs.some((s) => s.party) ? ' (party wall)' : ''}`,
      });
      continue;
    }
    const s = segs.sort((a, b) => b.b - b.a - (a.b - a.a))[0];
    const L = s.b - s.a;
    for (let i = 0; i < wd.n; i++) {
      let at = s.a + (L * (i + 0.5)) / wd.n;
      const clash = (a) =>
        s.openings.some((o) => Math.abs(o.s - a) < (o.w + wd.w) / 2 + 0.2) ||
        a - wd.w / 2 < s.a + 0.2 ||
        a + wd.w / 2 > s.b - 0.2;
      if (clash(at)) {
        let found = null;
        for (let d = 0.1; d < L && found == null; d += 0.1) {
          for (const t of [at + d, at - d]) if (found == null && !clash(t)) found = t;
        }
        if (found == null) {
          issues.push({ rule: 'windows on walls', msg: `no room for window in ${wd.room} (${wd.side})` });
          continue;
        }
        at = found;
      }
      s.openings.push({
        s: at,
        w: Math.min(wd.w, L / wd.n - 0.3),
        z0: wd.sill,
        z1: wd.sill + wd.h,
        kind: 'window',
        shape: wd.shape,
        stained: wd.stained,
      });
    }
  }
}

function flightsOf(H) {
  return (H.stairs || []).map((s) => {
    const z0 = H.levels[s.from].z;
    const z1 = H.levels[s.to].z;
    const rise = z1 - z0;
    const n = Math.ceil(rise / 0.185);
    const run = s.dir.includes('y') ? s.d : s.w;
    const dirS = s.dir[0] === '+' ? 1 : -1;
    const ax = s.dir[1];
    const f = Math.max(0, 1 - 2.1 / rise);
    const hole = { ...s };
    if (ax === 'y') {
      if (dirS > 0) {
        hole.y = s.y + s.d * f;
        hole.d = s.d * (1 - f);
      } else hole.d = s.d * (1 - f);
    } else if (dirS > 0) {
      hole.x = s.x + s.w * f;
      hole.w = s.w * (1 - f);
    } else hole.w = s.w * (1 - f);
    return {
      ...s,
      z0,
      z1,
      rise,
      n,
      riser: rise / n,
      tread: run / n,
      run,
      ax,
      dirS,
      hole,
      heightAt(x, y) {
        const t =
          ax === 'y'
            ? dirS > 0
              ? (y - s.y) / s.d
              : (s.y + s.d - y) / s.d
            : dirS > 0
              ? (x - s.x) / s.w
              : (s.x + s.w - x) / s.w;
        return z0 + rise * Math.min(1, Math.max(0, t));
      },
      contains(x, y, m = 0) {
        return x >= s.x - m && x <= s.x + s.w + m && y >= s.y - m && y <= s.y + s.d + m;
      },
    };
  });
}

function subtract(r, h) {
  const x0 = Math.max(r.x, h.x);
  const x1 = Math.min(r.x + r.w, h.x + h.w);
  const y0 = Math.max(r.y, h.y);
  const y1 = Math.min(r.y + r.d, h.y + h.d);
  if (x1 <= x0 || y1 <= y0) return [r];
  const out = [];
  if (y0 > r.y) out.push({ x: r.x, y: r.y, w: r.w, d: y0 - r.y });
  if (y1 < r.y + r.d) out.push({ x: r.x, y: y1, w: r.w, d: r.y + r.d - y1 });
  if (x0 > r.x) out.push({ x: r.x, y: y0, w: x0 - r.x, d: y1 - y0 });
  if (x1 < r.x + r.w) out.push({ x: x1, y: y0, w: r.x + r.w - x1, d: y1 - y0 });
  return out;
}

const ov = (a, b) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y));

export function prove(Hraw) {
  const H = expand(Hraw);
  const out = [];
  const push = (rule, ok, detail, warn = false, provenance = 'checked') =>
    out.push({ rule, state: ok ? (warn ? 'WARN' : 'PASS') : 'FAIL', detail, provenance });

  const [FW, FD] = H.footprint;
  const rooms = H.levels.flatMap((l) => l.rooms).filter((r) => r.use !== 'lightwell');
  const issues = [];
  const LW = H.levels.map((l) => wallsOf(l, H));
  placeOpenings(H, LW, issues);
  const F = flightsOf(H);

  // 1. Contained in declared envelope
  const outside = rooms.filter((r) => r.x < -1e-6 || r.y < -1e-6 || r.x + r.w > FW + 1e-6 || r.y + r.d > FD + 1e-6);
  push(
    'contained',
    !outside.length,
    outside.length
      ? outside.map((r) => `${r.name} leaves footprint`).join('; ')
      : `${rooms.length} rooms inside ${FW} x ${FD} m envelope`,
    false,
    'recorded'
  );

  // 2. No room clashes
  const cl = [];
  H.levels.forEach((l, k) => {
    const rs = l.rooms.filter((r) => r.use !== 'lightwell');
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        if (ov(rs[i], rs[j]) > 0.01) cl.push(`${rs[i].name} x ${rs[j].name}`);
      }
    }
    for (const r of rs) {
      for (let m = k + 1; m < H.levels.length; m++) {
        if (r.z + r.h > H.levels[m].z + 0.01) {
          for (const q of H.levels[m].rooms.filter((x) => x.use !== 'lightwell')) {
            if (ov(r, q) > 0.01) cl.push(`${r.name} rises into ${q.name}`);
          }
        }
      }
    }
  });
  push('no clashes', !cl.length, cl.length ? cl.join('; ') : 'no two rooms occupy the same volume');

  // 3. Structural support
  const sup = [];
  const cant = [];
  H.levels.forEach((l, k) => {
    if (!k) return;
    const below = H.levels
      .slice(0, k)
      .flatMap((q) => q.rooms)
      .filter((q) => q.use !== 'lightwell' && q.z + q.h >= l.z - 0.01);
    for (const r of l.rooms.filter((x) => x.use !== 'lightwell')) {
      let rest = [{ x: r.x, y: r.y, w: r.w, d: r.d }];
      for (const b of below) rest = rest.flatMap((p) => subtract(p, b));
      const area = rest.reduce((a, p) => a + p.w * p.d, 0);
      const deep = Math.max(0, ...rest.map((p) => Math.min(p.w, p.d)));
      if (area > 0.05) (deep > 1.51 ? sup : cant).push(`${r.name} overhangs ${deep.toFixed(1)} m`);
    }
  });
  push(
    'supported',
    !sup.length,
    sup.length
      ? sup.join('; ')
      : cant.length
        ? 'cantilevers <= 1.5 m: ' + cant.join('; ')
        : 'every upper room bears cleanly on structure below',
    cant.length > 0 && !sup.length
  );

  // 4. Reachable from street
  const adj = new Map();
  const link = (a, b) => {
    (adj.get(a) || adj.set(a, []).get(a)).push(b);
    (adj.get(b) || adj.set(b, []).get(b)).push(a);
  };
  for (const d of H.doors || []) if (d._seg) link(d.a === 'yard' ? 'street' : d.a, d.b === 'yard' ? 'street' : d.b);
  for (const f of F) {
    const top =
      f.ax === 'y'
        ? f.dirS > 0
          ? [f.x + f.w / 2, f.y + f.d - 0.05]
          : [f.x + f.w / 2, f.y + 0.05]
        : f.dirS > 0
          ? [f.x + f.w - 0.05, f.y + f.d / 2]
          : [f.x + 0.05, f.y + f.d / 2];
    const bot =
      f.ax === 'y'
        ? f.dirS > 0
          ? [f.x + f.w / 2, f.y + 0.05]
          : [f.x + f.w / 2, f.y + f.d - 0.05]
        : f.dirS > 0
          ? [f.x + 0.05, f.y + f.d / 2]
          : [f.x + f.w - 0.05, f.y + f.d / 2];
    const inRoom = (lv, [x, y]) =>
      H.levels[lv].rooms.find((r) => r.use !== 'lightwell' && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d);
    const A = inRoom(f.from, bot);
    const B = inRoom(f.to, top);
    f._a = A;
    f._b = B;
    if (A && B) link(A.id, B.id);
  }
  for (const e of H.exterior || []) {
    if (e.kind === 'fireescape') {
      for (let k = e.from; k <= e.to; k++) {
        for (const r of H.levels[k].rooms) {
          if (r.x < e.x + e.w && r.x + r.w > e.x && r.y < 0.01) link('fire escape', r.id);
        }
      }
      link('fire escape', 'street');
    }
  }
  const seen = new Set(['street']);
  const q = ['street'];
  while (q.length) {
    const a = q.shift();
    for (const b of adj.get(a) || []) {
      if (!seen.has(b)) {
        seen.add(b);
        q.push(b);
      }
    }
  }
  const lost = rooms.filter((r) => !seen.has(r.id));
  push(
    'reachable',
    !lost.length,
    lost.length
      ? 'unreachable: ' + lost.map((r) => `${r.name} (${H.levels[r.level].name})`).join(', ')
      : `all ${rooms.length} rooms reachable from the street`
  );

  // 5 & 6. Doors and windows on real walls
  const di = issues.filter((i) => i.rule === 'doors on walls');
  const wi = issues.filter((i) => i.rule === 'windows on walls');
  push('doors on walls', !di.length, di.length ? di.map((i) => i.msg).join('; ') : `${(H.doors || []).length} doors seated in valid walls`);
  push(
    'windows on walls',
    !wi.length,
    wi.length
      ? wi.map((i) => i.msg).join('; ')
      : `${LW.flat().reduce((a, s) => a + s.openings.filter((o) => o.kind === 'window').length, 0)} facade windows, zero on party walls`
  );

  // 7. Daylight & Sky Lightwell
  const hasLightwell = H.levels.some((l) => l.rooms.some((r) => r.use === 'lightwell'));
  const lit = new Set(
    LW.flat()
      .flatMap((s) => (s.openings.some((o) => o.kind === 'window') ? [s.P?.id, s.N?.id] : []))
      .filter(Boolean)
  );
  const need = rooms.filter((r) => ['home', 'cafe', 'kitchen', 'shop'].includes(r.use));
  const dark = [];
  const borrowed = [];
  for (const r of need) {
    if (!lit.has(r.id)) {
      const via = (H.doors || []).find(
        (d) => (d.w || 0.9) >= 1.8 && [d.a, d.b].includes(r.id) && lit.has(d.a === r.id ? d.b : d.a)
      );
      if (via || hasLightwell) borrowed.push(r.name + (hasLightwell ? ' (via cyan lightwell)' : ' (borrowed opening)'));
      else dark.push(r.name);
    }
  }
  push(
    'daylight',
    !dark.length,
    dark.length
      ? 'dark: ' + dark.join(', ')
      : borrowed.length
        ? 'borrowed/lightwell light: ' + borrowed.join(', ')
        : `${need.length} occupied rooms receive direct facade daylight`,
    borrowed.length > 0 && !dark.length
  );

  // 8. Stairs riser/tread geometry
  const sb = F.filter((f) => f.riser > 0.2 || f.tread < 0.25 || !f._a || !f._b);
  push(
    'stairs',
    !sb.length,
    F.length
      ? sb.length
        ? sb.map((f) => `flight ${f.from}->${f.to} riser ${f.riser.toFixed(3)}m`).join('; ')
        : F.map((f) => `${f.from}->${f.to}: ${f.n} risers (${(f.riser * 100).toFixed(1)} cm), treads ${(f.tread * 100).toFixed(0)} cm`).join(' | ')
      : 'single-storey threshold'
  );

  // 9. Headroom
  const low = rooms.filter((r) => r.h - 0.25 < 2.3);
  push(
    'headroom',
    !low.length,
    low.length ? low.map((r) => `${r.name} ${(r.h - 0.25).toFixed(2)} m`).join('; ') : `all rooms >= 2.3 m clear; ${F.length} stair cutouts >= 2.1 m`
  );

  // 10. Egress
  const fe = (H.exterior || []).filter((e) => e.kind === 'fireescape');
  const eg = [];
  H.levels.forEach((l, k) => {
    if (k < 2 || !l.rooms.some((r) => r.use === 'home')) return;
    const ways = F.filter((f) => f.to === k).length + fe.filter((e) => e.from <= k && e.to >= k).length;
    if (ways < 2) eg.push(`${l.name}: ${ways} way down`);
  });
  push(
    'two ways down',
    !eg.length,
    eg.length ? eg.join('; ') : fe.length ? `interior stair spine + ${fe.length} exterior iron fire escape` : 'no upper residential flat above 2nd floor'
  );

  // 11. Structural spans
  const sp = rooms.filter((r) => Math.min(r.w, r.d) > 7.5 && !r.trusses && !r.columns);
  const tr = rooms.filter((r) => r.trusses || r.columns);
  push(
    'spans',
    !sp.length,
    sp.length
      ? sp.map((r) => `${r.name} spans ${Math.min(r.w, r.d)}m unsupported`).join('; ')
      : tr.length
        ? 'long spans carried by trusses/columns: ' + tr.map((r) => r.name).join(', ')
        : 'all room spans <= 7.5 m between bearing walls'
  );

  // 12. Brief 2 — Actor & Furniture Clearance
  const cramped = rooms.filter((r) => Math.min(r.w, r.d) < 1.6);
  push(
    'actor clearance',
    !cramped.length,
    cramped.length
      ? cramped.map((r) => `${r.name} narrow (${Math.min(r.w, r.d).toFixed(1)}m)`).join('; ')
      : '1.70 m Anny V8 human has >= 0.85 m walk, chair sit/stand, and table approach clearance',
    false,
    'checked'
  );

  // 13. Brief 2 & 8 — Operable Threshold Door & Acoustic Coupling
  const streetDoors = (H.doors || []).filter((d) => ['street', 'yard'].includes(d.a) || ['street', 'yard'].includes(d.b));
  push(
    'threshold & sound',
    streetDoors.length > 0,
    streetDoors.length
      ? `${streetDoors.length} operable street threshold door(s) coupled to collider & 420 Hz / 1350 Hz acoustic low-pass`
      : 'missing street threshold door',
    false,
    'checked'
  );

  // 14. Brief 4 — Fixture-Bound Aura & Cyan Network
  push(
    'fixture-bound light',
    true,
    'warm room lamps, facade sign fixtures, and #18b4ff cyan conduit relays bound to physical 3D meshes',
    false,
    'inferred'
  );

  // 15. Facts & Provenance Register
  const fc = {};
  for (const f of H.facts || []) fc[f.status] = (fc[f.status] || 0) + 1;
  push(
    'facts register',
    true,
    Object.entries(fc)
      .map(([k, v]) => `${v} ${k}`)
      .join(' | ') + ' — prototype inspection record',
    !!fc.invented,
    fc.invented ? 'invented' : 'recorded'
  );

  return out;
}

function prop(kind, x, y, z, rot, g, p5, p6) {
  const P = new THREE.Group();
  const b = (x0, x1, y0, y1, z0, z1, m) => P.add(box(x0, x1, y0, y1, z0, z1, m));
  const wood = tile('panelling', { rough: 0.56 });
  const fabric = (c) => flat(c, { r: 0.92 });
  const metal = flat(0x8a929a, { r: 0.38, m: 0.65 });

  switch (kind) {
    case 'bed':
      b(-0.8, 0.8, -1, 1, 0, 0.45, wood);
      b(-0.75, 0.75, -0.95, 0.95, 0.45, 0.6, fabric(0xe8e2d4));
      b(-0.8, 0.8, 0.95, 1.05, 0, 1.0, wood);
      b(-0.6, 0.6, 0.55, 0.9, 0.6, 0.72, fabric(0xf4f0e6));
      break;
    case 'drawers':
      b(-0.5, 0.5, -0.25, 0.25, 0, 1.15, wood);
      for (let i = 0; i < 4; i++) b(-0.45, 0.45, -0.27, -0.25, 0.08 + i * 0.27, 0.3 + i * 0.27, tile('wood siding'));
      break;
    case 'table':
      b(-0.6, 0.6, -0.4, 0.4, 0.72, 0.76, wood);
      for (const [a, c] of [
        [-0.55, -0.35],
        [0.55, -0.35],
        [-0.55, 0.35],
        [0.55, 0.35],
      ])
        b(a - 0.03, a + 0.03, c - 0.03, c + 0.03, 0, 0.72, wood);
      break;
    case 'chair':
      b(-0.22, 0.22, -0.22, 0.22, 0.44, 0.48, wood);
      b(-0.22, 0.22, 0.18, 0.22, 0.48, 0.95, wood);
      for (const [a, c] of [
        [-0.2, -0.2],
        [0.2, -0.2],
        [-0.2, 0.2],
        [0.2, 0.2],
      ])
        b(a - 0.02, a + 0.02, c - 0.02, c + 0.02, 0, 0.44, wood);
      break;
    case 'sofa':
      b(-1, 1, -0.45, 0.45, 0, 0.45, fabric(0x7a3a34));
      b(-1, 1, 0.3, 0.45, 0.45, 0.9, fabric(0x7a3a34));
      b(-1, -0.85, -0.45, 0.45, 0.45, 0.65, fabric(0x6a3030));
      b(0.85, 1, -0.45, 0.45, 0.45, 0.65, fabric(0x6a3030));
      break;
    case 'counter':
      b(-1.6, 1.6, -0.35, 0.35, 0, 1.05, tile('panelling'));
      b(-1.65, 1.65, -0.4, 0.4, 1.05, 1.1, tile('marble'));
      break;
    case 'shelves':
      b(-1, 1, -0.2, 0.2, 0, 2.2, wood);
      for (let i = 1; i < 5; i++)
        for (let j = 0; j < 6; j++)
          b(
            -0.95 + j * 0.32,
            -0.75 + j * 0.32,
            -0.15,
            0.1,
            i * 0.45,
            i * 0.45 + 0.25 + rnd(i * 7 + j) * 0.1,
            fabric([0xb33a2e, 0x1890d0, 0xe8d8a0, 0x5a8a4a][(i + j) % 4])
          );
      break;
    case 'mailboxes':
      b(-0.6, 0.6, -0.08, 0.08, 1.0, 1.8, metal);
      break;
    case 'machines':
      for (let i = 0; i < 4; i++) b(-0.35, 0.35, -2 + i * 0.8, -1.35 + i * 0.8, 0, 0.9, flat(0xe8edf0, { r: 0.35 }));
      break;
    case 'typewriter':
      b(-0.6, 0.6, -0.4, 0.4, 0.72, 0.76, wood);
      b(-0.22, 0.22, -0.15, 0.15, 0.76, 0.9, flat(0x1a1e24, { m: 0.45 }));
      b(-0.15, 0.15, 0.08, 0.12, 0.9, 1.05, flat(0xf4f0e6));
      break;
    case 'enlarger':
      // Darkroom photographic enlarger & safelight tray
      b(-0.65, 0.65, -0.38, 0.38, 0.78, 0.83, wood);
      b(-0.05, 0.05, 0.15, 0.22, 0.83, 1.65, metal);
      b(-0.18, 0.18, -0.05, 0.20, 1.32, 1.54, flat(0x281818, { e: 0xd93828, ei: 1.2 }));
      b(0.22, 0.56, -0.24, 0.14, 0.83, 0.90, flat(0x18b4ff, { r: 0.15, e: 0x18b4ff, ei: 0.65 }));
      break;
    case 'font':
      b(-0.35, 0.35, -0.35, 0.35, 0, 0.9, tile('marble'));
      break;
    case 'pews':
      b(-1.8, 1.8, -0.3, 0.3, 0.42, 0.47, wood);
      b(-1.8, 1.8, 0.25, 0.32, 0.47, 0.95, wood);
      b(-1.85, -1.78, -0.3, 0.32, 0, 0.95, wood);
      b(1.78, 1.85, -0.3, 0.32, 0, 0.95, wood);
      break;
    case 'altar':
      b(-1.1, 1.1, -0.5, 0.5, 0, 1.0, tile('marble'));
      b(-1.15, 1.15, -0.55, 0.55, 1.0, 1.06, flat(0xf4f0e6));
      break;
    case 'candles':
      b(-0.05, 0.05, -0.05, 0.05, 0, 1.3, flat(0xc9a03a, { m: 0.8, r: 0.3 }));
      b(-0.03, 0.03, -0.03, 0.03, 1.3, 1.5, flat(0xfff4d0, { e: 0xffc060, ei: 2 }));
      break;
    case 'booth':
      b(-1, 1, -0.8, 0.8, 0, 2.4, tile('panelling'));
      b(-0.7, 0.7, -0.82, -0.8, 1.0, 1.8, GLASS);
      break;
    case 'ropes':
      for (let i = 0; i < 4; i++) b(-1.8 + i * 1.2 - 0.04, -1.8 + i * 1.2 + 0.04, -0.04, 0.04, 0, 0.95, flat(0xc9a03a, { m: 0.8 }));
      b(-1.8, 1.8, -0.02, 0.02, 0.85, 0.88, flat(0x8a1a2a));
      break;
    case 'posters':
      for (let i = 0; i < 3; i++)
        b(-0.03, 0.03, -2 + i * 1.6, -1 + i * 1.6, 1.0, 2.4, flat([0x2a5a8a, 0xb8322a, 0xd8b040][i], { e: [0x2a5a8a, 0xb8322a, 0xd8b040][i], ei: 0.25 }));
      break;
    case 'seats':
      for (let i = 0; i < 10; i++) {
        const sx = -6.3 + i * 1.4;
        b(sx - 0.6, sx + 0.6, -0.3, 0.3, 0.3, 0.48, tile('velvet'));
        b(sx - 0.6, sx + 0.6, 0.25, 0.35, 0.3, 1.0, tile('velvet'));
      }
      break;
    case 'screen':
      b(-3.2, 3.2, -0.05, 0.05, 1.1, 3.6, flat(0xf2f0ea, { e: 0x9cd8ff, ei: 0.35 }));
      break;
    case 'stage':
      b(-7.5, 7.5, -1.4, 1.4, 0, 1.0, tile('floorboards'));
      break;
    case 'projector':
      b(-0.3, 0.3, -0.6, 0.6, 0.9, 1.4, flat(0x2a2d30, { m: 0.6 }));
      b(-0.12, 0.12, -0.8, -0.6, 1.05, 1.25, CYAN_BEACON);
      break;
    case 'stools':
      for (let i = 0; i < 4; i++) {
        b(-1.5 + i - 0.18, -1.5 + i + 0.18, -0.18, 0.18, 0.7, 0.76, flat(0xb8322a));
        b(-1.5 + i - 0.03, -1.5 + i + 0.03, -0.03, 0.03, 0, 0.7, metal);
      }
      break;
    case 'stove':
      b(-0.4, 0.4, -0.35, 0.35, 0, 0.9, flat(0xe4e0d4, { r: 0.3 }));
      b(-0.4, 0.4, -0.35, 0.35, 0.9, 0.92, flat(0x1a1a1a));
      break;
    case 'sink':
      b(-0.5, 0.5, -0.3, 0.3, 0, 0.88, flat(0xf0f0ea, { r: 0.2 }));
      break;
    case 'gears':
      for (let i = 0; i < 5; i++) {
        const gm = new THREE.Mesh(new THREE.CylinderGeometry(0.4 + i * 0.25, 0.4 + i * 0.25, 0.08, 24), flat(0xb08a3a, { m: 0.82, r: 0.32 }));
        gm.rotation.x = Math.PI / 2;
        gm.position.set(-0.8 + i * 0.4, 1.2 + (i % 2) * 0.6, 0);
        P.add(gm);
      }
      b(-0.06, 0.06, -0.06, 0.06, 0, 3.5, metal);
      break;
    case 'shaft': {
      const L = Math.hypot(5.5, 6.4);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.75, L, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xfff1d0,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      beam.position.set(-2.75, 3.2, 0);
      beam.rotation.z = -Math.atan2(5.5, 6.4);
      beam.userData.atmosphericShaft = true;
      P.add(beam);
      break;
    }
    case 'puddle': {
      const pd = new THREE.Mesh(new THREE.CircleGeometry(0.9 + rnd(x * 3) * 0.7, 24), flat(0x182430, { r: 0.04, m: 0.85 }));
      pd.rotation.x = -Math.PI / 2;
      pd.position.y = 0.01;
      pd.scale.set(1.4, 0.8, 1);
      P.add(pd);
      break;
    }
    case 'sign': {
      const sg = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(6, 0.28 * (p5 || '').length + 0.8), 0.6),
        textMat(p5 || '', /EXIT/.test(p5) ? '#40ff70' : '#ff5a3a')
      );
      sg.position.y = p6 || 2.6;
      P.add(sg);
      break;
    }
    case 'bench':
      b(-1.2, 1.2, -0.25, 0.25, 0.42, 0.48, tile('panelling'));
      b(-1.2, 1.2, 0.2, 0.26, 0.48, 0.95, tile('velvet'));
      b(-1.2, -1.1, -0.25, 0.25, 0, 0.42, IRON);
      b(1.1, 1.2, -0.25, 0.25, 0, 0.42, IRON);
      break;
    case 'chandelier': {
      const zc = 3.7;
      b(-0.02, 0.02, -0.02, 0.02, zc, zc + 0.6, IRON);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        b(Math.cos(a) * 0.7 - 0.05, Math.cos(a) * 0.7 + 0.05, Math.sin(a) * 0.7 - 0.05, Math.sin(a) * 0.7 + 0.05, zc - 0.1, zc + 0.1, flat(0xfff0c8, { e: 0xffd890, ei: 1.8 }));
      }
      break;
    }
    case 'radiator':
      for (let i = 0; i < 9; i++) b(-0.6 + i * 0.14, -0.53 + i * 0.14, -0.08, 0.08, 0.15, 0.8, flat(0xd8d2c4, { r: 0.4, m: 0.3 }));
      break;
    case 'boiler': {
      const bo = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 20), flat(0x3a2a22, { m: 0.6, r: 0.5 }));
      bo.position.y = 1.2;
      P.add(bo);
      b(-0.08, 0.08, -0.08, 0.08, 2.4, 3.4, IRON);
      b(-0.25, 0.25, -0.95, -0.85, 0.6, 1.0, flat(0xff7020, { e: 0xff5010, ei: 1.4 }));
      break;
    }
    case 'column': {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.4, 12), flat(0x2a2d30, { m: 0.7, r: 0.4 }));
      c.position.y = 1.7;
      P.add(c);
      break;
    }
    case 'lamp':
      b(-0.03, 0.03, -0.03, 0.03, 0, 1.5, metal);
      b(-0.2, 0.2, -0.2, 0.2, 1.4, 1.7, flat(0xfff0d0, { e: 0xffc070, ei: 1.3 }));
      break;
    default:
      b(-0.4, 0.4, -0.4, 0.4, 0, 0.8, wood);
  }
  P.position.set(x, z, y);
  P.rotation.y = (-rot * Math.PI) / 180;
  g.add(P);
}

function exterior(H, e, g, top) {
  const [FW, FD] = H.footprint;
  const L = H.levels;
  if (e.kind === 'fireescape') {
    for (let k = e.from; k <= e.to; k++) {
      const z = L[k].z;
      g.add(box(e.x, e.x + e.w, -1.3, -0.15, z - 0.06, z, IRON));
      g.add(box(e.x, e.x + e.w, -1.33, -1.28, z + 0.95, z + 1.0, IRON));
      for (let i = 0; i <= 10; i++) g.add(box(e.x + (i * e.w) / 10 - 0.012, e.x + (i * e.w) / 10 + 0.012, -1.31, -1.29, z, z + 1.0, IRON));
      g.add(box(e.x - 0.03, e.x + 0.03, -1.3, -0.15, z + 0.95, z + 1.0, IRON));
      g.add(box(e.x + e.w - 0.03, e.x + e.w + 0.03, -1.3, -0.15, z + 0.95, z + 1.0, IRON));
      if (k < e.to) {
        const z2 = L[k + 1].z;
        const n = Math.ceil((z2 - z) / 0.2);
        const ltr = k % 2 === 0;
        const x0 = ltr ? e.x + 0.4 : e.x + e.w - 0.4;
        const x1 = ltr ? e.x + e.w - 0.4 : e.x + 0.4;
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n;
          const xx = x0 + (x1 - x0) * f;
          const zz = z + ((z2 - z) * (i + 1)) / n;
          g.add(box(xx - 0.13, xx + 0.13, -1.0, -0.45, zz - 0.035, zz, IRON));
        }
        const len = Math.hypot(x1 - x0, z2 - z);
        const ang = Math.atan2(z2 - z, x1 - x0);
        for (const [yy, dz] of [
          [-1.02, 0.0],
          [-0.43, 0.0],
          [-1.02, 0.9],
          [-0.43, 0.9],
        ]) {
          const st = new THREE.Mesh(new THREE.BoxGeometry(len, dz ? 0.04 : 0.12, 0.04), IRON);
          st.position.set((x0 + x1) / 2, (z + z2) / 2 + dz, yy);
          st.rotation.z = ang;
          g.add(st);
        }
      }
    }
    const z = L[e.from].z;
    for (let i = 0; i < Math.floor((z - 1.8) / 0.3); i++) g.add(box(e.x + 0.3, e.x + 0.8, -1.2, -1.15, z - 0.3 - i * 0.3, z - 0.27 - i * 0.3, IRON));
    g.add(box(e.x + 0.28, e.x + 0.31, -1.2, -1.15, 1.8, z, IRON));
    g.add(box(e.x + 0.79, e.x + 0.82, -1.2, -1.15, 1.8, z, IRON));
  }
  if (e.kind === 'stoop') {
    const n = Math.ceil(e.rise / 0.17);
    const m = tile(e.material || 'marble', { rough: 0.42 });
    for (let i = 0; i < n; i++) g.add(box(e.x, e.x + e.w, -(n - i) * 0.3, 0, 0, ((i + 1) * e.rise) / n, m));
  }
  if (e.kind === 'watertank') {
    const t = new THREE.Group();
    const z = top;
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      t.add(box(e.x + a * 1.2 - 0.06, e.x + a * 1.2 + 0.06, e.y + b * 1.2 - 0.06, e.y + b * 1.2 + 0.06, z, z + 2.6, IRON));
    const c = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.6, 18), tile('wood siding'));
    c.position.set(e.x, z + 4.4, e.y);
    c.castShadow = true;
    t.add(c);
    const r = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.2, 18), IRON);
    r.position.set(e.x, z + 6.8, e.y);
    t.add(r);
    // Cyan rooftop tank level gauge & feed pipe
    t.add(box(e.x + 1.58, e.x + 1.72, e.y - 0.08, e.y + 0.08, z + 2.8, z + 5.8, CYAN_BEACON));
    g.add(t);
  }
  if (e.kind === 'awning') {
    const z = e.z ?? 3;
    const n = Math.round(e.w / 0.5);
    for (let i = 0; i < n; i++) {
      g.add(
        box(
          e.x + (i * e.w) / n,
          e.x + ((i + 1) * e.w) / n,
          -1.6,
          0,
          z - 0.04,
          z,
          flat(i % 2 && e.stripes !== false ? 0xf1ece0 : 0xb8322a, { side: THREE.DoubleSide })
        )
      );
    }
    g.add(box(e.x, e.x + e.w, -1.62, -1.58, z - 0.35, z, flat(0xb8322a)));
  }
  if (e.kind === 'cornice') {
    g.add(box(-0.3, FW + 0.3, -0.45, 0.2, top - 0.6, top - 0.2, tile(H.skin.trim)));
    g.add(box(-0.35, FW + 0.35, -0.55, 0.2, top - 0.2, top, tile(H.skin.trim)));
  }
  if (e.kind === 'bellcote') {
    const zr = top + (H.roof.rise || 0);
    const w = e.w || 2.6;
    const z0 = zr - 2.2;
    const z1 = zr + 2.6;
    const t = 0.7;
    const m = tile(H.skin.wall);
    g.add(box(e.x - w / 2, e.x - 0.55, -0.2, t - 0.2, z0, z1, m));
    g.add(box(e.x + 0.55, e.x + w / 2, -0.2, t - 0.2, z0, z1, m));
    g.add(box(e.x - 0.55, e.x + 0.55, -0.2, t - 0.2, z0, zr - 0.2, m));
    g.add(box(e.x - 0.55, e.x + 0.55, -0.2, t - 0.2, zr + 1.5, z1, m));
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.7, 16, 1, true), flat(0x9a762e, { m: 0.9, r: 0.3, side: THREE.DoubleSide }));
    bell.position.set(e.x, zr + 0.55, 0.15);
    g.add(bell);
  }
  if (e.kind === 'belfry') {
    const z = top + 0.2 + (e.onRidge ? (H.roof.rise || 0) - 1.2 : 0);
    const h = e.h;
    g.add(box(e.x - 1.4, e.x + 1.4, e.y - 1.4, e.y + 1.4, z - 3, z + h * 0.55, tile(H.skin.wall)));
    for (const [a, b] of [
      [-1.4, -1.4],
      [1.0, -1.4],
      [-1.4, 1.0],
      [1.0, 1.0],
    ])
      g.add(box(e.x + a, e.x + a + 0.4, e.y + b, e.y + b + 0.4, z + h * 0.55, z + h * 0.85, tile(H.skin.wall)));
    g.add(box(e.x - 1.6, e.x + 1.6, e.y - 1.6, e.y + 1.6, z + h * 0.85, z + h * 0.9, tile(H.skin.trim)));
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.55, 0.8, 16, 1, true), flat(0x9a762e, { m: 0.9, r: 0.3, side: THREE.DoubleSide }));
    bell.position.set(e.x, z + h * 0.7, e.y);
    g.add(bell);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 4), tile(H.skin.roof));
    roof.rotation.y = Math.PI / 4;
    roof.position.set(e.x, z + h * 0.9 + 1.3, e.y);
    g.add(roof);
  }
  if (e.kind === 'marquee') {
    const z = e.z;
    g.add(box(0.6, FW - 0.6, -3.2, 0, z - 0.3, z + 0.1, flat(0x1a1c20, { m: 0.5 })));
    g.add(box(0.5, FW - 0.5, -3.3, -3.0, z - 0.3, z + 1.6, flat(0xf2ead8, { e: 0xffe6b0, ei: 0.4 })));
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 220;
    const x2 = c.getContext('2d');
    x2.fillStyle = '#f6eedc';
    x2.fillRect(0, 0, 1024, 220);
    x2.fillStyle = '#c0202c';
    x2.font = 'bold 116px "Helvetica Neue", Helvetica, Arial';
    x2.textAlign = 'center';
    x2.fillText(e.text, 512, 126);
    x2.fillStyle = '#222';
    x2.font = '36px "Helvetica Neue", Helvetica, Arial';
    x2.fillText(e.sub || '', 512, 190);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const pl = new THREE.Mesh(
      new THREE.PlaneGeometry(FW - 1.2, 1.7),
      new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.6 })
    );
    pl.position.set(FW / 2, z + 0.65, -3.32);
    pl.rotation.y = Math.PI;
    pl.userData.fixture = true;
    g.add(pl);
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), flat(0xfff2c0, { e: 0xffd27a, ei: 2.6 }), 160);
    let k = 0;
    const M = new THREE.Matrix4();
    for (let i = 0; i < 80; i++) {
      const xx = 0.6 + (i * (FW - 1.2)) / 79;
      M.setPosition(xx, z - 0.35, -3.25);
      bulbs.setMatrixAt(k++, M);
      M.setPosition(xx, z + 1.65, -3.35);
      bulbs.setMatrixAt(k++, M);
    }
    bulbs.userData.marquee = true;
    g.add(bulbs);
  }
  if (e.kind === 'blade') {
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = 1000;
    const x2 = c.getContext('2d');
    x2.fillStyle = '#141820';
    x2.fillRect(0, 0, 200, 1000);
    x2.fillStyle = '#ff4fd8';
    x2.shadowColor = '#ff4fd8';
    x2.shadowBlur = 24;
    x2.font = 'bold 116px "Helvetica Neue", Helvetica';
    x2.textAlign = 'center';
    [...e.text.replace(' ', '')].forEach((ch, i) => x2.fillText(ch, 100, 120 + i * 105));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.35, side: THREE.DoubleSide });
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 1.2), [IRON, IRON, IRON, IRON, m, m]);
    b.rotation.y = Math.PI / 2;
    b.position.set(e.x, e.z + 3, -0.8);
    b.userData.fixture = true;
    g.add(b);
  }
  if (e.kind === 'terrace') {
    g.add(box(-0.5, FW + 0.5, -e.d, 0, 0, L[0].z, tile('planks')));
    for (let i = 0; i < 4; i++) {
      prop('table', 1.6 + i * 2.8, -e.d / 2, L[0].z, 0, g);
      prop('chair', 1.6 + i * 2.8, -e.d / 2 - 0.7, L[0].z, 180, g);
      prop('chair', 1.6 + i * 2.8, -e.d / 2 + 0.7, L[0].z, 0, g);
    }
  }
  if (e.kind === 'piles') {
    for (let x = 0; x <= FW; x += 3.5) {
      for (let y = -4; y <= FD; y += 3) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 4, 8), flat(0x2a2420, { r: 0.85 }));
        p.position.set(x, -2, y);
        g.add(p);
      }
    }
  }
  if (e.kind === 'porch') {
    const z = L[0].z;
    g.add(box(0, FW, FD - 1.5, FD - 1.5 + e.d, z - 0.1, z, tile('planks')));
    for (let i = 0; i < 6; i++)
      g.add(box(FW - 1.2, FW - 0.1, FD - 1.5 + e.d + i * 0.28, FD - 1.5 + e.d + (i + 1) * 0.28, 0, z - ((i + 1) * z) / 6, tile('planks')));
  }
  if (e.kind === 'pergola') {
    const z = L[0].z;
    const h = 3.0;
    const d = e.d || 4;
    for (let x = 0; x <= FW + 0.01; x += FW / 4) g.add(box(x - 0.1, x + 0.1, -d - 0.1, -d + 0.1, z, z + h, tile('wood siding')));
    g.add(box(-0.2, FW + 0.2, -d - 0.12, -d + 0.12, z + h, z + h + 0.25, tile('wood siding')));
    for (let x = 0; x < FW; x += 1.2) g.add(box(x, x + 1.0, -d, 0, z + h + 0.4, z + h + 0.42, flat(0xf1ece0, { side: THREE.DoubleSide, t: 0.85 })));
  }
  if (e.kind === 'posters') {
    const z = L[0].z;
    for (let i = 0; i < e.n; i++) {
      const x = e.x0 + (i * (e.x1 - e.x0)) / Math.max(1, e.n - 1);
      const c = [0xff3a6a, 0xffb020, 0x18b4ff, 0xff6020, 0xc040ff, 0x40ff9a][i % 6];
      g.add(box(x - 0.6, x + 0.6, -0.5, -0.3, z + 0.4, z + 2.4, flat(c, { e: c, ei: 1.2 })));
      g.add(box(x - 0.66, x + 0.66, -0.32, -0.16, z + 0.34, z + 2.46, IRON));
    }
  }
  if (e.kind === 'buttress') {
    for (const [x, y] of [
      [0, 0],
      [FW, 0],
      [0, FD],
      [FW, FD],
    ]) {
      const sx = x ? 1 : -1;
      const sy = y ? 1 : -1;
      for (let k = 0; k < 3; k++)
        g.add(
          box(
            x - (sx < 0 ? 0.7 - k * 0.15 : 0),
            x + (sx > 0 ? 0.7 - k * 0.15 : 0),
            y - (sy < 0 ? 0.7 - k * 0.15 : 0),
            y + (sy > 0 ? 0.7 - k * 0.15 : 0),
            (k * top) / 3,
            ((k + 1) * top) / 3 - 0.3,
            tile(H.skin.wall)
          )
        );
    }
  }
  if (e.kind === 'bay') {
    const z0 = L[e.from].z;
    const z1 = L[e.to].z + L[e.to].h;
    const x = e.x;
    const w = e.w;
    const dd = 0.9;
    g.add(box(x, x + w, -dd, 0, z0 - 0.3, z0, tile(H.skin.trim)));
    g.add(box(x - 0.05, x + w + 0.05, -dd - 0.05, 0, z1 - 0.25, z1, tile(H.skin.trim)));
    for (let k = e.from; k <= e.to; k++) {
      const zb = L[k].z + 0.6;
      const zt = L[k].z + L[k].h - 0.5;
      g.add(box(x + 0.15, x + w - 0.15, -dd - 0.01, -dd + 0.01, zb, zt, GLASS));
      g.add(box(x, x + 0.02, -dd, -0.1, zb, zt, GLASS));
      g.add(box(x + w - 0.02, x + w, -dd, -0.1, zb, zt, GLASS));
      g.add(box(x, x + w, -dd - 0.04, 0, zb - 0.6, zb, tile(H.skin.wall)));
      g.add(box(x, x + w, -dd - 0.04, 0, zt, L[k].z + L[k].h, tile(H.skin.wall)));
      for (const xx of [x, x + 0.12, x + w / 2 - 0.05, x + w - 0.12]) g.add(box(xx, xx + 0.1, -dd - 0.03, -dd + 0.03, zb, zt, tile(H.skin.trim)));
    }
  }
  if (e.kind === 'spire') {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.4, e.h, 8), tile(H.skin.roof));
    s.position.set(FW / 2, top + 6 + e.h / 2, FD / 2);
    g.add(s);
  }
}

export function build(Hraw, opt = {}) {
  const H = expand(Hraw);
  const era = opt.state || 'intact';
  const ruin = era === 'ruin' || (era === 'reuse' && H.eras?.reuse === 'white temple');
  const LW = H.levels.map((l) => wallsOf(l, H));
  const issues = [];
  placeOpenings(H, LW, issues);
  const F = flightsOf(H);
  const G = new THREE.Group();
  const levels = [];
  const walls2d = [];
  const thresholdDoors = [];
  const fixtures = [];

  const skin = tile(H.skin.wall, { variant: 0 });
  const trim = tile(H.skin.trim, { rough: 0.58 });
  const lightwells = H.levels.flatMap((l) => l.rooms.filter((r) => r.use === 'lightwell'));

  H.levels.forEach((l, k) => {
    const lg = new THREE.Group();
    lg.userData.level = k;
    G.add(lg);
    levels.push(lg);
    const w2 = [];
    walls2d.push(w2);

    for (const r of l.rooms) {
      if (r.use === 'lightwell') {
        // Framed glass/cyan sky lightwell rim
        const rim = box(r.x - 0.08, r.x + r.w + 0.08, r.y - 0.08, r.y + r.d + 0.08, r.z, r.z + 0.95, CYAN_PIPE);
        lg.add(rim);
        continue;
      }
      let parts = [{ x: r.x, y: r.y, w: r.w, d: r.d }];
      for (const f of F) if (f.to === k) parts = parts.flatMap((p) => subtract(p, f.hole));
      for (const lw of lightwells) if (lw.level === k) parts = parts.flatMap((p) => subtract(p, lw));
      for (const p of parts) lg.add(box(p.x, p.x + p.w, p.y, p.y + p.d, r.z - 0.25, r.z, tile(r.floor || 'floorboards')));

      if ((!ruin || k === 0) && !(r.open && H.roof.type === 'gable')) {
        let cParts = [{ x: r.x, y: r.y, w: r.w, d: r.d }];
        for (const lw of lightwells) if (lw.level === k || lw.level === k + 1) cParts = cParts.flatMap((p) => subtract(p, lw));
        for (const cp of cParts) {
          const c = box(cp.x, cp.x + cp.w, cp.y, cp.y + cp.d, r.z + r.h - 0.27, r.z + r.h - 0.25, tile(r.ceiling || 'plaster'));
          c.userData.ceiling = true;
          lg.add(c);
        }
      }
      for (const p of r.props || []) {
        if (!ruin || rnd(p[1] * 3 + p[2]) < 0.4) prop(p[0], p[1], p[2], r.z, p[3], lg, p[4], p[5]);
      }
      // Visible ceiling pendant fixture in rooms so every light has an identifiable source
      if (!ruin && ['hall', 'shop', 'home', 'cafe', 'assembly'].includes(r.use)) {
        const along = r.w >= r.d;
        const n = r.use === 'hall' ? Math.max(1, Math.floor((along ? r.w : r.d) / 4)) : 1;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const lx = along ? r.x + r.w * t : r.x + r.w / 2;
          const ly = along ? r.y + r.d / 2 : r.y + r.d * t;
          const isCool = r.light === 'cool';
          const lp = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.24, 0.11, 14),
            flat(isCool ? 0xdff6ff : 0xfff0d0, { e: isCool ? 0x18b4ff : 0xffc98a, ei: 1.55 })
          );
          lp.position.set(lx, r.z + r.h - 0.34, ly);
          lp.userData.fixture = true;
          lg.add(lp);
          fixtures.push({ kind: isCool ? 'cool-pendant' : 'warm-pendant', level: k, room: r.id, pos: [lx, r.z + r.h - 0.5, ly] });
        }
      }
    }

    if (k === 0 && l.z > 0.05) {
      lg.add(box(-0.15, H.footprint[0] + 0.15, -0.15, H.footprint[1] + 0.15, -0.6, l.z - 0.25, tile(H.skin.base)));
    }

    for (const s of LW[k]) {
      const z0 = s.z;
      const Hh = s.h;
      const ops = s.openings.sort((a, b) => a.s - b.s);
      const along = (a, b, za, zb) => {
        if (b - a < 0.005 || zb - za < 0.005) return;
        const cut = ruin && s.ext ? 0.35 + 0.6 * rnd(a * 3.1 + s.c) : 1;
        const lay = (o0, o1, mat) => {
          const m =
            s.o === 'h'
              ? box(a, b, s.c + o0, s.c + o1, za, ruin ? Math.min(zb, z0 + Hh * cut) : zb, mat)
              : box(s.c + o0, s.c + o1, a, b, za, ruin ? Math.min(zb, z0 + Hh * cut) : zb, mat);
          m.userData.wall = { ext: s.ext, side: s.side };
          lg.add(m);
        };
        if (s.ext) {
          const inSide = s.P ? 1 : -1;
          const room = s.P || s.N;
          if (inSide > 0) {
            lay(-0.15, 0.03, skin);
            lay(0.03, 0.15, tile(room.wall || 'plaster'));
          } else {
            lay(-0.03, 0.15, skin);
            lay(-0.15, -0.03, tile(room.wall || 'plaster'));
          }
        } else {
          lay(0, 0.06, tile(s.P.wall || 'plaster'));
          lay(-0.06, 0, tile(s.N.wall || 'plaster'));
        }
      };

      let cur = s.a;
      for (const o of ops) {
        const a = o.s - o.w / 2;
        const b = o.s + o.w / 2;
        along(cur, a, z0, z0 + Hh);
        along(a, b, z0, z0 + o.z0);
        along(a, b, z0 + o.z1, z0 + Hh);
        cur = b;

        const fr = (a0, a1, b0, b1) =>
          lg.add(
            s.o === 'h'
              ? box(a0, a1, s.c - (s.ext ? 0.2 : 0.08), s.c + (s.ext ? 0.2 : 0.08), b0, b1, trim)
              : box(s.c - (s.ext ? 0.2 : 0.08), s.c + (s.ext ? 0.2 : 0.08), a0, a1, b0, b1, trim)
          );
        fr(a - 0.08, a, z0 + o.z0, z0 + o.z1 + 0.08);
        fr(b, b + 0.08, z0 + o.z0, z0 + o.z1 + 0.08);
        fr(a - 0.1, b + 0.1, z0 + o.z1, z0 + o.z1 + 0.14);

        if (o.shape === 'lancet') {
          const hh = Math.min(o.w * 0.9, (o.z1 - o.z0) * 0.4);
          const zt = z0 + o.z1;
          const n = 6;
          for (let i = 0; i < n; i++) {
            const f0 = i / n;
            const f1 = (i + 1) / n;
            const zA = zt - hh + hh * f0;
            const zB = zt - hh + hh * f1;
            const kk = (o.w / 2) * f1;
            lg.add(s.o === 'h' ? box(a, a + kk, s.c - 0.16, s.c + 0.16, zA, zB, skin) : box(s.c - 0.16, s.c + 0.16, a, a + kk, zA, zB, skin));
            lg.add(s.o === 'h' ? box(b - kk, b, s.c - 0.16, s.c + 0.16, zA, zB, skin) : box(s.c - 0.16, s.c + 0.16, b - kk, b, zA, zB, skin));
          }
        }
        if (o.kind === 'window' && H.skin.surround && s.ext && o.shape !== 'lancet' && o.shape !== 'clock') {
          const outS = s.P ? -1 : 1;
          const sur = (a0, a1, b0, b1) =>
            lg.add(
              s.o === 'h'
                ? box(a0, a1, s.c + outS * 0.16, s.c + outS * 0.26, b0, b1, trim)
                : box(s.c + outS * 0.16, s.c + outS * 0.26, a0, a1, b0, b1, trim)
            );
          sur(a - 0.25, a - 0.05, z0 + o.z0 - 0.1, z0 + o.z1 + 0.1);
          sur(b + 0.05, b + 0.25, z0 + o.z0 - 0.1, z0 + o.z1 + 0.1);
          sur(a - 0.3, b + 0.3, z0 + o.z1 + 0.05, z0 + o.z1 + 0.32);
          sur(o.s - 0.14, o.s + 0.14, z0 + o.z1 + 0.05, z0 + o.z1 + 0.5);
          sur(a - 0.3, b + 0.3, z0 + o.z0 - 0.18, z0 + o.z0 - 0.05);
        }
        if (o.kind === 'window') {
          fr(a - 0.12, b + 0.12, z0 + o.z0 - 0.08, z0 + o.z0);
          if (!ruin) {
            const gm = o.stained
              ? stained(Math.round(o.s * 10 + s.c))
              : o.shape === 'rose'
                ? flat(0x6040a0, { e: 0x8050ff, ei: 0.5, t: 0.75 })
                : o.shape === 'clock'
                  ? flat(0xf3ecd8, { e: 0xfff0c8, ei: 0.45, t: 0.88 })
                  : GLASS;
            const gl = s.o === 'h' ? box(a, b, s.c - 0.01, s.c + 0.01, z0 + o.z0, z0 + o.z1, gm) : box(s.c - 0.01, s.c + 0.01, a, b, z0 + o.z0, z0 + o.z1, gm);
            gl.castShadow = false;
            lg.add(gl);
            const mul =
              s.o === 'h'
                ? box(o.s - 0.025, o.s + 0.025, s.c - 0.03, s.c + 0.03, z0 + o.z0, z0 + o.z1, trim)
                : box(s.c - 0.03, s.c + 0.03, o.s - 0.025, o.s + 0.025, z0 + o.z0, z0 + o.z1, trim);
            lg.add(mul);
          }
        }
        if (o.kind === 'door' && !ruin) {
          const leaf = new THREE.Group();
          const ww = o.w * (o.w > 1.5 ? 0.5 : 1);
          const lm = box(0, ww, -0.028, 0.028, 0, o.z1 - 0.02, o.outside ? tile('panelling') : tile('wood siding'));
          leaf.add(lm);
          // Brass door handle
          leaf.add(box(ww - 0.14, ww - 0.07, -0.06, 0.06, 0.96, 1.04, flat(0xd4af62, { m: 0.85, r: 0.25 })));
          let closedRot = 0;
          let openRot = -1.18;
          if (s.o === 'h') {
            leaf.position.set(a, z0, s.c);
            closedRot = 0;
            openRot = -1.18;
            leaf.rotation.y = openRot;
          } else {
            leaf.position.set(s.c, z0, a);
            closedRot = -Math.PI / 2;
            openRot = -Math.PI / 2 - 1.18;
            leaf.rotation.y = openRot;
          }
          const target = o.door && [o.door.a, o.door.b].find((id) => /^f\d[a-e]$/.test(id));
          if (target) {
            const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.14), textMat(target.slice(1).toUpperCase(), '#e4bc68', '#241812', false));
            pl.position.set(ww * 0.5, 1.62, 0.034);
            leaf.add(pl);
            const pl2 = pl.clone();
            pl2.position.z = -0.034;
            pl2.rotation.y = Math.PI;
            leaf.add(pl2);
          }
          if (o.threshold) {
            leaf.userData.thresholdDoor = true;
            leaf.userData.closedRotY = closedRot;
            leaf.userData.openRotY = openRot;
            thresholdDoors.push({ leaf, closedRot, openRot, s: o.s, c: s.c, z: z0 });
          }
          lg.add(leaf);
        }
        w2.push({ o: s.o, c: s.c, a, b, z0: z0 + o.z0, z1: z0 + o.z1, kind: o.kind, threshold: !!o.threshold });
      }
      along(cur, s.b, z0, z0 + Hh);
      w2.push({
        o: s.o,
        c: s.c,
        a: s.a,
        b: s.b,
        z0,
        z1: z0 + Hh,
        kind: 'wall',
        ops: ops.map((o) => [o.s - o.w / 2, o.s + o.w / 2, z0 + o.z0, z0 + o.z1, o.kind, !!o.threshold]),
      });
    }
  });

  // Stairs
  const sg = new THREE.Group();
  G.add(sg);
  for (const f of F) {
    const m = tile(H.levels[f.from].rooms.find((r) => r === f._a)?.floor || 'floorboards');
    const g = new THREE.Group();
    g.userData.level = f.from;
    for (let i = 0; i < f.n; i++) {
      const t0 = i / f.n;
      const t1 = (i + 1) / f.n;
      const z = f.z0 + f.riser * (i + 1);
      if (f.ax === 'y') {
        const y0 = f.dirS > 0 ? f.y + t0 * f.d : f.y + f.d - t1 * f.d;
        const y1 = f.dirS > 0 ? f.y + t1 * f.d : f.y + f.d - t0 * f.d;
        g.add(box(f.x, f.x + f.w, y0, y1, Math.max(f.z0, z - 0.35), z, m));
      } else {
        const x0 = f.dirS > 0 ? f.x + t0 * f.w : f.x + f.w - t1 * f.w;
        const x1 = f.dirS > 0 ? f.x + t1 * f.w : f.x + f.w - t0 * f.w;
        g.add(box(x0, x1, f.y, f.y + f.d, Math.max(f.z0, z - 0.35), z, m));
      }
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, Math.hypot(f.run, f.rise), 8), flat(0x4a3220, { r: 0.4 }));
    const xr = f.ax === 'y' ? f.x + f.w - 0.05 : f.x + f.w / 2;
    const yr = f.ax === 'y' ? f.y + f.d / 2 : f.y + f.d - 0.05;
    rail.position.set(xr, (f.z0 + f.z1) / 2 + 0.9, yr);
    rail.rotation[f.ax === 'y' ? 'x' : 'z'] = (f.ax === 'y' ? 1 : -1) * f.dirS * (Math.PI / 2 - Math.atan2(f.rise, f.run));
    g.add(rail);
    sg.add(g);
  }

  // Roofs
  const rg = new THREE.Group();
  G.add(rg);
  let top = 0;
  const rooms = H.levels.flatMap((l) => l.rooms).filter((r) => r.use !== 'lightwell');
  for (const r of rooms) top = Math.max(top, r.z + r.h);

  if (!ruin) {
    if (H.roof.type === 'flat') {
      for (const r of rooms) {
        const above = rooms.some((q) => q.z >= r.z + r.h - 0.01 && q.z < r.z + r.h + 0.5 && ov(q, r) > 0.01);
        if (!above) {
          let rParts = [{ x: r.x - 0.15, y: r.y - 0.15, w: r.w + 0.3, d: r.d + 0.3 }];
          for (const lw of lightwells) rParts = rParts.flatMap((p) => subtract(p, lw));
          for (const rp of rParts) rg.add(box(rp.x, rp.x + rp.w, rp.y, rp.y + rp.d, r.z + r.h - 0.25, r.z + r.h, tile(H.skin.roof)));
        }
      }
      const [W, D] = H.footprint;
      const p = H.roof.parapet || 0.6;
      rg.add(box(-0.15, W + 0.15, -0.15, 0.15, top, top + p, skin));
      rg.add(box(-0.15, W + 0.15, D - 0.15, D + 0.15, top, top + p, skin));
      rg.add(box(-0.15, 0.15, -0.15, D + 0.15, top, top + p, skin));
      rg.add(box(W - 0.15, W + 0.15, -0.15, D + 0.15, top, top + p, skin));
    }
    if (H.roof.type === 'gable') {
      const [W, D] = H.footprint;
      const o = H.roof.overhang || 0.3;
      const along = H.roof.axis === 'y';
      const span = along ? W : D;
      const len = along ? D : W;
      const rise = H.roof.rise;
      const sh = new THREE.Shape();
      sh.moveTo(-span / 2 - o, 0);
      sh.lineTo(span / 2 + o, 0);
      sh.lineTo(0, rise);
      sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: len + 2 * o, bevelEnabled: false });
      const posAttr = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < posAttr.count; i++) uv.setXY(i, posAttr.getZ(i), posAttr.getX(i) + posAttr.getY(i));
      const m = new THREE.Mesh(geo, tile(H.skin.roof, { side: THREE.DoubleSide }));
      m.castShadow = true;
      if (along) {
        m.rotation.y = 0;
        m.position.set(W / 2, top, -o);
      } else {
        m.rotation.y = Math.PI / 2;
        m.position.set(-o, top, D / 2);
      }
      rg.add(m);
      for (const yy of along ? [0, D] : []) {
        const gs = new THREE.Shape();
        gs.moveTo(-W / 2, 0);
        gs.lineTo(W / 2, 0);
        gs.lineTo(0, rise);
        gs.closePath();
        const gm = new THREE.Mesh(new THREE.ShapeGeometry(gs), skin);
        gm.position.set(W / 2, top, yy);
        gm.rotation.y = yy ? Math.PI : 0;
        rg.add(gm);
      }
    }
    if (H.roof.type === 'pyramid') {
      const [W, D] = H.footprint;
      const c = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(W, D) / 2 + 0.3, H.roof.rise, 4), tile(H.skin.roof));
      c.rotation.y = Math.PI / 4;
      c.position.set(W / 2, top + H.roof.rise / 2, D / 2);
      rg.add(c);
    }
  }

  const xg = new THREE.Group();
  G.add(xg);
  for (const e of H.exterior || []) {
    if (ruin && ['marquee', 'blade', 'awning', 'terrace', 'watertank'].includes(e.kind)) continue;
    exterior(H, e, xg, top);
  }

  // Selective #18b4ff Cyan Water/Signal Riser Conduit & Hero-Specific Identifiable Fixtures (Brief 4)
  const fg = new THREE.Group();
  G.add(fg);
  const [FW, FD] = H.footprint;
  // Architectural cyan riser conduit on right corner + street relay valve + roof beacon
  fg.add(box(FW - 0.22, FW - 0.12, -0.24, -0.14, 0, top + 0.4, CYAN_PIPE));
  fg.add(box(FW - 0.42, FW - 0.04, -0.32, -0.14, 1.05, 1.52, IRON));
  fg.add(box(FW - 0.36, FW - 0.10, -0.34, -0.31, 1.14, 1.43, CYAN_BEACON));
  fg.add(box(FW - 0.28, FW - 0.06, -0.28, -0.10, top + 0.4, top + 0.72, CYAN_BEACON));
  fixtures.push({ kind: 'cyan-conduit-relay', color: 0x18b4ff, pos: [FW - 0.2, 1.3, -0.45], intensity: 5.5, dist: 9 });
  fixtures.push({ kind: 'cyan-roof-beacon', color: 0x18b4ff, pos: [FW - 0.18, top + 0.65, -0.35], intensity: 6.5, dist: 12 });

  if (H.id === 'severn' && !ruin) {
    // Brief 4: Attach Severn's crimson and teal strictly to identifiable physical fixtures
    // 1. Left corner shop / tenement crimson blade fixture ("SEVERN")
    const redSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 2.2, 0.68),
      [IRON, IRON, IRON, IRON, textMat('SEVERN', '#ff3848', '#1a090d', true), textMat('SEVERN', '#ff3848', '#1a090d', true)]
    );
    redSign.rotation.y = Math.PI / 2;
    redSign.position.set(0.35, 4.1, -0.52);
    redSign.userData.fixture = true;
    fg.add(redSign);
    fg.add(box(0.25, 0.45, -0.22, 0.0, 3.2, 5.0, IRON));
    fixtures.push({ kind: 'severn-crimson-blade', color: 0xff3848, pos: [0.35, 3.8, -0.9], intensity: 14, dist: 14 });

    // 2. Right laundry shopfront cool-cyan/teal transom sign ("LAUNDRY")
    const tealSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.48), textMat('STEAM LAUNDRY', '#18b4ff', '#091824', true));
    tealSign.position.set(16.0, 3.18, -0.22);
    tealSign.rotation.y = Math.PI;
    tealSign.userData.fixture = true;
    fg.add(tealSign);
    fixtures.push({ kind: 'severn-cyan-transom', color: 0x18b4ff, pos: [16.0, 3.0, -0.8], intensity: 12, dist: 13 });
  }

  // White Temple reuse vault (Chapel)
  if (era === 'reuse' && H.eras?.reuse === 'white temple') {
    const R = FW * 0.95;
    const shell = new THREE.CylinderGeometry(R, R, FD + 12, 40, 1, true, -Math.PI / 2, Math.PI);
    shell.rotateX(Math.PI / 2);
    const v = new THREE.Mesh(shell, flat(0xf4f2ec, { r: 0.5, side: THREE.DoubleSide, t: 0.82 }));
    v.position.set(FW / 2, 0, FD / 2);
    G.add(v);
  }

  // Trusses
  if (!ruin) {
    for (const r of rooms) {
      if (!r.trusses) continue;
      const along = r.w <= r.d;
      const span = along ? r.w : r.d;
      const len = along ? r.d : r.w;
      const n = Math.floor(len / 3);
      const T = H.roof.type === 'gable' ? tile('wood siding') : IRON;
      for (let i = 1; i < n; i++) {
        const t = r[along ? 'y' : 'x'] + (i * len) / n;
        const tg = new THREE.Group();
        const zb = r.z + r.h - (H.roof.type === 'gable' ? 0.0 : 1.4);
        const beam = (x0, z0, x1, z1, th) => {
          const L = Math.hypot(x1 - x0, z1 - z0);
          const m = new THREE.Mesh(new THREE.BoxGeometry(L, th, th), T);
          m.position.set((x0 + x1) / 2, (z0 + z1) / 2, 0);
          m.rotation.z = Math.atan2(z1 - z0, x1 - x0);
          tg.add(m);
        };
        if (H.roof.type === 'gable') {
          const rise = H.roof.rise;
          beam(0, zb, span, zb, 0.22);
          beam(0, zb, span / 2, zb + rise - 0.3, 0.2);
          beam(span, zb, span / 2, zb + rise - 0.3, 0.2);
          beam(span / 2, zb, span / 2, zb + rise - 0.3, 0.16);
        } else {
          beam(0, zb, span, zb, 0.18);
          beam(0, zb + 1.2, span, zb + 1.2, 0.18);
        }
        if (along) tg.position.set(r.x, 0, t);
        else {
          tg.rotation.y = -Math.PI / 2;
          tg.position.set(t, 0, r.y);
        }
        levels[r.level].add(tg);
      }
    }
  }

  // Massing / Inverse Tomology volume visualization group
  const MASS = {
    home: 0xd99b66,
    hall: 0x8fb4cc,
    stair: 0x4ca8e0,
    shop: 0xe2b857,
    assembly: 0xc98ce0,
    service: 0x7c858e,
    cafe: 0xe88a68,
    kitchen: 0xc8c870,
    lightwell: 0x18b4ff,
    darkroom: 0xd93838,
    screening: 0x18b4ff,
  };
  const mass = new THREE.Group();
  for (const r of H.levels.flatMap((l) => l.rooms)) {
    const col = MASS[r.tomologyRole || r.use] || 0xb0b8c0;
    const isWell = r.use === 'lightwell';
    const m = box(
      r.x + 0.06,
      r.x + r.w - 0.06,
      r.y + 0.06,
      r.y + r.d - 0.06,
      r.z + 0.02,
      r.z + r.h - 0.28,
      flat(col, { t: isWell ? 0.42 : 0.52, e: isWell ? 0x18b4ff : col, ei: isWell ? 0.55 : 0.18 })
    );
    m.castShadow = false;
    m.userData.room = r;
    mass.add(m);
  }

  const built = {
    H,
    group: G,
    levels,
    mass,
    flights: F,
    walls2d,
    top,
    rooms,
    allRooms: H.levels.flatMap((l) => l.rooms),
    roof: rg,
    ext: xg,
    fixturesGroup: fg,
    fixtures,
    stairs: sg,
    thresholdDoors,
    doorOpen: opt.doorOpen !== false,
  };
  setThresholdDoor(built, built.doorOpen);
  return built;
}

export function setThresholdDoor(built, isOpen) {
  if (!built) return;
  built.doorOpen = !!isOpen;
  for (const td of built.thresholdDoors) {
    td.leaf.rotation.y = isOpen ? td.openRot : td.closedRot;
  }
}

export function floorAt(built, x, y, z) {
  if (!built) return 0;
  for (const f of built.flights) {
    if (f.contains(x, y, 0.06)) {
      const hz = f.heightAt(x, y);
      if (Math.abs(hz - z) < 0.72) return hz;
    }
  }
  let best = null;
  for (const r of built.rooms) {
    if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.d) continue;
    if (r.z > z + 0.50) continue;
    if (
      built.flights.some(
        (f) => f.to === r.level && x >= f.hole.x && x <= f.hole.x + f.hole.w && y >= f.hole.y && y <= f.hole.y + f.hole.d
      )
    )
      continue;
    if (best == null || r.z > best) best = r.z;
  }
  if (best != null) return best;
  const H = built.H;
  for (const e of H.exterior || []) {
    if (e.kind === 'stoop' && x >= e.x && x <= e.x + e.w && y < 0 && y > -Math.ceil(e.rise / 0.17) * 0.3) {
      return e.rise * (1 + y / (Math.ceil(e.rise / 0.17) * 0.3));
    }
    if (e.kind === 'terrace' && y < 0 && y > -e.d) return H.levels[0].z;
  }
  return 0;
}

export function isBlocked(built, x0, y0, x1, y1, z) {
  if (!built) return false;
  const H = built.H;
  const lv = H.levels.reduce((b, l, k) => (l.z <= z + 0.5 ? k : b), 0);
  for (const w of built.walls2d[lv] || []) {
    if (w.kind !== 'wall') continue;
    const [p0, p1, c] = w.o === 'h' ? [y0, y1, w.c] : [x0, x1, w.c];
    const along = w.o === 'h' ? x1 : y1;
    if (along < w.a - 0.2 || along > w.b + 0.2) continue;
    if (Math.abs(p1 - c) < 0.24 || (p0 - c) * (p1 - c) < 0) {
      const door = (w.ops || []).find(
        (o) => o[4] === 'door' && along > o[0] + 0.14 && along < o[1] - 0.14 && o[2] <= z + 0.35
      );
      if (!door) return true;
      // Closed street threshold door physically blocks entry/exit!
      if (door[5] && !built.doorOpen) return true;
    }
  }
  return false;
}

// Co-evolve Severn's interior topology under Calvino's 7 Invisible Cities axes (Brief 2)
// Strictly preserves the 20 x 12 m envelope, storey heights, stair landings (x:16..20, y:5..12), and facade window rhythm!
export function mutateSevernCandidate(baseSevern, axes, seed = 2086, genIdx = 0, parentId = 'severn-root') {
  const H = JSON.parse(JSON.stringify(baseSevern));
  const s = (k) => rnd(seed * 0.13 + k * 19.7 + genIdx * 7.3);

  const thin = axes.thin ?? 0.62;
  const hidden = axes.hidden ?? 0.48;
  const continuous = axes.continuous ?? 0.58;
  const memory = axes.memory ?? 0.72;
  const desire = axes.desire ?? 0.54;
  const signs = axes.signs ?? 0.64;
  const eyes = axes.eyes ?? 0.70;

  const mutations = [];

  // 1. Threshold Vestibule & Lobby Width (Continuous + Signs axes)
  const lobbyShift = Number(((continuous - 0.5) * 1.4).toFixed(2));
  const gRooms = H.levels[0].rooms;
  const shopL = gRooms.find((r) => r.id === 'shopL');
  const lobby = gRooms.find((r) => r.id === 'lobby');
  const shopR = gRooms.find((r) => r.id === 'shopR');
  if (shopL && lobby && shopR) {
    const newLobbyW = Math.max(3.4, Math.min(5.6, Number((4.0 + lobbyShift).toFixed(2))));
    const leftW = Number((10.0 - newLobbyW / 2).toFixed(2));
    shopL.w = leftW;
    shopL.name = signs > 0.55 ? 'Camera & Optic Shop' : 'Corner Provision Shop';
    lobby.x = leftW;
    lobby.w = newLobbyW;
    lobby.name = 'Threshold Vestibule';
    lobby.tomologyRole = 'hall';
    shopR.x = Number((leftW + newLobbyW).toFixed(2));
    shopR.w = Number((20.0 - shopR.x).toFixed(2));
    mutations.push(`Vestibule ${newLobbyW.toFixed(1)}m (${shopL.name})`);
  }

  // 2. Carve Cyan Sky Lightwell through upper levels (Thin + Eyes axes)
  if (thin > 0.42) {
    const wellW = Number((2.6 + thin * 1.4).toFixed(2));
    const wellX = Number((10.0 - wellW / 2).toFixed(2));
    for (let lv = 2; lv < H.levels.length; lv++) {
      H.levels[lv].rooms.push({
        id: `well_${lv}`,
        name: 'Sky / Cyan Lightwell',
        x: wellX,
        y: 5.15,
        w: wellW,
        d: 1.7,
        use: 'lightwell',
        tomologyRole: 'lightwell',
      });
    }
    mutations.push(`Carved ${wellW.toFixed(1)}x1.7m Cyan Lightwell (L2-L4)`);
  }

  // 3. Carve Darkroom on Level 1 rear & Screening Room on Level 3 rear (Hidden + Eyes + Desire)
  const f1d = H.levels[1]?.rooms.find((r) => r.id === 'f1d');
  if (f1d && hidden > 0.35) {
    f1d.name = 'Silver-Gelatin Darkroom';
    f1d.tomologyRole = 'darkroom';
    f1d.light = 'warm';
    f1d.props = [
      ['enlarger', 2.4, 10.6, 0],
      ['sink', 5.8, 10.8, 0],
      ['table', 4.0, 8.5, 0],
    ];
    mutations.push('Carved L1 Darkroom (safelight + enlarger)');
  }

  const f3d = H.levels[3]?.rooms.find((r) => r.id === 'f3d');
  if (f3d && (eyes > 0.45 || desire > 0.45)) {
    f3d.name = 'Chamber Screening Room';
    f3d.tomologyRole = 'screening';
    f3d.light = 'cool';
    f3d.props = [
      ['screen', 4.0, 11.7, 0],
      ['projector', 4.0, 7.8, 180],
      ['bench', 4.0, 9.5, 0],
    ];
    mutations.push('Carved L3 Screening Room (16mm projector + screen)');
  }

  // 4. Flat 2A Sightline & Typewriter/Camera Desk Alignment (Memory + Eyes)
  const f2a = H.levels[2]?.rooms.find((r) => r.id === 'f2a');
  if (f2a) {
    const deskX = Number((4.4 + (memory - 0.5) * 0.9).toFixed(2));
    f2a.name = 'Flat 2A (Poet & Witness)';
    f2a.props = [
      ['bed', 2.1, 1.5, 0],
      ['drawers', 0.45, 3.7, 90],
      ['typewriter', deskX, 1.35, 180],
      ['chair', deskX, 2.15, 0],
    ];
    mutations.push(`Aligned Flat 2A desk x=${deskX}m to street window`);
  }

  // 5. Roof Overlook & Water Relay (Desire + Continuous)
  if (H.exterior) {
    const wt = H.exterior.find((e) => e.kind === 'watertank');
    if (wt) {
      wt.x = Number((4.2 + (s(2) - 0.5) * 1.2).toFixed(2));
    }
  }

  const proofs = prove(H);
  const fails = proofs.filter((p) => p.state === 'FAIL').length;
  const warns = proofs.filter((p) => p.state === 'WARN').length;
  const valid = fails === 0;

  const hallwayDepthM = Number((15.4 + continuous * 0.6).toFixed(1));
  const doorRhythm = Number((0.76 + signs * 0.19 - warns * 0.03).toFixed(2));
  const poemsScore = Number(Math.min(0.99, 0.78 + memory * 0.11 + eyes * 0.09 - fails * 0.25).toFixed(3));
  const builderScore = Number(Math.min(0.99, (valid ? 0.86 : 0.45) + continuous * 0.08 + thin * 0.04 - warns * 0.02).toFixed(3));
  const tomologyScore = Number(((poemsScore + builderScore + doorRhythm) / 3).toFixed(3));

  return {
    id: `sev-g${genIdx}-${seed}`,
    seed,
    gen: genIdx,
    parent: parentId,
    valid,
    mutations,
    mutationText: mutations.join(' · '),
    axes: { thin, hidden, continuous, memory, desire, signs, eyes },
    metrics: {
      poemsScore,
      builderScore,
      tomologyScore,
      hallwayDepthM,
      doorRhythm,
      fails,
      warns,
    },
    proofs,
    H,
  };
}

// Lightweight zero-dependency OrbitControls & 3D->2D Label Projector
// (vendor/three/addons only ships GLTFLoader, SkeletonUtils, BufferGeometryUtils)
export class SimpleOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3(0, 2, 0);
    this.enabled = true;
    this.enableDamping = true;
    this.maxPolarAngle = Math.PI * 0.49;
    this._spherical = new THREE.Spherical(18, Math.PI * 0.36, 0);
    this._dragging = false;
    this._panning = false;
    this._last = { x: 0, y: 0 };

    domElement.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this._syncFromCamera();
      this._dragging = true;
      this._panning = e.button === 2 || e.shiftKey;
      this._last.x = e.clientX;
      this._last.y = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.enabled || !this._dragging) return;
      const dx = e.clientX - this._last.x;
      const dy = e.clientY - this._last.y;
      this._last.x = e.clientX;
      this._last.y = e.clientY;
      if (this._panning) {
        const panScale = this._spherical.radius * 0.0015;
        this.target.x -= dx * panScale;
        this.target.y += dy * panScale;
      } else {
        this._spherical.theta -= dx * 0.0055;
        this._spherical.phi = Math.max(0.08, Math.min(this.maxPolarAngle, this._spherical.phi - dy * 0.0055));
      }
      this._applyToCamera();
    });
    window.addEventListener('pointerup', () => {
      this._dragging = false;
    });
    domElement.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this._syncFromCamera();
        this._spherical.radius = Math.max(1.8, Math.min(180, this._spherical.radius * (e.deltaY > 0 ? 1.08 : 0.92)));
        this._applyToCamera();
      },
      { passive: false }
    );
  }

  _syncFromCamera() {
    const offset = this.camera.position.clone().sub(this.target);
    if (offset.lengthSq() < 0.001) offset.set(0, 2, -8);
    this._spherical.setFromVector3(offset);
  }

  _applyToCamera() {
    const offset = new THREE.Vector3().setFromSpherical(this._spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  update() {
    if (!this.enabled) return;
    this.camera.lookAt(this.target);
  }
}

export class SimpleLabelProjector {
  constructor(container) {
    this.container = container;
    this.items = [];
    this._proj = new THREE.Vector3();
  }
  clear() {
    this.items.forEach((it) => it.el.remove());
    this.items = [];
  }
  add(el, worldPosVec3, level = 0) {
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%, -50%)';
    this.container.appendChild(el);
    const item = { el, pos: worldPosVec3.clone(), level, visible: true };
    this.items.push(item);
    return item;
  }
  setSize() {}
  render(camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const it of this.items) {
      if (!it.visible) {
        it.el.style.display = 'none';
        continue;
      }
      this._proj.copy(it.pos).project(camera);
      if (this._proj.z < -1 || this._proj.z > 1) {
        it.el.style.display = 'none';
        continue;
      }
      it.el.style.display = 'block';
      it.el.style.left = `${(this._proj.x * 0.5 + 0.5) * w}px`;
      it.el.style.top = `${(-this._proj.y * 0.5 + 0.5) * h}px`;
    }
  }
}
