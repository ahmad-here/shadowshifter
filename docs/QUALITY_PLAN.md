# Shadow Shift — Quality Plan

Living document. Updated at the end of every work batch.

## Baseline (2026-10-21, before the polish work)

| Check                                     | Result                                                |
| ----------------------------------------- | ----------------------------------------------------- |
| Typecheck / lint                          | pass                                                  |
| Unit tests (Vitest)                       | 238 / 238 pass                                        |
| E2E (Playwright, desktop + Pixel 7)       | 24 / 24 pass                                          |
| Production bundle                         | 839 kB JS (228 kB gzip), 8.7 kB CSS                   |
| Draw calls, autopilot gameplay (headless) | 33–36 (budget ≤ 50)                                   |
| Headless FPS                              | 15–40 (software WebGL — **not** a device measurement) |

No real-device profiling has been possible from this environment; phone numbers below are
unmeasured until someone runs the game on hardware.

## Confirmed defects (observed in code, tests, measurements or screenshots)

All fixed unless marked open. Each has a test that fails without the fix.

1. Refused side leap gave no feedback. _(it. 1: red "blocked" flash, counter `leapsRefused`)_
2. Side-leap target not communicated; valid side buildings looked like dead branches. _(it. 1: landing marker on the legal target only)_
3. No takeoff/landing/pickup feedback. _(it. 1)_
4. No settings. _(it. 2)_
5. All mechanics appeared in the first ~15 s. _(it. 3: staged introduction)_
6. No recovery after high-pressure moments. _(it. 3: calm platforms after trampolines/forks)_
7. No onboarding. _(it. 4: contextual first-run tips)_
8. No audio. _(it. 6: synthesized, event-driven)_
9. No adaptive quality. _(it. 7)_
10. Flames floated in mid-air on triangular buildings. _(it. 8, found by the new decor test)_
11. **Obstacle buildings with no obstacle** — the 22 m landing margin left no room on 34–37 m
    buildings. _(it. 9, found by measuring; test: every obstacle building has an obstacle)_
12. **Late-game pressure too low** (one obstacle per ~10 s at top speed). _(it. 9: density ramp)_
13. Offline reload failed: cached JS/CSS missed because the server sends `Vary` headers.
    _(it. 10: `ignoreVary`, offline e2e test)_
14. `debugState` code shipped in production (unreachable, but present). _(it. 10: compiled out,
    `npm run check:prod` enforces it)_
15. Focus stayed on "How to play" after closing it, so Space reopened it. _(found while testing)_

Open:

- No real-device profiling yet (only headless software WebGL measurements below).
- Lifetime shard total has no browser test (unit-covered logic only).
- Hologram decoration is rare and hard to see; worth a design pass with real art.

## Post-iteration changes (user feedback)

- Animated character from the user's Mixamo FBX files (converted to one 2.3 MB GLB, root motion
  removed, ~20k triangles). Fixed a duplicate-character bug: the load call had been placed in
  `applyPixelRatio()`, so every quality change attached another model.
- Gaps could be crossed by just running (ledge catch also applied to walk-offs). Ledge catch now
  requires a leap; gaps widened to 2.2–3.4 m. Falling short into a gap reads "You fell" and the
  runner stops at the building face instead of passing through it.
- Less predictable: closer camera, buildings revealed ~50 m ahead, denser fog. Buildings at
  different heights, sliding into place. Slightly harder: 10 → 19 m/s, faster acceleration.
- Forks guaranteed at least every third chance (≤1500 m apart, tested).

## Decisions that differ from the polish brief

- **Mirror portal swaps left/right too.** The brief says side leaps stay unswapped, but the user
  explicitly asked earlier for the mirror to "reverse its direction also". Kept the user's choice;
  revert by deleting `left`/`right` from `MIRROR` in `src/game/sim.ts` if wanted.

## Acceptance criteria

- Every gameplay rule change has a deterministic sim test; every visual feedback is driven by sim
  event counters, never by raw input (so it can't show success the sim didn't grant).
- `WorldView.verify()` stays empty in unit and e2e tests, including after restarts.
- Draw calls ≤ 50 in normal play; quality settings never change sim outcomes (tested).
- Production bundle contains no debug hooks (`__shadowShift`, URL params).
- Offline play is claimed only after an e2e test with the network disabled passes.

## Iteration roadmap

| #   | Iteration                                                                                   | Status |
| --- | ------------------------------------------------------------------------------------------- | ------ |
| 1   | Movement feedback: landing marker, takeoff/landing rings, refused-leap flash, pickup bursts | done   |
| 2   | Settings (sound, quality, reduced effects, reset best) persisted                            | done   |
| 3   | Staged mechanic introduction + recovery spacing in the generator                            | done   |
| 4   | First-run contextual tutorial tips                                                          | done   |
| 5   | Camera: speed look-ahead/FOV, landing dip, crash shake; runner squash & stretch             | done   |
| 6   | Audio: synthesized Web Audio SFX from sim events, mute, unlock on first input               | done   |
| 7   | Adaptive quality (Auto/Low/Medium/High) with p90 frame time, cooldown, anti-oscillation     | done   |
| 8   | Decoration: corner flames, holograms, trampoline light beams (instanced, Low = off)         | done   |
| 9   | Energy shards (collectible, lifetime total) + obstacle density fixes                        | done   |
| 10  | Offline PWA (versioned service worker, no new dependency) + regression + perf               | done   |

## Measurements after iteration 10 (headless Chromium, software WebGL — not device numbers)

| Metric                                 | Value                                                         |
| -------------------------------------- | ------------------------------------------------------------- |
| Unit tests                             | 326 / 326                                                     |
| E2E tests (desktop + Pixel 7)          | 34 / 34                                                       |
| Bundle                                 | 865 kB JS (234 kB gzip), 10.6 kB CSS                          |
| Draw calls, autopilot play             | 31–35 (Low and High)                                          |
| Frame time, phone-size viewport        | Low: median 16.7 ms · High: median 33.3 ms, p95 50 ms         |
| JS heap across 8 restarts              | 12.7 MB → 12.7 MB (desktop), 16.1 → 16.1 MB (mobile): no leak |
| Mesh/physics mismatches after restarts | 0                                                             |

## Known risks

- Headless WebGL is slow and unrepresentative; e2e avoids wall-clock timing for that reason.
- The bundle is dominated by Three.js; tree-shaking `import * as THREE` gains little.
- A client-only game cannot be fully tamper-proof (see CLAUDE.md, Security).

## Changelog

- **Batch 1:** sim event counters (`landings`, `leapsRefused`, `lastRefused`) and the read-only
  `upcomingExit()` query; new `src/render/FeedbackView.ts`; tests in `sim.test.ts` and
  `FeedbackView.test.ts`.
