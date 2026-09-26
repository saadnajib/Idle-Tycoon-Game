# Ribbon

A one-tap mobile game prototype. Flappy controls, but you trail a long physics ribbon, and **the ribbon is your hitbox**. Each tap decides where your tail will be a moment later. Tapping fast makes the tail thrash and fill the gap, so the right move is often to not tap. The ribbon grows as you score, so it is both the difficulty curve and the cosmetic reward.

Everything is in `index.html`: vanilla JS, Canvas 2D, WebAudio, no external assets or CDNs, so it runs offline in a Capacitor webview.

## Play

Open `index.html` in a browser, or serve the folder (`npx serve .`). Tap or click anywhere to flap. Space and Arrow Up also flap, and M toggles sound. The first run shows a one-line "tap to flap" hint.

- **Solid ribbon:** the front part is bright and saturated: 60% of a 24-segment ribbon (14 segments), shrinking to 45% at 48 (22 segments). If it or the head touches a gate, the floor or the ceiling, you die.
- **Loose ribbon:** the rest is thin and ghosted, at 35% alpha. Touching something with it is a *graze*: sparkles, a chime and a combo counter.
- **Death:** a 250 ms freeze frame. The segment that touched is highlighted white and the contact point gets a red ring. Then the ribbon goes limp and the game-over card slides up.
- **Growth:** +1 segment every 3 gates, from 24 up to 48.

## Physics

- A fixed 1/120 s step, with the accumulator capped at 0.25 s. rAF renders an interpolated state, and the game pauses when the page is hidden.
- The head uses gravity 1900 and a terminal speed of 950. A flap **sets** vy to −540.
- The ribbon is a verlet chain simulated in **world space**, so it trails naturally as the world scrolls. It runs 3 constraint passes and then a follow-the-leader stretch cap at 105%. That cap moves each point's previous position along with the point, so it never adds energy. Without this, the tail whipped ahead of the head.
- Collision: the head is a circle of radius 10. Each segment is sampled at its midpoint and far end with radius 4, against rounded-rectangle slabs (exact distance to an inset rectangle, minus the corner radius), the floor and the ceiling.
- Gates: spacing 260, gap 190 shrinking by 2 per gate down to 150, and the gap centre moves at most ±220 from one gate to the next. Scroll speed is 190 plus 6 per gate, up to 320. A seeded RNG makes a run reproducible.

### Tuning changes from the original brief (all in `TUNING`)

| key | brief | now | why |
|---|---|---|---|
| `segRest` | 9 | 6 | At 9 px the ribbon (216–432 px) ran off the left edge of a 400 px screen, and the solid/loose split and some solid-segment collisions were off screen. Deaths you cannot see feel cheap. |
| `headX` | 120 fixed | 150, +2 per extra segment, max 200 | Same reason: this leaves room behind the head as the ribbon grows. |
| `ribbonGravity` | 0.35 | 0.12 | At 0.35 the chain hung almost vertically below the head, like a kite string. 0.22 still let a long ribbon's solid part droop further than the gap allows (see below). At 0.12, with the brief's damping of 0.985, the solid part follows the flight arc and the loose tail still swings. |
| `solidFraction` → `solidFractionCap` | 0.6 flat | 0.6 at 24 segments, lerping to 0.45 at 48 | `solidCount(n) = round(n × lerp(solidFraction, solidFractionCap, (n − seg0) / (segMax − seg0)))`: 14 solid at 24, 17 at 30, 19 at 36, 20 at 42, 22 at 48. Growth still adds length, grazing surface and some solid, but the lethal part no longer grows at the full 60%. Collision, the floor clamp, rendering, the death highlight and the game-over preview all call this one function. |
| `maxStretch` | – | 1.05 | Three passes alone let the chain stretch 20–30%, which makes the hitbox length unreliable. |
| `maxDpr` | – | 2 | Caps the canvas backing store to keep fill cost down on phones. |

`damping` (0.985), `iterations`, the starting `solidFraction` (0.6) and the gate and scroll numbers are as specified.

