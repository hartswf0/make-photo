# Pack Donkey

A drivable pack donkey, a plate camera you operate by hand, and a day's assignment.

Open `index.html` from a web server. Add `?level=pass` for the second level.

## Files

| File | What it is |
|---|---|
| `donkey.js` | The animal. Self-contained and reusable: model, fur, gaits, moods, load physics and its own decision-making. Needs only three.js r160 and the `coat_*.jpg` textures. |
| `main.js` | This game: terrain, levels, controls, packing, the plate camera, the assignment. |
| `index.html` | Page, layout and styles. |
| `example.html` | The smallest page that uses the donkey on its own. Start here to put it in another level. |
| `coat_*.jpg` | Coat textures projected onto the model. |

## Using the donkey somewhere else

```html
<script src="three.js"></script>
<script src="donkey/donkey.js"></script>
<script>
  const donkey = makeDonkey({ assetPath: "donkey/" });
  scene.add(donkey.group);
  donkey.place(0, 0, 0, heightAt);                       // heightAt(x, z) returns ground height
  // every frame:
  donkey.update(dt, { throttle: 1, steer: 0, pace: 0 }, heightAt);
</script>
```

`throttle` and `steer` run from -1 to 1. `pace` is 0 walk, 1 trot, 2 canter, 3 gallop. What you pass is a request: the donkey may slow it, refuse it or bolt, depending on load, slope, tiredness, fear, hunger and trust. Set `donkey.state.brainOff = true` for an animal that simply obeys.

Other calls: `setCargo([{kg, slot}])`, `resaddle()`, `setMood(id)`, `lie()`, `feed()`, `soothe()`. Read `donkey.state` for speed, stamina, label and thought, and `donkey.mind` for its drives. The full list is at the top of `donkey.js`.

## Adding a level

Add an entry to `LEVELS` at the top of `main.js`:

```js
ridge: { name: "Cathedral Ridge", relief: 1.8, keepers: 3, minutes: 10, cairn: [40, -60], next: "meadow",
         brief: "One line telling the player what the day asks." }
```

`relief` scales how rough the ground is, `cairn` is where the camera spot is marked, `keepers` is how many good plates the day asks for, and `minutes` is how long the light lasts. Open it with `?level=ridge`.
