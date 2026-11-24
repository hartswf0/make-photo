# One world

What we are building: one continuous world of water and Wi-Fi. Every level is a district you walk, ride, drive, fly or sail into, with the same cast (Imani, Mistletoe), the same controls and the same rain surface. No page loads, no title cards.

## The runtime owns

- **Ground**: `atlas/ow/` holds 2 km terrain tiles, plus `low.bin` for the horizon.
- **Bridge decks**: they come from `build_archipelago.py`.
- **The player**: one controller, one physics (terrain plus decks, rails, a wagon on four wheel samples) and one camera.
- **The game surface**: `night-post/rain/surface.js`, reached through the `AhiyaBridge` contract.

This is `atlas/overworld.html`.

## A region owns

Only what lives on its island: buildings, flora, wildlife, people and their scripts.

- A region is `(ctx, island) -> { update(dt, t, player, donkey), dispose() }`, registered in `atlas/regions.js`.
- It samples the shared ground (`ctx.groundAt`) instead of bringing its own terrain.
- It is mounted when you come within 2.6 km of its island's edge, and let go beyond 5.2 km. Its code is fetched from 7 km out.

All four Ethiopia Highlands tiles (Simien, Gheralta, Blue Nile Gorge, Belaya) mount this way from `ethiopia-highlands/endemic-fauna.js`. The level squeezes its ground into `worldSpanM`; the archipelago keeps it at true scale, so the region scales its landmarks out to match.

## Bridges are airlocks

- The layout solver in `build_archipelago.py` pulls every bridged pair of islands to a 420 m strait, and keeps the others at least 1.4 km apart.
- Bridges are 0.7–1.8 km long and land where both shores are low.
- At wagon speed a crossing is 20–40 s. The far island's region mounts while you are still on the near bridgehead.

## Next regions

Each level page stays as a thin wrapper for working on its region alone. In order of size:

1. **WYGWYL city**: 1.9 MB.
2. **Abyssinian roof**: 11 MB.
3. **Night Post / Ahiya**: 29 MB.
4. **Highland Exposure**: 61 MB.
5. **MONOLITH**: 733 MB. Its assets need a diet first.

The container format each region ships in, the jerry can, is specified in `atlas/JERRYCAN.md`, along with a taxonomy of every level.
