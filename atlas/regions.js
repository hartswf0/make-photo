// The trough's pourer. Levels ship as jerry cans (can@1: a label and a LEGOS graph); shared bodies ship as kits (kit@1: archetypes,
// RAGE's .ytyp idea) registered once and named by every can. See atlas/JERRYCAN.md.
// As you near an island one of its cans pours there: chance picks this visit's variants (probable / plausible / preposterous),
// the can's entry builds onto the shared ground, its sources, weather and kit bodies register with the world, beasts choose what to do
// by scoring their skills (the SAGA shape: options + scores, best first; the trough moves them), an action ripples one hop to the bodies
// around it, and when you leave the can drains: what changed is folded into one ledger (dw.ledger) as counters and a few tuples.
(() => {
  const once = new Map();
  const script = src => once.get(src) || once.set(src, new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); })).get(src);
  const json = url => once.get(url) || once.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); })).get(url);
  const abs = (base, rel) => new URL(rel, new URL(base, location.href)).href;
  const dig = path => path.split('.').reduce((o, k) => o && o[k], window);

  // ---------- memory: one ledger, namespaced by can; counters, a recharging bias, and the last few tuples ----------
  const LEDGER = { read() { try { return JSON.parse(localStorage.getItem('dw.ledger') || '{}'); } catch { return {}; } },
    write(l) { try { localStorage.setItem('dw.ledger', JSON.stringify(l)); } catch { } },
    tick() { const l = this.read(); l._clock = (l._clock || 0) + 1; this.write(l); return l._clock; },
    get(can, site) { const m = ((this.read()[can] || {})[site]) || {}; m.visits = m.visits || 0; m.bias = m.bias || {}; m.tuples = m.tuples || []; m.variants = m.variants || {};
      if (m.drawn) { for (const [k, v] of Object.entries(m.drawn)) m.bias[k] = Math.max(m.bias[k] || 0, Math.min(.5, v * .01)); delete m.drawn; }   // v1 ledgers kept litres
      return m; },
    put(can, site, rec) { const l = this.read(); (l[can] = l[can] || {})[site] = rec; this.write(l); },
    note(m, t) { m.tuples.push(t); if (m.tuples.length > 12) m.tuples.splice(0, m.tuples.length - 12); } };

  // ---------- chance: one seeded roll per pour ----------
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function roll(legos, mem, r) { const W = (legos.chance && legos.chance.weights) || { probable: .72, plausible: .23, preposterous: .05 }, out = {};
    for (const L of legos.L || []) { if (!L.variants) continue; const shift = Math.min(.5, mem.bias[L.id] || 0);   // consequence: a source drawn hard runs dry more often
      const w = { probable: Math.max(.05, W.probable - shift), plausible: W.plausible + shift, preposterous: W.preposterous }, tot = w.probable + w.plausible + w.preposterous; let x = r() * tot, pick = 'probable';
      for (const k of ['probable', 'plausible', 'preposterous']) { if (!L.variants[k]) continue; if ((x -= w[k]) <= 0) { pick = k; break; } } out[L.id] = { tier: pick, ...L.variants[pick] }; }
    return out; }

  // ---------- kits: archetype packets the trough registers once; cans name them ----------
  const ARCH = new Map();
  async function loadKit(url) { const k = await json(url); for (const [id, def] of Object.entries(k.archetypes || {})) ARCH.set(id, { kit: k, url, def }); return k; }
  async function makeBody(T, id, E) { const a = ARCH.get(id); if (!a) throw new Error('no archetype ' + id); for (const s of a.kit.scripts || []) await script(abs(a.url, s));
    const f = dig(a.def.make), owner = a.def.make.includes('.') ? dig(a.def.make.split('.').slice(0, -1).join('.')) : window; if (typeof f !== 'function') throw new Error('no builder ' + a.def.make);
    const opts = a.def.opts && { ...a.def.opts, ...(a.def.opts.assetPath ? { assetPath: abs(a.url, a.def.opts.assetPath) } : {}) };
    const raw = a.def.call === 'opts' ? f.call(owner, opts) : a.def.call === 'T,cast' ? f.call(owner, T, E && E.cast) : f.call(owner, T), root = a.def.root ? raw[a.def.root] : raw && raw.isObject3D ? raw : raw.group || raw.root;
    return { kind: a.def.body, raw, root }; }

  // ---------- a beast that chooses: skills scored each half second (SAGA's shape), moved by the trough ----------
  function beast(E, b, home, H, srcOf, r) { const d = b.raw, st = { thirst: .25 + r() * .5, boost: 0, boostT: 0, t: 9 };
    d.place(home.x, home.z, r() * 6.28, H); try { d.update(.016, { throttle: 0, steer: 0, pace: 0 }, H); } catch { }
    const me = { kind: 'beast', id: E.id, root: d.group, last: null, get x() { return d.group.position.x; }, get z() { return d.group.position.z; },
      options(pl) { const o = []; for (const s of E.skills || []) { const w = s.when || {}; let sc = s.base || 0;
          if (w.source_flowing) { const src = srcOf(w.source_flowing); if (src && src.flowing && st.thirst > (w.thirst_above || 0)) sc = s.score; }
          if (w.player_within && pl) { const dd = Math.hypot(pl.x - me.x, pl.z - me.z); if (dd < w.player_within && dd > (w.player_beyond || 0)) sc = s.score + st.boost; }
          o.push({ skill: s.name, parameters: s.parameters || {}, score: sc }); }
        o.sort((a, c) => c.score - a.score); return { options: o.map(x => ({ skill: x.skill, parameters: x.parameters })), scores: o.map(x => +x.score.toFixed(3)) }; },
      ripple(vector) { if (vector === 'GOAL') { st.boost = .35; st.boostT = 20; } },
      update(dt, pl, now) { st.thirst = Math.min(1, st.thirst + dt * .004); if (st.boostT > 0 && (st.boostT -= dt) <= 0) st.boost = 0;
        { const w = performance.now(); if (!me.last || w - (st.at || 0) > 500) { st.at = w; me.last = me.options(pl); } }
        const top = me.last.options[0]; let tx, tz, stop;
        if (top.skill === 'drink') { const src = srcOf(top.parameters.at); tx = src.x + 1.6; tz = src.z + 1.6; stop = 1.4; if (Math.hypot(tx - me.x, tz - me.z) < 2.2) st.thirst = Math.max(0, st.thirst - dt * .15); }
        else if (top.skill === 'approach' && pl) { tx = pl.x; tz = pl.z; stop = 3.5; }
        else { const a = now * .04 + E.id.length; tx = home.x + Math.cos(a) * 6; tz = home.z + Math.sin(a) * 6; stop = 1.5; }
        const dx = tx - me.x, dz = tz - me.z, dd = Math.hypot(dx, dz); let dh = Math.atan2(dx, dz) - d.group.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        d.update(dt, { throttle: dd > stop ? Math.min(1, (dd - stop) / 4) : 0, steer: Math.max(-1, Math.min(1, dh * 2)), pace: 0 }, H); } };
    return me; }

  // ---------- a walker who chooses: listen at home, turn to you, greet you once and say their line, thank you for water ----------
  function walker(ctx, E, b, home, H, r) { const ch = b.raw; ch.group.position.set(home.x, H(home.x, home.z), home.z); ch.group.rotation.y = r() * 6.28; if (ch.label && ch.label.sprite) ch.label.sprite.visible = false;
    if (ctx.motion) ctx.motion.add(E.id, ch); const st = { t: 9, cool: 0, greetT: 0, given: 0 };
    const me = { kind: 'walker', id: E.id, name: E.name, root: ch.group, x: home.x, z: home.z, get y() { return ch.group.position.y; }, last: null,
      options(pl) { const d = pl ? Math.hypot(pl.x - me.x, pl.z - me.z) : 1e9, o = [];
        for (const s of E.skills || [{ name: 'listen', base: .3 }, { name: 'face', when: { player_within: 14 }, score: .45 }, { name: 'greet', when: { player_within: 8 }, score: .7 }]) { const w = s.when || {}; let sc = s.base || 0;
          if (w.player_within && d < w.player_within) sc = s.score; if (s.name === 'greet' && st.cool > 0) sc = 0; o.push({ skill: s.name, parameters: s.parameters || {}, score: sc }); }
        o.sort((a, c) => c.score - a.score); return { options: o.map(x => ({ skill: x.skill, parameters: x.parameters })), scores: o.map(x => +x.score.toFixed(3)) }; },
      onGive(l) { st.given += l; if (me.ledger) me.ledger(l); st.cool = 40; st.greetT = 2.5; if (ctx.say) ctx.say(E.name, E.thanks || 'Thank you for the water.', me); },
      update(dt, pl) { st.cool = Math.max(0, st.cool - dt); st.greetT = Math.max(0, st.greetT - dt); { const w = performance.now(); if (!me.last || w - (st.at || 0) > 500) { st.at = w; me.last = me.options(pl); } }
        const top = me.last.options[0].skill;
        if ((top === 'face' || top === 'greet') && pl) { let dh = Math.atan2(pl.x - me.x, pl.z - me.z) - ch.group.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); ch.group.rotation.y += dh * Math.min(1, dt * 3); }
        if (top === 'greet') { st.cool = 60; st.greetT = 2.5; if (ctx.say) ctx.say(E.name, E.line, me); }
        if (ctx.motion) ctx.motion.loco(E.id, { speedMps: 0, greeting: st.greetT > 0, talking: st.greetT > 0 }); },
      drop() { if (ctx.motion) ctx.motion.drop(E.id); } };
    return me; }

  // ---------- adapters: the contracts the trough offers a can ----------
  const ADAPTERS = {
    // ground@1: the can is laid out in metres from its island's corner, at true scale, on the trough's ground; it returns blockers, rooms and landmarks
    async 'ground@1'(ctx, isl, can) { const F = isl.full || isl, ox = F.center[0] - F.size[0] / 2, oz = F.center[1] - F.size[1] / 2, Wp = p => [p[0] + ox, p[1] + oz];   // the can's frame is the uncropped island
      const rx0 = isl.center[0] - isl.size[0] / 2, rz0 = isl.center[1] - isl.size[1] / 2, rect = [rx0 - ox, rz0 - oz, rx0 - ox + isl.size[0], rz0 - oz + isl.size[1]];   // the island as it stands (focused), in the can's frame
      await ctx.ensureGround(rx0, rz0, rx0 + isl.size[0], rz0 + isl.size[1]);
      const live = await window[can.entry.global][can.entry.call](ctx.T, { H: (x, z) => ctx.groundAt(ox + x, oz + z), low: ctx.lowAt ? (x, z) => ctx.lowAt(ox + x, oz + z) : null, coarse: ctx.coarseAt ? (x, z) => ctx.coarseAt(ox + x, oz + z) : null, shape: ctx.shapeAt ? (x, z, h, pad) => ctx.shapeAt(ox + x, oz + z, h, pad) : null, sunDir: ctx.sunDir, maxAnisotropy: ctx.maxAnisotropy, rect, origin: [ox, oz], datum: isl.datum }); live.root.position.set(ox, 0, oz); ctx.scene.add(live.root); if (ctx.shade) ctx.shade(live.root); const farOff = live.farRect && ctx.holeGround ? ctx.holeGround([live.farRect[0] + ox, live.farRect[1] + oz, live.farRect[2] + ox, live.farRect[3] + oz]) : null; const hOff = live.heights && ctx.addHeights ? ctx.addHeights([live.heights.rect[0] + ox, live.heights.rect[1] + oz, live.heights.rect[2] + ox, live.heights.rect[3] + oz], (x, z) => live.heights.at(x - ox, z - oz)) : null; const holeOff = live.floraHole && ctx.addFloraHole ? ctx.addFloraHole([live.floraHole[0] + ox, live.floraHole[1] + oz, live.floraHole[2] + ox, live.floraHole[3] + oz]) : null; const lampOff = live.lamps && ctx.addLamps ? ctx.addLamps(live.lamps.map(l => ({ ...l, x: l.x + ox, z: l.z + oz }))) : null;
      const gm = live.materials && live.materials.ground, gOff = gm && ctx.setGround ? ctx.setGround(isl.id, { material: gm.material, uv: gm.uv && ((x, z, y) => gm.uv(x - ox, z - oz, y)), color: gm.color && ((x, z, y) => gm.color(x - ox, z - oz, y)) }) : null;
      const regs = []; if (ctx.addBlockers) { if (live.blockers) regs.push(ctx.addBlockers(live.blockers.map(pl => pl.map(Wp)))); if (live.walls) regs.push(ctx.addBlockers(live.walls.map(pl => pl.map(Wp)))); }
      let doorOff = null; const door = () => { if (!live.door || !ctx.addBlockers) return; if (!live.doorOpen && !doorOff) doorOff = ctx.addBlockers([live.door.map(Wp)]); if (live.doorOpen && doorOff) { doorOff(); doorOff = null; } }; door();
      if (live.room && ctx.addInterior) regs.push(ctx.addInterior({ id: live.room.id, pts: live.room.pts.map(Wp) }));
      const marks = {}; for (const [k, v] of Object.entries(live.landmarks || {})) marks[k] = { ...v, x: v.x + ox, z: v.z + oz };
      return { marks, live,
        apply(v) { if ('door' in v) { live.setDoor(v.door === 'open'); door(); } if (v.flood) live.setFlood(true); },
        toggle() { live.setDoor(!live.doorOpen); door(); return live.doorOpen; },
        update(dt, t) { live.update(dt, t); }, dispose() { if (gOff) gOff(); if (lampOff) lampOff(); if (holeOff) holeOff(); if (hOff) hOff(); if (farOff) farOff(); for (const o of regs) o(); if (doorOff) doorOff(); ctx.scene.remove(live.root); live.dispose(); } }; },
    // terrain@1: the can builds on the trough's ground at true scale. Its own coordinates were squeezed into frame.span; landmarks spread back out.
    async 'terrain@1'(ctx, isl, can, site) {
      const man = await json(abs(can.url, can.frame.manifest)), r = man.regions[site.region]; if (!r) throw new Error('no region ' + site.region);
      const F = isl.full || isl, cx = F.center[0], cz = F.center[1], hx = F.size[0] / 2, hz = F.size[1] / 2, kx = F.size[0] / r.worldSpanM, kz = F.size[1] / r.worldSpanM;   // the pack's frame is the uncropped island
      await ctx.ensureGround(isl.center[0] - isl.size[0] / 2, isl.center[1] - isl.size[1] / 2, isl.center[0] + isl.size[0] / 2, isl.center[1] + isl.size[1] / 2);
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
      const make = window[can.entry.global][can.entry.call], live = make(ctx.T, terrain); live.root.position.set(cx, 0, cz); ctx.scene.add(live.root); if (ctx.shade) ctx.shade(live.root);
      const mats = [], offs = [];   // material@1: the level's own shaders and textures, given the trough's frame (true scale, this island's datum)
      for (const pk of can.materials || []) { if (!pk.script || !ctx.setGround) continue; await script(abs(can.url, pk.script)); const f = dig(pk.make); if (typeof f !== 'function') continue;
        const out = f.call(dig(pk.make.split('.').slice(0, -1).join('.')), ctx.T, { regionStyle: r.regionStyle, minElevM: r.minElevM, maxElevM: r.maxElevM, datumElevM: isl.datum ?? (r.minElevM - 30), verticalScale: 1,
          cloudElevY: typeof r.cloudSeaElevM === 'number' && isl.datum != null ? r.cloudSeaElevM - isl.datum : -9999, sunDir: ctx.sunDir ? ctx.sunDir() : undefined }), m = out && out.material ? out : { material: out };
        mats.push(m); if (pk.bind === 'ground') offs.push(ctx.setGround(isl.id, { material: m.material })); }
      const lp = { x: 0, y: 0, z: 0 }, ld = { x: 0, y: 0, z: 0 }, at = (o, p) => { o.x = p.x - cx; o.y = p.y; o.z = p.z - cz; return o; };
      const marks = {}; for (const [k, v] of Object.entries(live.landmarks || {})) if (v && Number.isFinite(v.x)) marks[k] = { x: v.x + cx, z: v.z + cz };
      return { marks, update(dt, t, pl, dk) { live.update(dt, t, { playerPos: pl && at(lp, pl), donkeyPos: dk && at(ld, dk) }); for (const m of mats) if (m.uniforms) { if (m.uniforms.uTime) m.uniforms.uTime.value = t; if (m.uniforms.uSunDir && ctx.sunDir) m.uniforms.uSunDir.value.copy(ctx.sunDir()); } },
        dispose() { for (const o of offs) o(); ctx.scene.remove(live.root); live.dispose(); } };
    } };

  // ---------- pour and drain ----------
  async function pour(ctx, isl, can, site) {
    for (const n of can.entry.needs || []) await script(abs(can.url, n)); await script(abs(can.url, can.entry.script)); const legos = can.legos ? await json(abs(can.url, can.legos)) : { L: [] }; can.legosUrl = can.legos ? abs(can.url, can.legos) : can.url;
    const clock = LEDGER.tick(), mem = LEDGER.get(can.id, isl.id);
    if (mem.seen) for (const k in mem.bias) mem.bias[k] = Math.max(0, mem.bias[k] - .08 * Math.max(0, clock - mem.seen - 1));   // recharge: every visit elsewhere refills the aquifer a little
    mem.visits++; mem.seen = clock;
    const r = rng(hash(can.id + '|' + isl.id + '|' + mem.visits)), pick = roll(legos, mem, r);
    for (const [k, v] of Object.entries(pick)) if (v.tier === 'preposterous' || v.weather) mem.bias[k] = Math.max(0, (mem.bias[k] || 0) - .25);   // a storm or a risen cloud sea refills it
    const body = await ADAPTERS[can.entry.adapter](ctx, isl, can, site), regs = [], src = {}, bodies = [];
    const H = (x, z) => ctx.groundAt(x, z), srcOf = id => src[id];
    const ripple = (S, x, z) => { const R = S.ripple; if (!R) return; for (const b of bodies) if (b.ripple && Math.hypot(b.x - x, b.z - z) < R.radius) b.ripple(R.vector); };   // one hop, to the bodies around the act
    for (const L of legos.L || []) { const m = body.marks[L.at]; if (!m) continue; const v = pick[L.id] || { tier: 'probable' };
      if ((L.offers || []).includes('draw')) { const S = (legos.S || []).find(s => s.verb === 'draw' && s.at === L.id) || {}, per = (S.shift && S.shift.ledger_delta && S.shift.ledger_delta.dry_bias_per_litre) || .01;
        const o = { id: can.id + ':' + isl.id + ':' + L.id, x: m.x, z: m.z, name: L.name, flowing: v.flowing !== false, note: v.note || '', tier: v.tier,
          onDraw: litres => { mem.bias[L.id] = Math.min(.5, (mem.bias[L.id] || 0) + litres * per); LEDGER.note(mem, [mem.visits, 'draw', L.id, +litres.toFixed(1), v.tier]); LEDGER.put(can.id, isl.id, mem); ripple(S, m.x, m.z); } };
        src[L.id] = o; regs.push(ctx.addSource(o)); }
      if (body.apply && (v.door || v.flood)) body.apply(v);
      if ((L.offers || []).includes('open') && body.toggle && ctx.addSwitch) regs.push(ctx.addSwitch({ x: m.x, z: m.z, label: () => body.live.doorOpen ? 'Close the door' : 'Open the door',
        run: () => { const o = body.toggle(); LEDGER.note(mem, [mem.visits, o ? 'open' : 'close', L.id, 0, v.tier]); LEDGER.put(can.id, isl.id, mem); } }));
      if (v.weather && ctx.addWeather) regs.push(ctx.addWeather({ x: isl.center[0], z: isl.center[1], hx: isl.size[0] / 2, hz: isl.size[1] / 2, ...v.weather })); }
    for (const E of legos.E || []) { if (E.body !== 'emitter' || !E.sound || !ctx.addSound) continue; const m = body.marks[E.at]; if (!m) continue;   // a sound placed in the world
      regs.push(ctx.addSound({ url: abs(can.legosUrl, E.sound), x: m.x + ((E.offset || [])[0] || 0), y: H(m.x, m.z) + 2, z: m.z + ((E.offset || [])[1] || 0), radius: E.radius || 200, gain: E.gain || .6, room: E.room || null })); }
    for (const E of legos.E || []) { if (!E.archetype) continue; const m = body.marks[E.at]; if (!m) continue;   // a kit body, placed by a few lines of LEGOS
      try { const b = await makeBody(ctx.T, E.archetype, E), o = E.offset || [0, 0], home = { x: m.x + o[0], z: m.z + o[1] };
        if (b.kind === 'walker') { const w = walker(ctx, E, b, home, H, r); w.ledger = l => { LEDGER.note(mem, [mem.visits, 'give', E.id, l, '']); LEDGER.put(can.id, isl.id, mem); }; ctx.scene.add(w.root); if (ctx.shade) ctx.shade(w.root); bodies.push(w); if (ctx.addPerson) regs.push(ctx.addPerson(w)); }
        else if (b.kind === 'beast') { const bs = beast(E, b, home, H, srcOf, r); ctx.scene.add(bs.root); if (ctx.shade) ctx.shade(bs.root); bodies.push(bs); }
        else { b.root.position.set(home.x, H(home.x, home.z), home.z); b.root.rotation.y = r() * 6.28; ctx.scene.add(b.root); if (ctx.shade) ctx.shade(b.root); bodies.push({ kind: b.kind, id: E.id, root: b.root, x: home.x, z: home.z }); } }
      catch (e) { console.warn('body', E.id, e); } }
    mem.variants = Object.fromEntries(Object.entries(pick).map(([k, v]) => [k, v.tier])); mem.last = Date.now(); LEDGER.put(can.id, isl.id, mem);
    return { id: isl.id, can: can.id, pick, marks: body.marks, bodies,
      update(dt, t, pl, dk) { body.update(dt, t, pl, dk); for (const b of bodies) if (b.update) b.update(dt, pl, t); },
      dispose() { for (const off of regs) try { off(); } catch { } for (const b of bodies) { ctx.scene.remove(b.root); if (b.drop) b.drop(); } body.dispose(); LEDGER.put(can.id, isl.id, { ...mem, drained: Date.now() }); } };
  }

  window.DWRegions = {
    ledger: LEDGER, archetypes: ARCH, makeBody,
    create(ctx) { const live = new Map(), busy = new Set(), failed = new Map(), SITES = new Map(); let shelf = null;   // a pour that fails waits 30 s before trying again
      const ready = json(ctx.shelf || './cans.json').then(async s => { await Promise.all((s.kits || []).map(u => loadKit(abs(location.href, u)).catch(e => console.warn('kit', u, e))));
        shelf = await Promise.all(s.cans.map(async u => ({ ...(await json(abs(location.href, u))), url: abs(location.href, u) })));
        for (const can of shelf) for (const site of can.sites || []) SITES.set(site.island, { can, site }); if (ctx.onShelf) ctx.onShelf([...SITES.entries()].map(([id, x]) => ({ id, keep: !!x.can.keepTroughFlora }))); }).catch(e => console.warn('shelf', e));
      const edge = (isl, x, z) => Math.hypot(Math.max(0, Math.abs(x - isl.center[0]) - isl.size[0] / 2), Math.max(0, Math.abs(z - isl.center[1]) - isl.size[1] / 2));
      return { live, ready, sites: SITES,
        tick(x, z) { if (!shelf) return; for (const isl of ctx.islands) { const s = SITES.get(isl.id); if (!s) continue; const d = edge(isl, x, z), B = s.can.bands || { scent: 7000, pour: 2600, drain: 5200 };
            if (d < B.scent) { script(abs(s.can.url, s.can.entry.script)); if (s.can.legos) json(abs(s.can.url, s.can.legos)); if (s.can.frame && s.can.frame.manifest) json(abs(s.can.url, s.can.frame.manifest)); }
            if (d < B.pour && !live.has(isl.id) && !busy.has(isl.id) && !(failed.get(isl.id) > performance.now())) { busy.add(isl.id); const t0 = performance.now(); if (ctx.onStart) ctx.onStart(isl);
              pour(ctx, isl, s.can, s.site).then(r => { live.set(isl.id, r); if (ctx.onMount) ctx.onMount(isl, r, performance.now() - t0); }).catch(e => { console.warn('pour', isl.id, e && (e.message || (e.target && e.target.src) || e)); failed.set(isl.id, performance.now() + 30000); if (ctx.onMount) ctx.onMount(isl, null, 0); }).finally(() => busy.delete(isl.id)); }
            else if (d > B.drain && live.has(isl.id)) { try { live.get(isl.id).dispose(); } catch { } live.delete(isl.id); } } },
        update(dt, t, pl, dk) { for (const r of live.values()) try { r.update(dt, t, pl, dk); } catch (e) { } } }; } };
})();
