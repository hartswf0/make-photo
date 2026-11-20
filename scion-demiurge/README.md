# SCION DEMIURGE — Abyssinian-Harar Vertical Open World

A self-contained, single-file WebGL2 + Web Audio API playable open world (`989.5 KB`) compiled deterministically from an immutable open-commercial geodetic and agricultural vault (`1.77 MB`).

- **Live Runtime (Standard)**: `https://hartswf0.github.io/make-photo/scion-demiurge/`
- **Live Runtime (Blind HUD-Free `?hud=0`)**: `https://hartswf0.github.io/make-photo/scion-demiurge/?hud=0`

---

## 1. World Thesis & Spatial Polarity

- **Governing Physical & Social Law**: Across the `911 m` to `4,550 m` Ethiopian flood-basalt stratigraphy, ascending altitude buys optical sightlines and cyan microwave relay connectivity while exacting mechanical traction loss, 12-ton Isuzu FSR brake-drum heat/fade on canyon descents, unacclimated `VO2max` hypoxia (`0.581` on Ras Dashen), and `20 L` jerrycan water-haulage cost.
- **Anisotropic Compression Law**: Horizontal inter-basin distances are compressed **`40:1`** along Rift escarpment fault hinges into a continuous **`14 × 14 km` (`196 km²`, `196` `1×1 km` sectors)** playable world, while cliff faces, the **`1,500 m` Blue Nile (Abay) Gorge drop** (`1,006 m` silt-water thalweg, `1,020 m` steel truss bridge), the **`12.0 m` Roha/Lalibela subtractive volcanic-tuff trench** (`2,500 m -> 2,488 m`), and the **`4,550 m` Ras Dashen Afroalpine crown** remain locked at **`1:1` metric vertical scale**.
- **Crucible Corridor (`2 × 14 km`, 28 high-detail sectors inside 168 SLOD sectors)**:
  1. **Entoto Overlook Rim (`3,202 m`, `Z = -6,275 m`)**: Eucalyptus crown, aviation-lit red/white + cyan Relay Mast, and unobstructed over-the-shoulder sightline down into Addis.
  2. **Addis Korkoro Market & Elevated Light Rail (`2,400 m`, `Z = -3,920 .. -3,550 m`)**: Corrugated *korkoro* market stalls, moving `18 m/s` green/white LRT tram viaduct, and consequent *buna* (coffee) ceremony vendors whose 6-puff roasting smoke extinguishes while vendors shelter beneath lit porch eaves during `KIREMT_SQUALL` monsoon rain (`-49.6%` clay-mud friction drop).
  3. **Blue Nile (Abay) Gorge Switchbacks & Steel Bridge (`1,006 m / 1,020 m`, `Z = -2,300 .. +600 m`)**: `63.63 km` unfolded civil bench-cut switchback corridor (`<= 13.29%` grade with `68 m` turnaround pads), 4 grounded concrete bridge piers (`950 m` footings), and 12-ton Isuzu FSR thermal brake-fade physics (`>380°C` runaway + glowing wheel hubs vs. cool `E` exhaust/engine-brake descent).
  4. **Roha Subtractive Sanctuary Trench (`2,500 m -> 2,488 m`, `X = 20 m, Z = 2,400 m`)**: Negative-volume `30 × 30 × 12.0 m` red-tuff courtyard entered via a watertight `10 m` western dromos ramp (`X = -35 m .. +5 m`), housing a walkable cruciform monolith nave (`TRENCH` convolution reverb) protected by an unconditional `r = 64.0 m` `BAREFOOT_NON_COMBAT` Sanctuary Dignity perimeter.
  5. **Simien Escarpment & Ras Dashen Crown (`4,550 m`, `Z = 5,400 .. 6,220 m`)**: `100%` flood-basalt/scree summit cone, Giant *Lobelia rhynchopetalum* rosettes, endemic Gelada / Walia ibex / Ethiopian wolf ecology, hypoxia sprint cap, and deep-skirted dry-stone summit cairns.

---

## 2. Controls & Modes

| Input | Action |
| :--- | :--- |
| `Click Canvas` | Lock pointer & initialize procedural Web Audio synthesis / convolution IR |
| `W / A / S / D` | Move / Drive / Pitch & Roll Glider (`S` = service wheel brakes in vehicles) |
| `Shift` | Sprint (governed by altitude `VO2max` hypoxia) / Vehicle full throttle |
| `Space` | Jump (on foot) / Handbrake |
| `E` | Toggle **Exhaust / Engine Brake** (prevents `>380°C` Isuzu brake fade on Abay descent) |
| `1` – `5` | Traversal Mode: `1` Foot, `2` Pack Donkey, `3` Minibus HiAce, `4` Loaded 12t Isuzu FSR, `5` Thermal Ridge Glider *(locked to `1` Foot inside Roha `r = 64 m` Sanctuary)* |
| `T` | Cycle Solar Phase (`MORNING`, `ZENITH`, `DUSK`, `NIGHT`, `DAWN`) |
| `R` | Toggle `KIREMT_SQUALL` Monsoon Rain (alters `μ` traction, rain audio, buna smoke & NPC shelter) |
| `H` | Toggle HUD (`?hud=0` URL parameter forces pure zero-HUD blind traversal mode) |
| `M` | Mute / Unmute procedural Web Audio engine |
| `Tab` | Toggle **Demiurge Status Desk** (live GPU/CPU telemetry, `ΔΔ` inquiry receipts, active sector, provenance hashes & `[[GHOST::CLEAN_LALI_SFM]]` status) |

