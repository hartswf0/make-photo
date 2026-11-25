# Genie triage: why The Sealed Line failed, and how we drive Genie

Evidence comes from three paid sessions: bottle-001, sealed-001 and the earlier Tex take. It also uses the google-genai SDK source (`_gaos/types/interactions`) and the frames themselves. Google's docs pages could not be reached from this container, so nothing here is taken from them.

## How we control Genie (`genie/take.py`)

Everything goes over one WebSocket (`wss://generativelanguage.googleapis.com/v1beta/interactions/live`). Six kinds of message exist, and we send them in this order:

```
{"event_type": "interaction.create", "model": "genie-4"}
{"event_type": "world_setup", "world_prompt": "<text>", "reference_image": {"data": "<base64 jpeg>", "mime_type": "image/jpeg"}}
{"event_type": "user_action", "action": "key_down", "input": "key_w"}      # held until key_up
{"event_type": "input", "content": [{"type": "text", "text": "<event line>"}]}
{"event_type": "user_action", "action": "key_up", "input": "key_w"}
{"event_type": "interaction.complete"}
```

The SDK's only keys are:
- `key_w`, `key_a`, `key_s`, `key_d`;
- `arrow_up`, `arrow_down`, `arrow_left`, `arrow_right`;
- `space`, `key_e`.

Actions are `key_down`, `key_up` and `key_click`. There is no mouse, camera or "character" channel. The camera is whatever the prompt and the image make it.

## What happened in sealed-001 (log.jsonl)

```
0.51  key_w down (held for the whole take, released at 117.5)
2.61  "He walks the length of the empty carriage."            42 chars, x4
6.61  "He reaches the closed door ... brass handle."          80 chars, x4
10.1  door 1 cue                                              2,383 chars, x4
14.1, 18.1, 21.6  follow-ups                                  368 / 272 / 80 chars, x4
... the same every 15 s, to door 7 at 100.1 ...
```

Totals: 31 text lines, each sent four times, so 124 text messages. That came to 17,856 input tokens of text.

## Triage

**1. The style changed in the first 8 seconds, before any door cue.**
- **Frame 0** is the seed: dark, heavily graded, vignetted, and a jointed, mannequin-like figure in a gold-patterned coat.
- **By 8 s** it is a flat, bright, neutral photoreal carriage and an ordinary man in a beige coat.
- **Only two short lines had been sent by then.** So the main cause is the world setup and the seed, not the cues. Three things in it:
  - **We weakened the seed ourselves.** `seed()` squeezed it under a 48 KB limit, down to 1024×576 at JPEG quality 55 with a 0.9 px blur. That limit is our own assumption, never verified. The SDK has no size limit, and it also accepts a `uri`. The seed is the strongest anchor for style and for who he is, and we sent a soft, small copy of it.
  - **The look was a list of adjectives.** "technicolor-sepia dust, imperial gold, teal and indigo shadow, blood red, amber lamps, heavy grain" is not something Genie can see. What it can see (the bright desert, the teal panels, the red seats) it kept. The grade it dropped, because it renders toward its own photoreal default.
  - **The seed's figure is ambiguous.** It has no face and jointed wooden-looking arms, so Genie resolved it to the most likely person.

**2. He is white because nothing said otherwise.**
- The prompt says "a lone traveler in a long canvas duster coat and a dark felt hat". It names no race.
- The seed shows no face.
- Genie's default is a Hollywood-western white man, and it gave us one, plus two white men in suits and a white violinist.
- Our world is an Ethiopian western (Haile Gerima meets Leone; Almaz, Yared, Selam, Girma; habesha dress, the krar, the highlands). None of it was in the prompt except the phrase "Ethiopian western-noir", used as a colour grade.
- This is the biggest failure. Who people are has to be stated in the first sentence and shown in the seed.

**3. The prompt named the things it forbade.**
- The opening prompt said: "No passengers, no luggage, no cups, no bees ... no cuts ... interface overlays".
- **A text model reads "no bees" as "bees".** Bees, a paper cup and passengers all arrived.
- **Negatives should be dropped, not listed.** Say only what is there.

**4. Walking worked, then stopped.**
- W was down from 0.5 s to 117.5 s.
- From 0 to about 20 s he walks forward. The seat bays pass at about one every 4 s, so he covered roughly a fifth of the carriage in 20 s.
- At 18–24 s the door-1 follow-ups put two men next to him ("uses him as a shield", "straightens his hat"). He stopped, and the camera turned to face them.
- From then on the text cues, not the W key, decide what the frame does. **Text that asks people to do things to him overrides walking.**
- At that pace the far door is about 90 s away. **The schedule sent door cues at 9.5 s, while he was still near the start of the first carriage, so no door ever opened.**

**5. The cues were far too big.**
- Each door cue was about 2,400 characters, about 400 words, with 15 to 20 objects, 5 to 6 groups of people and 5 to 6 actions.
- It was sent four times in 600 ms, and three more lines followed every 4 s.
- **Genie realised fragments**, chosen from the whole list at random: the calf, the armour, the cup, the violinist, the targeting boxes.
- It never changed the room except once, at 55.5 s, as a hard cut.

**6. Repetition and pacing were our guesses.**
- "Send it N times, 150 ms apart" came from a secondhand summary of Google's example (ten times). We never measured whether it helps.
- With a 2,400-character line it may be doing harm: four restatements of everything in 0.6 s.

**7. The session length can't hold seven rooms.** Genie 4 sessions end at 120 s. Seven doors left 15 s each, below what it takes to walk to a door.

**8. Our earlier takes said the same thing.**
- In bottle-001, holding W moved him, the photoreal look held because it was already Genie's default, and every camera instruction in text was ignored.
- The Tex take held its style because the seed and the prompt agreed and the text cues were few and short.

## What a prompt needs (our working rules)

1. **Who, first, and in the seed.** For example: "A Black Ethiopian man in his thirties, short beard, a canvas duster over a white gabi, a dark felt hat". The seed shows the same person, face partly visible.
2. **Describe the world in concrete things the camera can see,** in 80–150 words. No lists of colours. No negatives.
3. **Set the camera and the movement once,** in the setup: "third person, from behind at shoulder height; he walks steadily down the aisle". Then hold W. Don't restate it in every line.
4. **Send the seed sharp,** at 1280×720 and high JPEG quality.
5. **Send short event lines:** one event, 10–25 words, with a source, a motion and a consequence. Send it once, or twice at most. At least 8 s between lines.
6. **Do nothing to him while he must keep walking.** Things happen next to him, not to him.
7. **Room changes happen only at a visible door.** Seed him close to it, watch the frames, and send the cue only when the door fills the frame.

## Yes: just walking the train is the right test

A world prompt, W held, and no text at all, for 30 s. That one take measures what we keep guessing:
- walking speed;
- whether the third-person view holds;
- whether the style and the man hold;
- what Genie does at a door by itself.
