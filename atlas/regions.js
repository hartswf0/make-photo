// Region packs: each level's own content, mounted onto the one shared archipelago ground as you come near it and let go behind you.
// A region is a function (ctx, island) -> { update(dt, t, player, donkey), dispose() }. The overworld owns the ground, the player,
// physics, camera and the game surface; a region only brings what lives on its island. The bridges are the airlocks: a region starts
// mounting as you reach the bridgehead on the far shore, so it is standing there by the time you have crossed.
(() => {
  const once = new Map();
  const script = src => once.get(src) || once.set(src, new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); })).get(src);
  const json = url => once.get(url) || once.set(url, fetch(url).then(r => r.json())).get(url);

  // ---------- Ethiopia Highlands: the flora, churches, hamlets, standpipes and wildlife of all four highland tiles ----------
  const ETH = '../ethiopia-highlands/';
  async function ethiopia(ctx, isl) {
    const [, man] = await Promise.all([script(ETH + 'endemic-fauna.js?v=1'), json(ETH + 'terrain-pack/manifest.json')]);
    const r = man.regions[isl.id]; if (!r || !window.EthiopiaEndemicFauna) throw new Error('no pack for ' + isl.id);
    const cx = isl.center[0], cz = isl.center[1], hx = isl.size[0] / 2, hz = isl.size[1] / 2, kx = isl.size[0] / r.worldSpanM, kz = isl.size[1] / r.worldSpanM;
    await ctx.ensureGround(cx - hx, cz - hz, cx + hx, cz + hz);
    // the level squeezes its ground into worldSpanM; the archipelago keeps it at true scale, so its landmarks spread out to match
    const sc = p => Array.isArray(p) ? p.map(sc) : p && typeof p === 'object' && Number.isFinite(p.x) && Number.isFinite(p.z) ? { ...p, x: p.x * kx, z: p.z * kz } : p;
    const lm = {}; for (const [k, v] of Object.entries(r.landmarks || {})) lm[k] = sc(v);
    const V = ctx.T.Vector3, tmp = new V(), H = (x, z) => ctx.groundAt(cx + x, cz + z);
    const N = (x, z, out) => (out || new V()).set(H(x - 4, z) - H(x + 4, z), 8, H(x, z - 4) - H(x, z + 4)).normalize();
    const real = (x, z) => H(x, z) + r.minElevM - 30;
    const terrain = { regionId: isl.id, minX: -hx, maxX: hx, minZ: -hz, maxZ: hz, spanX: hx * 2, spanZ: hz * 2, waterY: 1.5, midY: H(0, 0), datumElev: r.datumElevM, vScale: 1, landmarks: lm,
      sampleHeight: H, sampleNormal: N, sampleSlope: (x, z) => { N(x, z, tmp); return Math.sqrt(Math.max(0, 1 - tmp.y * tmp.y)) / Math.max(.05, tmp.y); },
      sampleSlopeDegrees: (x, z) => { N(x, z, tmp); return Math.acos(Math.min(1, tmp.y)) * 180 / Math.PI; },
      sampleRealElevM: real, sampleBiome: (x, z) => { const e = real(x, z); return e >= 3200 ? 'wurch' : e >= 2300 ? 'dega' : e >= 1500 ? 'woina_dega' : 'kolla'; },
      sampleUpdraft: (x, z) => Math.min(8.5, terrain.sampleSlope(x, z) * 3.8) };
    const eco = window.EthiopiaEndemicFauna.createEndemicWorld(ctx.T, terrain); eco.root.position.set(cx, 0, cz); ctx.scene.add(eco.root);
    const lp = { x: 0, y: 0, z: 0 }, ld = { x: 0, y: 0, z: 0 }, at = (o, p) => { o.x = p.x - cx; o.y = p.y; o.z = p.z - cz; return o; };
    const marks = Object.entries(eco.landmarks || {}).filter(([, v]) => v && Number.isFinite(v.x)).map(([k, v]) => ({ id: k, x: v.x + cx, z: v.z + cz }));
    return { id: isl.id, marks, update(dt, t, pl, dk) { eco.update(dt, t, { playerPos: pl && at(lp, pl), donkeyPos: dk && at(ld, dk) }); }, dispose() { ctx.scene.remove(eco.root); eco.dispose(); } };
  }

  const KINDS = { simien_imet_gogo: ethiopia, gheralta_spires: ethiopia, blue_nile_gorge: ethiopia, gerd_belaya_escarpment: ethiopia };
  const MOUNT = 2600, DROP = 5200, WARM = 7000;   // metres from an island's edge: start loading, let go, fetch the code ahead

  window.DWRegions = { kinds: KINDS,
    create(ctx) { const live = new Map(), busy = new Set(), edge = (isl, x, z) => Math.hypot(Math.max(0, Math.abs(x - isl.center[0]) - isl.size[0] / 2), Math.max(0, Math.abs(z - isl.center[1]) - isl.size[1] / 2));
      return { live,
        tick(x, z) { for (const isl of ctx.islands) { const f = KINDS[isl.id]; if (!f) continue; const d = edge(isl, x, z);
            if (d < WARM && f === ethiopia) { script(ETH + 'endemic-fauna.js?v=1'); json(ETH + 'terrain-pack/manifest.json'); }
            if (d < MOUNT && !live.has(isl.id) && !busy.has(isl.id)) { busy.add(isl.id); const t0 = performance.now(); if (ctx.onStart) ctx.onStart(isl);
              f(ctx, isl).then(r => { live.set(isl.id, r); if (ctx.onMount) ctx.onMount(isl, r, performance.now() - t0); }).catch(e => console.warn('region', isl.id, e)).finally(() => busy.delete(isl.id)); }
            else if (d > DROP && live.has(isl.id)) { try { live.get(isl.id).dispose(); } catch { } live.delete(isl.id); } } },
        update(dt, t, pl, dk) { for (const r of live.values()) try { r.update(dt, t, pl, dk); } catch (e) { } } }; } };
})();