---

## 3. Reproducible Compilation & Hardware Verification

All raw geodetic and cadastral inputs live inside `scion-demiurge/vault/` with zero external dependencies beyond Python 3 (`numpy`) for compilation and Node.js + local Chrome for headless hardware probing:

```bash
# 1. Compile 196-sector graph, run ΔΔ switchback inquiry, enforce seam & hydrostatic invariants
python3 scion-demiurge/compiler/compile_crucible.py

# 2. Bundle engine_template.html + crucible_pack.json into single-file index.html (< 1.02 MB)
python3 scion-demiurge/compiler/build_single_file_runtime.py

# 3. Run automated WebGL2 + kinematic + Sanctuary Dignity hardware verification probe
node scion-demiurge/compiler/kinematic_probe.mjs
```

To serve locally and inspect in `?hud=0` blind mode:

```bash
python3 -m http.server 8900
# Open http://127.0.0.1:8900/scion-demiurge/index.html?hud=0
```

---

## 4. Directory Layout

```text
scion-demiurge/
├── index.html                        # Self-contained WebGL2 + Web Audio playable runtime (989.5 KB)
├── README.md                         # Operational, architectural & reproduction guide
├── vault/                            # Standalone immutable open-commercial source archive (1.77 MB)
│   ├── orbital_dem16.bin             # Public Domain AWS Open Data Terrain z7 macro shell
│   ├── blue_nile_gorge.dem16.bin     # Public Domain Copernicus GLO-30 z12 Abay canyon DEM
│   ├── simien_imet_gogo.dem16.bin    # Public Domain Copernicus GLO-30 z13 Simien escarpment DEM
│   ├── fields_dem_gorge.bin          # CC-BY-4.0 Fields of The World (FTW 2025) gorge agricultural parcels
│   ├── fields_dem_simien.bin         # CC-BY-4.0 FTW 2025 highland agricultural parcels
│   ├── terrain_manifest.json         # Upstream DEM provenance & tile bounds
│   └── ftw_manifest.json             # CC-BY-4.0 FTW attribution & schema manifest
├── compiler/
│   ├── compile_crucible.py           # Geodetic domain warp, ΔΔ civil switchback solver & MLO compiler
│   ├── build_single_file_runtime.py  # Zero-dependency single-HTML bundler
│   └── kinematic_probe.mjs           # Headless Chrome CDP WebGL2 / physics / dignity test suite
├── runtime/
│   └── engine_template.html          # WebGL2 shaders, instanced renderer, 3D suspension & Web Audio graph
└── compiled/
    ├── sector_graph_196.json         # 196-sector (14x14 km) streaming topology & 0.00 m seam audit
    ├── crucible_pack.json            # Quantized 561x561 terrain/material pack + 862-vertex road spline
    └── validation_ledger.json        # Four-tier epistemic ledger (MEASURED / STRUCTURAL / JUDGED / ACTIVE_GHOST)
```

---

## 5. Circuit Breakers & Active Ghost (`[[GHOST::CLEAN_LALI_SFM]]`)

1. **Provenance Circuit Breaker**: `100%` of compiled terrain and agricultural parcel data derives from SHA-256-verified Public Domain (AWS Terrarium / Copernicus GLO-30) and `CC-BY-4.0` (Kerner et al. 2025 *Fields of The World*) sources in `vault/`. Zero restricted non-commercial academic TLS scans (e.g., Zamani Project / UCT) were ingested.
2. **Sanctuary Dignity Circuit Breaker**: Around the Roha rock-hewn sanctuary (`(20, 2400)`, `r = 64.0 m`), highway geometry is routed West (`>= 155.0 m` clear), non-pilgrim AI agents are excluded (`>= 182.44 m` clear), stone bollards halt vehicles outside the perimeter (`X <= -46.4 m`), vehicle/donkey mode switches are refused, airborne gliders auto-dismount to `BAREFOOT_NON_COMBAT` foot traversal upon crossing `r <= 64.0 m`, and zero combat or extractive mechanics exist anywhere in the runtime.
3. **`[[GHOST::CLEAN_LALI_SFM]]`**: Rather than scraping non-commercial laser scans, the Roha monolith uses a clean-room parametric subtractive volcanic-tuff proxy and logs `[[GHOST::CLEAN_LALI_SFM]]` across `sector_graph_196.json`, `crucible_pack.json`, `validation_ledger.json`, and the `Tab` Status Desk, specifying a permitted ground + 6 m telescopic-pole Structure-from-Motion capture with ARCCH and the EOTC Lalibela Parish Council outside liturgical hours.
