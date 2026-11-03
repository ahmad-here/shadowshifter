# Shadow Shift

Browser-based 3D endless runner. TypeScript + React + Vite + Three.js. No backend.

## Core mechanics

- The runner auto-runs and accelerates (10 → 19 u/s) across separate floating buildings. Safety is
  physical: you are only safe standing on a building. Gaps (3.0–4.6 m) must be jumped: the ledge
  catch only helps after a real leap, never after running off an edge.
- **Buildings at different heights** (from 220 m): rises of 0.4–0.8 m must be jumped (they only
  follow a short gap, so an edge jump always clears them); drops of 0.5–1.0 m are landed on.
  Junctions, trampolines and their neighbours stay level. Buildings slide to their height as they
  appear (presentation only; physics is the final height from the start).
- **Connected corners** (user's request, like the reference video): at a dead end the side building
  is flush against the corner building, and ←/→ in the window carves round the corner on the
  ground (no jump; `sim.corners`). Missing it runs off the end. Mid-air ←/→ turns immediately.
  Forks' corners are connected the same way. At dead ends a side leap is the only way on; at **forks** a side building is offered
  while the path also continues ahead; both branches rejoin at a hub.
- **Trampoline dead ends** (no walls): nothing lies ahead; the side building sits diagonally beyond
  the end, out of reach of any normal jump or side leap. Bounce on the pad (high, ~1.44 s), then
  press ←/→ in mid-air (an `air` exit) to steer onto it. Missing the pad or not steering = fall.
- **Parallel lanes**: a lane (`switch`) ends beside a parallel one (`lane`) heading the same way;
  ←/→ in the hop window jumps across while still running forward (`hop` exit, `laneOffset` 4.8 m).
- Junction scheduler (`World.pickJunction`): the most overdue of trampoline / hop / fork (targets
  250 / 250 / 350 m) goes first; spells and portals are forced past 1.5x their spacing. Spacing is
  regression-tested (`specials come often`).
- **Parkour moves** (from the user's reference video `art/sample.mp4`; `sim.move`):
  - **Vault** (`vault` obstacle, pale ledge, from 100 m): vaulted automatically, never fatal.
  - **Wall-run** (`World.walls`, from 180 m): a gap longer than any jump (15–17 m) with a wall
    on one side. Jump, then side-step toward the wall (←/→ in the air, user's design): feet plant
    on the wall, the runner holds height and kicks off `wallKickLead` before the end onto the
    next building. A jump alone, a step away from the wall, or running off the edge is a fall.
  - **Climb + flip** (`approach: 'climb'`, from 280 m): a building `climbRise` taller. Running or
    jumping into its face climbs it, then flips onto the deck. Ordinary taller faces still kill.
  - Buildings reached by a move carry `approach`; generation tests exempt only those pairs, and the
    autopilot runs must exercise every move (`parkour moves` tests). Poses: `render/movePose.ts`
    (no Mixamo clips for these yet; reuses run/jumpUp with procedural lean, roll and flip).
- **Obstacles** (colour = action), real-world models from `tools/blender/obstacles.py`
  (`models/obstacles.glb`, normalised into the collision boxes; plain boxes until loaded):
  red laser gate = jump, overhead pipe bundle with cyan bands = slide, pipe with amber valve =
  either, rooftop AC units = vault.
- **Black portal** (`World.spells`, user's design, replaced the shadow pits): a dark energy gate
  across the lane (void variant of `render/portalShader.ts`), unavoidable at any jump height.
  Running through it brings **darkness** for `shadowSeconds` (8 s): fog hides all beyond ~18 m from the camera, buildings dim to black
  (`SHADOW_WORLD` uniform in `render/shaders.ts`), the sky goes black, fog closes in and the
  screen edges darken, so visibility really drops. Neon route edges and obstacle colours stay lit;
  the runner is pure black. Controls and hazards are normal. Surviving it earns `autoSeconds` (5 s)
  of **auto-run** (`effect: 'auto'`): the autopilot plays (player moves ignored) and hands control
  back only once grounded on a building, clear of obstacles.
  After surviving it, no black portal appears for `darkCooldown` (25 s): the sim clears any
  placed or generated meanwhile.
- **Game feel** (researched: coyote time, jump buffer, squash/stretch were already in): landing and
  slide dust (`render/DustView.ts`), near-miss reward (`sim.nearMisses`: flash ring, FOV punch,
  whoosh), 90 ms hit-stop on crashes (`GameController`). Variable jump height was rejected: a tap
  would cut jumps short over gaps that every full jump is guaranteed to clear.
- **Mirror portal** (animated electric energy portal, procedural shader in `render/portalShader.ts`;
  its bright core goes dark once used): running through it turns the runner around for 10 s and
  reverses every control: jump ↔ slide and left ↔ right (the user asked for left/right too). Bots use `sim.control()`, which
  bypasses the swap; player input goes through `sim.act()`.
- **Carved turns** (researched; replaces the 90 degree snap): a side leap runs a quarter circle of
  `turnRadius` (1.2 m) into the new heading, then flies straight (`sim.facing` for presentation).
  The camera lags the heading and rolls into the turn; the body banks up to ~22 degrees.
- **Character animation**: athletic run clip made in Blender (`tools/blender/athletic_run.py`:
  arm swing x1.3, stride x1.15), wall-run clips authored on the rig (`tools/blender/wallrun.py`:
  hips rolled 55 degrees, core held, outer arm out), plus a procedural layer
  (`render/bodyDrive.ts`: speed lean, turn bank, stabilised head, landing compression).
- **Side-leap rules**: a press early on a dead-end building is held until its window (leap assist).
  A leap is refused if it would head south or land on a building whose route runs another way
  (those only lead to dead branches). Leaps into empty air are allowed.
- Fairness rules (tested, height-aware): every edge jump lands on the next building at every speed;
  ledge catch up to 0.45 m after a leap;
  obstacles at least 22 m into a building so you land with ≥0.45 s to react; every world is random
  per start (`?seed=N` fixes it for debugging).
- Buildings are square, hexagonal, triangular and wedge-shaped, and rise into place about 140 m
  ahead (user's request: obstacles must be readable well in advance, never pop up late).
- **Energy shards** (amber) on calm buildings: collected by running through; counted per run and
  as a lifetime total. Score stays distance.
- Mechanics unlock in stages (`CONFIG.intro`: trampolines 150 m, spells 200 m, hops 250 m,
  portals 300 m, forks 500 m); calm platforms follow trampolines and forks.
- First-run tips (`game/hints.ts`, `app/tutorial.ts`), shown once per mechanic.
- Score = distance in metres. Best score and shard total are kept in localStorage (checksummed).
- Controls: ↑/W/Space/swipe up = jump, ↓/S/swipe down = slide (slam in mid-air),
  ←→/A D/swipe = side leap, Esc/P = pause.

## Character

- `public/models/runner.glb` (3.3 MB, ~20k triangles, 5 in-place clips, 1024² suit texture) is
  generated from the Mixamo FBX files in `art/` by `npm run convert:runner` (needs
  `npx vite --port 5199` running). `art/` is never shipped. The FBX skin is `base.obj` rigged
  (same 60k-vertex mesh, in cm).
- The suit texture is baked by projecting the character sheet `art/runner-reference.png`
  (FRONT / SIDE / BACK / 3/4 columns) through the mesh UVs (`bakeTexture` in `tools/convert.ts`).
  Its magenta stripes are the one deliberate exception to the no-purple palette (user request).
- `render/characterState.ts` picks the clip from sim state; `CharacterModel` loads lazily and
  the placeholder figure runs until it arrives (or forever if loading fails).

## Art pipeline

- Source art lives in `art/` (never shipped). Game-ready files are generated into `public/`:
  - `npm run convert:runner` → `models/runner.glb` (Mixamo FBX → simplified skinned GLB + clips,
    suit texture baked from `runner-reference.png`)
  - `npm run convert:props` → `models/fire.glb` + `models/obstacles.glb`: headless Blender runs
    `tools/blender/fire.py` and `tools/blender/obstacles.py`. Fire:
    (flat fire relief → three rotated copies = round flame bush, 1.5k triangles, fire-gradient
    vertex colours, 34 KB). Animated in `DecorView` by a vertex shader (sway + licking tips).
- Rooftops are procedural (no texture): a recreation of BlendKit's "Powder coated metal black"
  (one continuous matte black surface, fine grain, soft sheen) in `render/shaders.ts`. No grid,
  no panels.
  - `convert:runner` needs the dev server (`npx vite --port 5199`); `convert:props` needs Blender.
- All optional art loads in the background with a fallback (placeholder runner, cone flame), and
  is precached by the service worker for offline play.

## Visual identity

Sci-fi corridor theme (user's second reference image): deep navy space, white/pale-blue
architecture with panel seams, cyan-blue light strips (`#2fd8ff`), orange accent lights
(`#ff8a2a`), red lasers (`#ff3048`, jump barriers), blue-black powder-coated rooftops. **No purple.**
Colours live in `COLORS` in `src/render/palette.ts` and CSS variables in `src/ui/styles.css`.

Scenery (`render/cityPlan.ts` + `CityDecor.ts`): a dense skyline of towers around the route with
glowing caps, and flat glowing sigils on calm decks. **Readability rule:** only route buildings use
the white-wall/cyan-rim look (`ROUTE_LOOK`); scenery uses `DECOR_LOOK` (navy steel, no rim), never
overlaps any building, and towers on the camera side stay below the deck.

## Architecture

| Path                        | Responsibility                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/game/`                 | Pure simulation. No Three.js, DOM timing or React. Fully unit-tested.                                                                |
| `game/config.ts`            | All tuning constants.                                                                                                                |
| `game/world.ts`             | Seeded, bounded, recycled world of buildings, obstacles, pads, spells, exits. N/E/W only, so no overlap.                             |
| `game/sim.ts`               | `GameSim`: physics, side leaps, slide, collision, effects, phases. Driven by fixed `step(dt)`.                                       |
| `game/stepper.ts`           | Fixed-timestep accumulator (120 Hz) for frame-rate independence.                                                                     |
| `game/input.ts`             | Keyboard and swipe input → intents → phase-aware actions.                                                                            |
| `game/autopilot.ts`         | Perfect-play bot for tests and `?autopilot`.                                                                                         |
| `src/render/`               | Three.js view, one focused module per concern (world, runner, feedback, effects, camera, backdrop). Reads the sim; never mutates it. |
| `src/app/GameController.ts` | rAF loop, wires sim + renderer + input + UI store, pause on blur/hidden.                                                             |
| `src/app/store.ts`          | Throttled (≤10 Hz) external store: the only data React sees.                                                                         |
| `src/ui/`                   | React menus, HUD and error overlay.                                                                                                  |

Debug: `?seed=N` fixes the track, `?autopilot` plays automatically.
`window.__shadowShift.state()` returns a snapshot (used by e2e tests).

## Rendering rules

- Buildings are closed solids (deck, walls, underside) with window facades; the chase camera rides
  over any deck it would sink into, so it never shows a building's inside.
- `src/render/` files stay under 200 lines. `WorldView` + `Layer` own all world meshes; meshes are
  matched to entities by object identity, so a new world (restart) can never keep stale meshes.
  `WorldView.verify()` compares meshes with physics; tests and e2e assert it stays empty.
- Both portals (`render/portalShader.ts`) are procedural shaders. Building walls are double-sided.

## Security

- Debug hooks (`?seed`, `?autopilot`, `window.__shadowShift`) exist only in dev and in the e2e build
  (`vite build --mode e2e`, `.env.e2e`). Production compiles them out. React only receives the
  frozen `GameApi` (store + intents). The best score is checksummed. A purely client-side game
  cannot be made tamper-proof; this only blocks casual cheating.

## Rules

- No unbounded spawning: the world is capped at `maxPlatforms` / `maxObstacles`; meshes are pooled.
- Visual feedback is driven by sim event counters (`jumps`, `landings`, `leapsRefused`, …), never
  by raw input, so it can never show something the simulation did not do.
- No per-frame React state updates. HUD updates go through `UiStore`, throttled.
- Gameplay logic must stay in `src/game/` and be unit-testable without a browser.
- Gameplay must never depend on frame rate; always go through `FixedStepper`.
- No new runtime dependencies without a clear need. No external asset URLs at runtime.

## Performance budgets and browsers

- Target 60 fps on mid-range phones; ≤ 50 draw calls in gameplay (currently ~20–40).
- Pixel ratio capped at 2; MSAA off on high-DPR screens.
- JS bundle baseline: 839 kB raw / 228 kB gzip (mostly Three.js). See `docs/QUALITY_PLAN.md`.
- Supported: latest Chrome, Edge, Firefox, Safari (desktop + iOS/Android). Requires WebGL2.

## Presentation systems

- Settings (`app/settings.ts`): sound, quality (Auto/Low/Medium/High), reduced effects. Never read
  by `src/game/`.
- Adaptive quality (`render/AdaptiveQuality.ts`): p90 frame time, cooldown, anti-oscillation.
- Audio (`app/audio.ts`, `app/soundEvents.ts`): synthesized, driven by sim counters only.
- Offline: `pwa/serviceWorkerPlugin.ts` emits a versioned `sw.js` per build.

## Commands

- `npm run dev`: dev server
- `npm run typecheck`, `npm run lint`, `npm run format`
- `npm test`: Vitest unit tests (`src/**/*.test.ts`)
- `npm run test:e2e`: Playwright (debug build in `dist-e2e`, served on :4174, desktop + Pixel 7)
- `npm run check`: typecheck + lint + unit + build + `check:prod` (no debug code in production)

## Status

Milestone 1 (gray-box) done, then redesigned to match the reference art: building-hopping,
side leaps, forks, trampolines, 3 obstacle types, black portal / darkness, chase camera (spring follow, `render/CameraRig.ts`) with wind (`render/WindView.ts`),
rising shaped buildings.

Generation guarantees are enforced by tests (`world.test.ts`): no overlapping buildings, every gap
jumpable at min speed, every landing long enough at max speed, every exit window lands on a
building, obstacles clear of landing zones. `sim.test.ts` runs the autopilot for 3 minutes on 12
seeds, on both main and side branches.

Known issues / notes:

- Headless Chromium runs at ~15–40 fps (software WebGL); e2e timing accounts for this.
- A side leap where no building exists is a fall by design.
- Not yet done: real art assets, fire/portal decorations, graphics quality tiers, PWA/offline, audio.
