# make-photo
After Ansel Adams ("You don’t take a photograph, you make it"): haul 8×10 plates by burro or woody roof-deck and sculpt living worlds across 11 tonal zones.

## THRESHOLD (11 Tonal Worlds)

[`zones/`](./zones/) maps each Ansel Adams tonal zone (`0`–`X`) to its own procedural GPU shader world (`Light Alone`, `The Set`, `Warm Cave`, `Silhouette`, `Woodblock`, `Silver Gelatin`, `The Card`, `Spray Wall`, `Watercolour`, `Cyanotype`, and `Optical Glass`, plus `Risograph` and `Ink Wash`), pulled through camera focus (`Threshold` hybrid pull, `Depth Shells`, or `11 Tonal Strata`) with the shared pack donkey Mistletoe, woody wagon roof-deck, and Three-Clocks WebAudio.

## MONOLITH-3 (Open World + Mistletoe)

`MONOLITH-3.html` is a self-contained single-file field expedition (`~21 MB` Tier-1 lossless build) uniting:
- **Open-world Grand Teton & Yosemite**: walk directly from Snake River Overlook down the Bluff Switchback Trail to the river, upstream Oxbow, and Far-Bank Terrace, and roam Yosemite's Half Dome granite apron alongside the Zone System notch pass.
- **Skinned Pack Donkey (Mistletoe)**: shared procedural 25-bone skinned burro (`donkey/donkey.js`) with fur shells, coat projections, weighted Left/Top/Right cargo balance, lead-rope/tether/mounted driving across 4 gaits, and autonomous drives (trust, hunger, fear, refusal, cliff caution).
- **8×10 Field Camera & Expedition Map**: unpack the 3D tripod and view camera anywhere on foot (`C`) to expose contact prints into the Map & Plates archive (`M`).

Modular sources live in `monolith3/` (`ui.css`, `body.html`, `game.js`) and `donkey/` (`donkey.js`, `coat_*.jpg`), compiled deterministically via:

```sh
python3 scripts/build_monolith3.py
```

## Pack Donkey

`donkey/` is a playable level: lead a pack donkey to a cairn, set up a plate camera by hand, and bring good glass plates home before the light goes. The donkey itself is reusable in other pages. See `donkey/README.md`. Open `donkey/index.html` from a web server, or `/donkey/` on GitHub Pages.
