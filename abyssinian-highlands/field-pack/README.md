# field-pack — real field polygons for the Abyssinian Highlands

Built by `build_pack.py` (venv in `.venv/`, git-ignored: `pip install duckdb shapely numpy pyarrow pytz`).
Outputs: `fields_<region>.bin`, `manifest.json`, `field-stats.json`, `fields-loader.js`.

## Provenance
| Source | Status |
|---|---|
| **Fields of The World global** (PRUE U-Net on Sentinel-2, 10 m, year 2025), `s3://us-west-2.opendata.source.coop/tge-labs/ftw-global-data/predictions/vectors/alpha/results-by-admin/admin:country_code=ET/ET_{AM,OR,TI,BE}.parquet`, anonymous HTTPS range reads via DuckDB bbox pushdown | **USED** — CC-BY-4.0, Taylor Geospatial et al.; Robinson et al. 2026, arXiv:2605.11055. Attribution required. |
| Digital Earth Africa cropland-extent STAC | not needed (raster extent only; FTW already gave vectors) |
| EthCT2020 (DOI 10.17632/mfpvmk8cnm.1) crop labels | **needs user action** — Mendeley Data download is interactive/not offered as a keyless API; crop class is therefore `unknown` (0) for every field. Drop the files in and extend `build_pack.py` to fill the `crop` byte. |
| Synthetic fallback | none. Nothing is invented (`synthetic:false`). |

Caveat (from FTW): polygons are *remote-sensing field units* (10 m), not cadastral parcels; tiny smallholder plots may merge, and confidence is conservative in smallholder systems.

## What is in a pack
Per region the **densest sub-window** (≤~6.5k fields, 0.015–0.16° square) of the requested region bbox, not the whole region — full coverage would be tens of MB. `manifest.regions[id].windowBbox` is the window, `regionBbox` the request. Polygons: area ≥ 300 m², Douglas-Peucker 7 m, int16 quantised to the window.

Binary layout (`ABF1`, little-endian): header `4s magic, u32 nf, u32 nv, u32 0, f32 x0,y0,x1,y1`; then `u32 offsets[nf+1]`, `f32 area_m2[nf]`, `i16 xy[nv*2]` (lon = x0 + (v+32768)/65535·(x1-x0)), `u8 orient[nf]` (×180/255°, long axis CCW from east), `u8 shape[nf]`, `u8 crop[nf]` (each padded to 4 bytes).

## Shape classes — heuristics, not labels
Computed from minimum-rotated-rectangle elongation L/W, fill ratio (area / rectangle area) and area:
`riparian-strip` elong≥5, W≤45 m, straight; `contour-ribbon` elong≥3 (or curved narrow strips); `lowland-block` fill≥0.8, elong<2.4, ≥0.8 ha; `jigsaw` other irregular <8 ha; `unknown` remainder. No ground truth exists for these classes; riparian is not tied to a river layer. See `field-stats.json` for histograms and shares.

## Use
```html
<script src="field-pack/fields-loader.js"></script>
<script>AbyssFieldPack.load('tana').then(p => { /* p.polys, p.bbox, p.classes */ })</script>
```
Serve over HTTP (fetch). Sizes: see `manifest.totalBytes` (budget 1.2 MB).

## Update (#288): DEM-clipped + exemplar packs (`build_extra.py`)
Region ids now: `tana` (densest window), `dem_simien`, `dem_gheralta`, `dem_gorge`, `dem_gerd` (exactly the real-DEM tile bounds; every real FTW polygon whose bbox-centre falls in the tile — sparse where FTW found few fields, e.g. dem_simien 139), and exemplars `ex_block` (Pawe/Metekel, 36.35–36.39E 11.31–11.35N) and `ex_riparian` (Tana west shore 37.06–37.10E 11.69–11.73N) — **real polygons from other places, flagged `exemplar:true`**. Old simien/gheralta/gorge/metekel windows were removed. FTW essentially contains no large (>15 ha) compact blocks in Ethiopia; `ex_block` is the best found (16 compact ≥0.8 ha parcels). Riparian strips are likewise rare (heuristic).
