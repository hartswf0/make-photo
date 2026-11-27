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

## Physics (Rapier)

The ground, trees and walls are solid. Loose things have real bodies and tumble: the yellow cart, the white barrel, two pyramids of paint cans, four tyres, two drums. Vehicles and people shove them; paintballs knock them and count them.

## Paint

The gun is MESA CHIP's (`mesa/ink.js`): a ball on an arc that lands wet, runs on walls, and cures into leaded stained glass. The ground, the den wall and the garage take paint. The header counts square metres of glass.

## For two (`mesa/net.js`, words in `duo.js`)

"Play with a friend" on the first card makes a link (`…/up-back/?with=cobalt-horn-35`) and opens the share sheet. Whoever opens it is in the yard too, in an olive coat.

- Each phone moves its own player and resolves hits on itself: a friend's ball that lands on you, or on the vehicle you are driving, is a tag. The header shows tags for and against.
- Whoever last drove a vehicle owns its position; the other phone follows it. A vehicle someone is driving cannot be taken.
- Not shared: loose props, leaves, figs, and paint already on the ground when someone joins (new paint is, because every shot is replayed on both phones).
- Peer to peer through PeerJS's public broker; no account and no server of ours. Tested with two tabs over a stand-in channel (`?netlocal`), not yet phone to phone.

## Not yet

- The trucks are boxy.
- Trees do not take paint (their colliders are fatter than their trunks, so the glass would float).
- No boat.
