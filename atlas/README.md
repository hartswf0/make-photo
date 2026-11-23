# World Atlas

One map for every world in make-photo. `worlds.json` registers each world once, with its places in WGS84 lat/lon and how its local metres map to the Earth. `index.html` draws them on one Mercator map and streams real elevation only for what is on screen and large enough to read.

## What is registered (15 worlds, 85 places)

| Kind | Worlds |
|---|---|
| Real place | MONOLITH-3 (Grand Teton), zones, MONOLITH (Half Dome), field-plates, Ethiopia highlands (4 DEM tiles), Abyssinian roof (country DEM) |
| Composite of real places | Highland Exposure and Scion Demiurge (Entoto to Simien, compressed about 40:1), Abyssinian transect, WYGWYL island (six real places rotated into one), City3D Baltimore |
| Montage | Donkey Water 2086 (Teton metres, with Simien pasted 1.6 km west, a procedural abyss, Half Dome mirrored in) |
| Fictional, anchored | Pack Donkey (named for Tuolumne Meadows), Atlantis (anchored to Centro CDMX through the island), Nolli block (no place) |

Not spatial, so not registered: study, music-video, city/design-room, the root index.

## How it streams

1. **Registry** (`worlds.json`, about 20 KB): every world and place. Drawn at Earth scale as drops; a world's places separate as you zoom.
2. **Land outline**: Natural Earth 110 m from jsdelivr (`world-atlas@2.0.2`). If it fails, the graticule alone is shown.
3. **Country elevation**: the Ethiopia orbital DEM (`abyssinian-highlands/orbital/orbital_dem16.bin`, 450 KB, 1.8 km cells) loads when Ethiopia fills more than 140 px, and fades out as you go closer.
4. **Valley elevation**: each Ethiopia tile DEM (`ethiopia-highlands/terrain-pack/*.dem16.bin`, 295 KB, 384 x 384 over 6 km) loads when its box fills more than 36 px, with its carrier trail drawn on it.
5. **Enter**: every place opens its own world (Ethiopia tiles deep-link with `?region=`).

## Freed terrain (done)

`python3 atlas/build_terrain.py` pulls the Grand Teton far (801 x 1281), near (641 x 681) and detail (201 x 201) grids out of `MONOLITH-3.html`, and the Ahiya hillside (91 x 91) out of `night-post/ahiya-real-terrain.js`, into `atlas/data/*.bin`. They stream exactly like the Ethiopia tiles.

## Liquid, and the game's own map

The map renders under the rain engine's glass (`night-post/rain/engine.js`): each visible world or place is a lens drop that refracts the ground under it, routes and Donkey Water's seams are currents, a drag moves water and a tap splashes. Inside Donkey Water, Menu → Map (or tapping the way) opens this same atlas at the carrier's real latitude and longitude with `?embed=1&me=lat,lon`; Back returns to the world.

## What the next streams need

| World | Data | What is needed to stream it here |
|---|---|---|
| Highland Exposure | 196 sectors of 1 km with byte offsets and sha256, inside the 6.7 MB html | move `terrain-src` out to a sidecar `.bin`; the sector table is already a streaming index |
| WYGWYL island | `city/island/data/height_grid.json` | per-region rot and scale are needed to place each piece on Earth |

## Contradictions the atlas keeps visible, not merged

- Donkey Water walks from the Simien pump to the Teton Pueblo in about 0.7 km; on Earth they are about 13,000 km apart. The atlas draws that seam as a dotted thread.
- Highland Exposure and Scion Demiurge are the same corridor with different anchors (Entoto z -6400 vs -6275, Roha 2800 vs 2400).
- The Ahiya 10 degree rotation sense is not recorded, so Ahiya positions other than the pump are marked approximate. So are Half Dome mirrored pieces and the places named only from general knowledge (Assateague, Teotihuacan, Tres Marias, Tuolumne).

Regenerate `worlds.json` with `python3 atlas/build_worlds.py` from the repo root (it reads the Ethiopia and orbital manifests directly).
