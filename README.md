# Nusa Wings — Archipelago Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/yandreload/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/yandreload/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Entry for the make.fun bounty
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057)
($500 USDC, 50 paid places, closes Fri 28 Nov 2026 07:57 WIB).

## The game

Fly a bush plane over an Indonesian archipelago in a chase view: sea,
islands and a low sun ahead, gold rings to thread, and a runway strip on
Pulau Landas waiting at the end of the course. Three sorties with different
pressure — **Ring Run** (8 rings, full tank), **Island Hop** (6 rings on 60
fuel) and **Storm Courier** (8 rings in 170 seconds with gusts shoving you
sideways). Fuel burns, hard landings damage the airframe, and a gentle,
well-aligned touchdown pays a landing bonus.

- **Controls:** ↑ ↓ pitch, ← → turn, Shift / Ctrl throttle, P pause, M mute.
  Click a mission card, or press 1 / 2 / 3, to fly. Mouse buttons work on
  every menu: start, resume, restart, change mission.
- **HUD:** altitude, speed, vertical speed, a compass tape with heading,
  throttle, fuel and damage gauges, an attitude indicator, ring counter,
  score, and a next-ring pointer so you are never lost.
- **Sound:** everything is synthesised in WebAudio — engine hum, wind, ring
  chimes, landing thud, low-fuel alarm. No audio files, no network requests.

## How it is built

Plain static files under `game/` — `index.html` plus ES modules, Canvas 2D,
no library, no build step, nothing loaded over the network. Play it with
`node serve.ts` and open http://localhost:8080.

| File | Job |
| --- | --- |
| `game/src/config.js` | Tuning numbers, palette, missions |
| `game/src/random.js` | Seeded random source |
| `game/src/course.js` | Islands, rings and runway layout |
| `game/src/flight.js` | Flight model, fuel, damage, scoring |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/render.js` | All canvas drawing: sky, sea, plane, HUD |
| `game/src/audio.js` | Synthesised engine, wind and beeps |
| `game/src/shots.js` | Autopilot that stages the screenshots |
| `game/src/main.js` | Boot, game loop, screens |

`?shot=start|play|landing|end&seed=N` stages a deterministic screenshot
scene (the autopilot flies the real rules forward), and `shots.json` lists
the four screenshots in `screenshots/`. `main.ts` (Node 22, stdlib only)
copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` with the vendored make.fun library.

## License

MIT — see [LICENSE](LICENSE).
