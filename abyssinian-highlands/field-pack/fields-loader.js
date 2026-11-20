/* AbyssFieldPack — loads real FTW field polygons (see README.md / manifest.json).
 *   AbyssFieldPack.load(regionId[, baseUrl]) -> Promise<{ polys, bbox, classes, count, region }>
 *   regionId: tana | gorge | simien | gheralta | metekel
 *   bbox   : [lon0,lat0,lon1,lat1] of the sampled window actually containing the polygons
 *   classes: { shape:[names], crop:[names] }
 *   polys  : array of { ring:Float32Array [lon0,lat0,lon1,lat1,...] (open ring),
 *                        area (m2), orient (deg, long axis CCW from east, 0..180),
 *                        shape (idx into classes.shape), shapeName, crop, cropName }
 * Also available: AbyssFieldPack.manifest(baseUrl), AbyssFieldPack.stats(baseUrl).
 * baseUrl defaults to the directory of this script. */
(function (root) {
  'use strict';
  var here = '';
  try { var s = document.currentScript && document.currentScript.src; if (s) here = s.replace(/[^\/]*$/, ''); } catch (e) {}
  var cache = {};
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }
  function manifest(base) { base = base || here; return cache['m' + base] || (cache['m' + base] = getJSON(base + 'manifest.json')); }
  function stats(base) { base = base || here; return getJSON((base || here) + 'field-stats.json'); }
  function decode(buf, classes, regionId) {
    var dv = new DataView(buf);
    var magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'ABF1') throw new Error('bad field pack magic');
    var nf = dv.getUint32(4, true), nv = dv.getUint32(8, true);
    var bbox = [dv.getFloat32(16, true), dv.getFloat32(20, true), dv.getFloat32(24, true), dv.getFloat32(28, true)];
    var p = 32;
    var offs = new Uint32Array(buf.slice(p, p + 4 * (nf + 1))); p += 4 * (nf + 1);
    var area = new Float32Array(buf.slice(p, p + 4 * nf)); p += 4 * nf;
    var xy = new Int16Array(buf.slice(p, p + 4 * nv)); p += 4 * nv;
    var pad = function (n) { return n + ((4 - n % 4) % 4); };
    var ori = new Uint8Array(buf, p, nf); p += pad(nf);
    var shp = new Uint8Array(buf, p, nf); p += pad(nf);
    var crp = new Uint8Array(buf, p, nf);
    var spx = (bbox[2] - bbox[0]) / 65535, spy = (bbox[3] - bbox[1]) / 65535;
    var polys = new Array(nf);
    for (var i = 0; i < nf; i++) {
      var a = offs[i], b = offs[i + 1], ring = new Float32Array((b - a) * 2);
      for (var k = a, j = 0; k < b; k++, j += 2) {
        ring[j] = bbox[0] + (xy[2 * k] + 32768) * spx;
        ring[j + 1] = bbox[1] + (xy[2 * k + 1] + 32768) * spy;
      }
      polys[i] = { ring: ring, area: area[i], orient: ori[i] * 180 / 255, shape: shp[i], shapeName: classes.shape[shp[i]],
                   crop: crp[i], cropName: classes.crop[crp[i]] };
    }
    return { polys: polys, bbox: bbox, classes: classes, count: nf, region: regionId };
  }
  function load(regionId, base) {
    base = base || here;
    var key = regionId + '|' + base;
    if (cache[key]) return cache[key];
    return (cache[key] = manifest(base).then(function (m) {
      var r = m.regions[regionId];
      if (!r || !r.file) throw new Error('AbyssFieldPack: no data for region ' + regionId);
      return fetch(base + r.file).then(function (res) { if (!res.ok) throw new Error(r.file + ' ' + res.status); return res.arrayBuffer(); })
        .then(function (buf) { return decode(buf, { shape: m.shapeClasses, crop: m.cropClasses }, regionId); });
    }));
  }
  root.AbyssFieldPack = { load: load, manifest: manifest, stats: stats, _decode: decode };
})(typeof window !== 'undefined' ? window : globalThis);
