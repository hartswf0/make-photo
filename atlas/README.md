# The Archipelago

One invented sea holding the real ground of every level we have, each island at its true scale. Only the arrangement is fiction: each island is its level's own elevation grid, lowered into the sea at its edges.

| Island | Level(s) | Ground | Size |
|---|---|---|---|
| Grand Teton | MONOLITH-3, zones, Donkey Water west | USGS 3DEP, from inside MONOLITH-3.html | 24.6 x 38.7 km |
| Half Dome | MONOLITH, field plates | Yosemite survey, from MONOLITH-3.html | 18 x 12.2 km |
| Entoto–Simien corridor | Highland Exposure, Scion Demiurge | Copernicus 30 m, compressed 40:1 along the corridor | 14 x 14 km |
| Simien, Gheralta, Blue Nile Gorge, Belaya Escarpment | Ethiopia Highlands | AWS Terrarium DEM tiles | 5.8 to 16.5 km |
| Ahiya | Donkey Water, Ahiya circuit | Copernicus GLO-30 at the Basalt Pump, at its true place 1 km below Simien | 0.9 km |
| WYGWYL | city suite, Atlantis, Nolli block | the island's own height grid, roads, rails and streets | 9.6 x 6.4 km |

Not islands: Pack Donkey and the Abyss (procedural, no saved ground), study and the music video (not places).

## Build

```
python3 atlas/build_archipelago.py   # paints archipelago.jpg, archipelago-small.jpg, isles/*.webp; writes archipelago.json
```

`archipelago.json` holds every island's places, roads, trails, rails, rivers and streets in map kilometres, and a `frame` for the islands a game can stand on, so a game can open the map at its player: `atlas/?embed=1&island=ahiya&x=-1460&z=760`. Donkey Water's Map does exactly that.

## Files

- `index.html`: the map. Pan, pinch, wheel, double-tap; tap an island or place for its card and Enter.
- `globe.html`: the earlier Earth view, kept for reference.
- `build_worlds.py` / `worlds.json`, `build_terrain.py` / `data/`: the registry and the freed terrain grids.
