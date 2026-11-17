# make-photo
After Ansel Adams ("You don’t take a photograph, you make it"): haul 8×10 plates by burro or woody roof-deck and sculpt living worlds across 11 tonal zones.

## THRESHOLD · Donkey Water Sci-Fi (MONOLITH-3 Open World × 11 Tonal Worlds)

[`zones/`](./zones/) streams the real `MONOLITH-3` USGS Grand Teton (Snake River Overlook, Bluff Trail, Silver Ford, Oxbow, Far-Bank Pueblo) and Yosemite Half Dome open world with **Physics & Collisions OFF** for crisp cruiser handling in the **1940s Woody Station Wagon** (`buildWagon`) where **Mistletoe** rides the roof-deck (ash-wood Sawbuck pack saddle, flush-ribbed 20L electric-cyan jerrycans, diamond-hitch rope & Scion transceiver). Includes **Summit Donkey Base-Jumping & Rogallo Paraglider Valley Flight** (`J` key or cliff launch with cyan wingtip contrails), **WiFi-bounded electric-cyan rain** falling strictly inside live Donkey / Relay / Filmstrip Forest coverage domes, **8 elevation-gated Filmstrip Forest groves**, `REC PPC` live `IN-FRAME WIFI %` 8×10 viewfinder, *Cyan Jerikan Over Cosmic Addis* cassette deck, and **14 GPU Zone shaders**.

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
