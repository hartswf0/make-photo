// The trough's pourer. Every level ships as a jerry can (see atlas/JERRYCAN.md): a label (can.json) and a LEGOS graph (legos.json).
// The trough reads the shelf (atlas/cans.json), and as you near an island one of its cans pours there:
// chance picks this visit's variants (probable / plausible / preposterous), the can's entry builds onto the shared ground,
// its sources and weather register with the world, and when you leave it drains: what changed is written to memory (dw.ledger).
(() => {
  const once = new Map();
  const script = src => once.get(src) || once.set(src, new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); })).get(src);
  const json = url => once.get(url) || once.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); })).get(url);
  const abs = (base, rel) => new URL(rel, new URL(base, location.href)).href;

  // ---------- memory: one ledger, namespaced by can ----------
  const LEDGER = { read() { try { return JSON.parse(localStorage.getItem('dw.ledger') || '{}'); } catch { return {}; } },
    get(can, site) { const l = this.read(); return ((l[can] || {})[site]) || { visits: 0, drawn: {}, variants: {} }; },
    put(can, site, rec) { const l = this.read(); (l[can] = l[can] || {})[site] = rec; try { localStorage.setItem('dw.ledger', JSON.stringify(l)); } catch { } } };

  // ---------- chance: one seeded roll per pour ----------
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function roll(legos, mem, r) { const W = (legos.chance && legos.chance.weights) || { probable: .72, plausible: .23, preposterous: .05 }, out = {};
    for (const L of legos.L || []) { if (!L.variants) continue; const drawn = mem.drawn[L.id] || 0, shift = Math.min(.5, Math.floor(drawn / 20) * .1);   // consequence: a well drawn hard runs dry more often
      const w = { probable: Math.max(.05, W.probable - shift), plausible: W.plausible + shift, preposterous: W.preposterous }, tot = w.probable + w.plausible + w.preposterous; let x = r() * tot, pick = 'probable';
      for (const k of ['probable', 'plausible', 'preposterous']) { if (!L.variants[k]) continue; if ((x -= w[k]) <= 0) { pick = k; break; } } out[L.id] = { tier: pick, ...L.variants[pick] }; }
    return out; }

  // ---------- adapters: the contracts the trough offers a can ----------
  const ADAPTERS = {
    // terrain@1: the can builds on the trough's ground at true scale. Its own coordinates were squeezed into frame.span; landmarks spread back out.
    async 'terrain@1'(ctx, isl, can, site) {
      const man = await json(abs(can.url, can.frame.manifest)), r = man.regions[site.region]; if (!r) throw new Error('no region ' + site.region);
      const cx = isl.center[0], cz = isl.center[1], hx = isl.size[0] / 2, hz = isl.size[1] / 2, kx = isl.size[0] / r.worldSpanM, kz = isl.size[1] / r.worldSpanM;
      await ctx.ensureGround(cx - hx, cz - hz, cx + hx, cz + hz);
      const sc = p => Array.isArray(p) ? p.map(sc) : p && typeof p === 'object' && Number.isFinite(p.x) && Number.isFinite(p.z) ? { ...p, x: p.x * kx, z: p.z * kz } : p;
      const lm = {}; for (const [k, v] of Object.entries(r.landmarks || {})) lm[k] = sc(v);
      const V = ctx.T.Vector3, tmp = new V(), H = (x, z) => ctx.groundAt(cx + x, cz + z);
      const N = (x, z, out) => (out || new V()).set(H(x - 4, z) - H(x + 4, z), 8, H(x, z - 4) - H(x, z + 4)).normalize();
      const real = (x, z) => H(x, z) + r.minElevM - 30;
      const terrain = { regionId: site.region, minX: -hx, maxX: hx, minZ: -hz, maxZ: hz, spanX: hx * 2, spanZ: hz * 2, waterY: 1.5, midY: H(0, 0), datumElev: r.datumElevM, vScale: 1, landmarks: lm,
        sampleHeight: H, sampleNormal: N, sampleSlope: (x, z) => { N(x, z, tmp); return Math.sqrt(Math.max(0, 1 - tmp.y * tmp.y)) / Math.max(.05, tmp.y); },
        sampleSlopeDegrees: (x, z) => { N(x, z, tmp); return Math.acos(Math.min(1, tmp.y)) * 180 / Math.PI; },
        sampleRealElevM: real, sampleBiome: (x, z) => { const e = real(x, z); return e >= 3200 ? 'wurch' : e >= 2300 ? 'dega' : e >= 1500 ? 'woina_dega' : 'kolla'; },
        sampleUpdraft: (x, z) => Math.min(8.5, terrain.sampleSlope(x, z) * 3.8) };
      const make = window[can.entry.global][can.entry.call], live = make(ctx.T, terrain); live.root.position.set(cx, 0, cz); ctx.scene.add(live.root);
      const lp = { x: 0, y: 0, z: 0 }, ld = { x: 0, y: 0, z: 0 }, at = (o, p) => { o.x = p.x - cx; o.y = p.y; o.z = p.z - cz; return o; };
      const marks = {}; for (const [k, v] of Object.entries(live.landmarks || {})) if (v && Number.isFinite(v.x)) marks[k] = { x: v.x + cx, z: v.z + cz };
      return { marks, update(dt, t, pl, dk) { live.update(dt, t, { playerPos: pl && at(lp, pl), donkeyPos: dk && at(ld, dk) }); }, dispose() { ctx.scene.remove(live.root); live.dispose(); } };
    } };

  // ---------- pour and drain ----------
  async function pour(ctx, isl, can, site) {
    await script(abs(can.url, can.entry.script)); const legos = can.legos ? await json(abs(can.url, can.legos)) : { L: [] };
    const mem = LEDGER.get(can.id, isl.id); mem.visits++;
    const pick = roll(legos, mem, rng(hash(can.id + '|' + isl.id + '|' + mem.visits)));
    const body = await ADAPTERS[can.entry.adapter](ctx, isl, can, site), regs = [];
    for (const L of legos.L || []) { const m = body.marks[L.at]; if (!m) continue; const v = pick[L.id] || { tier: 'probable' };
      if ((L.offers || []).includes('draw')) regs.push(ctx.addSource({ id: can.id + ':' + isl.id + ':' + L.id, x: m.x, z: m.z, name: L.name, flowing: v.flowing !== false, note: v.note || '', tier: v.tier,
        onDraw: litres => { mem.drawn[L.id] = (mem.drawn[L.id] || 0) + litres; LEDGER.put(can.id, isl.id, mem); } }));
      if (v.weather && ctx.addWeather) regs.push(ctx.addWeather({ x: isl.center[0], z: isl.center[1], hx: isl.size[0] / 2, hz: isl.size[1] / 2, ...v.weather })); }
    mem.variants = Object.fromEntries(Object.entries(pick).map(([k, v]) => [k, v.tier])); mem.last = Date.now(); LEDGER.put(can.id, isl.id, mem);
    return { id: isl.id, can: can.id, pick, marks: body.marks, update: body.update,
      dispose() { for (const off of regs) try { off(); } catch { } body.dispose(); LEDGER.put(can.id, isl.id, { ...mem, drained: Date.now() }); } };
  }

  window.DWRegions = {
    ledger: LEDGER,
    create(ctx) { const live = new Map(), busy = new Set(), SITES = new Map(); let shelf = null;
      const ready = json(ctx.shelf || './cans.json').then(async s => { shelf = await Promise.all(s.cans.map(async u => ({ ...(await json(abs(location.href, u))), url: abs(location.href, u) })));
        for (const can of shelf) for (const site of can.sites || []) SITES.set(site.island, { can, site }); if (ctx.onShelf) ctx.onShelf([...SITES.keys()]); }).catch(e => console.warn('shelf', e));
      const edge = (isl, x, z) => Math.hypot(Math.max(0, Math.abs(x - isl.center[0]) - isl.size[0] / 2), Math.max(0, Math.abs(z - isl.center[1]) - isl.size[1] / 2));
      return { live, ready, sites: SITES,
        tick(x, z) { if (!shelf) return; for (const isl of ctx.islands) { const s = SITES.get(isl.id); if (!s) continue; const d = edge(isl, x, z), B = s.can.bands || { scent: 7000, pour: 2600, drain: 5200 };
            if (d < B.scent) { script(abs(s.can.url, s.can.entry.script)); if (s.can.legos) json(abs(s.can.url, s.can.legos)); if (s.can.frame && s.can.frame.manifest) json(abs(s.can.url, s.can.frame.manifest)); }
            if (d < B.pour && !live.has(isl.id) && !busy.has(isl.id)) { busy.add(isl.id); const t0 = performance.now(); if (ctx.onStart) ctx.onStart(isl);
              pour(ctx, isl, s.can, s.site).then(r => { live.set(isl.id, r); if (ctx.onMount) ctx.onMount(isl, r, performance.now() - t0); }).catch(e => { console.warn('pour', isl.id, e); if (ctx.onMount) ctx.onMount(isl, null, 0); }).finally(() => busy.delete(isl.id)); }
            else if (d > B.drain && live.has(isl.id)) { try { live.get(isl.id).dispose(); } catch { } live.delete(isl.id); } } },
        update(dt, t, pl, dk) { for (const r of live.values()) try { r.update(dt, t, pl, dk); } catch (e) { } } }; } };
})();