**Why the late game had a cliff (droop).** The solid part of the ribbon sags below the head, and the head needs room for its own flap arc too. At `ribbonGravity` 0.22 with a flat 60% solid share, the end of the solid part hung on average 47 px below the head at 24 segments, but 91 px at 42 and 102 px at 48. Head arc plus droop no longer fit in a 150–190 px gap, so runs ended on the bottom slab with the rear of the solid ribbon. An autopilot that aims at the gap the head is entering (40 seeds, ribbon held at a fixed length, start speed and gap) got median gates of 30.5 / 24 / 16 / 1 / 1 at 24 / 30 / 36 / 42 / 48 segments. With 0.12 and the 0.6 → 0.45 lerp, the average solid droop is 34–50 px at every length, and the same autopilot gets 30.5 / 27 / 32.5 / 37 / 29.5, a 48/24 ratio of 0.97 (was 0.03). With speed and gap set to the values you actually have when you reach each length, the 48/24 ratio is 0.46 (was 0.03), so difficulty now rises smoothly with speed instead of hitting a wall. In full runs from 24 segments the median is 28.5 gates (was 24). Autopilots that aim to keep the whole solid body inside the previous gate still find long ribbons harder (48/24 ratio about 0.35, was 0.08). If the late game feels too steep, the other levers are `segEvery`, `headXMax` and `speedPerGate`.

## Rendering

- The dusk gradient and two cached, low-resolution parallax tiles (at 0.2× and 0.5× scroll speed) fill the whole screen, margins included. The playfield is a letterboxed 400×720 logical area that fits inside the safe-area insets.
- The ribbon is one midpoint-smoothed quadratic curve, drawn piece by piece so it can taper (14 → 7 px solid, 5 → 2 px loose) and cycle hue (base + i×8, rotating over time). The glow comes from four additive `lighter` strokes, with no `shadowBlur`. Colour strings are precomputed for each palette, so the hot loop allocates nothing.
- Gates are glass slabs with an electric-cyan edge, a few texture lines and a glow on the gap edge. The glow brightens when the head or the solid ribbon comes within 60 px.
- Particles use a 200-slot struct-of-arrays pool: flap puffs, graze sparkles and death sparks.

## Monetization mock

`Monetization` in the script is the swap point:

- `showRewarded(id, onReward, onDismiss)` shows a mock "Loading ad…" overlay with a 2.5 s bar. It powers **Trim tail & continue**, once per run: you continue before the gate you died at, with 16 segments and 1 s of invulnerability. Replace its body with AdMob, for example `@capacitor-community/admob`.
- `purchase(sku, onSuccess)` and `restorePurchases(onDone)` are a mock store for the non-consumable `ribbon_styles_pack` ($1.99). It unlocks the Aurora and Ember palettes, which you pick from the swatches on the game-over card.

## Save

Stored in `localStorage` under the key `ribbon.save.v1`:
`{ best, mute, firstRun, games, owned: { ribbon_styles_pack }, palette }`. Every access is wrapped in try/catch, so blocked storage only loses persistence. `load()` copies only these fields and type-checks each one: `best` and `games` must be non-negative integers, `mute` a boolean, `owned` a plain object of booleans, and `palette` a known palette (a paid one only if owned). Anything else falls back to its default. Unknown keys, including `__proto__`, are ignored, and unparseable JSON loads as defaults.

If a rewarded continue completes while the tab is hidden, the run resumes **paused**, so it does not start moving the moment you return.

## Test hook

`window.Ribbon = { state, TUNING, save, load, restart(seed?), flap, step(dtSeconds), solidCount(n) }`

`step` advances the simulation in fixed steps and switches the rAF loop to render-only mode (`state.manual = true`). Set `Ribbon.state.manual = false` to hand control back to real time.

## Native build

The repo is also a Capacitor 8 project (`com.saadnajib.ribbon`) with generated `ios/` (Swift Package Manager, no CocoaPods) and `android/` projects. The web game stays in `index.html`.

```sh
npm i
npm run build     # copies index.html to www/ (www/ is not in git)
npm run sync      # build + npx cap sync
npm run ios       # open in Xcode (Mac only)
npm run android   # open in Android Studio
npm run serve     # serve www/ at http://localhost:8080
npm run icons     # redraw assets/icon.png and assets/splash.png
npm run assets    # regenerate all native icon and splash sizes from assets/
```

On native, the game hides the splash on its first frame and plays a heavy haptic on death. Both use the global `Capacitor.Plugins` bridge and do nothing in a plain browser. The monetization mocks **must** be replaced or removed before store submission. See [PUBLISHING.md](PUBLISHING.md) for the full App Store and Google Play checklist.
