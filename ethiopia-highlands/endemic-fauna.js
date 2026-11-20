/* Ethiopian Highlands Endemic Ecology, Organic Afromontane GPU Flora, Hand-Chiselled Rock-Hewn
   Monolithic Architecture & Donkey-Method Lofted `SILAS` Endemic Wildlife (`endemic-fauna.js`).
   Exposes `window.EthiopiaEndemicFauna` for `/ethiopia-highlands/` (`ethiopia-world.js`).
   - Donkey-Method Catmull-Rom `refineRings` + `loftSpine` continuous anatomical sculpting +
     512×512 procedural directional fur normal & mottled pelage maps (`roughness >= 0.86`, zero primitive spheres/sticks)
     across all 4 Endemic Ethiopian Highland Wildlife species:
     1. Gelada (`Theropithecus gelada`) — continuous lofted baboon body/head/prognathous ridged muzzle,
        draped shaggy golden-amber fur mantle, natural matte vascular hourglass chest patch, muscular lofted limbs
     2. Walia Ibex (`Capra walie`) — lofted deep-chested chestnut-sienna body, black/white banded lofted legs,
        sweeping transversely-ridged scimitar horns, perched on sculpted craggy basalt outcrops
     3. Ethiopian Wolf (`Canis simensis`) — lofted lean rufous-red body & fox-like mole-rat snout, crisp white throat/chest bib,
        plumed black-tipped tail, long lofted legs
     4. Mountain Nyala (`Tragelaphus buxtoni`) — lofted grey-chestnut striped/spotted body, white inter-orbital chevron,
        keeled spiral lyre horns
   - Organic Bark/Bract/Foliage GPU `InstancedMesh` Afromontane Flora:
     Giant Lobelia (diamond leaf-scar bark normal/albedo, shaggy marcescent dead-leaf skirt, 48-sword-leaf rosette &
     68-bract overlapping floral spike), Festuca tussocks, Helichrysum cushions, gnarled dappled Acacia abyssinica,
     Hagenia abyssinica (kosso), and ribbed Candelabra Euphorbia
   - Hand-Chiselled Lalibela Volcanic Scoria/Tuff Rock-Hewn Cruciform Church (sunken bedrock trench, recessed dark
     cedar plank doors, Aksumite monkey-head windows) + Dark Graphite Cast-Iron Standpipe (`#222428`, zero cyan bleed) */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const frac = x => x - Math.floor(x);
  const wrapAngle = a => {
    let r = (a + Math.PI) % TAU;
    if (r < 0) r += TAU;
    return r - Math.PI;
  };

  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || "simien");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const h2 = (x, y) => frac(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(h2(xi, yi), h2(xi + 1, yi), u), lerp(h2(xi, yi + 1), h2(xi + 1, yi + 1), u), v);
  }
  function fbm(x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) {
      s += a * vnoise(x * f, y * f);
      f *= 2.03;
      a *= 0.5;
    }
    return s;
  }

  /* ---------- Donkey-Method Catmull-Rom Ring Refinement & Anatomical Spine/Limb Loft ---------- */
  function cr(a, b, c, d, t) {
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  }

  function refineRings(R, sub) {
    if (R.length < 3 || sub <= 1) return R;
    const out = [];
    for (let i = 0; i < R.length - 1; i++) {
      const r0 = R[Math.max(0, i - 1)];
      const r1 = R[i];
      const r2 = R[i + 1];
      const r3 = R[Math.min(R.length - 1, i + 2)];
      for (let s = 0; s < sub; s++) {
        const t = s / sub;
        const o = {};
        for (const k in r1) {
          if (Array.isArray(r1[k])) o[k] = r1[k].map((_, q) => cr(r0[k][q], r1[k][q], r2[k][q], r3[k][q], t));
          else if (typeof r1[k] === "number") o[k] = cr(r0[k], r1[k], r2[k], r3[k], t);
          else o[k] = r1[k];
        }
        out.push(o);
      }
    }
    out.push(Object.assign({}, R[R.length - 1]));
    return out;
  }

  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm3 = a => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };

  /* Continuous anatomical tube loft (ported from `donkey/donkey.js`):
     Each ring: `{ p: [x, y, z], w, up, dn, e?, u? }`. Closed watertight ends by default.
     `opt.color(r, sa, ca, u)` -> `[R, G, B]`; `opt.disp(r, sa, ca, u)` -> radialfur/muscle sculpt multiplier. */
  function loftTube(T, rawRings, opt = {}) {
    let rings = opt.sub ? refineRings(rawRings, opt.sub) : rawRings.slice();
    if (!opt.open && rings.length >= 2) {
      const rFirst = rings[0];
      const rSecond = rings[1];
      const rLast = rings[rings.length - 1];
      const rPrev = rings[rings.length - 2];
      const tan0 = norm3([rSecond.p[0] - rFirst.p[0], rSecond.p[1] - rFirst.p[1], rSecond.p[2] - rFirst.p[2]]);
      const tanN = norm3([rLast.p[0] - rPrev.p[0], rLast.p[1] - rPrev.p[1], rLast.p[2] - rPrev.p[2]]);
      const avg0 = ((rFirst.w || 0.05) + (rFirst.up || rFirst.w || 0.05) + (rFirst.dn || rFirst.w || 0.05)) / 3;
      const avgN = ((rLast.w || 0.05) + (rLast.up || rLast.w || 0.05) + (rLast.dn || rLast.w || 0.05)) / 3;
      const makeDome = (base, dir, sgn, radScale, axPush) => Object.assign({}, base, {
        p: [base.p[0] + dir[0] * sgn * avg0 * 0 + dir[0] * sgn * axPush, base.p[1] + dir[1] * sgn * axPush, base.p[2] + dir[2] * sgn * axPush],
        w: Math.max(0.0012, base.w * radScale),
        up: Math.max(0.0012, (base.up !== undefined ? base.up : base.w) * radScale),
        dn: Math.max(0.0012, (base.dn !== undefined ? base.dn : base.w) * radScale)
      });
      rings = [
        makeDome(rFirst, tan0, -1, 0.02, avg0 * 0.46),
        makeDome(rFirst, tan0, -1, 0.46, avg0 * 0.34),
        makeDome(rFirst, tan0, -1, 0.78, avg0 * 0.16)
      ].concat(rings, [
        makeDome(rLast, tanN, 1, 0.78, avgN * 0.16),
        makeDome(rLast, tanN, 1, 0.46, avgN * 0.34),
        makeDome(rLast, tanN, 1, 0.02, avgN * 0.46)
      ]);
    }
    const seg = opt.seg || 20;
    const n = rings.length;
    const side = opt.side || [1, 0, 0];
    const pos = [], col = [], uv = [], idx = [];
    let arcLen = 0;

    for (let i = 0; i < n; i++) {
      const r = rings[i];
      const u = i / Math.max(1, n - 1);
      const prev = rings[Math.max(0, i - 1)].p;
      const next = rings[Math.min(n - 1, i + 1)].p;
      const tan = opt.tan || norm3([next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]]);
      const up = norm3(cross3(tan, side));
      if (i > 0) arcLen += Math.hypot(r.p[0] - prev[0], r.p[1] - prev[1], r.p[2] - prev[2]);
      const e = r.e || opt.e || 1.0;
      const w = Math.max(0.0012, r.w);
      const hu = Math.max(0.0012, r.up !== undefined ? r.up : r.w);
      const hd = Math.max(0.0012, r.dn !== undefined ? r.dn : r.w);

      for (let j = 0; j <= seg; j++) {
        const a = Math.PI + (j / seg) * TAU;
        const sa = Math.sin(a), ca = Math.cos(a);
        const dsp = opt.disp ? opt.disp(r, sa, ca, u, a) : 1.0;
        const cx = Math.sign(sa) * Math.pow(Math.abs(sa), e) * w * dsp;
        const cy = Math.sign(ca) * Math.pow(Math.abs(ca), e) * (ca > 0 ? hu : hd) * dsp;
        const px = r.p[0] + side[0] * cx + up[0] * cy;
        const py = r.p[1] + side[1] * cx + up[1] * cy;
        const pz = r.p[2] + side[2] * cx + up[2] * cy;
        pos.push(px, py, pz);
        const c = opt.color ? opt.color(r, sa, ca, u, px, py, pz) : [1, 1, 1];
        col.push(c[0], c[1], c[2]);
        uv.push((j / seg) * (opt.ur || 3), arcLen * (opt.vr || 5));
      }
    }

    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j;
        const b = a + 1;
        const c = a + seg + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // Weld seam normals cleanly around tube circumference
    const N = g.attributes.normal;
    for (let i = 0; i < n; i++) {
      const a = i * (seg + 1), b = a + seg;
      const nx = N.getX(a) + N.getX(b), ny = N.getY(a) + N.getY(b), nz = N.getZ(a) + N.getZ(b);
      const l = Math.hypot(nx, ny, nz) || 1;
      N.setXYZ(a, nx / l, ny / l, nz / l);
      N.setXYZ(b, nx / l, ny / l, nz / l);
    }
    return g;
  }

  /* ---------- Geometry Merge Helper ---------- */
  function mergeBufferGeometries(T, geos) {
    let totalVerts = 0, totalIdx = 0, hasColor = false;
    for (const g of geos) {
      if (!g || !g.attributes || !g.attributes.position) continue;
      totalVerts += g.attributes.position.count;
      if (g.attributes.color) hasColor = true;
      totalIdx += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(totalVerts * 3);
    const nrm = new Float32Array(totalVerts * 3);
    const uv = new Float32Array(totalVerts * 2);
    const col = hasColor ? new Float32Array(totalVerts * 3) : null;
    const idx = totalVerts > 65535 ? new Uint32Array(totalIdx) : new Uint16Array(totalIdx);

    let vOff = 0, iOff = 0;
    for (const g of geos) {
      if (!g || !g.attributes || !g.attributes.position) continue;
      if (!g.attributes.normal) g.computeVertexNormals();
      const pA = g.attributes.position, nA = g.attributes.normal, uA = g.attributes.uv, cA = g.attributes.color;
      const count = pA.count;
      for (let i = 0; i < count; i++) {
        const b3 = (vOff + i) * 3, b2 = (vOff + i) * 2;
        pos[b3] = pA.getX(i); pos[b3 + 1] = pA.getY(i); pos[b3 + 2] = pA.getZ(i);
        nrm[b3] = nA ? nA.getX(i) : 0; nrm[b3 + 1] = nA ? nA.getY(i) : 1; nrm[b3 + 2] = nA ? nA.getZ(i) : 0;
        uv[b2] = uA ? uA.getX(i) : 0; uv[b2 + 1] = uA ? uA.getY(i) : 0;
        if (col) {
          col[b3] = cA ? cA.getX(i) : 1;
          col[b3 + 1] = cA ? cA.getY(i) : 1;
          col[b3 + 2] = cA ? cA.getZ(i) : 1;
        }
      }
      if (g.index) {
        const gIdx = g.index;
        for (let i = 0; i < gIdx.count; i++) idx[iOff + i] = gIdx.getX(i) + vOff;
        iOff += gIdx.count;
      } else {
        for (let i = 0; i < count; i++) idx[iOff + i] = vOff + i;
        iOff += count;
      }
      vOff += count;
    }
    const out = new T.BufferGeometry();
    out.setAttribute("position", new T.BufferAttribute(pos, 3));
    out.setAttribute("normal", new T.BufferAttribute(nrm, 3));
    out.setAttribute("uv", new T.BufferAttribute(uv, 2));
    if (col) out.setAttribute("color", new T.BufferAttribute(col, 3));
    out.setIndex(new T.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
  }

  function tintGeometry(T, geo, r, g, b, gradTop = null, noiseAmt = 0.08) {
    const p = geo.attributes.position;
    const count = p.count;
    const arr = new Float32Array(count * 3);
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < count; i++) {
      const y = p.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const spanY = Math.max(0.001, maxY - minY);
    for (let i = 0; i < count; i++) {
      let cr0 = r, cg0 = g, cb0 = b;
      if (gradTop) {
        const t = clamp((p.getY(i) - minY) / spanY, 0, 1);
        cr0 = lerp(r, gradTop[0], t);
        cg0 = lerp(g, gradTop[1], t);
        cb0 = lerp(b, gradTop[2], t);
      }
      const n = 1.0 + (fbm(p.getX(i) * 4.5 + p.getY(i) * 2.3, p.getZ(i) * 4.5, 3) - 0.5) * noiseAmt * 2.0;
      arr[i * 3] = clamp(cr0 * n, 0, 1);
      arr[i * 3 + 1] = clamp(cg0 * n, 0, 1);
      arr[i * 3 + 2] = clamp(cb0 * n, 0, 1);
    }
    geo.setAttribute("color", new T.BufferAttribute(arr, 3));
    return geo;
  }

  /* ---------- Procedural Normal-Map & Albedo Generators (Fur, Bark, Foliage, Chiselled Volcanic Tuff) ---------- */
  function heightToNormalTexture(T, size, heightFn, strength = 2.6, repeatX = 1, repeatY = 1) {
    if (typeof document === "undefined") return null;
    const hGrid = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        hGrid[y * size + x] = heightFn(x / size, y / size);
      }
    }
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      const ym = ((y - 1 + size) % size) * size;
      const yp = ((y + 1) % size) * size;
      const y0 = y * size;
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size;
        const xp = (x + 1) % size;
        const dx = (hGrid[y0 + xp] - hGrid[y0 + xm]) * strength;
        const dy = (hGrid[yp + x] - hGrid[ym + x]) * strength;
        const nz = 1.0;
        const inv = 1.0 / Math.hypot(dx, dy, nz);
        const idx4 = (y0 + x) * 4;
        d[idx4] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
        d[idx4 + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
        d[idx4 + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
        d[idx4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    if (T.NoColorSpace) tex.colorSpace = T.NoColorSpace;
    return tex;
  }

  function makeCanvasAlbedo(T, size, drawFn, repeatX = 1, repeatY = 1) {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    drawFn(ctx, size);
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  // 1. Directional Mammalian Pelage / Fur Albedo + Normal Map (Mistletoe standard!)
  function createPelageTextures(T) {
    const furAlbedo = makeCanvasAlbedo(T, 256, (ctx, S) => {
      const img = ctx.createImageData(S, S);
      const d = img.data;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const u = x / S, v = y / S;
          // Anisotropic hair strands along V + guard-hair clumping
          const strand = vnoise(u * 96.0, v * 18.0);
          const clump = fbm(u * 24.0, v * 8.0, 3);
          const mottle = fbm(u * 5.0, v * 5.0, 3);
          const val = clamp(0.72 + (strand - 0.5) * 0.28 + (clump - 0.5) * 0.22 + (mottle - 0.5) * 0.16, 0.48, 1.0);
          const i4 = (y * S + x) * 4;
          d[i4] = Math.round(val * 255);
          d[i4 + 1] = Math.round(val * 250);
          d[i4 + 2] = Math.round(val * 242);
          d[i4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }, 1, 1);

    const furNormal = heightToNormalTexture(T, 256, (u, v) => {
      return vnoise(u * 110.0, v * 20.0) * 0.65 + fbm(u * 32.0, v * 10.0, 3) * 0.35;
    }, 3.2, 1, 1);

    return { furAlbedo, furNormal };
  }

  // 2. Diamond Leaf-Scar Lobelia Bark + Gnarled Acacia Bark + Dappled Foliage Cluster Textures
  function createBotanicalTextures(T) {
    // Diamond leaf-scar pattern characteristic of Giant Lobelia (`Lobelia rhynchopetalum`) woody stems!
    const lobeliaScarH = (u, v) => {
      const d1 = Math.abs(Math.sin((u * 9.0 + v * 18.0) * Math.PI));
      const d2 = Math.abs(Math.sin((u * 9.0 - v * 18.0) * Math.PI));
      const diamond = Math.pow(d1 * d2, 0.45);
      return diamond * 0.72 + fbm(u * 24, v * 48, 3) * 0.28;
    };
    const barkAlbedo = makeCanvasAlbedo(T, 256, (ctx, S) => {
      const img = ctx.createImageData(S, S);
      const d = img.data;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const h = lobeliaScarH(x / S, y / S);
          const lich = smooth(0.62, 0.85, fbm((x / S) * 10, (y / S) * 14, 3)) * 0.16;
          const vCol = clamp(0.54 + h * 0.42 + lich, 0.35, 1.0);
          const i4 = (y * S + x) * 4;
          d[i4] = Math.round(vCol * 248);
          d[i4 + 1] = Math.round((vCol * 0.94 + lich * 0.25) * 245);
          d[i4 + 2] = Math.round(vCol * 0.84 * 240);
          d[i4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }, 2, 3);
    const barkNormal = heightToNormalTexture(T, 256, lobeliaScarH, 3.6, 2, 3);

    // Dappled bipinnate leaf-cluster + bract texture so canopies & spikes have crisp organic micro-detail
    const foliageH = (u, v) => fbm(u * 38.0, v * 38.0, 4) * 0.7 + vnoise(u * 84.0, v * 84.0) * 0.3;
    const foliageAlbedo = makeCanvasAlbedo(T, 256, (ctx, S) => {
      const img = ctx.createImageData(S, S);
      const d = img.data;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const h = foliageH(x / S, y / S);
          // Deep inter-leaf shadow pockets + sunlit leaflet clusters
          const shade = clamp(0.52 + h * 0.56, 0.38, 1.0);
          const i4 = (y * S + x) * 4;
          d[i4] = Math.round(shade * 246);
          d[i4 + 1] = Math.round(shade * 255);
          d[i4 + 2] = Math.round(shade * 232);
          d[i4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }, 3, 3);
    const foliageNormal = heightToNormalTexture(T, 256, foliageH, 2.8, 3, 3);

    return { barkAlbedo, barkNormal, foliageAlbedo, foliageNormal };
  }

  // 3. Hand-Chiselled Lalibela Basaltic Scoria / Stratified Volcanic Red Tuff Texture + Normal Map (Zero Brick Grid & Zero Corduroy!)
  function createVolcanicTuffTextures(T, isGheralta) {
    const tuffHeight = (u, v) => {
      // Authentic horizontal sedimentary/volcanic tuff bedding strata + fine vesicular scoria pores + weathered block fractures!
      const warp = fbm(u * 3.2, v * 3.2, 3) * 0.08;
      const strataCoarse = fbm(u * 2.2, (v + warp) * 18.0, 4) * 0.46;
      const strataFine = Math.sin((v + warp * 0.7) * 14.0 * TAU) * 0.07;
      const scoriaPits = -Math.pow(Math.max(0, vnoise(u * 76.0, v * 76.0) - 0.62) * 2.4, 1.5) * 0.24;
      const crag = fbm(u * 12.0, v * 12.0, 4) * 0.30;
      return strataCoarse + strataFine + scoriaPits + crag;
    };

    const baseR = isGheralta ? [174, 98, 66] : [148, 82, 63];
    const darkR = isGheralta ? [88, 46, 31] : [68, 37, 31];
    const mossR = [68, 76, 50];

    const tuffAlbedo = makeCanvasAlbedo(T, 512, (ctx, S) => {
      const img = ctx.createImageData(S, S);
      const d = img.data;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const u = x / S, v = y / S;
          const h = clamp(0.5 + (tuffHeight(u, v) - 0.35) * 0.72, 0, 1);
          const lich = smooth(0.68, 0.88, fbm(u * 9.0 + 3.1, v * 9.0 + 7.4, 4)) * 0.34;
          const streak = smooth(0.56, 0.86, fbm(u * 14.0, v * 2.8, 3)) * 0.24;
          let r = lerp(darkR[0], baseR[0] * 1.15, h) * (1 - streak);
          let g = lerp(darkR[1], baseR[1] * 1.13, h) * (1 - streak);
          let b = lerp(darkR[2], baseR[2] * 1.11, h) * (1 - streak);
          r = lerp(r, mossR[0], lich);
          g = lerp(g, mossR[1], lich);
          b = lerp(b, mossR[2], lich);
          const i4 = (y * S + x) * 4;
          d[i4] = clamp(Math.round(r), 0, 255);
          d[i4 + 1] = clamp(Math.round(g), 0, 255);
          d[i4 + 2] = clamp(Math.round(b), 0, 255);
          d[i4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }, 2, 2);

    const tuffNormal = heightToNormalTexture(T, 256, tuffHeight, 2.3, 2, 2);

    // Adzed aged-cedar plank door texture
    const doorAlbedo = makeCanvasAlbedo(T, 256, (ctx, S) => {
      ctx.fillStyle = "#2b1c13";
      ctx.fillRect(0, 0, S, S);
      for (let p = 0; p < 6; p++) {
        const x0 = Math.round((p / 6) * S);
        const w = Math.round(S / 6);
        ctx.fillStyle = p % 2 === 0 ? "#332116" : "#261810";
        ctx.fillRect(x0 + 2, 0, w - 4, S);
        ctx.fillStyle = "#120b07";
        ctx.fillRect(x0, 0, 3, S);
      }
      // Horizontal iron/timber battens & iron studs
      for (const by of [44, 128, 212]) {
        ctx.fillStyle = "#1e1612";
        ctx.fillRect(0, by, S, 16);
        ctx.fillStyle = "#484440";
        for (let s = 18; s < S; s += 42) {
          ctx.beginPath();
          ctx.arc(s, by + 8, 4, 0, TAU);
          ctx.fill();
        }
      }
    }, 1, 1);

    return { tuffAlbedo, tuffNormal, doorAlbedo };
  }

  /* ---------- 1. Procedural Afromontane Flora Prototype Geometries (Bracts, Marcescent Skirts & Dappled Canopies) ---------- */
  function createFloraPrototypes(T) {
    const disposable = [];

    // 1A. Giant Lobelia (`Lobelia rhynchopetalum`) Scarred Trunk + Hanging Marcescent Leaf Skirt + Rosette + 68-Bract Spike!
    const lobTrunkParts = [];
    const lobStem = new T.CylinderGeometry(0.11, 0.20, 2.05, 11, 8);
    lobStem.translate(0, 1.0, 0);
    {
      const p = lobStem.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const ang = Math.atan2(p.getZ(i), p.getX(i));
        const scar = 1.0 + 0.085 * Math.sin(y * 28.0 + ang * 5.0) * Math.cos(y * 28.0 - ang * 5.0);
        p.setX(i, p.getX(i) * scar + 0.045 * Math.sin(y * 1.5));
        p.setZ(i, p.getZ(i) * scar);
      }
      lobStem.computeVertexNormals();
    }
    tintGeometry(T, lobStem, 0.42, 0.34, 0.25, [0.64, 0.54, 0.40], 0.12);
    lobTrunkParts.push(lobStem);

    // Dense hanging shaggy skirt of 28 dead marcescent brown/russet leaves under the green rosette!
    const goldenAngle = 2.39996323;
    for (let m = 0; m < 28; m++) {
      const u = m / 27;
      const az = m * goldenAngle + 0.4;
      const dLeaf = new T.ConeGeometry(0.085, 0.78 + (m % 3) * 0.12, 4, 2);
      dLeaf.scale(1.0, 1.0, 0.28);
      dLeaf.rotateX(Math.PI - (0.18 + u * 0.26)); // hang straight down hugging the trunk!
      dLeaf.rotateY(az);
      dLeaf.translate(Math.sin(az) * 0.15, 1.52 + u * 0.36, Math.cos(az) * 0.15);
      tintGeometry(T, dLeaf, 0.34, 0.25, 0.16, [0.56, 0.44, 0.28], 0.10);
      lobTrunkParts.push(dLeaf);
    }
    const lobTrunk = mergeBufferGeometries(T, lobTrunkParts);
    lobTrunkParts.forEach(g => g.dispose());
    disposable.push(lobTrunk);

    // 46 Live Arching Sword Leaves in 4 Phyllotactic Tiers
    const leafParts = [];
    for (let i = 0; i < 46; i++) {
      const u = i / 45;
      const az = i * goldenAngle;
      const len = lerp(0.96, 1.50, Math.sin(u * Math.PI * 0.85));
      const wid = lerp(0.11, 0.165, 1 - Math.abs(u - 0.45));
      const pitch = lerp(1.88, 0.28, Math.pow(u, 0.86));
      const arch = lerp(0.30, -0.14, u);

      const blade = new T.BufferGeometry();
      const segs = 5;
      const bPos = [], bCol = [], bUv = [], bIdx = [];
      for (let s = 0; s <= segs; s++) {
        const f = s / segs;
        const w = wid * Math.sin(Math.pow(f, 0.65) * Math.PI) * (1 - 0.18 * f);
        const rDist = f * len * Math.sin(pitch + arch * f * f);
        const yOff = 1.94 + u * 0.28 + f * len * Math.cos(pitch + arch * f * f);
        const keel = -0.026 * Math.sin(f * Math.PI);
        const cx = Math.cos(az), sz = Math.sin(az);
        const px = -sz, pz = cx;

        bPos.push(cx * rDist - px * w, yOff, sz * rDist - pz * w);
        bPos.push(cx * rDist, yOff + keel, sz * rDist);
        bPos.push(cx * rDist + px * w, yOff, sz * rDist + pz * w);
        bUv.push(0, f, 0.5, f, 1, f);

        const baseR = lerp(0.19, 0.34, u);
        const baseG = lerp(0.38, 0.56, u);
        const baseB = lerp(0.18, 0.32, u);
        const tipBoost = 0.82 + 0.34 * f;
        bCol.push(baseR * tipBoost, baseG * tipBoost, baseB * tipBoost);
        bCol.push(Math.min(1, baseR * tipBoost + 0.12), Math.min(1, baseG * tipBoost + 0.14), Math.min(1, baseB * tipBoost + 0.07));
        bCol.push(baseR * tipBoost, baseG * tipBoost, baseB * tipBoost);

        if (s < segs) {
          const r0 = s * 3, r1 = (s + 1) * 3;
          bIdx.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1);
          bIdx.push(r0 + 1, r1 + 1, r0 + 2, r0 + 2, r1 + 1, r1 + 2);
        }
      }
      blade.setAttribute("position", new T.Float32BufferAttribute(bPos, 3));
      blade.setAttribute("color", new T.Float32BufferAttribute(bCol, 3));
      blade.setAttribute("uv", new T.Float32BufferAttribute(bUv, 2));
      blade.setIndex(bIdx);
      blade.computeVertexNormals();
      leafParts.push(blade);
    }
    const lobRosette = mergeBufferGeometries(T, leafParts);
    leafParts.forEach(g => g.dispose());
    disposable.push(lobRosette);

    // Towering 3.5m Floral Spike (`obus`) with 68 Overlapping Drooping Shaggy Floral Bracts!
    const spikeParts = [];
    const spikeAxis = new T.CylinderGeometry(0.032, 0.15, 3.48, 9, 10);
    spikeAxis.translate(0, 3.82, 0);
    tintGeometry(T, spikeAxis, 0.28, 0.22, 0.26, [0.36, 0.44, 0.38], 0.12);
    spikeParts.push(spikeAxis);

    for (let b = 0; b < 68; b++) {
      const f = b / 67;
      const az = b * goldenAngle;
      const yB = lerp(2.18, 5.42, f);
      const env = Math.sin(Math.pow(f, 0.68) * Math.PI) * 1.15 + 0.22 * (1 - f);
      const rCore = lerp(0.14, 0.03, f) * env;
      const bractLen = lerp(0.42, 0.16, f) * (0.75 + 0.35 * env);
      const bract = new T.ConeGeometry(0.052 * env + 0.018, bractLen, 4);
      bract.scale(1.0, 1.0, 0.32);
      bract.rotateX(Math.PI - 0.58); // droop outward & downward like real woolly Lobelia bracts!
      bract.rotateY(az);
      bract.translate(Math.sin(az) * rCore, yB, Math.cos(az) * rCore);
      // Dusty sage-celadon woolly bract tips over deep plum-burgundy flower axils
      tintGeometry(T, bract, 0.35, 0.24, 0.29, [0.54, 0.62, 0.53], 0.10);
      spikeParts.push(bract);
    }
    const spikeCore = mergeBufferGeometries(T, spikeParts);
    spikeParts.forEach(g => g.dispose());
    disposable.push(spikeCore);

    // 1B. Afro-Alpine `Festuca` (`Guassa`) Tussock Clump & `Helichrysum` Cushion
    const tussockBlades = [];
    for (let b = 0; b < 16; b++) {
      const az = (b / 16) * TAU + (b % 3) * 0.19;
      const tilt = 0.35 + (b % 4) * 0.16;
      const h = 0.46 + (b % 5) * 0.08;
      const cone = new T.ConeGeometry(0.036, h, 3, 2);
      cone.translate(0, h * 0.5, 0);
      cone.rotateZ(tilt);
      cone.rotateY(az);
      tintGeometry(T, cone, 0.36, 0.38, 0.20, [0.74, 0.66, 0.38], 0.10);
      tussockBlades.push(cone);
    }
    const tussockGeo = mergeBufferGeometries(T, tussockBlades);
    tussockBlades.forEach(g => g.dispose());
    disposable.push(tussockGeo);

    const heliMound = new T.IcosahedronGeometry(0.46, 2);
    {
      const p = heliMound.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (y < 0) y *= 0.15;
        const bump = 1.0 + 0.14 * fbm(x * 8.0, z * 8.0, 3);
        p.setXYZ(i, x * 1.18 * bump, y * 0.58 * bump, z * 1.08 * bump);
      }
      heliMound.computeVertexNormals();
    }
    tintGeometry(T, heliMound, 0.52, 0.56, 0.48, [0.88, 0.84, 0.64], 0.12);
    disposable.push(heliMound);

    // 1C. Gnarled Flat-Topped `Acacia abyssinica` (Sculpted Forked Trunk + Multi-Cluster Dappled Foliage Pads)
    const acaciaWoodParts = [];
    const acBase = new T.CylinderGeometry(0.18, 0.32, 2.6, 8, 5);
    acBase.translate(0, 1.25, 0);
    {
      const p = acBase.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        p.setX(i, p.getX(i) + 0.12 * Math.sin(y * 1.3));
        p.setZ(i, p.getZ(i) + 0.08 * Math.cos(y * 1.7));
      }
      acBase.computeVertexNormals();
    }
    tintGeometry(T, acBase, 0.24, 0.19, 0.15, [0.35, 0.28, 0.21], 0.14);
    acaciaWoodParts.push(acBase);
    for (let b = 0; b < 6; b++) {
      const az = (b / 6) * TAU + 0.25;
      const limb = new T.CylinderGeometry(0.05, 0.13, 3.35, 7, 4);
      {
        const p = limb.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i);
          p.setX(i, p.getX(i) + 0.11 * Math.sin(y * 1.8 + b));
        }
        limb.computeVertexNormals();
      }
      limb.translate(0, 1.65, 0);
      limb.rotateZ(0.76 + (b % 2) * 0.11);
      limb.rotateY(az);
      limb.translate(0, 2.30, 0);
      tintGeometry(T, limb, 0.28, 0.22, 0.17, [0.38, 0.31, 0.23], 0.12);
      acaciaWoodParts.push(limb);
    }
    const acaciaWoodGeo = mergeBufferGeometries(T, acaciaWoodParts);
    acaciaWoodParts.forEach(g => g.dispose());
    disposable.push(acaciaWoodGeo);

    // Airy Dappled Bipinnate Foliage Cloudlets (22 overlapping ruffled leaf clusters — zero flat green plates!)
    const acaciaCanopyParts = [];
    const boughCenters = [
      [0, 4.68, 0, 1.55],
      [-1.95, 4.44, 0.98, 1.25],
      [2.00, 4.50, -0.88, 1.28],
      [-0.90, 4.56, -1.72, 1.20],
      [1.00, 4.48, 1.68, 1.22],
      [0.35, 5.04, 0.28, 1.38],
      [-1.18, 4.92, -0.40, 1.12]
    ];
    for (let bIdx = 0; bIdx < boughCenters.length; bIdx++) {
      const [bx, by, bz, bRad] = boughCenters[bIdx];
      for (let c = 0; c < 3; c++) {
        const ang = (c / 3) * TAU + bIdx * 1.1;
        const offR = c === 0 ? 0.0 : bRad * 0.52;
        const px = bx + Math.cos(ang) * offR;
        const py = by + (c === 0 ? 0.10 : -0.06 + (c % 2) * 0.08);
        const pz = bz + Math.sin(ang) * offR;
        const sx = bRad * (c === 0 ? 0.92 : 0.74);
        const sy = 0.26 + (c === 0 ? 0.07 : 0.0);
        const sz = bRad * (c === 0 ? 0.88 : 0.72);
        const pad = new T.IcosahedronGeometry(1.0, 1);
        const p = pad.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const ruffle = 0.78 + 0.36 * fbm(x * 4.2 + bIdx * 1.9 + c, z * 4.2 - c * 1.7, 3);
          p.setXYZ(i, x * sx * ruffle + px, y * sy * ruffle + py, z * sz * ruffle + pz);
        }
        pad.computeVertexNormals();
        tintGeometry(T, pad, 0.16, 0.25, 0.11, [0.46, 0.58, 0.25], 0.20);
        acaciaCanopyParts.push(pad);
      }
    }
    const acaciaCanopyGeo = mergeBufferGeometries(T, acaciaCanopyParts);
    acaciaCanopyParts.forEach(g => g.dispose());
    disposable.push(acaciaCanopyGeo);

    // 1D. `Hagenia abyssinica` (Kosso)
    const hagWoodParts = [];
    const hagTrunk = new T.CylinderGeometry(0.24, 0.38, 2.5, 8, 4);
    hagTrunk.translate(0, 1.2, 0);
    hagTrunk.rotateZ(-0.08);
    tintGeometry(T, hagTrunk, 0.40, 0.21, 0.14, [0.52, 0.28, 0.19], 0.12);
    hagWoodParts.push(hagTrunk);
    for (let b = 0; b < 4; b++) {
      const az = (b / 4) * TAU + 0.6;
      const limb = new T.CylinderGeometry(0.08, 0.18, 2.5, 6);
      limb.translate(0, 1.25, 0);
      limb.rotateZ(0.62);
      limb.rotateY(az);
      limb.translate(0, 2.2, 0);
      tintGeometry(T, limb, 0.46, 0.24, 0.16, null, 0.10);
      hagWoodParts.push(limb);
    }
    const hageniaWoodGeo = mergeBufferGeometries(T, hagWoodParts);
    hagWoodParts.forEach(g => g.dispose());
    disposable.push(hageniaWoodGeo);

    const hagCanopyParts = [];
    for (const [cx, cy, cz, rx, ry, rz] of [
      [0, 4.3, 0, 2.4, 1.5, 2.3],
      [-1.35, 3.85, 0.7, 1.65, 1.25, 1.55],
      [1.30, 3.95, -0.65, 1.7, 1.25, 1.6],
      [0.2, 3.9, -1.25, 1.55, 1.15, 1.5]
    ]) {
      const puff = new T.IcosahedronGeometry(1.0, 2);
      const p = puff.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const b = 0.88 + 0.24 * fbm(p.getX(i) * 3, p.getZ(i) * 3, 3);
        p.setXYZ(i, p.getX(i) * rx * b + cx, p.getY(i) * ry * b + cy, p.getZ(i) * rz * b + cz);
      }
      puff.computeVertexNormals();
      tintGeometry(T, puff, 0.18, 0.31, 0.15, [0.34, 0.50, 0.23], 0.14);
      hagCanopyParts.push(puff);
    }
    for (let pIdx = 0; pIdx < 9; pIdx++) {
      const az = (pIdx / 9) * TAU;
      const rad = 1.45 + (pIdx % 3) * 0.45;
      const panicle = new T.ConeGeometry(0.16, 0.72, 6);
      panicle.rotateX(Math.PI);
      panicle.translate(Math.cos(az) * rad, 2.85 + (pIdx % 2) * 0.35, Math.sin(az) * rad);
      tintGeometry(T, panicle, 0.64, 0.22, 0.25, [0.45, 0.15, 0.18], 0.10);
      hagCanopyParts.push(panicle);
    }
    const hageniaCanopyGeo = mergeBufferGeometries(T, hagCanopyParts);
    hagCanopyParts.forEach(g => g.dispose());
    disposable.push(hageniaCanopyGeo);

    // 1E. Ribbed Candelabra `Euphorbia abyssinica` (`Qulqual`)
    const euphParts = [];
    const euphStem = new T.CylinderGeometry(0.18, 0.25, 1.75, 8, 4);
    euphStem.translate(0, 0.82, 0);
    tintGeometry(T, euphStem, 0.27, 0.25, 0.19, [0.22, 0.34, 0.20], 0.14);
    euphParts.push(euphStem);

    for (let a = 0; a < 11; a++) {
      const ring = a < 4 ? 0 : 1;
      const az = (a / (ring === 0 ? 4 : 7)) * TAU + ring * 0.42;
      const outR = ring === 0 ? 0.38 : 0.76;
      const armH = ring === 0 ? 2.60 : 2.15 + (a % 3) * 0.24;
      const elbow = new T.CylinderGeometry(0.09, 0.11, outR * 1.25, 6);
      elbow.translate(0, outR * 0.6, 0);
      elbow.rotateZ(1.08);
      elbow.rotateY(az);
      elbow.translate(0, 1.48 + ring * 0.15, 0);
      tintGeometry(T, elbow, 0.18, 0.32, 0.18, null, 0.10);
      euphParts.push(elbow);

      // Star-ribbed 8-vertex fluted succulent column!
      const colArm = new T.CylinderGeometry(0.095, 0.112, armH, 8, 6);
      {
        const p = colArm.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const ang = Math.atan2(p.getZ(i), p.getX(i));
          const rib = 0.82 + 0.26 * Math.abs(Math.cos(ang * 2.0));
          const segPinch = 1.0 - 0.08 * Math.abs(Math.sin(p.getY(i) * 5.5));
          p.setX(i, p.getX(i) * rib * segPinch);
          p.setZ(i, p.getZ(i) * rib * segPinch);
        }
        colArm.computeVertexNormals();
      }
      colArm.rotateY(az);
      colArm.translate(Math.cos(az) * outR, 1.65 + ring * 0.18 + armH * 0.5, -Math.sin(az) * outR);
      tintGeometry(T, colArm, 0.16, 0.31, 0.16, [0.30, 0.48, 0.22], 0.12);
      euphParts.push(colArm);
    }
    const euphorbiaGeo = mergeBufferGeometries(T, euphParts);
    euphParts.forEach(g => g.dispose());
    disposable.push(euphorbiaGeo);

    return {
      lobTrunk, lobRosette, spikeCore, tussockGeo, heliMound,
      acaciaWoodGeo, acaciaCanopyGeo, hageniaWoodGeo, hageniaCanopyGeo, euphorbiaGeo,
      dispose() { for (const g of disposable) g.dispose(); }
    };
  }

  /* ---------- 2. Biome-Driven GPU InstancedMesh Flora Populator ---------- */
  function buildFloraGuilds(T, terrain, rng, landmarks) {
    const group = new T.Group();
    group.name = "EthiopiaAfromontaneFlora";
    const protos = createFloraPrototypes(T);
    const botTex = createBotanicalTextures(T);

    const windUniform = { value: 0 };
    const makeFloraMat = (mapTex, nrmTex, roughness, swayAmp) => {
      const mat = new T.MeshStandardMaterial({
        vertexColors: true,
        map: mapTex || null,
        normalMap: nrmTex || null,
        normalScale: new T.Vector2(0.85, 0.85),
        roughness,
        metalness: 0.01,
        side: T.DoubleSide
      });
      mat.onBeforeCompile = shader => {
        shader.uniforms.uWindTime = windUniform;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uWindTime;")
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             #ifdef USE_INSTANCING
               float instPhase = instanceMatrix[3][0] * 0.13 + instanceMatrix[3][2] * 0.17;
             #else
               float instPhase = 0.0;
             #endif
             float hFactor = max(0.0, transformed.y - 0.25);
             transformed.x += sin(uWindTime * 1.65 + instPhase) * ${swayAmp.toFixed(4)} * hFactor;`
          );
      };
      return mat;
    };

    const barkMat = makeFloraMat(botTex.barkAlbedo, botTex.barkNormal, 0.90, 0.012);
    const rosetteMat = makeFloraMat(botTex.foliageAlbedo, botTex.foliageNormal, 0.78, 0.026);
    const canopyMat = makeFloraMat(botTex.foliageAlbedo, botTex.foliageNormal, 0.88, 0.040);
    const spikeMat = makeFloraMat(botTex.foliageAlbedo, botTex.foliageNormal, 0.86, 0.018);

    const regId = String(terrain.regionId || "simien_imet_gogo").toLowerCase();
    const isSimien = regId.indexOf("simien") >= 0;
    const isGheralta = regId.indexOf("gheralta") >= 0;
    const isAbay = regId.indexOf("blue_nile") >= 0 || regId.indexOf("abay") >= 0;
    const isGerd = regId.indexOf("gerd") >= 0 || regId.indexOf("belaya") >= 0;

    const minX = terrain.minX + 12, maxX = terrain.maxX - 12;
    const minZ = terrain.minZ + 12, maxZ = terrain.maxZ - 12;
    const waterY = terrain.waterY !== undefined ? terrain.waterY : -9999;

    const simienRimSpawn = { x: 6.0, z: -434.0 };
    const keepOut = [];
    if (landmarks.churchPos) keepOut.push({ x: landmarks.churchPos.x, z: landmarks.churchPos.z, r: 12.5 });
    if (landmarks.relayPos) keepOut.push({ x: landmarks.relayPos.x, z: landmarks.relayPos.z, r: 5.5 });
    if (landmarks.hamletPos) keepOut.push({ x: landmarks.hamletPos.x, z: landmarks.hamletPos.z, r: 9.5 });
    if (landmarks.primaryLookout) keepOut.push({ x: landmarks.primaryLookout.x, z: landmarks.primaryLookout.z, r: 7.5 });
    if (isSimien) keepOut.push({ x: simienRimSpawn.x, z: simienRimSpawn.z, r: 8.5 });
    if (isGheralta && landmarks.relayPos && landmarks.churchPos) {
      keepOut.push({
        x: lerp(landmarks.relayPos.x, landmarks.churchPos.x, 0.35),
        z: lerp(landmarks.relayPos.z, landmarks.churchPos.z, 0.25),
        r: 9.5
      });
    }

    const isClear = (x, z) => {
      for (const k of keepOut) if (Math.hypot(x - k.x, z - k.z) < k.r) return false;
      return true;
    };

    const lobelias = [], lobeliaSpikes = [], tussocks = [], cushions = [], acacias = [], hagenias = [], euphorbias = [];

    if (isSimien) {
      for (const [px, pz, sc] of [[-3.5, -445.5, 1.24], [8.5, -447.0, 1.20], [-4.5, -439.5, 1.08], [11.5, -441.5, 1.12], [-1.5, -449.5, 1.16], [6.0, -450.0, 1.02]]) {
        const py = terrain.sampleHeight(px, pz);
        lobelias.push({ x: px, y: py, z: pz, sc, rot: rng() * TAU });
        lobeliaSpikes.push({ x: px, y: py, z: pz, sc: sc * 1.08, rot: rng() * TAU });
      }
      const heroCenters = [simienRimSpawn, landmarks.primaryLookout, landmarks.geladaMeadow, landmarks.relayPos, landmarks.wolfMoorland].filter(Boolean);
      for (const hc of heroCenters) {
        for (let i = 0; i < 38; i++) {
          const ang = rng() * TAU;
          const rad = 6.5 + Math.pow(rng(), 0.75) * 95.0;
          const x = clamp(hc.x + Math.cos(ang) * rad, minX, maxX);
          const z = clamp(hc.z + Math.sin(ang) * rad, minZ, maxZ);
          const slope = terrain.sampleSlope(x, z);
          const y = terrain.sampleHeight(x, z);
          if (slope < 0.56 && y > waterY + 3.0 && isClear(x, z)) {
            const sc = 0.88 + rng() * 0.62;
            const rot = rng() * TAU;
            lobelias.push({ x, y, z, sc, rot });
            if (i % 4 !== 3) lobeliaSpikes.push({ x, y, z, sc: sc * (0.95 + rng() * 0.36), rot });
            for (let t = 0; t < 3; t++) {
              const tx = clamp(x + (rng() - 0.5) * 6.5, minX, maxX);
              const tz = clamp(z + (rng() - 0.5) * 6.5, minZ, maxZ);
              if (terrain.sampleSlope(tx, tz) < 0.58) {
                tussocks.push({ x: tx, y: terrain.sampleHeight(tx, tz), z: tz, sc: 0.85 + rng() * 0.7, rot: rng() * TAU });
              }
            }
          }
        }
      }
    }

    if (isGheralta) {
      const gCenters = [landmarks.churchPos, landmarks.relayPos, landmarks.cliffSanctuaryPos].filter(Boolean);
      for (const gc of gCenters) {
        for (let i = 0; i < 42; i++) {
          const ang = rng() * TAU;
          const rad = 14.0 + rng() * 145.0;
          const x = clamp(gc.x + Math.cos(ang) * rad, minX, maxX);
          const z = clamp(gc.z + Math.sin(ang) * rad, minZ, maxZ);
          const slope = terrain.sampleSlope(x, z);
          const y = terrain.sampleHeight(x, z);
          if (y > waterY + 2.0 && isClear(x, z)) {
            if (slope < 0.34 && i % 2 === 0) {
              acacias.push({ x, y, z, sc: 0.92 + rng() * 0.68, rot: rng() * TAU });
            } else if (slope < 0.62) {
              euphorbias.push({ x, y, z, sc: 0.86 + rng() * 0.66, rot: rng() * TAU });
            }
          }
        }
      }
    }

    const trailPts = Array.isArray(landmarks.trailWaypoints) && landmarks.trailWaypoints.length
      ? landmarks.trailWaypoints
      : [landmarks.primaryLookout, landmarks.relayPos, landmarks.churchPos].filter(Boolean);

    for (let i = 0; i < 6400; i++) {
      let x, z;
      if (i < 2600 && trailPts.length > 0) {
        const anchor = trailPts[i % trailPts.length];
        const ang = rng() * TAU;
        const rad = 12.0 + Math.pow(rng(), 0.85) * 310.0;
        x = clamp(anchor.x + Math.cos(ang) * rad, minX, maxX);
        z = clamp(anchor.z + Math.sin(ang) * rad, minZ, maxZ);
      } else {
        x = lerp(minX, maxX, rng());
        z = lerp(minZ, maxZ, rng());
      }
      if (!isClear(x, z)) continue;
      const y = terrain.sampleHeight(x, z);
      if (y <= waterY + 1.8) continue;
      const slope = terrain.sampleSlope(x, z);
      if (slope > 0.64) continue;

      const elevM = terrain.sampleRealElevM(x, z);
      const biome = terrain.sampleBiome(x, z);
      const rot = rng() * TAU;
      const rPick = rng();

      if (biome === "wurch" || (isSimien && elevM > 3050)) {
        if (slope < 0.48 && rPick < 0.16 && lobelias.length < 560) {
          const sc = 0.78 + rng() * 0.68;
          lobelias.push({ x, y, z, sc, rot });
          if (rng() < 0.68) lobeliaSpikes.push({ x, y, z, sc: sc * (0.90 + rng() * 0.40), rot });
        } else if (slope < 0.56 && rPick < 0.38 && cushions.length < 750) {
          cushions.push({ x, y, z, sc: 0.72 + rng() * 0.75, rot });
        } else if (tussocks.length < 2800) {
          tussocks.push({ x, y, z, sc: 0.80 + rng() * 0.78, rot });
        }
      } else if (biome === "dega") {
        if (slope < 0.42 && rPick < 0.16 && hagenias.length < 360) {
          hagenias.push({ x, y, z, sc: 0.84 + rng() * 0.58, rot });
        } else if (slope < 0.36 && rPick < 0.25 && acacias.length < 480) {
          acacias.push({ x, y, z, sc: 0.82 + rng() * 0.55, rot });
        } else if (slope < 0.58 && rPick < 0.34 && euphorbias.length < 440) {
          euphorbias.push({ x, y, z, sc: 0.80 + rng() * 0.58, rot });
        } else if (rPick < 0.52 && cushions.length < 750) {
          cushions.push({ x, y, z, sc: 0.64 + rng() * 0.60, rot });
        } else if (tussocks.length < 2800) {
          tussocks.push({ x, y, z, sc: 0.74 + rng() * 0.70, rot });
        }
      } else {
        if (slope < 0.36 && rPick < (isGheralta || isGerd ? 0.30 : 0.24) && acacias.length < 520) {
          acacias.push({ x, y, z, sc: 0.86 + rng() * 0.70, rot });
        } else if (slope < 0.60 && rPick < 0.50 && euphorbias.length < 480) {
          euphorbias.push({ x, y, z, sc: 0.80 + rng() * 0.70, rot });
        } else if (slope < 0.40 && !isGheralta && rPick < 0.58 && hagenias.length < 340) {
          hagenias.push({ x, y, z, sc: 0.78 + rng() * 0.50, rot });
        } else if (tussocks.length < 2800 && (isAbay || rng() < 0.68)) {
          tussocks.push({ x, y, z, sc: 0.70 + rng() * 0.65, rot });
        }
      }
    }

    const dummy = new T.Object3D();
    const upVec = new T.Vector3(0, 1, 0);
    const nrmVec = new T.Vector3(0, 1, 0);
    const tiltQuat = new T.Quaternion();
    const yawQuat = new T.Quaternion();

    const makeInstanced = (geo, mat, items, sinkY = 0.10, normalAlign = 0.22, castShadow = false) => {
      if (!items.length) return null;
      const mesh = new T.InstancedMesh(geo, mat, items.length);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        terrain.sampleNormal(it.x, it.z, nrmVec);
        nrmVec.lerp(upVec, 1 - normalAlign).normalize();
        tiltQuat.setFromUnitVectors(upVec, nrmVec);
        yawQuat.setFromAxisAngle(upVec, it.rot);
        dummy.position.set(it.x, it.y - sinkY, it.z);
        dummy.quaternion.copy(tiltQuat).multiply(yawQuat);
        dummy.scale.setScalar(it.sc);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
      return mesh;
    };

    makeInstanced(protos.lobTrunk, barkMat, lobelias, 0.14, 0.16, true);
    makeInstanced(protos.lobRosette, rosetteMat, lobelias, 0.14, 0.16, true);
    makeInstanced(protos.spikeCore, spikeMat, lobeliaSpikes, 0.14, 0.16, true);
    makeInstanced(protos.tussockGeo, canopyMat, tussocks, 0.06, 0.55, false);
    makeInstanced(protos.heliMound, spikeMat, cushions, 0.08, 0.60, false);
    makeInstanced(protos.acaciaWoodGeo, barkMat, acacias, 0.18, 0.12, true);
    makeInstanced(protos.acaciaCanopyGeo, canopyMat, acacias, 0.18, 0.12, true);
    makeInstanced(protos.hageniaWoodGeo, barkMat, hagenias, 0.18, 0.15, true);
    makeInstanced(protos.hageniaCanopyGeo, canopyMat, hagenias, 0.18, 0.15, true);
    makeInstanced(protos.euphorbiaGeo, rosetteMat, euphorbias, 0.16, 0.18, true);

    return {
      group,
      counts: {
        giantLobelia: lobelias.length,
        lobeliaSpikes: lobeliaSpikes.length,
        tussockGrass: tussocks.length,
        helichrysum: cushions.length,
        acaciaAbyssinica: acacias.length,
        hageniaKosso: hagenias.length,
        euphorbiaCandelabra: euphorbias.length
      },
      update(nowSec) { windUniform.value = nowSec; },
      dispose() {
        protos.dispose();
        for (const t of Object.values(botTex)) if (t && t.dispose) t.dispose();
        for (const m of [barkMat, rosetteMat, canopyMat, spikeMat]) m.dispose();
      }
    };
  }

  /* ---------- 3. Hand-Chiselled Lalibela Rock-Hewn Church, Tukul/Hidmo & Dark Cast-Iron Standpipe ---------- */
  function makeRockHewnBox(T, w, h, d, segX = 8, segY = 10, segZ = 8, cragAmt = 0.055, baseAoDark = 0.26) {
    const geo = new T.BoxGeometry(w, h, d, segX, segY, segZ);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const halfH = h * 0.5;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = (fbm(x * 0.85 + y * 0.65, z * 0.85 - y * 0.45, 3) - 0.5) * 2.0 * cragAmt;
      // Bevel sharp mathematical edges & add subtle hand-hewn rock undulations
      const edgeX = Math.abs(x) / Math.max(0.01, w * 0.5);
      const edgeZ = Math.abs(z) / Math.max(0.01, d * 0.5);
      const cornerBevel = edgeX > 0.92 && edgeZ > 0.92 ? -0.045 : 0;
      x += Math.sign(x) * (n + cornerBevel);
      z += Math.sign(z) * (n + cornerBevel);
      y += n * 0.35;
      p.setXYZ(i, x, y, z);

      // Bake weathered moss/soot base darkening & corner AO
      const vFrac = clamp((y + halfH) / Math.max(0.01, h), 0, 1);
      const ao = lerp(1.0 - baseAoDark, 1.0, smooth(0.0, 0.42, vFrac)) * (1.0 - 0.10 * (edgeX * edgeZ));
      col[i * 3] = ao;
      col[i * 3 + 1] = ao * (0.98 + 0.02 * (1 - vFrac));
      col[i * 3 + 2] = ao * 0.96;
    }
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return geo;
  }

  function buildHighlandArchitecture(T, terrain, landmarks) {
    const group = new T.Group();
    group.name = "EthiopiaHighlandArchitecture";
    const disposables = [];
    const track = obj => { disposables.push(obj); return obj; };

    const regId = String(terrain.regionId || "simien_imet_gogo").toLowerCase();
    const isGheralta = regId.indexOf("gheralta") >= 0;

    const tuffTexBundle = createVolcanicTuffTextures(T, isGheralta);
    if (tuffTexBundle.tuffAlbedo) track(tuffTexBundle.tuffAlbedo);
    if (tuffTexBundle.tuffNormal) track(tuffTexBundle.tuffNormal);
    if (tuffTexBundle.doorAlbedo) track(tuffTexBundle.doorAlbedo);

    const tuffMat = track(new T.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: tuffTexBundle.tuffAlbedo,
      normalMap: tuffTexBundle.tuffNormal,
      normalScale: new T.Vector2(0.75, 0.75),
      roughness: 0.91,
      metalness: 0.02
    }));
    tuffMat.userData.surfaceTag = "stone";

    const tuffPlainMat = track(new T.MeshStandardMaterial({
      color: 0xffffff,
      map: tuffTexBundle.tuffAlbedo,
      normalMap: tuffTexBundle.tuffNormal,
      normalScale: new T.Vector2(0.70, 0.70),
      roughness: 0.91,
      metalness: 0.02
    }));
    tuffPlainMat.userData.surfaceTag = "stone";

    const basaltStoneMat = track(new T.MeshStandardMaterial({
      color: 0x565d66,
      normalMap: tuffTexBundle.tuffNormal,
      normalScale: new T.Vector2(0.85, 0.85),
      roughness: 0.90,
      metalness: 0.03
    }));
    basaltStoneMat.userData.surfaceTag = "stone";

    const cedarTimberMat = track(new T.MeshStandardMaterial({
      color: 0x3b2619,
      roughness: 0.84,
      metalness: 0.03
    }));
    cedarTimberMat.userData.surfaceTag = "wood";

    const cedarPlankDoorMat = track(new T.MeshStandardMaterial({
      color: 0xffffff,
      map: tuffTexBundle.doorAlbedo,
      normalMap: tuffTexBundle.tuffNormal,
      normalScale: new T.Vector2(0.45, 0.45),
      roughness: 0.82,
      metalness: 0.05
    }));
    cedarPlankDoorMat.userData.surfaceTag = "wood";

    const thatchMat = track(new T.MeshStandardMaterial({ color: 0xa88c52, roughness: 0.94, metalness: 0.01 }));
    const brassCrossMat = track(new T.MeshStandardMaterial({ color: 0xcfa652, roughness: 0.38, metalness: 0.72 }));

    // Dark Graphite Cast-Iron (`#222428` — strictly neutral grey with zero blue tint & zero cyan point-light bleed!)
    const castIronMat = track(new T.MeshStandardMaterial({
      color: 0x222428,
      roughness: 0.56,
      metalness: 0.26
    }));
    castIronMat.userData.surfaceTag = "iron";

    const terracottaMat = track(new T.MeshStandardMaterial({ color: 0xa45538, roughness: 0.78, metalness: 0.03 }));
    terracottaMat.userData.surfaceTag = "terracotta";

    const cyanWaterMat = track(new T.MeshStandardMaterial({
      color: 0x28d8f0,
      emissive: 0x149ec0,
      emissiveIntensity: 0.92,
      roughness: 0.14,
      metalness: 0.04,
      transparent: true,
      opacity: 0.94
    }));
    cyanWaterMat.userData.isWaterCyan = true;

    const cyanFoamMat = track(new T.MeshBasicMaterial({
      color: 0xdcfaff,
      transparent: true,
      opacity: 0.88,
      side: T.DoubleSide
    }));
    cyanFoamMat.userData.isWaterCyan = true;

    const jerikanShellMat = track(new T.MeshStandardMaterial({
      color: 0x1d98c2,
      emissive: 0x0c5c7c,
      emissiveIntensity: 0.52,
      roughness: 0.34,
      metalness: 0.06
    }));
    jerikanShellMat.userData.isWaterCyan = true;

    // ---- 3A. Hand-Chiselled Rock-Hewn Monolithic Cruciform Church (`Bete Giyorgis` Sunken Trench + Recessed Cedar Doors) ----
    const churchGroup = new T.Group();
    const cPos = landmarks.churchPos;
    churchGroup.position.set(cPos.x, cPos.y, cPos.z);
    churchGroup.rotation.y = landmarks.churchHeading || 0;

    // Deep monolithic rock-cut courtyard floor & foundation (-9.4m deep)
    const deepSkirt = new T.Mesh(track(makeRockHewnBox(T, 18.6, 9.4, 18.6, 6, 4, 6, 0.14, 0.35)), tuffMat);
    deepSkirt.position.set(0, -4.72, 0);
    deepSkirt.receiveShadow = true;
    churchGroup.add(deepSkirt);

    // Craggy Excavated Living-Rock Perimeter Trench Cliffs (jagged multi-ledge volcanic rock faces instead of flat boxes!)
    const trenchBerms = [
      [0, 1.25, -8.35, 19.6, 2.75, 3.4],   // North living-rock face
      [-8.35, 1.25, 0, 3.4, 2.75, 19.6],   // West living-rock face
      [8.35, 1.25, 0, 3.4, 2.75, 19.6],    // East living-rock face
      [-5.45, 1.15, 8.35, 8.5, 2.55, 3.3], // South-West rock trench shoulder
      [5.45, 1.15, 8.35, 8.5, 2.55, 3.3]   // South-East rock trench shoulder
    ];
    for (const [bx, by, bz, bw, bh, bd] of trenchBerms) {
      const bGeo = track(makeRockHewnBox(T, bw, bh, bd, 14, 6, 14, 0.26, 0.36));
      const bp = bGeo.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        let vx = bp.getX(i), vy = bp.getY(i), vz = bp.getZ(i);
        if (vy > 0) {
          // Sculpt craggy stepped living-rock outcrop top & sloped outer shoulder!
          const rimCrag = (fbm((vx + bx) * 0.42, (vz + bz) * 0.42, 4) - 0.42) * 0.95;
          vy += rimCrag;
        }
        bp.setXYZ(i, vx, vy, vz);
      }
      bGeo.computeVertexNormals();
      const berm = new T.Mesh(bGeo, tuffMat);
      berm.position.set(bx, by, bz);
      berm.castShadow = berm.receiveShadow = true;
      churchGroup.add(berm);
    }

    // 3 Stepped Hand-Hewn Aksumite Monolithic Plinth Courses
    for (let s = 0; s < 3; s++) {
      const spanArm = 9.5 - s * 0.56;
      const crossW = 4.65 - s * 0.26;
      const hStep = 0.34;
      const yStep = 0.17 + s * hStep;
      const pNS = new T.Mesh(track(makeRockHewnBox(T, crossW, hStep, spanArm, 6, 2, 8, 0.035, 0.18)), tuffMat);
      const pEW = new T.Mesh(track(makeRockHewnBox(T, spanArm, hStep, crossW, 8, 2, 6, 0.035, 0.18)), tuffMat);
      pNS.position.y = pEW.position.y = yStep;
      pNS.receiveShadow = pEW.receiveShadow = true;
      churchGroup.add(pNS, pEW);
    }

    // Main Chiselled Monolithic Greek-Cross Sanctuary
    const chBaseY = 1.02;
    const chH = 6.65;
    const armLen = 8.10;
    const armWid = 3.88;
    const bodyNS = new T.Mesh(track(makeRockHewnBox(T, armWid, chH, armLen, 8, 12, 12, 0.055, 0.30)), tuffMat);
    const bodyEW = new T.Mesh(track(makeRockHewnBox(T, armLen, chH, armWid, 12, 12, 8, 0.055, 0.30)), tuffMat);
    bodyNS.position.y = bodyEW.position.y = chBaseY + chH * 0.5;
    bodyNS.castShadow = bodyEW.castShadow = true;
    bodyNS.receiveShadow = bodyEW.receiveShadow = true;
    churchGroup.add(bodyNS, bodyEW);

    // Chiselled horizontal stringcourse cornices
    for (const bandY of [chBaseY + 2.35, chBaseY + 4.85, chBaseY + chH - 0.18]) {
      const bNS = new T.Mesh(track(makeRockHewnBox(T, armWid + 0.20, 0.19, armLen + 0.20, 6, 2, 8, 0.025, 0.12)), tuffMat);
      const bEW = new T.Mesh(track(makeRockHewnBox(T, armLen + 0.20, 0.19, armWid + 0.20, 8, 2, 6, 0.025, 0.12)), tuffMat);
      bNS.position.y = bEW.position.y = bandY;
      churchGroup.add(bNS, bEW);
    }

    // Lalibela `Bete Giyorgis` Triple Concentric Relief Cross on the Roof!
    const roofY = chBaseY + chH + 0.08;
    for (let cTier = 0; cTier < 3; cTier++) {
      const rLen = 7.4 - cTier * 1.85;
      const rWid = 3.2 - cTier * 0.78;
      const rH = 0.22;
      const rY = roofY + cTier * 0.18;
      const rNS = new T.Mesh(track(makeRockHewnBox(T, rWid, rH, rLen, 5, 2, 7, 0.03, 0.12)), tuffMat);
      const rEW = new T.Mesh(track(makeRockHewnBox(T, rLen, rH, rWid, 7, 2, 5, 0.03, 0.12)), tuffMat);
      rNS.position.y = rEW.position.y = rY;
      rNS.castShadow = rEW.castShadow = true;
      churchGroup.add(rNS, rEW);
    }

    // Ornate Ethiopian Brass Processional Cross finial
    const crossMast = new T.Mesh(track(new T.CylinderGeometry(0.04, 0.05, 1.35, 8)), brassCrossMat);
    crossMast.position.set(0, roofY + 0.95, 0);
    const crossBar = new T.Mesh(track(new T.BoxGeometry(0.76, 0.09, 0.07)), brassCrossMat);
    crossBar.position.set(0, roofY + 1.25, 0);
    const crossHalo = new T.Mesh(track(new T.TorusGeometry(0.32, 0.035, 8, 18)), brassCrossMat);
    crossHalo.position.set(0, roofY + 1.25, 0);
    churchGroup.add(crossMast, crossBar, crossHalo);

    // Aksumite "Monkey-Head" (`r'ese hebey`) Window & Deeply Recessed Dark Cedar Plank Doorway Builder
    const addAksumiteOpening = (parentGrp, fx, fy, fz, rotY, fW, fH, isPortal) => {
      const fGrp = new T.Group();
      fGrp.position.set(fx, fy, fz);
      fGrp.rotation.y = rotY;
      const bossGeo = track(new T.BoxGeometry(0.16, 0.16, 0.30));
      const stileGeo = track(new T.BoxGeometry(0.14, fH + 0.16, 0.18));
      const railGeo = track(new T.BoxGeometry(fW + 0.28, 0.14, 0.18));

      // Deep shadowed carved rock reveal surround
      const revealTop = new T.Mesh(track(new T.BoxGeometry(fW + 0.36, 0.22, 0.36)), tuffPlainMat);
      revealTop.position.set(0, fH * 0.5 + 0.12, 0.02);
      fGrp.add(revealTop);

      for (const sx of [-1, 1]) {
        const stile = new T.Mesh(stileGeo, cedarTimberMat);
        stile.position.set(sx * (fW * 0.5 + 0.06), 0, 0.06);
        stile.castShadow = true;
        fGrp.add(stile);
        for (const sy of [-1, 1]) {
          const boss = new T.Mesh(bossGeo, cedarTimberMat);
          boss.position.set(sx * (fW * 0.5 + 0.10), sy * (fH * 0.5 + 0.08), 0.12);
          boss.castShadow = true;
          fGrp.add(boss);
        }
      }
      for (const sy of [-1, 1]) {
        const rail = new T.Mesh(railGeo, cedarTimberMat);
        rail.position.set(0, sy * (fH * 0.5 + 0.06), 0.06);
        fGrp.add(rail);
      }

      if (isPortal) {
        // Deeply recessed dark carved cedar double plank doors + brass knockers (ZERO glowing cream rectangle!)
        const shadowBack = new T.Mesh(track(new T.BoxGeometry(fW - 0.04, fH - 0.04, 0.06)), cedarTimberMat);
        shadowBack.position.set(0, 0, -0.10);
        const doorLeafL = new T.Mesh(track(new T.BoxGeometry((fW - 0.08) * 0.49, fH - 0.08, 0.08)), cedarPlankDoorMat);
        doorLeafL.position.set(-(fW - 0.08) * 0.25, 0, -0.03);
        doorLeafL.rotation.y = 0.06;
        const doorLeafR = new T.Mesh(track(new T.BoxGeometry((fW - 0.08) * 0.49, fH - 0.08, 0.08)), cedarPlankDoorMat);
        doorLeafR.position.set((fW - 0.08) * 0.25, 0, -0.03);
        doorLeafR.rotation.y = -0.06;
        for (const sx of [-1, 1]) {
          const ringPull = new T.Mesh(track(new T.TorusGeometry(0.055, 0.012, 6, 14)), brassCrossMat);
          ringPull.position.set(sx * 0.14, -0.06, 0.03);
          fGrp.add(ringPull);
        }
        const arch = new T.Mesh(track(new T.CylinderGeometry(fW * 0.56, fW * 0.56, 0.22, 16, 1, false, 0, Math.PI)), tuffPlainMat);
        arch.rotation.z = -Math.PI * 0.5;
        arch.rotation.y = Math.PI * 0.5;
        arch.position.set(0, fH * 0.5 + 0.18, 0.08);
        fGrp.add(shadowBack, doorLeafL, doorLeafR, arch);
      } else {
        // Deep dark sanctuary aperture + carved stone cruciform window grille
        const voidPane = new T.Mesh(track(new T.BoxGeometry(fW - 0.06, fH - 0.06, 0.06)), castIronMat);
        voidPane.position.set(0, 0, -0.04);
        const vBar = new T.Mesh(track(new T.BoxGeometry(0.13, fH - 0.10, 0.14)), tuffPlainMat);
        const hBar = new T.Mesh(track(new T.BoxGeometry(fW - 0.10, 0.13, 0.14)), tuffPlainMat);
        vBar.position.z = hBar.position.z = 0.04;
        fGrp.add(voidPane, vBar, hBar);
      }
      parentGrp.add(fGrp);
    };

    addAksumiteOpening(churchGroup, 0, chBaseY + 1.32, armLen * 0.5 + 0.03, 0, 1.38, 2.38, true);
    for (let fIdx = 0; fIdx < 4; fIdx++) {
      const [fx, fz, fRot] = [
        [0, armLen * 0.5 + 0.03, 0],
        [0, -armLen * 0.5 - 0.03, Math.PI],
        [armLen * 0.5 + 0.03, 0, Math.PI * 0.5],
        [-armLen * 0.5 - 0.03, 0, -Math.PI * 0.5]
      ][fIdx];
      addAksumiteOpening(churchGroup, fx, chBaseY + 3.65, fz, fRot, 0.92, 1.24, false);
      addAksumiteOpening(churchGroup, fx, chBaseY + 5.55, fz, fRot, 0.78, 0.96, false);
      if (fIdx > 0) addAksumiteOpening(churchGroup, fx, chBaseY + 1.45, fz, fRot, 0.96, 1.42, false);
    }
    group.add(churchGroup);

    // Optional Cliffside `Abuna Yemata Guh` Buttressed Aksumite Rock-Hewn Sanctuary (Gheralta Korkor Ledge)
    if (landmarks.cliffSanctuaryPos && landmarks.cliffSanctuaryPos.distanceTo(cPos) > 25) {
      const cliffGrp = new T.Group();
      cliffGrp.position.copy(landmarks.cliffSanctuaryPos);
      cliffGrp.rotation.y = landmarks.cliffSanctuaryHeading || 0.12;

      const cSkirt = new T.Mesh(track(makeRockHewnBox(T, 9.8, 12.0, 7.2, 6, 4, 6, 0.12, 0.30)), tuffMat);
      cSkirt.position.set(0, -5.9, -1.0);
      cliffGrp.add(cSkirt);
      for (let st = 0; st < 4; st++) {
        const stepMesh = new T.Mesh(track(makeRockHewnBox(T, 3.6 - st * 0.25, 0.22, 0.55, 4, 2, 2, 0.025, 0.15)), tuffMat);
        stepMesh.position.set(0, 0.11 + st * 0.20, 2.35 - st * 0.42);
        stepMesh.receiveShadow = true;
        cliffGrp.add(stepMesh);
      }
      const cFacade = new T.Mesh(track(makeRockHewnBox(T, 7.8, 5.8, 4.4, 10, 10, 6, 0.06, 0.28)), tuffMat);
      cFacade.position.set(0, 3.3, -0.9);
      cFacade.castShadow = cFacade.receiveShadow = true;
      cliffGrp.add(cFacade);
      for (const px of [-3.45, -1.35, 1.35, 3.45]) {
        const pilaster = new T.Mesh(track(makeRockHewnBox(T, 0.56, 5.95, 0.46, 3, 8, 3, 0.03, 0.24)), tuffMat);
        pilaster.position.set(px, 3.35, 1.32);
        pilaster.castShadow = true;
        cliffGrp.add(pilaster);
      }
      for (const by of [0.68, 3.25, 5.88, 6.26]) {
        const cornice = new T.Mesh(
          track(new T.BoxGeometry(8.25, by > 6 ? 0.26 : 0.18, 4.75)),
          by === 3.25 ? cedarTimberMat : tuffPlainMat
        );
        cornice.position.set(0, by, -0.85);
        cliffGrp.add(cornice);
      }
      addAksumiteOpening(cliffGrp, 0, 1.95, 1.33, 0, 1.32, 2.25, true);
      addAksumiteOpening(cliffGrp, -2.40, 2.15, 1.33, 0, 0.86, 1.28, false);
      addAksumiteOpening(cliffGrp, 2.40, 2.15, 1.33, 0, 0.86, 1.28, false);
      addAksumiteOpening(cliffGrp, 0, 4.60, 1.33, 0, 0.92, 1.18, false);
      addAksumiteOpening(cliffGrp, -2.40, 4.60, 1.33, 0, 0.76, 1.04, false);
      addAksumiteOpening(cliffGrp, 2.40, 4.60, 1.33, 0, 0.76, 1.04, false);

      const cMast = new T.Mesh(track(new T.CylinderGeometry(0.04, 0.05, 1.25, 8)), brassCrossMat);
      cMast.position.set(0, 6.95, 1.15);
      const cBar = new T.Mesh(track(new T.BoxGeometry(0.72, 0.09, 0.07)), brassCrossMat);
      cBar.position.set(0, 7.22, 1.15);
      const cHalo = new T.Mesh(track(new T.TorusGeometry(0.30, 0.035, 8, 18)), brassCrossMat);
      cHalo.position.set(0, 7.22, 1.15);
      cliffGrp.add(cMast, cBar, cHalo);
      group.add(cliffGrp);
    }

    // ---- 3B. Highland Dry-Stone `Tukul` & `Hidmo` Homestead ----
    const hamletGroup = new T.Group();
    const hPos = landmarks.hamletPos;
    hamletGroup.position.set(hPos.x, hPos.y, hPos.z);
    hamletGroup.rotation.y = landmarks.hamletHeading || 0.4;

    const addTukul = (tx, tz, rad, wallH, roofH) => {
      const tGrp = new T.Group();
      const groundDelta = terrain.sampleHeight(hPos.x + tx, hPos.z + tz) - hPos.y;
      tGrp.position.set(tx, groundDelta, tz);
      const skirt = new T.Mesh(track(new T.CylinderGeometry(rad + 0.25, rad + 0.55, 6.0, 16)), basaltStoneMat);
      skirt.position.y = -2.85;
      tGrp.add(skirt);
      const wall = new T.Mesh(track(new T.CylinderGeometry(rad, rad + 0.08, wallH, 18)), basaltStoneMat);
      wall.position.y = wallH * 0.5;
      wall.castShadow = wall.receiveShadow = true;
      tGrp.add(wall);
      const roof = new T.Mesh(track(new T.ConeGeometry(rad + 0.78, roofH, 20)), thatchMat);
      roof.position.y = wallH + roofH * 0.48;
      roof.castShadow = true;
      tGrp.add(roof);
      const gullelat = new T.Mesh(track(new T.SphereGeometry(0.18, 10, 8)), terracottaMat);
      gullelat.position.y = wallH + roofH * 0.98;
      tGrp.add(gullelat);
      const door = new T.Mesh(track(new T.BoxGeometry(0.88, 1.68, 0.22)), cedarPlankDoorMat);
      door.position.set(0, 0.86, rad + 0.02);
      tGrp.add(door);
      hamletGroup.add(tGrp);
    };
    addTukul(-4.2, -1.8, 2.55, 2.35, 2.65);
    addTukul(4.4, -2.6, 2.15, 2.15, 2.25);

    {
      const hidGrp = new T.Group();
      const hdY = terrain.sampleHeight(hPos.x + 0.2, hPos.z - 6.4) - hPos.y;
      hidGrp.position.set(0.2, hdY, -6.4);
      const hSkirt = new T.Mesh(track(new T.BoxGeometry(5.8, 6.0, 4.4)), basaltStoneMat);
      hSkirt.position.y = -2.9;
      hidGrp.add(hSkirt);
      const hWall = new T.Mesh(track(makeRockHewnBox(T, 5.4, 2.85, 4.0, 8, 6, 6, 0.04, 0.24)), tuffMat);
      hWall.position.y = 1.42;
      hWall.castShadow = hWall.receiveShadow = true;
      hidGrp.add(hWall);
      const hParapet = new T.Mesh(track(new T.BoxGeometry(5.65, 0.32, 4.25)), basaltStoneMat);
      hParapet.position.y = 2.95;
      hidGrp.add(hParapet);
      for (let v = -2.1; v <= 2.15; v += 0.70) {
        const viga = new T.Mesh(track(new T.CylinderGeometry(0.065, 0.065, 4.55, 6)), cedarTimberMat);
        viga.rotation.x = Math.PI * 0.5;
        viga.position.set(v, 2.68, 0);
        hidGrp.add(viga);
      }
      const hDoor = new T.Mesh(track(new T.BoxGeometry(1.05, 1.92, 0.22)), cedarPlankDoorMat);
      hDoor.position.set(0, 0.96, 2.02);
      hidGrp.add(hDoor);
      hamletGroup.add(hidGrp);
    }
    group.add(hamletGroup);

    // ---- 3C. Dark Cast-Iron Standpipe (`#222428`), Grooved `Shekla` Basin &Selective `#28d8f0` Cyan Water/Jerrycans ----
    const relayGroup = new T.Group();
    const rPos = landmarks.relayPos;
    relayGroup.position.set(rPos.x, rPos.y, rPos.z);

    // Compact Octagonal 2-Step Dry-Stone Masonry Plinth
    const relaySkirt = new T.Mesh(track(new T.CylinderGeometry(3.15, 3.85, 5.6, 10)), basaltStoneMat);
    relaySkirt.position.set(0, -2.92, 0);
    relaySkirt.receiveShadow = true;
    const relayLowerStep = new T.Mesh(track(new T.CylinderGeometry(3.12, 3.24, 0.24, 10)), basaltStoneMat);
    relayLowerStep.position.set(0, -0.18, 0);
    relayLowerStep.receiveShadow = true;
    const relayUpperFlag = new T.Mesh(track(new T.CylinderGeometry(2.62, 2.72, 0.16, 10)), tuffPlainMat);
    relayUpperFlag.position.set(0, -0.06, 0);
    relayUpperFlag.receiveShadow = true;
    relayGroup.add(relaySkirt, relayLowerStep, relayUpperFlag);
    for (let cb = 0; cb < 10; cb++) {
      const ca = (cb / 10) * TAU;
      const curb = new T.Mesh(track(makeRockHewnBox(T, 0.62, 0.15, 0.28, 3, 2, 2, 0.02, 0.15)), basaltStoneMat);
      curb.position.set(Math.cos(ca) * 2.58, 0.01, Math.sin(ca) * 2.58);
      curb.rotation.y = -ca + Math.PI * 0.5;
      curb.receiveShadow = true;
      relayGroup.add(curb);
    }

    // Dark Graphite Cast-Iron Standpipe (`#222428` — stays crisp dark iron in Cyan Jerikan!)
    const pipeBase = new T.Mesh(track(new T.CylinderGeometry(0.18, 0.24, 0.24, 14)), castIronMat);
    pipeBase.position.set(-0.42, 0.12, 0);
    const pipeCol = new T.Mesh(track(new T.CylinderGeometry(0.075, 0.095, 1.18, 14)), castIronMat);
    pipeCol.position.set(-0.42, 0.72, 0);
    pipeCol.castShadow = true;
    const pipeCollar = new T.Mesh(track(new T.TorusGeometry(0.095, 0.022, 8, 16)), castIronMat);
    pipeCollar.rotation.x = Math.PI * 0.5;
    pipeCollar.position.set(-0.42, 0.98, 0);
    const pipeCap = new T.Mesh(track(new T.SphereGeometry(0.115, 14, 10)), castIronMat);
    pipeCap.position.set(-0.42, 1.32, 0);
    const spout = new T.Mesh(track(new T.CylinderGeometry(0.036, 0.042, 0.36, 10)), castIronMat);
    spout.rotation.z = -1.18;
    spout.position.set(-0.24, 1.06, 0);
    relayGroup.add(pipeBase, pipeCol, pipeCollar, pipeCap, spout);

    // Reciprocating dark cast-iron pump handle & spherical ball-knob
    const leverPivot = new T.Group();
    leverPivot.position.set(-0.42, 1.24, 0);
    const leverArm = new T.Mesh(track(new T.CylinderGeometry(0.018, 0.022, 0.68, 10)), castIronMat);
    leverArm.rotation.z = 1.15;
    leverArm.position.set(-0.28, -0.12, 0);
    const ballKnob = new T.Mesh(track(new T.SphereGeometry(0.048, 12, 10)), castIronMat);
    ballKnob.position.set(-0.58, -0.26, 0);
    leverPivot.add(leverArm, ballKnob);
    relayGroup.add(leverPivot);

    // Wheel-thrown ribbed terracotta `shekla` basin + `#28d8f0` cyan water surface
    const basinOuter = new T.Mesh(track(new T.CylinderGeometry(0.46, 0.28, 0.34, 22)), terracottaMat);
    basinOuter.position.set(0.18, 0.17, 0);
    basinOuter.castShadow = true;
    relayGroup.add(basinOuter);
    for (const rY of [0.10, 0.19, 0.28]) {
      const grooveRing = new T.Mesh(track(new T.TorusGeometry(lerp(0.31, 0.44, rY / 0.34), 0.014, 8, 22)), terracottaMat);
      grooveRing.rotation.x = Math.PI * 0.5;
      grooveRing.position.set(0.18, rY, 0);
      relayGroup.add(grooveRing);
    }
    const basinWater = new T.Mesh(track(new T.CircleGeometry(0.41, 22)), cyanWaterMat);
    basinWater.rotation.x = -Math.PI * 0.5;
    basinWater.position.set(0.18, 0.315, 0);
    relayGroup.add(basinWater);

    // Parabolic `#28d8f0` cyan water stream
    const streamPts = [];
    for (let s = 0; s <= 12; s++) {
      const f = s / 12;
      streamPts.push(new T.Vector3(
        lerp(-0.08, 0.18, f),
        lerp(0.99, 0.32, f * f) + 0.05 * Math.sin(f * Math.PI),
        0
      ));
    }
    const streamMesh = new T.Mesh(
      track(new T.TubeGeometry(new T.CatmullRomCurve3(streamPts), 14, 0.024, 8, false)),
      cyanWaterMat
    );
    relayGroup.add(streamMesh);

    const rippleRings = [];
    for (let r = 0; r < 3; r++) {
      const ring = new T.Mesh(track(new T.RingGeometry(0.05, 0.078, 24)), cyanFoamMat.clone());
      disposables.push(ring.material);
      ring.rotation.x = -Math.PI * 0.5;
      ring.position.set(0.18, 0.321 + r * 0.001, 0);
      relayGroup.add(ring);
      rippleRings.push(ring);
    }

    // Glowing Blue 20L Ahiya Water-WiFi Jerrycan Cache (no cyan PointLight bleeding onto standpipe iron!)
    const canPositions = [
      [-1.55, 0.24, -0.85, 0.2],
      [-1.18, 0.24, -0.92, -0.15],
      [-1.36, 0.24, -0.52, 0.45],
      [-1.36, 0.71, -0.78, 0.1],
      [1.35, 0.24, -0.80, -0.35],
      [1.72, 0.24, -0.72, 0.28]
    ];
    const canBodyGeo = track(new T.BoxGeometry(0.28, 0.46, 0.34));
    const canWinGeo = track(new T.BoxGeometry(0.30, 0.22, 0.20));
    const canCapGeo = track(new T.CylinderGeometry(0.036, 0.036, 0.06, 8));
    for (const [cx, cy, cz, cRot] of canPositions) {
      const jcGrp = new T.Group();
      jcGrp.position.set(cx, cy, cz);
      jcGrp.rotation.y = cRot;
      const body = new T.Mesh(canBodyGeo, jerikanShellMat);
      body.castShadow = true;
      const win = new T.Mesh(canWinGeo, cyanWaterMat);
      const cap = new T.Mesh(canCapGeo, brassCrossMat);
      cap.position.set(0, 0.25, 0.08);
      jcGrp.add(body, win, cap);
      relayGroup.add(jcGrp);
    }

    const relayMast = new T.Mesh(track(new T.CylinderGeometry(0.035, 0.05, 3.6, 8)), castIronMat);
    relayMast.position.set(-1.85, 1.8, -1.25);
    const relayDish = new T.Mesh(track(new T.SphereGeometry(0.38, 14, 10, 0, TAU, 0, 1.05)), brassCrossMat);
    relayDish.rotation.x = 1.35;
    relayDish.position.set(-1.85, 3.15, -1.12);
    const relayBeacon = new T.Mesh(track(new T.SphereGeometry(0.065, 10, 8)), castIronMat);
    relayBeacon.position.set(-1.85, 3.63, -1.25);
    relayGroup.add(relayMast, relayDish, relayBeacon);

    group.add(relayGroup);

    return {
      group, churchGroup, hamletGroup, relayGroup,
      update(nowSec) {
        const ph = nowSec * 2.1;
        leverPivot.rotation.z = Math.sin(ph) * 0.22;
        const pulse = 0.85 + 0.25 * Math.sin(ph);
        streamMesh.scale.set(pulse, 1, pulse);
        for (let i = 0; i < rippleRings.length; i++) {
          const u = ((nowSec * 0.72) + i / rippleRings.length) % 1;
          const s = lerp(0.4, 4.6, u);
          rippleRings[i].scale.set(s, s, 1);
          rippleRings[i].material.opacity = (1 - u) * 0.85;
        }
        relayBeacon.scale.setScalar(0.92 + 0.14 * Math.sin(nowSec * 3.4));
      },
      dispose() {
        for (const d of disposables) if (d && typeof d.dispose === "function") d.dispose();
      }
    };
  }

  /* ---------- 4. Donkey-Method Catmull-Rom Lofted + Fur-Normal Sculpted Endemic Wildlife ---------- */
  function createWildlifeMaterials(T) {
    const pelage = createPelageTextures(T);
    const tuffNrm = heightToNormalTexture(T, 128, (u, v) => fbm(u * 14, v * 14, 4), 3.6, 2, 2);

    const furMat = new T.MeshStandardMaterial({
      vertexColors: true,
      map: pelage.furAlbedo,
      normalMap: pelage.furNormal,
      normalScale: new T.Vector2(0.92, 0.92),
      roughness: 0.88,
      metalness: 0.01
    });

    // Natural matte vascular bare skin for Gelada hourglass chest patch (muted dusty crimson, zero neon balloon shine!)
    const geladaChestPatchMat = new T.MeshStandardMaterial({
      vertexColors: true,
      normalMap: pelage.furNormal,
      normalScale: new T.Vector2(0.35, 0.35),
      roughness: 0.80,
      metalness: 0.0
    });

    const hornKeratinMat = new T.MeshStandardMaterial({
      vertexColors: true,
      normalMap: pelage.furNormal,
      normalScale: new T.Vector2(0.55, 0.55),
      roughness: 0.62,
      metalness: 0.04
    });

    const eyeCorneaMat = new T.MeshStandardMaterial({
      color: 0x3b2410,
      emissive: 0x160c04,
      emissiveIntensity: 0.15,
      roughness: 0.18,
      metalness: 0.05
    });

    const basaltCragMat = new T.MeshStandardMaterial({
      vertexColors: true,
      normalMap: tuffNrm,
      normalScale: new T.Vector2(1.2, 1.2),
      roughness: 0.92,
      metalness: 0.02
    });

    return {
      furMat,
      geladaChestPatchMat,
      hornKeratinMat,
      eyeCorneaMat,
      basaltCragMat,
      dispose() {
        if (pelage.furAlbedo) pelage.furAlbedo.dispose();
        if (pelage.furNormal) pelage.furNormal.dispose();
        if (tuffNrm) tuffNrm.dispose();
        furMat.dispose();
        geladaChestPatchMat.dispose();
        hornKeratinMat.dispose();
        eyeCorneaMat.dispose();
        basaltCragMat.dispose();
      }
    };
  }

  // Sculpted Muscular Lofted 2-Segment Limb (`scapula/haunch -> muscular thigh -> joint -> tapered cannon/forearm -> hoof/paw/hand`)
  function makeLoftedLimb(T, uLen, lLen, uRadTop, uRadBot, lRadTop, lRadBot, furMat, upperColorFn, lowerColorFn, isShaggy = false) {
    const hip = new T.Group();
    const upperGeo = loftTube(T, [
      { p: [0, 0.085, -0.008], w: uRadTop * 0.56, up: uRadTop * 0.72, dn: uRadTop * 0.62, e: 0.96 },
      { p: [0, 0.015, 0.004], w: uRadTop * 0.90, up: uRadTop * 1.10, dn: uRadTop * 0.95, e: 0.95 },
      { p: [0, -uLen * 0.36, 0.012], w: uRadTop, up: uRadTop * 1.16, dn: uRadTop * 1.02, e: 0.95 },
      { p: [0, -uLen * 0.78, 0.004], w: lerp(uRadTop, uRadBot, 0.72), up: lerp(uRadTop, uRadBot, 0.68), dn: lerp(uRadTop, uRadBot, 0.70), e: 1.0 },
      { p: [0, -uLen - 0.015, 0], w: uRadBot, up: uRadBot * 1.05, dn: uRadBot * 1.05, e: 1.0 }
    ], {
      sub: 2, seg: 12, ur: 2, vr: 4,
      disp: (_r, sa, ca, u) => 1.0 + (isShaggy ? 0.12 : 0.04) * (vnoise(sa * 4 + u * 8, ca * 4) - 0.5),
      color: upperColorFn
    });
    const upper = new T.Mesh(upperGeo, furMat);
    upper.castShadow = true;
    hip.add(upper);

    const knee = new T.Group();
    knee.position.y = -uLen;
    hip.add(knee);

    const lowerGeo = loftTube(T, [
      { p: [0, 0.018, 0], w: lRadTop * 1.04, up: lRadTop * 1.08, dn: lRadTop * 1.05, e: 1.0 },
      { p: [0, -lLen * 0.48, 0.005], w: lerp(lRadTop, lRadBot, 0.55), up: lerp(lRadTop, lRadBot, 0.55), dn: lerp(lRadTop, lRadBot, 0.55), e: 1.0 },
      { p: [0, -lLen * 0.86, 0.010], w: lRadBot * 0.95, up: lRadBot * 1.02, dn: lRadBot * 0.95, e: 0.92 },
      { p: [0, -lLen, 0.024], w: lRadBot * 1.12, up: lRadBot * 1.25, dn: lRadBot * 0.85, e: 0.82 }
    ], {
      sub: 2, seg: 12, ur: 2, vr: 4,
      color: lowerColorFn
    });
    const lower = new T.Mesh(lowerGeo, furMat);
    lower.castShadow = true;
    knee.add(lower);

    return { hip, knee };
  }

  // 4A. Gelada (`Theropithecus gelada`) — Donkey-Method Lofted Torso, Shaggy Fur Mantle, Matte Vascular Chest & Lofted Baboon Head
  function buildGeladaRig(T, mats, isMale, scale = 1.0) {
    const root = new T.Group();
    const bodyPivot = new T.Group();
    bodyPivot.position.y = 0.45;
    root.add(bodyPivot);

    // Continuous lofted muscular baboon pelvis -> lumbar -> ribcage -> shoulder withers
    const torsoGeo = loftTube(T, [
      { p: [0, -0.02, -0.25], w: 0.135, up: 0.13, dn: 0.125, e: 0.92 }, // ischial rump
      { p: [0, 0.00, -0.11], w: 0.142, up: 0.145, dn: 0.135, e: 0.95 }, // lumbar waist
      { p: [0, 0.03, 0.06], w: isMale ? 0.175 : 0.155, up: 0.172, dn: 0.158, e: 0.94 }, // deep ribcage
      { p: [0, 0.07, 0.20], w: isMale ? 0.185 : 0.158, up: 0.178, dn: 0.152, e: 0.92 }, // muscular shoulders
      { p: [0, 0.11, 0.28], w: 0.115, up: 0.115, dn: 0.105, e: 0.96 }  // base of neck
    ], {
      sub: 3, seg: 20, ur: 3, vr: 5,
      disp: (_r, sa, ca, u, a) => {
        // Shaggy fur tufts & longitudinal fur-lock ridges across dorsal shoulders & flanks (leaving ventral sternum clean!)
        const dorsal = smooth(-0.2, 0.5, ca);
        const lockWave = Math.sin(a * (isMale ? 11 : 8) + u * 6.0) * 0.055 + (fbm(a * 3.5, u * 9.0, 3) - 0.5) * 0.08;
        return 1.0 + dorsal * (isMale ? 1.25 : 0.75) * lockWave;
      },
      color: (_r, sa, ca, u, px, py, pz) => {
        const mott = 0.88 + 0.24 * fbm(px * 9.0, pz * 9.0 + py * 6.0, 3);
        const shoulderCape = smooth(0.32, 0.78, u) * smooth(-0.25, 0.45, ca);
        const rC = lerp(0.32, isMale ? 0.66 : 0.56, shoulderCape) * mott;
        const gC = lerp(0.22, isMale ? 0.47 : 0.40, shoulderCape) * mott;
        const bC = lerp(0.15, isMale ? 0.24 : 0.21, shoulderCape) * mott;
        return [rC, gC, bC];
      }
    });
    const torso = new T.Mesh(torsoGeo, mats.furMat);
    torso.castShadow = torso.receiveShadow = true;
    bodyPivot.add(torso);

    // Draped Shaggy Fur Shoulder Mantle (`cape`) — organic lofted multi-fold fur shawl (zero capsules/cones!)
    const capeSpan = isMale ? 1.0 : 0.74;
    const capeGeo = loftTube(T, [
      { p: [0, 0.15, 0.22], w: 0.135 * capeSpan, up: 0.11 * capeSpan, dn: 0.05, e: 0.92 },
      { p: [0, 0.10, 0.10], w: 0.215 * capeSpan, up: 0.135 * capeSpan, dn: 0.08, e: 0.90 },
      { p: [0, 0.03, -0.04], w: 0.225 * capeSpan, up: 0.125 * capeSpan, dn: 0.12, e: 0.88 },
      { p: [0, -0.05, -0.16], w: 0.165 * capeSpan, up: 0.085 * capeSpan, dn: 0.09, e: 0.88 }
    ], {
      sub: 3, seg: 22, ur: 4, vr: 4,
      disp: (_r, _sa, ca, u, a) => {
        // Tuck ventral side inside torso (`ca < -0.15`), sculpt deep shaggy fur-lock channels over back & shoulders!
        if (ca < -0.15) return 0.55;
        const locks = 0.14 * Math.sin(a * 13.0 + u * 5.0) + 0.10 * (fbm(a * 5.0, u * 8.0, 3) - 0.5);
        const raggedHem = u > 0.72 ? 0.08 * Math.sin(a * 17.0) : 0;
        return 1.0 + locks + raggedHem;
      },
      color: (_r, _sa, ca, u, px, _py, pz) => {
        const strand = 0.84 + 0.30 * fbm(px * 14.0, pz * 12.0, 3);
        const tips = smooth(0.15, 0.85, u);
        return [
          lerp(0.68, 0.48, tips) * strand,
          lerp(0.49, 0.33, tips) * strand,
          lerp(0.25, 0.17, tips) * strand
        ];
      }
    });
    const capeMesh = new T.Mesh(capeGeo, mats.furMat);
    capeMesh.castShadow = true;
    bodyPivot.add(capeMesh);

    // Matte Anatomical Hourglass Chest Patch (subtle recessed bare crimson-terracotta vascular skin + pale beaded margin — zero toy-red balloon!)
    const chestGeo = new T.SphereGeometry(0.092, 16, 14);
    {
      const p = chestGeo.attributes.position;
      const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const ny = y / 0.092;
        // Pinch waist at y = 0 into authentic `Theropithecus gelada` hourglass silhouette, flatten flush against sternum!
        const hourglass = 0.62 + 0.46 * Math.pow(Math.abs(ny), 1.25);
        x *= hourglass * 0.96;
        y *= 1.18;
        z *= 0.22; // flat anatomical patch, NOT a protruding balloon!
        const bead = 0.004 * Math.sin(Math.atan2(y, x) * 26.0);
        p.setXYZ(i, x + bead, y + bead, z);

        const rEdge = Math.hypot(x / (0.090 * hourglass), y / 0.108);
        const isBorder = smooth(0.76, 0.96, rEdge);
        const tex = 0.90 + 0.16 * vnoise(x * 80, y * 80);
        // Muted natural dusty crimson-rose skin (`#9c2f2d`) with warm greyish-ivory (`#c6b9ac`) papillated border
        col[i * 3] = lerp(0.61, 0.77, isBorder) * tex;
        col[i * 3 + 1] = lerp(0.19, 0.71, isBorder) * tex;
        col[i * 3 + 2] = lerp(0.18, 0.66, isBorder) * tex;
      }
      chestGeo.setAttribute("color", new T.BufferAttribute(col, 3));
      chestGeo.computeVertexNormals();
    }
    const chestPatch = new T.Mesh(chestGeo, mats.geladaChestPatchMat);
    // Placed flush on the ventral sternum (`y = -0.132, z = 0.145, rotX = 1.34`) so when seated upright (`bodyPivot.rotation.x = -1.16`), the matte hourglass crimson-terracotta patch faces straight forward between the arms!
    chestPatch.position.set(0, -0.132, 0.145);
    chestPatch.rotation.x = 1.34;
    bodyPivot.add(chestPatch);

    // Continuous Lofted Baboon Neck -> Cranium -> Supraorbital Brow -> Ridged Prognathous Muzzle!
    const neck = new T.Group();
    neck.position.set(0, 0.11, 0.24);
    bodyPivot.add(neck);

    const headGeo = loftTube(T, [
      { p: [0, 0.00, -0.03], w: 0.092, up: 0.095, dn: 0.075, e: 0.95 }, // occiput & nape ruff
      { p: [0, 0.055, 0.02], w: 0.102, up: 0.098, dn: 0.078, e: 0.92 }, // cranium + cheek whisker width
      { p: [0, 0.072, 0.085], w: 0.078, up: 0.076, dn: 0.062, e: 0.86 }, // prominent supraorbital brow torus
      { p: [0, 0.046, 0.145], w: 0.048, up: 0.046, dn: 0.044, e: 0.88 }, // maxillary snout bridge
      { p: [0, 0.035, 0.205], w: 0.040, up: 0.038, dn: 0.036, e: 0.90 }  // rounded fleshy baboon nose pad
    ], {
      sub: 3, seg: 18, ur: 2, vr: 4,
      disp: (_r, sa, ca, u, a) => {
        // Cheek whisker side-tufts at u ~ 0.28..0.48, brow ridge at u ~ 0.52, maxillary ridges on snout!
        const whiskers = Math.exp(-Math.pow((u - 0.34) / 0.14, 2)) * Math.pow(Math.abs(sa), 2.0) * (0.28 + 0.08 * Math.sin(a * 9.0));
        const brow = Math.exp(-Math.pow((u - 0.52) / 0.09, 2)) * Math.max(0, ca) * 0.22;
        const snoutGrooves = u > 0.58 ? 0.05 * Math.cos(sa * 6.0) : 0;
        return 1.0 + whiskers + brow + snoutGrooves;
      },
      color: (_r, sa, ca, u) => {
        // Bare dark espresso-charcoal baboon face on anterior muzzle & brow; golden-buff cheek whiskers & crown fur!
        const bareMask = smooth(0.46, 0.62, u) * smooth(-0.5, 0.2, ca + (u > 0.65 ? 0.8 : 0));
        const isCheekRuff = smooth(0.20, 0.45, u) * (1 - smooth(0.45, 0.62, u)) * Math.abs(sa);
        let rC = lerp(0.52, 0.23, bareMask) + isCheekRuff * 0.22;
        let gC = lerp(0.37, 0.17, bareMask) + isCheekRuff * 0.16;
        let bC = lerp(0.20, 0.15, bareMask) + isCheekRuff * 0.08;
        return [rC, gC, bC];
      }
    });
    const headMesh = new T.Mesh(headGeo, mats.furMat);
    headMesh.castShadow = true;
    neck.add(headMesh);

    // Articulated Lofted Lower Jaw (for rhythmic grass chewing!)
    const jaw = new T.Group();
    jaw.position.set(0, 0.018, 0.075);
    const jawGeo = loftTube(T, [
      { p: [0, 0, 0], w: 0.046, up: 0.022, dn: 0.030, e: 0.92 },
      { p: [0, -0.005, 0.065], w: 0.038, up: 0.020, dn: 0.028, e: 0.92 },
      { p: [0, -0.002, 0.118], w: 0.030, up: 0.018, dn: 0.022, e: 0.94 }
    ], {
      sub: 2, seg: 12,
      color: () => [0.24, 0.18, 0.15]
    });
    jaw.add(new T.Mesh(jawGeo, mats.furMat));
    neck.add(jaw);

    // Deep-set amber eyes tucked cleanly beneath the supraorbital brow arch (never protruding spheres!)
    for (const sx of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.011, 8, 6), mats.eyeCorneaMat);
      eye.position.set(sx * 0.028, 0.078, 0.104);
      neck.add(eye);
    }

    // Lofted Arching Tail with Cream-Buff Tufted Tip
    const tailPivot = new T.Group();
    tailPivot.position.set(0, 0.02, -0.24);
    const tailGeo = loftTube(T, [
      { p: [0, 0, 0], w: 0.026, up: 0.026, dn: 0.026 },
      { p: [0, 0.14, -0.16], w: 0.021, up: 0.021, dn: 0.021 },
      { p: [0, 0.04, -0.34], w: 0.019, up: 0.019, dn: 0.019 },
      { p: [0, -0.10, -0.43], w: 0.042, up: 0.042, dn: 0.042 },
      { p: [0, -0.19, -0.46], w: 0.012, up: 0.012, dn: 0.012 }
    ], {
      sub: 2, seg: 10,
      disp: (_r, _sa, _ca, u, a) => u > 0.68 ? 1.0 + 0.18 * Math.sin(a * 7.0) : 1.0,
      color: (_r, _sa, _ca, u) => u > 0.66 ? [0.84, 0.78, 0.68] : [0.34, 0.24, 0.16]
    });
    tailPivot.add(new T.Mesh(tailGeo, mats.furMat));
    bodyPivot.add(tailPivot);

    // 4 Muscular Lofted Primate Limbs (shaggy golden-brown shoulders tapering to dark espresso hands/feet!)
    const limbUpperCol = (_r, _sa, _ca, u) => [lerp(0.50, 0.30, u), lerp(0.35, 0.21, u), lerp(0.19, 0.14, u)];
    const limbLowerCol = (_r, _sa, _ca, u) => [lerp(0.28, 0.17, u), lerp(0.20, 0.13, u), lerp(0.14, 0.11, u)];
    const armL = makeLoftedLimb(T, 0.22, 0.21, 0.062, 0.042, 0.040, 0.028, mats.furMat, limbUpperCol, limbLowerCol, true);
    const armR = makeLoftedLimb(T, 0.22, 0.21, 0.062, 0.042, 0.040, 0.028, mats.furMat, limbUpperCol, limbLowerCol, true);
    armL.hip.position.set(0.135, 0.02, 0.17);
    armR.hip.position.set(-0.135, 0.02, 0.17);
    bodyPivot.add(armL.hip, armR.hip);

    const legL = makeLoftedLimb(T, 0.22, 0.22, 0.068, 0.045, 0.044, 0.030, mats.furMat, limbUpperCol, limbLowerCol, true);
    const legR = makeLoftedLimb(T, 0.22, 0.22, 0.068, 0.045, 0.044, 0.030, mats.furMat, limbUpperCol, limbLowerCol, true);
    legL.hip.position.set(0.122, 0.43, -0.15);
    legR.hip.position.set(-0.122, 0.43, -0.15);
    root.add(legL.hip, legR.hip);

    root.scale.setScalar(scale * (isMale ? 1.15 : 0.95));
    return { root, bodyPivot, neck, jaw, tailPivot, armL, armR, legL, legR };
  }

  // 4B. Walia Ibex (`Capra walie`) — Lofted Chestnut-Sienna Body, Lofted Caprine Head & Ridged Scimitar Horns
  function buildWaliaIbexRig(T, mats, isBuck, scale = 1.0) {
    const root = new T.Group();
    const bodyPivot = new T.Group();
    bodyPivot.position.y = 0.78;
    root.add(bodyPivot);

    // Continuous lofted barrel chest, muscular withers, tucked flank & croup
    const torsoGeo = loftTube(T, [
      { p: [0, 0.02, -0.38], w: 0.16, up: 0.16, dn: 0.15, e: 0.92 },
      { p: [0, 0.01, -0.16], w: 0.19, up: 0.18, dn: 0.19, e: 0.94 },
      { p: [0, 0.03, 0.12], w: 0.225, up: 0.24, dn: 0.22, e: 0.92 }, // deep muscular withers & brisket
      { p: [0, 0.08, 0.32], w: 0.165, up: 0.19, dn: 0.16, e: 0.94 }
    ], {
      sub: 3, seg: 20, ur: 3, vr: 5,
      disp: (_r, _sa, _ca, u, a) => 1.0 + 0.03 * (fbm(a * 3.0, u * 6.0, 3) - 0.5),
      color: (_r, _sa, ca, u, px, _py, pz) => {
        const belly = smooth(-0.22, -0.68, ca);
        const dorsalDark = smooth(0.55, 0.95, ca) * 0.28;
        const m = 0.88 + 0.22 * fbm(px * 8, pz * 8 + u * 4, 3);
        const rC = lerp(0.58 - dorsalDark * 0.35, 0.88, belly) * m;
        const gC = lerp(0.34 - dorsalDark * 0.22, 0.84, belly) * m;
        const bC = lerp(0.18 - dorsalDark * 0.12, 0.76, belly) * m;
        return [rC, gC, bC];
      }
    });
    const torso = new T.Mesh(torsoGeo, mats.furMat);
    torso.castShadow = torso.receiveShadow = true;
    bodyPivot.add(torso);

    // Continuous Lofted Neck & Tapered Caprine Head
    const neck = new T.Group();
    neck.position.set(0, 0.10, 0.28);
    bodyPivot.add(neck);

    const neckGeo = loftTube(T, [
      { p: [0, -0.02, -0.02], w: 0.135, up: 0.145, dn: 0.135, e: 0.94 },
      { p: [0, 0.14, 0.06], w: 0.108, up: 0.120, dn: 0.110, e: 0.94 },
      { p: [0, 0.28, 0.12], w: 0.088, up: 0.095, dn: 0.088, e: 0.94 }
    ], {
      sub: 2, seg: 14,
      color: (_r, _sa, ca) => {
        const throat = smooth(-0.3, -0.8, ca) * 0.15;
        return [0.54 - throat, 0.31 - throat * 0.6, 0.17 - throat * 0.4];
      }
    });
    neck.add(new T.Mesh(neckGeo, mats.furMat));

    const head = new T.Group();
    head.position.set(0, 0.28, 0.12);
    const headGeo = loftTube(T, [
      { p: [0, 0.01, -0.03], w: 0.082, up: 0.085, dn: 0.072, e: 0.90 },
      { p: [0, 0.02, 0.05], w: 0.076, up: 0.082, dn: 0.068, e: 0.88 },
      { p: [0, -0.015, 0.15], w: 0.048, up: 0.052, dn: 0.046, e: 0.88 },
      { p: [0, -0.038, 0.235], w: 0.036, up: 0.038, dn: 0.034, e: 0.92 }
    ], {
      sub: 3, seg: 16,
      color: (_r, _sa, _ca, u) => u > 0.78 ? [0.16, 0.14, 0.13] : [0.55, 0.32, 0.18]
    });
    head.add(new T.Mesh(headGeo, mats.furMat));

    // Lofted Dark Caprine Chin Beard
    const beardGeo = loftTube(T, [
      { p: [0, -0.055, 0.12], w: 0.028, up: 0.025, dn: 0.028 },
      { p: [0, -0.135, 0.14], w: 0.022, up: 0.020, dn: 0.022 },
      { p: [0, -0.195, 0.13], w: 0.006, up: 0.006, dn: 0.006 }
    ], { sub: 2, seg: 8, color: () => [0.15, 0.13, 0.12] });
    head.add(new T.Mesh(beardGeo, mats.furMat));

    // Sweeping Ridged Scimitar Horns (continuous lofted horn with baked transverse growth annuli!)
    const hornLen = isBuck ? 0.92 : 0.44;
    const hornR = isBuck ? 0.054 : 0.030;
    for (const sx of [-1, 1]) {
      const hRings = [];
      for (let s = 0; s <= 16; s++) {
        const f = s / 16;
        const a = f * (isBuck ? 2.12 : 1.18);
        const rad = lerp(hornR, hornR * 0.18, Math.pow(f, 0.82));
        hRings.push({
          p: [
            sx * (0.042 + f * (isBuck ? 0.165 : 0.08)),
            0.068 + Math.sin(a) * hornLen * 0.62,
            0.025 + (Math.cos(a) - 1) * hornLen * 0.54
          ],
          w: rad * 0.88, up: rad * 1.12, dn: rad * 0.92, e: 0.84
        });
      }
      const hornGeo = loftTube(T, hRings, {
        sub: 2, seg: 12,
        disp: (_r, _sa, ca, u) => {
          // Transverse growth ridges along anterior/dorsal keel of scimitar horn!
          const ridge = isBuck && u < 0.88 ? Math.pow(Math.max(0, Math.sin(u * 68.0)), 2.0) * (0.18 * Math.max(0.2, ca + 0.5)) : 0;
          return 1.0 + ridge;
        },
        color: (_r, _sa, _ca, u) => {
          const groove = Math.sin(u * 68.0) > 0.3 ? 1.12 : 0.86;
          return [0.24 * groove, 0.21 * groove, 0.18 * groove];
        }
      });
      const hm = new T.Mesh(hornGeo, mats.hornKeratinMat);
      hm.castShadow = true;
      head.add(hm);

      const earGeo = loftTube(T, [
        { p: [sx * 0.065, 0.035, -0.01], w: 0.020, up: 0.016, dn: 0.016 },
        { p: [sx * 0.135, 0.062, -0.03], w: 0.024, up: 0.014, dn: 0.014 },
        { p: [sx * 0.175, 0.075, -0.04], w: 0.006, up: 0.005, dn: 0.005 }
      ], { sub: 2, seg: 8, color: () => [0.50, 0.29, 0.16] });
      head.add(new T.Mesh(earGeo, mats.furMat));

      const eye = new T.Mesh(new T.SphereGeometry(0.013, 8, 6), mats.eyeCorneaMat);
      eye.position.set(sx * 0.064, 0.026, 0.068);
      head.add(eye);
    }
    neck.add(head);

    // 4 Muscular Lofted Legs with Diagnostic Black-and-White Capra walie Shin Bands!
    const waliaUpperCol = (_r, _sa, _ca, u) => [lerp(0.55, 0.44, u), lerp(0.32, 0.25, u), lerp(0.17, 0.14, u)];
    const waliaLowerCol = (_r, _sa, ca, u) => {
      if (u > 0.86) return [0.14, 0.13, 0.12]; // dark cloven hoof
      // Crisp white knee cap & fetlock with jet-black anterior stripe (`ca > 0.25` in limb local space)!
      const frontBlack = smooth(0.15, 0.45, ca) * (u > 0.18 && u < 0.78 ? 1 : 0);
      return [lerp(0.92, 0.13, frontBlack), lerp(0.90, 0.12, frontBlack), lerp(0.85, 0.12, frontBlack)];
    };
    const makeLeg = (lx, lz) => {
      const l = makeLoftedLimb(T, 0.38, 0.38, 0.088, 0.052, 0.048, 0.036, mats.furMat, waliaUpperCol, waliaLowerCol, false);
      l.hip.position.set(lx, 0, lz);
      bodyPivot.add(l.hip);
      return l;
    };
    const fl = makeLeg(0.145, 0.25);
    const fr = makeLeg(-0.145, 0.25);
    const hl = makeLeg(0.145, -0.27);
    const hr = makeLeg(-0.145, -0.27);

    root.scale.setScalar(scale * (isBuck ? 1.12 : 0.92));
    return { root, bodyPivot, neck, head, fl, fr, hl, hr };
  }

  // 4C. Ethiopian Wolf (`Canis simensis`) — Lofted Rufous-Red Canid Body, Crisp White Bib & Pointed Mole-Rat Snout
  function buildEthiopianWolfRig(T, mats, scale = 1.0) {
    const root = new T.Group();
    const bodyPivot = new T.Group();
    bodyPivot.position.y = 0.58;
    root.add(bodyPivot);

    const torsoGeo = loftTube(T, [
      { p: [0, 0.02, -0.32], w: 0.105, up: 0.115, dn: 0.105, e: 0.94 },
      { p: [0, 0.02, -0.12], w: 0.102, up: 0.118, dn: 0.095, e: 0.94 }, // lean tucked sighthound waist
      { p: [0, 0.01, 0.12], w: 0.128, up: 0.142, dn: 0.138, e: 0.92 },  // deep narrow chest
      { p: [0, 0.06, 0.28], w: 0.105, up: 0.115, dn: 0.108, e: 0.94 }
    ], {
      sub: 3, seg: 18,
      disp: (_r, _sa, _ca, u, a) => 1.0 + 0.04 * (fbm(a * 4, u * 7, 3) - 0.5),
      color: (_r, _sa, ca, u, px, _py, pz) => {
        const whiteBelly = smooth(-0.15, -0.58, ca);
        const m = 0.90 + 0.20 * fbm(px * 9, pz * 9, 3);
        return [
          lerp(0.76, 0.96, whiteBelly) * m,
          lerp(0.28, 0.94, whiteBelly) * m,
          lerp(0.12, 0.89, whiteBelly) * m
        ];
      }
    });
    const torso = new T.Mesh(torsoGeo, mats.furMat);
    torso.castShadow = torso.receiveShadow = true;
    bodyPivot.add(torso);

    const neck = new T.Group();
    neck.position.set(0, 0.06, 0.25);
    bodyPivot.add(neck);

    const neckGeo = loftTube(T, [
      { p: [0, -0.01, -0.02], w: 0.092, up: 0.098, dn: 0.095 },
      { p: [0, 0.11, 0.05], w: 0.076, up: 0.082, dn: 0.080 },
      { p: [0, 0.20, 0.11], w: 0.068, up: 0.072, dn: 0.068 }
    ], {
      sub: 2, seg: 14,
      color: (_r, _sa, ca) => {
        // Signature crisp white throat crescent bib (`ca < -0.15`)!
        const bib = smooth(-0.05, -0.45, ca);
        return [lerp(0.76, 0.96, bib), lerp(0.28, 0.94, bib), lerp(0.12, 0.90, bib)];
      }
    });
    neck.add(new T.Mesh(neckGeo, mats.furMat));

    const head = new T.Group();
    head.position.set(0, 0.20, 0.11);
    const headGeo = loftTube(T, [
      { p: [0, 0.01, -0.03], w: 0.078, up: 0.075, dn: 0.065, e: 0.92 },
      { p: [0, 0.01, 0.05], w: 0.066, up: 0.065, dn: 0.056, e: 0.92 },
      { p: [0, -0.01, 0.15], w: 0.034, up: 0.034, dn: 0.030, e: 0.92 }, // slender elongated mole-rat snout
      { p: [0, -0.015, 0.245], w: 0.018, up: 0.018, dn: 0.016, e: 0.95 }
    ], {
      sub: 3, seg: 16,
      color: (_r, _sa, ca, u) => {
        if (u > 0.88) return [0.10, 0.09, 0.09]; // jet-black nose leather
        const whiteCheek = smooth(-0.08, -0.45, ca);
        return [lerp(0.77, 0.96, whiteCheek), lerp(0.29, 0.94, whiteCheek), lerp(0.12, 0.90, whiteCheek)];
      }
    });
    head.add(new T.Mesh(headGeo, mats.furMat));

    for (const sx of [-1, 1]) {
      const earGeo = loftTube(T, [
        { p: [sx * 0.048, 0.055, -0.01], w: 0.028, up: 0.018, dn: 0.018 },
        { p: [sx * 0.062, 0.115, 0.00], w: 0.020, up: 0.012, dn: 0.012 },
        { p: [sx * 0.068, 0.165, 0.005], w: 0.004, up: 0.004, dn: 0.004 }
      ], {
        sub: 2, seg: 10,
        color: (_r, _sa, ca) => ca < -0.2 ? [0.95, 0.93, 0.89] : [0.75, 0.27, 0.11]
      });
      head.add(new T.Mesh(earGeo, mats.furMat));

      const eye = new T.Mesh(new T.SphereGeometry(0.011, 8, 6), mats.eyeCorneaMat);
      eye.position.set(sx * 0.042, 0.022, 0.072);
      head.add(eye);
    }
    neck.add(head);

    // Bushy Plumed Tail (Rufous base -> White mid -> Jet-Black tip!)
    const tailPivot = new T.Group();
    tailPivot.position.set(0, 0.04, -0.30);
    const tailGeo = loftTube(T, [
      { p: [0, 0, 0], w: 0.036, up: 0.036, dn: 0.036 },
      { p: [0, -0.06, -0.14], w: 0.056, up: 0.056, dn: 0.056 },
      { p: [0, -0.15, -0.28], w: 0.052, up: 0.052, dn: 0.052 },
      { p: [0, -0.23, -0.39], w: 0.014, up: 0.014, dn: 0.014 }
    ], {
      sub: 3, seg: 12,
      disp: (_r, _sa, _ca, u, a) => 1.0 + 0.12 * Math.sin(a * 9.0 + u * 6.0),
      color: (_r, _sa, _ca, u) => {
        if (u > 0.52) return [0.10, 0.09, 0.09]; // black tip
        if (u > 0.24) return [0.94, 0.92, 0.87]; // white mid-band
        return [0.74, 0.27, 0.12];
      }
    });
    tailPivot.add(new T.Mesh(tailGeo, mats.furMat));
    bodyPivot.add(tailPivot);

    const wolfUpCol = (_r, sa, _ca, u) => {
      const innerWhite = smooth(0.2, 0.8, -Math.abs(sa) + 0.5) * 0.25;
      return [lerp(0.76, 0.88, u * 0.5 + innerWhite), lerp(0.28, 0.65, u * 0.6 + innerWhite), lerp(0.12, 0.55, u * 0.6 + innerWhite)];
    };
    const wolfLowCol = (_r, _sa, _ca, u) => u > 0.88 ? [0.14, 0.13, 0.12] : [0.94, 0.91, 0.86];
    const fl = makeLoftedLimb(T, 0.29, 0.28, 0.058, 0.036, 0.034, 0.024, mats.furMat, wolfUpCol, wolfLowCol, false);
    const fr = makeLoftedLimb(T, 0.29, 0.28, 0.058, 0.036, 0.034, 0.024, mats.furMat, wolfUpCol, wolfLowCol, false);
    const hl = makeLoftedLimb(T, 0.30, 0.28, 0.066, 0.038, 0.036, 0.025, mats.furMat, wolfUpCol, wolfLowCol, false);
    const hr = makeLoftedLimb(T, 0.30, 0.28, 0.066, 0.038, 0.036, 0.025, mats.furMat, wolfUpCol, wolfLowCol, false);
    fl.hip.position.set(0.074, -0.01, 0.20);
    fr.hip.position.set(-0.074, -0.01, 0.20);
    hl.hip.position.set(0.078, -0.01, -0.22);
    hr.hip.position.set(-0.078, -0.01, -0.22);
    bodyPivot.add(fl.hip, fr.hip, hl.hip, hr.hip);

    root.scale.setScalar(scale);
    return { root, bodyPivot, neck, head, tailPivot, fl, fr, hl, hr };
  }

  // 4D. Mountain Nyala (`Tragelaphus buxtoni`) — Lofted Striped/Spotted Antelope Body & Spiral Lyre Horns
  function buildMountainNyalaRig(T, mats, isBull, scale = 1.0) {
    const root = new T.Group();
    const bodyPivot = new T.Group();
    bodyPivot.position.y = 1.02;
    root.add(bodyPivot);

    const torsoGeo = loftTube(T, [
      { p: [0, 0.02, -0.44], w: 0.19, up: 0.20, dn: 0.18, e: 0.92 },
      { p: [0, 0.02, -0.14], w: 0.22, up: 0.23, dn: 0.21, e: 0.94 },
      { p: [0, 0.05, 0.18], w: 0.245, up: 0.28, dn: 0.24, e: 0.92 }, // noble tragelaphine shoulder hump
      { p: [0, 0.11, 0.40], w: 0.175, up: 0.20, dn: 0.17, e: 0.94 }
    ], {
      sub: 3, seg: 20,
      disp: (_r, _sa, ca, _u) => 1.0 + (ca > 0.85 ? 0.08 : 0), // dorsal crest ridge
      color: (_r, _sa, ca, u, px, py, pz) => {
        // Baked vertical cream flank stripes & haunch spots directly in vertex colors!
        const stripeBand = u > 0.28 && u < 0.72 && Math.abs(ca) < 0.65
          ? Math.pow(Math.max(0, Math.sin(pz * 36.0)), 8.0) * 0.65
          : 0;
        const crestWhite = ca > 0.90 ? 0.55 : 0;
        const whiteMix = Math.min(1, stripeBand + crestWhite + smooth(-0.35, -0.75, ca) * 0.45);
        const m = 0.88 + 0.22 * fbm(px * 7, py * 7 + pz * 7, 3);
        return [
          lerp(0.45, 0.92, whiteMix) * m,
          lerp(0.36, 0.90, whiteMix) * m,
          lerp(0.29, 0.84, whiteMix) * m
        ];
      }
    });
    const torso = new T.Mesh(torsoGeo, mats.furMat);
    torso.castShadow = torso.receiveShadow = true;
    bodyPivot.add(torso);

    const neck = new T.Group();
    neck.position.set(0, 0.14, 0.36);
    bodyPivot.add(neck);

    const neckGeo = loftTube(T, [
      { p: [0, -0.02, -0.02], w: 0.145, up: 0.16, dn: 0.15 },
      { p: [0, 0.20, 0.08], w: 0.115, up: 0.13, dn: 0.12 },
      { p: [0, 0.38, 0.16], w: 0.092, up: 0.10, dn: 0.095 }
    ], {
      sub: 2, seg: 14,
      color: (_r, _sa, ca, u) => {
        const gorget = Math.exp(-Math.pow((u - 0.55) / 0.14, 2)) * smooth(-0.35, -0.75, ca);
        return [lerp(0.43, 0.93, gorget), lerp(0.34, 0.91, gorget), lerp(0.28, 0.86, gorget)];
      }
    });
    neck.add(new T.Mesh(neckGeo, mats.furMat));

    const head = new T.Group();
    head.position.set(0, 0.38, 0.16);
    const headGeo = loftTube(T, [
      { p: [0, 0.01, -0.03], w: 0.088, up: 0.088, dn: 0.076 },
      { p: [0, 0.01, 0.06], w: 0.080, up: 0.082, dn: 0.070 },
      { p: [0, -0.015, 0.17], w: 0.050, up: 0.052, dn: 0.046 },
      { p: [0, -0.032, 0.26], w: 0.036, up: 0.038, dn: 0.034 }
    ], {
      sub: 3, seg: 16,
      color: (_r, _sa, ca, u) => {
        if (u > 0.82) return [0.16, 0.14, 0.13];
        // White inter-orbital chevron at u ~ 0.48, ca > 0.4!
        const chev = Math.exp(-Math.pow((u - 0.50) / 0.08, 2)) * smooth(0.35, 0.75, ca);
        return [lerp(0.44, 0.94, chev), lerp(0.35, 0.92, chev), lerp(0.28, 0.87, chev)];
      }
    });
    head.add(new T.Mesh(headGeo, mats.furMat));

    for (const sx of [-1, 1]) {
      // Large radar-like tragelaphine ears
      const earGeo = loftTube(T, [
        { p: [sx * 0.072, 0.04, -0.01], w: 0.025, up: 0.022, dn: 0.022 },
        { p: [sx * 0.165, 0.095, -0.03], w: 0.045, up: 0.022, dn: 0.022 },
        { p: [sx * 0.225, 0.125, -0.04], w: 0.008, up: 0.006, dn: 0.006 }
      ], { sub: 2, seg: 10, color: (_r, _sa, ca) => ca < -0.2 ? [0.90, 0.87, 0.82] : [0.44, 0.35, 0.28] });
      head.add(new T.Mesh(earGeo, mats.furMat));

      const eye = new T.Mesh(new T.SphereGeometry(0.014, 8, 6), mats.eyeCorneaMat);
      eye.position.set(sx * 0.068, 0.025, 0.078);
      head.add(eye);

      if (isBull) {
        const hRings = [];
        for (let s = 0; s <= 16; s++) {
          const f = s / 16;
          const twist = f * TAU * 1.15;
          const rad = lerp(0.036, 0.006, f);
          hRings.push({
            p: [
              sx * (0.052 + 0.19 * Math.sin(f * Math.PI * 0.85) + 0.042 * Math.cos(twist)),
              0.07 + f * 0.78 + 0.03 * Math.sin(twist),
              -0.01 - f * 0.44 + 0.042 * Math.sin(twist)
            ],
            w: rad, up: rad * 1.15, dn: rad
          });
        }
        const hornGeo = loftTube(T, hRings, {
          sub: 2, seg: 10,
          color: (_r, _sa, _ca, u) => u > 0.84 ? [0.92, 0.89, 0.80] : [0.22, 0.19, 0.17] // ivory horn tips!
        });
        const hm = new T.Mesh(hornGeo, mats.hornKeratinMat);
        hm.castShadow = true;
        head.add(hm);
      }
    }
    neck.add(head);

    const tailGeo = loftTube(T, [
      { p: [0, 0.02, -0.44], w: 0.032, up: 0.032, dn: 0.032 },
      { p: [0, -0.14, -0.50], w: 0.042, up: 0.042, dn: 0.042 },
      { p: [0, -0.28, -0.52], w: 0.010, up: 0.010, dn: 0.010 }
    ], { sub: 2, seg: 8, color: (_r, _sa, ca) => ca < 0 ? [0.92, 0.90, 0.85] : [0.42, 0.33, 0.27] });
    bodyPivot.add(new T.Mesh(tailGeo, mats.furMat));

    const nyUpCol = (_r, _sa, _ca, u) => [lerp(0.45, 0.55, u), lerp(0.36, 0.46, u), lerp(0.29, 0.38, u)];
    const nyLowCol = (_r, _sa, _ca, u) => u > 0.88 ? [0.15, 0.14, 0.13] : [0.88, 0.84, 0.76];
    const fl = makeLoftedLimb(T, 0.48, 0.48, 0.088, 0.052, 0.048, 0.036, mats.furMat, nyUpCol, nyLowCol, false);
    const fr = makeLoftedLimb(T, 0.48, 0.48, 0.088, 0.052, 0.048, 0.036, mats.furMat, nyUpCol, nyLowCol, false);
    const hl = makeLoftedLimb(T, 0.50, 0.48, 0.098, 0.055, 0.050, 0.038, mats.furMat, nyUpCol, nyLowCol, false);
    const hr = makeLoftedLimb(T, 0.50, 0.48, 0.098, 0.055, 0.050, 0.038, mats.furMat, nyUpCol, nyLowCol, false);
    fl.hip.position.set(0.118, -0.02, 0.30);
    fr.hip.position.set(-0.118, -0.02, 0.30);
    hl.hip.position.set(0.125, -0.02, -0.33);
    hr.hip.position.set(-0.125, -0.02, -0.33);
    bodyPivot.add(fl.hip, fr.hip, hl.hip, hr.hip);

    root.scale.setScalar(scale * (isBull ? 1.12 : 0.94));
    return { root, bodyPivot, neck, head, fl, fr, hl, hr };
  }

  /* ---------- 5. Autonomous SILAS Perception & Steering Wildlife Engine ---------- */
  function makeFracturedBasaltBoulder(T, rx, ry, rz, seed) {
    const geo = new T.IcosahedronGeometry(1.0, 2);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // Flatten top ledge & carve craggy basalt fracture planes
      if (y > 0.32) y = 0.32 + (y - 0.32) * 0.30;
      const crag = 0.78 + 0.44 * fbm(x * 2.4 + seed, z * 2.4 - seed + y * 1.8, 4);
      x *= rx * crag;
      y *= ry * crag;
      z *= rz * crag;
      p.setXYZ(i, x, y, z);

      // Ochre/sage alpine lichen on upper flat ledge + dark weathered flood-basalt sides
      const topLichen = smooth(0.12, 0.34, y / Math.max(0.1, ry)) * smooth(0.45, 0.78, fbm(x * 3.5, z * 3.5, 3));
      const shade = 0.24 + 0.14 * fbm(x * 5, y * 5, 2);
      col[i * 3] = lerp(shade, 0.48, topLichen);
      col[i * 3 + 1] = lerp(shade * 1.03, 0.50, topLichen);
      col[i * 3 + 2] = lerp(shade * 1.08, 0.32, topLichen);
    }
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return geo;
  }

  function buildSilasWildlife(T, terrain, rng, landmarks) {
    const group = new T.Group();
    group.name = "EthiopiaEndemicWildlife";
    const mats = createWildlifeMaterials(T);
    const agents = [];

    const minX = terrain.minX + 14, maxX = terrain.maxX - 14;
    const minZ = terrain.minZ + 14, maxZ = terrain.maxZ - 14;
    const waterY = terrain.waterY !== undefined ? terrain.waterY : -9999;

    const findHabitatCenter = (hintPos, targetSlopeMin, targetSlopeMax, preferHigh) => {
      if (hintPos) {
        const y = terrain.sampleHeight(hintPos.x, hintPos.z);
        if (y > waterY + 2.0) return { x: hintPos.x, z: hintPos.z };
      }
      let best = { x: 0, z: 0, score: -1e9 };
      for (let i = 0; i < 160; i++) {
        const x = lerp(minX, maxX, rng());
        const z = lerp(minZ, maxZ, rng());
        const y = terrain.sampleHeight(x, z);
        if (y <= waterY + 3.0) continue;
        const sl = terrain.sampleSlope(x, z);
        if (sl < targetSlopeMin || sl > targetSlopeMax) continue;
        const sc = (preferHigh ? y * 1.5 : -Math.abs(y - (terrain.midY || y))) - 0.15 * Math.hypot(x, z);
        if (sc > best.score) best = { x, z, score: sc };
      }
      return { x: best.x, z: best.z };
    };

    const regId = String(terrain.regionId || "simien_imet_gogo").toLowerCase();
    const isSimien = regId.indexOf("simien") >= 0;

    // 1. Gelada Troop (`12` individuals) — placed 11–16m AHEAD on the Simien promontory meadow!
    const geladaLookoutPatch = isSimien
      ? { x: 2.5, z: -446.5 }
      : findHabitatCenter({ x: landmarks.primaryLookout.x - 14, z: landmarks.primaryLookout.z - 16 }, 0.0, 0.52, true);
    const geladaMeadowHome = findHabitatCenter(landmarks.geladaMeadow || geladaLookoutPatch, 0.0, 0.52, true);

    for (let i = 0; i < 12; i++) {
      const home = i < 6 ? geladaLookoutPatch : geladaMeadowHome;
      const isMale = i === 0 || i === 2 || i === 6;
      const isJuv = i === 5 || i === 11;
      const sc = isJuv ? 0.68 : 1.0;
      const rig = buildGeladaRig(T, mats, isMale, sc);
      const ang = (i / 6) * TAU + 0.35;
      const rad = i === 0 ? 0.4 : (1.8 + (i % 5) * 0.9);
      let ax = clamp(home.x + Math.cos(ang) * rad, minX, maxX);
      let az = clamp(home.z + Math.sin(ang) * rad, minZ, maxZ);
      if (isSimien && i < 6) {
        ax = clamp(ax, -2.5, 8.5);
        az = clamp(az, -449.0, -443.5);
      }
      const ay = terrain.sampleHeight(ax, az);
      rig.root.position.set(ax, ay, az);
      group.add(rig.root);
      agents.push({
        species: "gelada",
        label: isMale ? "Gelada (Harem Male)" : (isJuv ? "Gelada (Juvenile)" : "Gelada"),
        rig,
        x: ax, y: ay, z: az,
        homeX: home.x, homeZ: home.z, homeRadius: 6.5,
        heading: i === 0 ? 0.35 : (0.35 + (rng() - 0.5) * 1.1),
        speed: 0,
        state: i % 4 === 1 ? "quad_walk" : "forage_sit",
        stateTimer: i === 0 ? 14.0 : (4.0 + rng() * 6.0),
        phase: rng() * TAU,
        sitBlend: i % 4 === 1 ? 0 : 1,
        lookYaw: 0,
        minSlope: 0.0, maxSlope: 0.42
      });
    }

    // 2. Walia Ibex Herd (`6` individuals) — 27° sunlit rocky escarpment spur + Fractured Lichen-Basalt Outcrops!
    const ibexNearRim = isSimien
      ? { x: -24.0, z: -412.0 }
      : findHabitatCenter({ x: landmarks.primaryLookout.x - 18, z: landmarks.primaryLookout.z - 12 }, 0.30, 0.85, true);
    const ibexFarLedge = findHabitatCenter(landmarks.ibexLedge || ibexNearRim, 0.28, 0.95, true);

    for (const ledgeCenter of [ibexNearRim, ibexFarLedge]) {
      for (let b = 0; b < 8; b++) {
        const ba = (b / 8) * TAU + 0.3;
        const br = b === 0 ? 0.25 : (1.8 + rng() * 5.5);
        const bx = clamp(ledgeCenter.x + Math.cos(ba) * br, minX, maxX);
        const bz = clamp(ledgeCenter.z + Math.sin(ba) * br, minZ, maxZ);
        const by = terrain.sampleHeight(bx, bz);
        const bGeo = makeFracturedBasaltBoulder(T, 1.15 + rng() * 0.85, 0.65 + rng() * 0.45, 1.10 + rng() * 0.85, b * 3.7);
        const boulder = new T.Mesh(bGeo, mats.basaltCragMat);
        boulder.position.set(bx, by - 0.22, bz);
        boulder.rotation.y = rng() * TAU;
        boulder.castShadow = boulder.receiveShadow = true;
        group.add(boulder);
      }
    }

    for (let i = 0; i < 6; i++) {
      const home = i < 4 ? ibexNearRim : ibexFarLedge;
      const isBuck = i === 0 || i === 1 || i === 4;
      const rig = buildWaliaIbexRig(T, mats, isBuck, i === 5 ? 0.78 : 1.0);
      const ang = (i / 4) * TAU;
      const rad = i === 0 ? 0.3 : (2.0 + (i % 3) * 1.4);
      const ax = clamp(home.x + Math.cos(ang) * rad, minX, maxX);
      const az = clamp(home.z + Math.sin(ang) * rad, minZ, maxZ);
      const ay = terrain.sampleHeight(ax, az);
      rig.root.position.set(ax, ay, az);
      group.add(rig.root);
      agents.push({
        species: "walia_ibex",
        label: isBuck ? "Walia Ibex (Buck)" : "Walia Ibex",
        rig,
        x: ax, y: ay, z: az,
        homeX: home.x, homeZ: home.z, homeRadius: 8.5,
        heading: i === 0 ? 0.62 : (0.55 + (rng() - 0.5) * 1.1),
        speed: 0,
        state: i % 2 === 0 ? "sentinel_perch" : "ledge_bound",
        stateTimer: i === 0 ? 14.0 : (2.5 + rng() * 5.0),
        phase: rng() * TAU,
        boundArc: 0,
        lookYaw: 0,
        minSlope: 0.08, maxSlope: 0.95
      });
    }

    // 3. Ethiopian Wolf Pack (`3` individuals)
    const wolfHome = findHabitatCenter(
      landmarks.wolfMoorland || { x: landmarks.primaryLookout.x + 18, z: landmarks.primaryLookout.z + 15 },
      0.0, 0.42, true
    );
    for (let i = 0; i < 3; i++) {
      const rig = buildEthiopianWolfRig(T, mats, i === 0 ? 1.06 : 0.96);
      const ax = clamp(wolfHome.x + (i - 1) * 4.5, minX, maxX);
      const az = clamp(wolfHome.z + (rng() - 0.5) * 6.0, minZ, maxZ);
      const ay = terrain.sampleHeight(ax, az);
      rig.root.position.set(ax, ay, az);
      group.add(rig.root);
      agents.push({
        species: "ethiopian_wolf",
        label: "Ethiopian Wolf (Canis simensis)",
        rig,
        x: ax, y: ay, z: az,
        homeX: wolfHome.x, homeZ: wolfHome.z, homeRadius: 28.0,
        heading: rng() * TAU,
        speed: 1.8,
        state: i === 0 ? "mole_rat_stalk" : "trot_patrol",
        stateTimer: 3.0 + rng() * 5.0,
        phase: rng() * TAU,
        pounceArc: 0,
        lookYaw: 0,
        minSlope: 0.0, maxSlope: 0.45
      });
    }

    // 4. Mountain Nyala Herd (`4` individuals)
    const nyalaHome = findHabitatCenter(
      landmarks.nyalaBench || { x: landmarks.hamletPos.x - 18, z: landmarks.hamletPos.z + 14 },
      0.0, 0.36, false
    );
    for (let i = 0; i < 4; i++) {
      const isBull = i === 0;
      const rig = buildMountainNyalaRig(T, mats, isBull, i === 3 ? 0.76 : 1.0);
      const ang = (i / 4) * TAU;
      const ax = clamp(nyalaHome.x + Math.cos(ang) * 5.5, minX, maxX);
      const az = clamp(nyalaHome.z + Math.sin(ang) * 5.5, minZ, maxZ);
      const ay = terrain.sampleHeight(ax, az);
      rig.root.position.set(ax, ay, az);
      group.add(rig.root);
      agents.push({
        species: "mountain_nyala",
        label: isBull ? "Mountain Nyala (Bull)" : "Mountain Nyala",
        rig,
        x: ax, y: ay, z: az,
        homeX: nyalaHome.x, homeZ: nyalaHome.z, homeRadius: 22.0,
        heading: rng() * TAU,
        speed: 0.9,
        state: i % 2 === 0 ? "woodland_browse" : "measured_walk",
        stateTimer: 3.5 + rng() * 5.5,
        phase: rng() * TAU,
        lookYaw: 0,
        minSlope: 0.0, maxSlope: 0.42
      });
    }

    const nrmTmp = new T.Vector3(0, 1, 0);
    const upAxis = new T.Vector3(0, 1, 0);
    const qTilt = new T.Quaternion();
    const qYaw = new T.Quaternion();

    function stepQuadLegs(fl, fr, hl, hr, gaitPhase, amp) {
      const s1 = Math.sin(gaitPhase) * amp;
      const s2 = Math.sin(gaitPhase + Math.PI) * amp;
      fl.hip.rotation.x = s1;
      hr.hip.rotation.x = s1;
      fr.hip.rotation.x = s2;
      hl.hip.rotation.x = s2;
      fl.knee.rotation.x = Math.max(0, -s1) * 0.85;
      hr.knee.rotation.x = -Math.max(0, s1) * 0.75;
      fr.knee.rotation.x = Math.max(0, -s2) * 0.85;
      hl.knee.rotation.x = -Math.max(0, s2) * 0.75;
    }

    function update(dt, nowSec, visitorPos, donkeyPos) {
      const cDt = clamp(dt, 0.001, 0.05);

      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        a.stateTimer -= cDt;

        let nearDist = 999, nearX = a.x, nearZ = a.z;
        if (visitorPos) {
          const d = Math.hypot(visitorPos.x - a.x, visitorPos.z - a.z);
          if (d < nearDist) { nearDist = d; nearX = visitorPos.x; nearZ = visitorPos.z; }
        }
        if (donkeyPos) {
          const d = Math.hypot(donkeyPos.x - a.x, donkeyPos.z - a.z);
          if (d < nearDist) { nearDist = d; nearX = donkeyPos.x; nearZ = donkeyPos.z; }
        }

        let sepX = 0, sepZ = 0;
        for (let j = 0; j < agents.length; j++) {
          if (i === j || agents[j].species !== a.species) continue;
          const dx = a.x - agents[j].x, dz = a.z - agents[j].z;
          const d2 = dx * dx + dz * dz;
          if (d2 > 0.001 && d2 < 4.8) {
            const inv = 1.0 / Math.sqrt(d2);
            sepX += dx * inv * 0.8;
            sepZ += dz * inv * 0.8;
          }
        }

        const dxHome = a.homeX - a.x, dzHome = a.homeZ - a.z;
        const distHome = Math.hypot(dxHome, dzHome);
        let desiredHeading = a.heading;
        let targetSpeed = 0;

        if (a.species === "gelada") {
          if (nearDist < 1.8) {
            a.state = "quad_walk";
            a.stateTimer = 1.6;
            desiredHeading = Math.atan2(a.x - nearX, a.z - nearZ);
            targetSpeed = 1.9;
          } else if (nearDist < 13.5) {
            desiredHeading = Math.atan2(nearX - a.x, nearZ - a.z);
            if (a.stateTimer <= 0) {
              a.state = "watch_visitor";
              a.stateTimer = 2.5 + (i % 3);
            }
          } else if (a.stateTimer <= 0) {
            const r = ((Math.sin(nowSec * 1.7 + i * 3.1) * 43758.54) % 1 + 1) % 1;
            a.state = r < 0.65 ? "forage_sit" : "quad_walk";
            a.stateTimer = 3.2 + r * 5.5;
            desiredHeading = a.heading + (r - 0.5) * 2.2;
          }

          if (a.state === "quad_walk") {
            targetSpeed = 1.25;
            a.sitBlend = lerp(a.sitBlend, 0, cDt * 5.0);
          } else {
            targetSpeed = a.state === "forage_sit" ? 0.12 : 0.0;
            a.sitBlend = lerp(a.sitBlend, 1, cDt * 5.0);
          }

          const targetYaw = nearDist < 14.5
            ? clamp(wrapAngle(Math.atan2(nearX - a.x, nearZ - a.z) - a.heading), -1.05, 1.05)
            : Math.sin(nowSec * 0.9 + a.phase) * 0.28;
          a.lookYaw = lerp(a.lookYaw, targetYaw, cDt * 4.5);

          const R = a.rig;
          const sit = a.sitBlend;
          R.bodyPivot.position.y = lerp(0.45, 0.20, sit);
          R.bodyPivot.rotation.x = lerp(0.0, -1.16, sit);
          R.legL.hip.position.y = lerp(0.43, 0.16, sit);
          R.legR.hip.position.y = lerp(0.43, 0.16, sit);
          R.legL.hip.position.z = lerp(-0.15, -0.02, sit);
          R.legR.hip.position.z = lerp(-0.15, -0.02, sit);
          R.neck.rotation.x = lerp(0.05, 1.04, sit);
          R.neck.rotation.y = a.lookYaw;
          R.jaw.rotation.x = sit > 0.4 ? Math.abs(Math.sin(nowSec * 6.8 + a.phase)) * 0.20 : 0.03;
          R.tailPivot.rotation.y = Math.sin(nowSec * 2.1 + a.phase) * 0.22;

          if (sit > 0.5) {
            const pluckL = Math.max(0, Math.sin(nowSec * 3.0 + a.phase));
            const pluckR = Math.max(0, Math.sin(nowSec * 3.0 + a.phase + Math.PI));
            R.armL.hip.rotation.set(0.92 - pluckL * 0.28, 0, -0.18);
            R.armL.knee.rotation.x = -0.32 - pluckL * 1.05;
            R.armR.hip.rotation.set(0.92 - pluckR * 0.28, 0, 0.18);
            R.armR.knee.rotation.x = -0.32 - pluckR * 1.05;
            R.legL.hip.rotation.set(-2.05, 0, -0.26);
            R.legL.knee.rotation.x = 2.05;
            R.legR.hip.rotation.set(-2.05, 0, 0.26);
            R.legR.knee.rotation.x = 2.05;
          } else {
            R.armL.hip.rotation.z = R.armR.hip.rotation.z = 0;
            R.legL.hip.rotation.z = R.legR.hip.rotation.z = 0;
            stepQuadLegs(R.armL, R.armR, R.legL, R.legR, nowSec * 6.5 + a.phase, 0.48);
          }
        } else if (a.species === "walia_ibex") {
          if (a.stateTimer <= 0) {
            const nextBound = a.state !== "ledge_bound";
            a.state = nextBound ? "ledge_bound" : "sentinel_perch";
            a.stateTimer = nextBound ? 2.4 + (i % 3) * 0.7 : 3.8 + (i % 2) * 2.0;
            desiredHeading = a.heading + Math.sin(nowSec + i * 2.1) * 1.4;
          }
          targetSpeed = a.state === "ledge_bound" ? 3.1 : 0.0;
          const R = a.rig;
          if (a.state === "ledge_bound") {
            const bPh = (nowSec * 3.6 + a.phase) % TAU;
            const hop = Math.max(0, Math.sin(bPh));
            a.boundArc = hop * 0.42;
            R.bodyPivot.rotation.x = -Math.cos(bPh) * 0.24;
            R.fl.hip.rotation.x = -0.55 * hop;
            R.fr.hip.rotation.x = -0.45 * hop;
            R.hl.hip.rotation.x = 0.65 * hop;
            R.hr.hip.rotation.x = 0.58 * hop;
            R.neck.rotation.x = 0.12;
          } else {
            a.boundArc = lerp(a.boundArc, 0, cDt * 8);
            R.bodyPivot.rotation.x = lerp(R.bodyPivot.rotation.x, -0.06, cDt * 5);
            stepQuadLegs(R.fl, R.fr, R.hl, R.hr, 0, 0);
            R.neck.rotation.x = -0.08 + 0.05 * Math.sin(nowSec * 1.1 + a.phase);
          }
          const targetYaw = nearDist < 18 ? clamp(wrapAngle(Math.atan2(nearX - a.x, nearZ - a.z) - a.heading), -0.9, 0.9) : Math.sin(nowSec * 0.7 + a.phase) * 0.35;
          a.lookYaw = lerp(a.lookYaw, targetYaw, cDt * 4.0);
          R.head.rotation.y = a.lookYaw;
        } else if (a.species === "ethiopian_wolf") {
          if (a.stateTimer <= 0) {
            a.state = a.state === "trot_patrol" ? "mole_rat_stalk" : "trot_patrol";
            a.stateTimer = a.state === "mole_rat_stalk" ? 3.6 : 4.8;
            desiredHeading = a.heading + Math.cos(nowSec * 1.3 + i) * 1.25;
          }
          const R = a.rig;
          if (a.state === "mole_rat_stalk") {
            const pounceWindow = a.stateTimer < 0.75;
            targetSpeed = pounceWindow ? 3.4 : 0.48;
            const pArc = pounceWindow ? Math.sin(((0.75 - a.stateTimer) / 0.75) * Math.PI) : 0;
            a.pounceArc = pArc * 0.48;
            R.bodyPivot.position.y = 0.50 + a.pounceArc;
            R.neck.rotation.x = pounceWindow ? 0.35 : 0.52;
            stepQuadLegs(R.fl, R.fr, R.hl, R.hr, nowSec * 3.8 + a.phase, 0.28);
          } else {
            a.pounceArc = 0;
            targetSpeed = 2.45;
            R.bodyPivot.position.y = 0.58 + Math.abs(Math.sin(nowSec * 8.2 + a.phase)) * 0.04;
            R.neck.rotation.x = 0.08;
            stepQuadLegs(R.fl, R.fr, R.hl, R.hr, nowSec * 8.2 + a.phase, 0.56);
          }
          R.tailPivot.rotation.y = Math.sin(nowSec * 3.4 + a.phase) * 0.28;
          const targetYaw = nearDist < 16 ? clamp(wrapAngle(Math.atan2(nearX - a.x, nearZ - a.z) - a.heading), -0.85, 0.85) : 0;
          a.lookYaw = lerp(a.lookYaw, targetYaw, cDt * 4.2);
          R.head.rotation.y = a.lookYaw;
        } else {
          if (nearDist < 12.0) {
            a.state = "freeze_listen";
            targetSpeed = 0;
          } else if (a.stateTimer <= 0) {
            a.state = a.state === "woodland_browse" ? "measured_walk" : "woodland_browse";
            a.stateTimer = 4.0 + (i % 3) * 1.8;
            desiredHeading = a.heading + Math.sin(nowSec + i) * 1.1;
          }
          const R = a.rig;
          if (a.state === "measured_walk") {
            targetSpeed = 1.35;
            stepQuadLegs(R.fl, R.fr, R.hl, R.hr, nowSec * 4.8 + a.phase, 0.42);
            R.neck.rotation.x = 0.06;
          } else {
            targetSpeed = 0;
            stepQuadLegs(R.fl, R.fr, R.hl, R.hr, 0, 0);
            R.neck.rotation.x = a.state === "woodland_browse"
              ? -0.22 + 0.14 * Math.sin(nowSec * 1.8 + a.phase)
              : -0.05;
          }
          const targetYaw = nearDist < 18 ? clamp(wrapAngle(Math.atan2(nearX - a.x, nearZ - a.z) - a.heading), -0.95, 0.95) : Math.sin(nowSec * 0.6 + a.phase) * 0.25;
          a.lookYaw = lerp(a.lookYaw, targetYaw, cDt * 3.6);
          R.head.rotation.y = a.lookYaw;
        }

        if (distHome > a.homeRadius) {
          desiredHeading = Math.atan2(dxHome, dzHome);
          targetSpeed = Math.max(targetSpeed, 1.4);
        }
        if (Math.hypot(sepX, sepZ) > 0.05 && targetSpeed > 0.05) {
          desiredHeading = wrapAngle(desiredHeading + 0.35 * wrapAngle(Math.atan2(sepX, sepZ) - desiredHeading));
        }

        a.heading = wrapAngle(a.heading + clamp(wrapAngle(desiredHeading - a.heading), -2.6 * cDt, 2.6 * cDt));
        a.speed = lerp(a.speed, targetSpeed, cDt * 4.5);

        if (a.speed > 0.02) {
          const nx = clamp(a.x + Math.sin(a.heading) * a.speed * cDt, minX, maxX);
          const nz = clamp(a.z + Math.cos(a.heading) * a.speed * cDt, minZ, maxZ);
          const ny = terrain.sampleHeight(nx, nz);
          const nSlope = terrain.sampleSlope(nx, nz);
          if (ny > waterY + 1.5 && nSlope <= a.maxSlope) {
            a.x = nx;
            a.z = nz;
          } else {
            a.heading = Math.atan2(a.homeX - a.x, a.homeZ - a.z);
          }
        }

        a.y = terrain.sampleHeight(a.x, a.z);
        a.rig.root.position.set(a.x, a.y + (a.boundArc || 0), a.z);

        terrain.sampleNormal(a.x, a.z, nrmTmp);
        nrmTmp.lerp(upAxis, 0.55).normalize();
        qTilt.setFromUnitVectors(upAxis, nrmTmp);
        qYaw.setFromAxisAngle(upAxis, a.heading);
        a.rig.root.quaternion.copy(qTilt).multiply(qYaw);
      }
    }

    function getTelemetry(refPos) {
      const counts = { gelada: 0, walia_ibex: 0, ethiopian_wolf: 0, mountain_nyala: 0 };
      let nearest = null, nearestDist = Infinity;
      for (const a of agents) {
        counts[a.species] = (counts[a.species] || 0) + 1;
        if (refPos) {
          const d = Math.hypot(a.x - refPos.x, a.z - refPos.z);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = { species: a.species, label: a.label, state: a.state, distM: +d.toFixed(1), x: a.x, y: a.y, z: a.z };
          }
        }
      }
      return {
        totalAgents: agents.length,
        counts,
        nearest,
        geladaMeadow: { x: geladaMeadowHome.x, z: geladaMeadowHome.z },
        ibexLedge: { x: ibexNearRim.x, z: ibexNearRim.z },
        wolfMoorland: { x: wolfHome.x, z: wolfHome.z },
        nyalaBench: { x: nyalaHome.x, z: nyalaHome.z }
      };
    }

    return {
      group, agents, update, getTelemetry,
      dispose() {
        mats.dispose();
        group.traverse(obj => { if (obj.isMesh && obj.geometry) obj.geometry.dispose(); });
      }
    };
  }

  /* ---------- 6. Landmark Auto-Resolver & Top-Level Region Builder ---------- */
  function resolveRegionLandmarks(T, terrain, rng) {
    const lm = terrain.landmarks || {};
    const minX = terrain.minX + 26, maxX = terrain.maxX - 26;
    const minZ = terrain.minZ + 26, maxZ = terrain.maxZ - 26;
    const waterY = terrain.waterY !== undefined ? terrain.waterY : -9999;

    const toVec3 = pt => {
      if (!pt) return null;
      const x = Array.isArray(pt) ? pt[0] : pt.x;
      const z = Array.isArray(pt) ? (pt.length > 2 ? pt[2] : pt[1]) : pt.z;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
      const cx = clamp(x, minX, maxX);
      const cz = clamp(z, minZ, maxZ);
      return new T.Vector3(cx, terrain.sampleHeight(cx, cz), cz);
    };

    const scanBench = (preferHigh, maxSlope, minDistFrom) => {
      let best = null, bestScore = -1e9;
      for (let i = 0; i < 240; i++) {
        const x = lerp(minX, maxX, rng());
        const z = lerp(minZ, maxZ, rng());
        const y = terrain.sampleHeight(x, z);
        if (y <= waterY + 4.0) continue;
        const sl = terrain.sampleSlope(x, z);
        if (sl > maxSlope) continue;
        if (minDistFrom && Math.hypot(x - minDistFrom.x, z - minDistFrom.z) < 24) continue;
        const drop = Math.max(
          y - terrain.sampleHeight(clamp(x + 36, minX, maxX), z),
          y - terrain.sampleHeight(clamp(x - 36, minX, maxX), z),
          y - terrain.sampleHeight(x, clamp(z + 36, minZ, maxZ)),
          y - terrain.sampleHeight(x, clamp(z - 36, minZ, maxZ))
        );
        const score = (preferHigh ? y * 1.4 : y * 0.45) + drop * 2.2 - sl * 28.0 - 0.08 * Math.hypot(x, z);
        if (score > bestScore) { bestScore = score; best = new T.Vector3(x, y, z); }
      }
      return best || new T.Vector3(0, terrain.sampleHeight(0, 0), 0);
    };

    const primaryLookout = toVec3(lm.imetGogoLookout || lm.gerdSaddleOverlook || lm.gliderLaunchPoint || lm.abayRiverTerrace)
      || scanBench(true, 0.34, null);
    const churchPos = toVec3(lm.monolithCourtPad || lm.churchCliffLedge) || scanBench(false, 0.28, primaryLookout);
    const cliffSanctuaryPos = lm.monolithCourtPad && lm.churchCliffLedge ? toVec3(lm.churchCliffLedge) : null;

    let relayPos = toVec3(lm.standpipeRelay || lm.relayStation);
    if (!relayPos) {
      let bestR = null, bestDiff = 1e9;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * TAU;
        const rx = clamp(churchPos.x + Math.cos(ang) * 16.5, minX, maxX);
        const rz = clamp(churchPos.z + Math.sin(ang) * 16.5, minZ, maxZ);
        const ry = terrain.sampleHeight(rx, rz);
        const diff = Math.abs(ry - churchPos.y) + terrain.sampleSlope(rx, rz) * 25;
        if (ry > waterY + 3.0 && diff < bestDiff) { bestDiff = diff; bestR = new T.Vector3(rx, ry, rz); }
      }
      relayPos = bestR || new T.Vector3(churchPos.x + 15, terrain.sampleHeight(churchPos.x + 15, churchPos.z), churchPos.z);
    }

    let hamletPos = toVec3(lm.hamletPos);
    if (!hamletPos) {
      const hx = clamp(relayPos.x + 22, minX, maxX);
      const hz = clamp(relayPos.z + 16, minZ, maxZ);
      hamletPos = new T.Vector3(hx, terrain.sampleHeight(hx, hz), hz);
    }

    const churchHeading = (lm.churchCliffLedge && typeof lm.churchCliffLedge.yaw === "number")
      ? lm.churchCliffLedge.yaw
      : Math.atan2(relayPos.x - churchPos.x, relayPos.z - churchPos.z);

    const trailWaypoints = Array.isArray(lm.carrierTrailWaypoints)
      ? lm.carrierTrailWaypoints.map(toVec3).filter(Boolean)
      : [];

    return {
      primaryLookout,
      churchPos,
      churchHeading,
      cliffSanctuaryPos,
      cliffSanctuaryHeading: (lm.churchCliffLedge && lm.churchCliffLedge.yaw) || 0.12,
      relayPos,
      hamletPos,
      hamletHeading: churchHeading + 0.6,
      trailWaypoints,
      geladaMeadow: toVec3(lm.geladaMeadow) || new T.Vector3(
        clamp(primaryLookout.x + 12, minX, maxX),
        terrain.sampleHeight(clamp(primaryLookout.x + 12, minX, maxX), clamp(primaryLookout.z - 9, minZ, maxZ)),
        clamp(primaryLookout.z - 9, minZ, maxZ)
      ),
      ibexLedge: toVec3(lm.waliaIbexLedge || lm.ibexLedge) || null,
      wolfMoorland: toVec3(lm.ethiopianWolfMoor || lm.wolfMoorland) || null,
      nyalaBench: toVec3(lm.nyalaBench || lm.abayRiverTerrace) || null
    };
  }

  function createEndemicWorld(T, terrainAdapter) {
    const root = new T.Group();
    root.name = "EthiopiaEndemicWorldRoot";
    const seed = hashString(terrainAdapter.regionId || "simien_imet_gogo");
    const rng = mulberry32(seed);

    const landmarks = resolveRegionLandmarks(T, terrainAdapter, rng);
    const architecture = buildHighlandArchitecture(T, terrainAdapter, landmarks);
    const flora = buildFloraGuilds(T, terrainAdapter, rng, landmarks);
    const wildlife = buildSilasWildlife(T, terrainAdapter, rng, landmarks);

    root.add(architecture.group, flora.group, wildlife.group);

    return {
      root, landmarks, flora, architecture, wildlife,
      update(dt, nowSec, opts = {}) {
        flora.update(nowSec);
        architecture.update(nowSec);
        wildlife.update(dt, nowSec, opts.playerPos, opts.donkeyPos);
      },
      getSummary(refPos) {
        return {
          regionId: terrainAdapter.regionId,
          flora: flora.counts,
          wildlife: wildlife.getTelemetry(refPos),
          landmarks: {
            primaryLookout: landmarks.primaryLookout,
            churchPos: landmarks.churchPos,
            relayPos: landmarks.relayPos,
            hamletPos: landmarks.hamletPos
          }
        };
      },
      dispose() {
        flora.dispose();
        architecture.dispose();
        wildlife.dispose();
      }
    };
  }

  const EthiopiaEndemicFauna = {
    version: "2.0.0-donkey-loft-ethiopia",
    createEndemicWorld
  };

  if (typeof window !== "undefined") {
    window.EthiopiaEndemicFauna = EthiopiaEndemicFauna;
  }
})();
