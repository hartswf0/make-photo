# Up Back

A wet November yard in East Tennessee, built by hand from photographs. Open `up-back/index.html`.

It starts in the den (one wall, no roof, rain on the carpet) and climbs through oak leaves to the Airstream. Ten things to find, shown one at a time. Past the Airstream a trough gate leads into the trough (`atlas/JERRYCAN.md`).

## Playing it

- **On a phone:** the left thumb is a stick, the right thumb turns the view, **Fire** shoots paint, and the button above it does what is here (get up, drive, get out, pick a fig).
- **On a keyboard:** W A S D, arrows turn, Shift runs, E does what is here, Space or F shoots.

## Everything with wheels or tracks runs

| Vehicle | How it drives |
|---|---|
| The Deere track loader | spins where it stands; slow; ploughs the leaves and counts them |
| The zero-turn mower | spins where it stands; quicker; you sit on it |
| The black Denali | steers like a truck; fast; heavy to pull away |
| The Suburban | the same, slower, and it smokes |
| The red bicycle (behind the camper) | steers and leans; no reverse |

Each sits on the ground under its own length and width, squats when it pulls away, rolls into a turn, and bumps when it hits something solid. Vehicles block each other and the walker.

## The excavator, buckets, digging, breaking

- **The excavator** stands at the top of the yard, past the Airstream to the west: tracks nearly seven metres long, a house that swings, a boom, a stick and a toothed bucket. It is slow and nothing stops it: its tracks and bucket break whatever they meet.
- **Arm mode** (the yellow button, or R): the tracks stop and both thumbs work the arm.
  - Excavator: left thumb swings (left/right) and reaches (up/down); right thumb lifts the boom (up/down) and curls the bucket (left/right). On a keyboard: W A S D and the arrows.
  - Deere: right thumb lifts the arms and tips the bucket.
- **Digging.** Put the teeth in the ground and curl in: the ground goes down a square metre at a time, up to six metres deep, and the bucket fills (5 m³ on the excavator). Swing, curl out, and it tips into a pile. The Deere scrapes a little when driven forward with the bucket down. Everything in the world, people, vehicles, leaves, props, follows the new ground.
- **Picking up.** A bucket that closes on loose things carries them: cans, tyres, drums, the cart, and the pieces of anything broken. Curl out and they are thrown with the bucket's speed.
- **Breaking.** Everything placed in the yard comes apart into its own boards, panels and parts, each with a body: the den, the camper, the Airstream, the trailer, the garage panel by panel (lose three and the roof comes down), the bench and engine inside it. Trees fall the way they are pushed. The trucks and the Deere have to ram at speed; the mower and bicycle cannot.
- **Going in.** The garage is open to the south: a bench with paint cans, an engine on a stand, tyres, one bulb. The Airstream has a room in it (Step inside, once you have laid a hand on it). The den was always open.

## Physics (Rapier)

The ground, trees and walls are solid. Loose things have real bodies and tumble: the yellow cart, the white barrel, two pyramids of paint cans, four tyres, two drums. Vehicles and people shove them; paintballs knock them and count them.

## Paint

The gun is MESA CHIP's (`mesa/ink.js`): a ball on an arc that lands wet, runs on walls, and cures into leaded stained glass. The ground, the den wall and the garage take paint. The header counts square metres of glass.

## For two (`mesa/net.js`, words in `duo.js`)

"Play with a friend" on the first card makes a link (`…/up-back/?with=cobalt-horn-35`) and opens the share sheet. Whoever opens it is in the yard too, in an olive coat.

- Each phone moves its own player and resolves hits on itself: a friend's ball that lands on you, or on the vehicle you are driving, is a tag. The header shows tags for and against.
- Whoever last drove a vehicle owns its position; the other phone follows it. A vehicle someone is driving cannot be taken.
- Shared as well: the arm positions, everything broken, every tree felled, and every bucketful dug or tipped.
- Not shared: loose props and pieces, what a bucket is carrying, leaves, figs, and paint already on the ground when someone joins (new paint is, because every shot is replayed on both phones).
- Peer to peer through PeerJS's public broker; no account and no server of ours. Tested with two tabs over a stand-in channel (`?netlocal`), not yet phone to phone.

## Not yet

- The trucks are boxy.
- Trees do not take paint (their colliders are fatter than their trunks, so the glass would float).
- No boat.
- Shrubs cannot be broken. Vehicles cannot be broken or picked up. Broken pieces are capped at 280; the oldest disappear.
- The excavator's cab cannot be entered on foot, and its arm does not collide with things: it breaks them or grabs them.
