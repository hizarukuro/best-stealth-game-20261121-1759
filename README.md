# Hushstack: The Night Archive

[![make.fun bounty](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/hizarukuro/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/hizarukuro/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

A top-down stealth game in vanilla JavaScript and Canvas 2D — no libraries, no
network, everything generated in code. You are a thief in a candle-lit grand
archive at night. Take the **Ember Atlas** from its pedestal, then reach the
exit unseen.

## How it plays

- **Lantern Wardens** patrol waypoint beats with translucent vision cones that
  are raycast against the shelves, so tall bookcases carve real shadows into
  their gaze. Calm cones are teal, suspicious amber, alerted red.
- **Detection fills over time** — faster in lamplight, slower in shadow, never
  while you are hidden inside a low book stack — and decays when you break line
  of sight, so a glimpse is recoverable. A warden who hears a noise or catches a
  glimpse investigates it ("WHAT WAS THAT?"); one who is sure gives chase.
- **Cover and light are the game:** low stacks hide you, tall shelves block
  sight and movement, lamp pools betray you at longer range, deep shadow keeps
  you. Throw a coin (click) to pull a warden off his beat. Optional loot —
  inkwells and coin stacks — rewards the thorough.
- Being caught costs a strike; three strikes and the night is lost. Three
  floors of growing size and warden count: **1 · The Reading Room**,
  **2 · The Long Stacks**, **3 · The Ember Vault**.

## Controls

- **WASD / arrows** — move
- **SHIFT** — sneak (silent, slow) · **SPACE** — sprint (fast, loud)
- **E** — take the Atlas
- **CLICK** — throw a coin to draw a warden
- **ESC** — pause · **R** — retry the floor

Sound is synthesized with WebAudio — footsteps that give the wardens away,
a coin's tick, the sting when you are spotted. No audio files.

## Layout

- `game/index.html`, `game/style.css` — the page and its frame
- `game/js/main.js` — boot, input, the game loop
- `game/js/levels.js` — the three floors: maps, patrol beats, lamps, loot
- `game/js/guards.js` — patrol, vision cones, detection, investigation, pursuit
- `game/js/player.js` — movement, sneak/sprint, hiding, the coin throw
- `game/js/render.js` — floor, shelves, lamps, lighting, cones, actors
- `game/js/hud.js` — header, detection banner, side panel, screens
- `game/js/audio.js` — the WebAudio sound kit
- `game/js/state.js` — game state, floor flow, strikes
- `game/js/geometry.js` — line of sight and cone raycasting

Built with make.fun — referral code c23ct4sn
