# Abyssinian Highlands — Roof of Africa (`roof.html`)

Standalone page: orbit → region → ground dive through the Ethiopian massif.
(`index.html` in this folder is the separate older "4-zone transect" page; they link to each other.)

Deep links: `roof.html?region=simien|gheralta|gorge|gerd&mode=aerial|walk&look=silver|risograph|woodblock|jerikan|raw&season=0..12&by=crop|zone|shape`

## Files (this page)
| file | role |
|---|---|
| `roof.html`, `abyss-style.css`, `abyss-world.js` | page, styles, all logic |
| `orbital/orbital_dem16.bin` + `orbital_manifest.json` + `bake_orbital_dem.py` | 6–15°N 35–42°E, 420×540 uint16 grid baked from AWS Terrarium z7 (SRTM/GMTED/ETOPO1) |
| `field-pack/` | (peer `abyss-fields-data`) real Fields-of-The-World polygons, CC-BY-4.0 |
| reused read-only | `../ethiopia-highlands/{ethiopia-terrain.js,endemic-fauna.js,terrain-pack/}`, `../study/look-audition-mv.js`, `../donkey/*` |

## What is real vs stylized
- **Real:** all elevations (orbital grid ~1.8 km/cell, so peaks are smoothed: max ≈ 4,300 m vs Ras Dashen ≈ 4,550 m); ground DEM tiles; field polygons (draped only where they fall inside the DEM tile bounds); landmark coordinates (GERD 11.2153°N 35.0931°E, Imet Gogo 13.2167°N 38.0833°E, Gheralta 13.9722°N 39.4286°E, Abay gorge 10.0750°N 38.1917°E).
- **Stylized (labelled in-page):** orbital 6× vertical exaggeration and tint; Blue Nile and Rift lines (hand-placed approximations); season colours (illustrative crop calendar); **crop colours** (crop class is *not* in the field data — all "unknown" — so crop view is inferred from altitude zone); church-forest ring, stone bunds, ox-plough, trees.
- Ground DEM tiles span ~6–16 km of real terrain but are drawn in a 2.4 km world (horizontal compression, 0.6× vertical) by the shared pack, so fields look smaller/steeper than life.
- Field shape classes are geometry heuristics. In the sampled windows ~95–98 % are small irregular "jigsaw"; lowland mechanized blocks and riparian strips are rare, so the Compare panel takes those examples from `ex_block` / `ex_riparian` (other places, flagged "Example from").

## Controls
Orbit: drag = rotate, wheel/pinch = zoom, Shift/right-drag = pan, WASD pan, click a label (Gheralta, GERD, Abay gorge, Imet Gogo) or a pill / keys `1–4` to dive, `0` back to orbit.
Region: drag/wheel, WASD pan, `V` or "Walk ▾" to drop to ground; walk with WASD / on-screen stick; "Jump to" pills (fields, ox-plough, church forest, stone bunds).
Looks: Raw, Silver Gelatin, Risograph Stipple, Woodblock, Cyan Jerikan (`LookAuditionMV`).

## Known gaps
- `abyss-human-forge` runtime (`AllometricRig`) is **not** integrated: it renders to its own WebGL2 context; ground level uses the existing donkey cast (Imani, Mistletoe, ploughman).
- Simien tile has only 139 real field polygons (FTW sparse there).
- Tana plain fields (`tana` pack) are only used in the Compare panel (no DEM tile for it).

## Notes from audit
- The GERD dive centres on the `gerd_belaya_escarpment` DEM tile (≈11.15–11.30°N, 35.10–35.25°E); the dam itself (11.2153°N 35.0931°E) lies at the tile's western edge, so the HUD shows tile coordinates, while the orbital map pin and label use the dam coordinate.
- First dive to a region shows a one-off frame hitch while the terrain pack decodes/compiles shaders.
