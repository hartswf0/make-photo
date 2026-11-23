# One cast, one operator surface

## Where each world stands

| World | Mistletoe (donkey.js) | The cast (characters.js) | Operator surface |
|---|---|---|---|
| Donkey Water (night-post) | yes | yes, canonical | rain surface (`night-post/rain/surface.js`) |
| Overworld (atlas) | yes, follows you, rideable | yes: Imani via `CAST_2086` | **the rain surface**, through its own `AhiyaBridge` (legacy buttons: `?legacy` or `overworld-legacy.html`) |
| Ethiopia Highlands | yes | yes, but re-specified by hand (its Imani's coat differs) | its own HUD |
| Abyssinian roof | yes | yes | its own HUD |
| zones | yes | yes | its own HUD |
| MONOLITH-3, field plates | yes (embedded copy in MONOLITH-3) | no | their own HUDs |
| Abyssinian transect | yes | partly | its own HUD |
| Highland Exposure, Scion Demiurge | no | no (own figures) | their own HUDs |
| WYGWYL island, city suite | no | no | their own HUDs |

## The one cast

`donkey/characters.js` now exposes `window.CAST_2086`:

```js
CAST_2086.make(THREE, 'imani')      // the same Imani in every world
CAST_2086.get('saba')               // a copy of a canonical spec
CAST_2086.specs                     // everyone: the western basin and Ahiya casts
```

Drive any member with the shared motion clips: `Mesh2MotionWorldBridge.createWorldCastDriver(...)`, `registerActor(id, ch)`, then `setActorLocomotion(id, { speedMps, carrying, sitting })` each frame. The donkey is `makeDonkey({ assetPath: '../donkey/' })`.

## The one operator surface: the contract

The rain surface reads nothing from a world except one object, `window.AhiyaBridge`. Any world that provides it gets the same glass, drops, threads, menu and map.

```js
window.AhiyaBridge = {
  canvas,                                  // the world's canvas (for the glass to refract)
  state() { return {
    ready, clock, lang,
    water:  { liters, capacity, reserve, donkey, donkeyDown },
    place:  { id, name, next, visited },
    mode,   speed, exit,                   // 'walk' | 'ride' | 'drive' | 'glide'; exit = the way out of a state
    live,                                  // the one act valid here: { kind, id, label, x, y }
    busy, speech, said,
    lens:   { focus, filter, stop, tilt, ... },
    things: { donkey, source, can, people, next, wagon },   // screen positions of what can be touched
    map, pos, sound
  }; },
  act: { live, exit, steer, look, jump, say, focus, set, lean, restore, warp, travel, expose, lang },
  menu() { return [{ id, group, label, value, on, run }] }
};
```

Donkey Water implements it in `night-post/night-post.js`. A world that cannot do something leaves that field empty and the surface drops it; nothing breaks.

## Order to bring the rest in

1. Ethiopia Highlands and Abyssinian roof: switch their hand-copied cast to `CAST_2086.make`.
2. ~~Overworld~~ done: its bridge offers Enter (a level's place), Sail (a ferry pier) and Draw (a well), the Go menu gains Boat, and Map opens the archipelago at your spot.
3. zones, then MONOLITH-3: the same.
4. Highland Exposure and WYGWYL: they have no carrier or water yet; give them Imani and Mistletoe first.

## Legacy copies

Before moving a world onto the one surface, keep a copy beside it: `atlas/overworld-legacy.html`, `atlas/map-legacy.html`, and Donkey Water's `?rain=1`. The git tag `legacy-before-one-surface` marks the same point locally (this session's proxy would not push tags).
