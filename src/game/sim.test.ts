import { describe, expect, it } from 'vitest';
import { autopilot } from './autopilot';
import { CONFIG, jumpDistance } from './config';
import { GameSim } from './sim';
import { FixedStepper } from './stepper';
import { DIR_X, DIR_Z, turnDir, World, type ObstacleKind, type Platform, type Run } from './world';
import { Rng, randomSeed } from './rng';

const DT = CONFIG.stepSeconds;

/** A sim on a hand-built world. The runner starts at the origin heading north (-Z). */
function custom(build: (w: World, run: Run) => void): GameSim {
  const sim = new GameSim(1, {
    world: () => {
      const w = new World(1, { empty: true });
      build(w, w.newRun(0, 0, 0, 0));
      return w;
    },
  });
  sim.act('start');
  return sim;
}

/** Long straight platform from -5 to `len` (plus optional obstacle). */
function straight(len = 200, obstacle?: { kind: ObstacleKind; at: number }) {
  return custom((w, run) => {
    const p = w.addPlatform(run, -5, len, 1.5, 'rect', 'plain');
    if (obstacle) w.addObstacle(p, obstacle.kind, obstacle.at);
  });
}

/** Along-distance travelled (runner heads north from z=0). */
const along = (sim: GameSim) => -sim.z;

function stepFor(sim: GameSim, seconds: number, each?: () => void): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n && (sim.phase === 'playing' || sim.phase === 'dying'); i++) {
    each?.();
    sim.step(DT);
  }
}

function stepUntil(sim: GameSim, cond: () => boolean, max = 30): void {
  const n = Math.round(max / DT);
  for (let i = 0; i < n; i++) {
    if (cond()) return;
    sim.step(DT);
  }
  throw new Error('condition never met');
}

function finish(sim: GameSim): void {
  stepUntil(sim, () => sim.phase !== 'playing' && sim.phase !== 'dying', 10);
}

describe('state machine', () => {
  it('starts ready and does not move until started', () => {
    const sim = new GameSim(1);
    expect(sim.phase).toBe('ready');
    stepFor(sim, 2);
    for (let i = 0; i < 200; i++) sim.step(DT);
    expect(sim.z).toBe(0);
    expect(sim.score).toBe(0);
    expect(sim.platform?.role).toBe('start');
  });

  it('only accepts actions valid for the current phase', () => {
    const sim = new GameSim(1);
    for (const a of ['jump', 'left', 'slide', 'pause', 'resume', 'restart'] as const)
      expect(sim.act(a)).toBe(false);
    expect(sim.act('start')).toBe(true);
    expect(sim.act('start')).toBe(false);
    expect(sim.act('pause')).toBe(true);
    expect(sim.act('jump')).toBe(false);
    expect(sim.act('slide')).toBe(false);
    expect(sim.act('resume')).toBe(true);
    expect(sim.phase).toBe('playing');
  });

  it('freezes completely while paused', () => {
    const sim = straight();
    stepFor(sim, 1);
    sim.act('jump');
    sim.step(DT);
    sim.act('pause');
    const snap = JSON.stringify([sim.x, sim.y, sim.z, sim.vy, sim.speed, sim.distance, sim.time]);
    for (let i = 0; i < 600; i++) sim.step(DT);
    expect(JSON.stringify([sim.x, sim.y, sim.z, sim.vy, sim.speed, sim.distance, sim.time])).toBe(
      snap,
    );
  });

  it('running off the last building falls, dies and reaches game over', () => {
    const sim = straight(20);
    stepUntil(sim, () => sim.phase === 'dying');
    expect(sim.deathCause).toBe('fell');
    expect(sim.y).toBeLessThan(CONFIG.fallDeathY + 0.1);
    const score = sim.score;
    stepFor(sim, CONFIG.dyingSeconds - 0.05);
    expect(sim.phase).toBe('dying');
    finish(sim);
    expect(sim.phase).toBe('gameover');
    expect(sim.score).toBe(score);
    for (let i = 0; i < 600; i++) sim.step(DT);
    expect(sim.phase).toBe('gameover');
  });

  it('menu returns to the ready screen with a fresh world, only from pause or game over', () => {
    const sim = straight(20);
    expect(sim.act('menu')).toBe(false); // playing
    sim.act('pause');
    expect(sim.act('menu')).toBe(true);
    expect(sim.phase).toBe('ready');
    expect(sim.distance).toBe(0);
    expect(sim.act('menu')).toBe(false);
  });

  it('restart rebuilds the same world and clears every piece of state', () => {
    const sim = new GameSim(9);
    const fresh = new GameSim(9);
    sim.act('start');
    stepFor(sim, 5, () => {
      const a = autopilot(sim);
      if (a) sim.control(a);
    });
    sim.act('jump');
    sim.act('right');
    sim.act('slide');
    sim.act('pause');
    expect(sim.act('restart')).toBe(true);
    expect(sim.phase).toBe('playing');
    expect([sim.x, sim.y, sim.z, sim.vy, sim.dir, sim.distance, sim.jumps]).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(sim.speed).toBe(CONFIG.startSpeed);
    expect(sim.effect).toBe('none');
    expect(sim.sliding).toBe(false);
    expect(sim.world.platforms.map((p) => p.id)).toEqual(fresh.world.platforms.map((p) => p.id));
    // Inputs buffered before the restart must not fire afterwards.
    stepFor(sim, 0.5);
    expect(sim.dir).toBe(0);
    expect(sim.grounded).toBe(true);
  });
});

describe('running and jumping', () => {
  it('accelerates and caps at max speed', () => {
    const sim = straight(10000);
    sim.step(DT);
    expect(sim.speed).toBeGreaterThan(CONFIG.startSpeed);
    stepFor(sim, 60);
    expect(sim.speed).toBe(CONFIG.maxSpeed);
  });

  it('score is distance travelled and never decreases', () => {
    const sim = straight(1000);
    let last = 0;
    stepFor(sim, 3, () => {
      expect(sim.score).toBeGreaterThanOrEqual(last);
      last = sim.score;
    });
    expect(sim.distance).toBeCloseTo(CONFIG.startSpeed * 3 + 0.5 * CONFIG.acceleration * 9, 0);
    expect(along(sim)).toBeCloseTo(sim.distance, 1);
  });

  it('is frame-rate independent through the fixed stepper', () => {
    const results = [20, 30, 60, 75, 144, 240].map((fps) => {
      const sim = straight(1000);
      const stepper = new FixedStepper();
      for (let i = 0; i < Math.round(2.5 * fps); i++)
        stepper.advance(1 / fps, (dt) => sim.step(dt));
      return sim.distance;
    });
    for (const r of results) expect(r).toBeCloseTo(results[0]!, 1);
  });

  it('jumps with the expected arc and lands grounded', () => {
    const sim = straight();
    sim.act('jump');
    sim.step(DT);
    expect(sim.grounded).toBe(false);
    let peak = 0;
    let air = DT;
    while (!sim.grounded) {
      sim.step(DT);
      air += DT;
      peak = Math.max(peak, sim.y);
    }
    expect(air).toBeCloseTo((2 * CONFIG.jumpVelocity) / CONFIG.gravity, 1);
    expect(peak).toBeCloseTo(CONFIG.jumpVelocity ** 2 / (2 * CONFIG.gravity), 1);
    expect(sim.y).toBe(0);
  });

  it('cannot double jump, but a jump pressed just before landing fires on landing', () => {
    const sim = straight();
    sim.act('jump');
    sim.step(DT);
    stepFor(sim, 0.2);
    const vy = sim.vy;
    sim.act('jump');
    sim.step(DT);
    expect(sim.vy).toBeLessThan(vy);
    stepUntil(sim, () => sim.grounded);
    sim.act('jump');
    sim.step(DT);
    stepUntil(sim, () => sim.vy < -CONFIG.jumpVelocity + 1.5);
    sim.act('jump');
    stepUntil(sim, () => sim.vy > 0, 0.5);
  });

  it('not jumping a gap means falling into it', () => {
    const sim = custom((w, run) => {
      w.addPlatform(run, -5, 10, 1.5, 'rect', 'plain');
      w.addPlatform(run, 13.5, 60, 1.5, 'rect', 'plain');
    });
    finish(sim);
    expect(sim.phase).toBe('gameover');
    expect(along(sim)).toBeLessThan(16);
  });

  it('the widest gap is clearable at the slowest speed, and the shortest landing holds at top speed', () => {
    for (const [speed, gap, len] of [
      [CONFIG.startSpeed, CONFIG.maxGap, CONFIG.plainMinLength],
      [CONFIG.maxSpeed, CONFIG.minGap, CONFIG.plainMinLength],
      [CONFIG.maxSpeed, CONFIG.maxGap, CONFIG.plainMinLength],
    ] as const) {
      const sim = custom((w, run) => {
        w.addPlatform(run, -5, 20, 1.5, 'rect', 'plain');
        w.addPlatform(run, 20 + gap, 20 + gap + len, 1.5, 'rect', 'plain');
      });
      sim.speed = speed;
      stepUntil(sim, () => along(sim) >= 19.4);
      sim.act('jump');
      sim.step(DT);
      stepUntil(sim, () => sim.grounded || sim.phase !== 'playing', 3);
      expect(sim.phase, `v${speed} gap${gap}`).toBe('playing');
      expect(along(sim)).toBeGreaterThan(20 + gap);
      expect(along(sim)).toBeLessThan(20 + gap + len);
    }
  });

  it('coyote time: a jump just after leaving the edge still works', () => {
    const sim = custom((w, run) => {
      w.addPlatform(run, -5, 10, 1.5, 'rect', 'plain');
      w.addPlatform(run, 12, 60, 1.5, 'rect', 'plain');
    });
    stepUntil(sim, () => !sim.grounded);
    sim.step(DT);
    sim.act('jump');
    stepFor(sim, 1.2);
    expect(sim.phase).toBe('playing');
    expect(sim.grounded).toBe(true);
  });

  it('landing a hair short catches the ledge; landing well short drops into the gap', () => {
    const ledge = custom((w, run) => {
      w.addPlatform(run, -5, 10, 1.5, 'rect', 'plain');
      w.addPlatform(run, 10 + jumpDistance(CONFIG.startSpeed) + 0.1, 60, 1.5, 'rect', 'plain');
    });
    stepUntil(ledge, () => along(ledge) >= 9.95);
    ledge.speed = CONFIG.startSpeed;
    ledge.act('jump');
    stepFor(ledge, 1.5);
    expect(ledge.phase).toBe('playing');

    const wall = custom((w, run) => {
      w.addPlatform(run, -5, 10, 1.5, 'rect', 'plain');
      w.addPlatform(run, 10 + jumpDistance(CONFIG.startSpeed) + 1, 60, 1.5, 'rect', 'plain');
    });
    stepUntil(wall, () => along(wall) >= 9.95);
    wall.act('jump');
    stepUntil(wall, () => wall.phase !== 'playing');
    expect(wall.deathCause).toBe('fell');
  });
});

describe('sliding', () => {
  it('lowers the runner for a fixed time then stands back up', () => {
    const sim = straight();
    sim.act('slide');
    sim.step(DT);
    expect(sim.sliding).toBe(true);
    expect(sim.height).toBe(CONFIG.slideHeight);
    stepFor(sim, CONFIG.slideSeconds - 0.05);
    expect(sim.sliding).toBe(true);
    stepFor(sim, 0.1);
    expect(sim.sliding).toBe(false);
    expect(sim.height).toBe(CONFIG.runnerHeight);
  });

  it('sliding in the air slams down and slides on landing', () => {
    const sim = straight();
    sim.act('jump');
    stepFor(sim, 0.15);
    sim.act('slide');
    expect(sim.vy).toBeLessThanOrEqual(-CONFIG.slamVelocity);
    stepUntil(sim, () => sim.grounded, 1);
    sim.step(DT);
    expect(sim.sliding).toBe(true);
  });

  it('jumping cancels a slide', () => {
    const sim = straight();
    sim.act('slide');
    sim.step(DT);
    sim.act('jump');
    sim.step(DT);
    expect(sim.sliding).toBe(false);
    expect(sim.grounded).toBe(false);
  });
});

describe('obstacles', () => {
  const AT = 20;
  type Move = 'none' | 'jump' | 'slide';
  /** Approach an obstacle at a given speed and do `move` at the ideal moment. */
  function attempt(kind: ObstacleKind, move: Move, speed: number): GameSim {
    const sim = straight(200, { kind, at: AT });
    sim.speed = speed;
    const lead = move === 'jump' ? speed * 0.3 : Math.max(0.8, speed * 0.12);
    const front = AT - 0.3 - CONFIG.runnerRadius;
    stepUntil(sim, () => along(sim) >= front - lead);
    if (move !== 'none') sim.act(move);
    stepUntil(sim, () => sim.phase !== 'playing' || along(sim) > AT + 4, 3);
    return sim;
  }

  const table: [ObstacleKind, Move, boolean][] = [
    ['low', 'none', false],
    ['low', 'jump', true],
    ['low', 'slide', false],
    ['high', 'none', false],
    ['high', 'jump', false],
    ['high', 'slide', true],
    ['mid', 'none', false],
    ['mid', 'jump', true],
    ['mid', 'slide', true],
    ['wall', 'jump', false],
    ['wall', 'slide', false],
  ];
  for (const [kind, move, survives] of table) {
    it(`${kind} + ${move} → ${survives ? 'survives' : 'crashes'} at every speed`, () => {
      for (const speed of [CONFIG.startSpeed, 13, CONFIG.maxSpeed]) {
        const sim = attempt(kind, move, speed);
        expect(sim.phase === 'playing', `${kind} ${move} v${speed} cause=${sim.deathCause}`).toBe(
          survives,
        );
        if (!survives) expect(sim.deathCause).toBe('hit');
      }
    });
  }

  it('a huge time step cannot tunnel through an obstacle', () => {
    const sim = straight(200, { kind: 'low', at: 3 });
    sim.step(0.5);
    expect(sim.deathCause).toBe('hit');
  });
});

/**
 * Dead end heading north at [-5, 21], exit window centred at along 18 to the given side,
 * leading to an entry building on the new heading.
 */
function junction(turn: 'left' | 'right', withEntry = true) {
  let target!: Platform;
  const sim = custom((w, run) => {
    const half = CONFIG.junctionHalfWidth;
    const end = w.addPlatform(run, -5, 18 + half, half, 'rect', 'end');
    const next = w.addExit(end, 18, turn, false);
    if (withEntry) target = w.addPlatform(next, half + 2, 40, half, 'rect', 'entry');
  });
  return { sim, target: () => target };
}

describe('side jumps', () => {
  it('a side jump inside the exit window lands on the side building and changes heading', () => {
    for (const turn of ['left', 'right'] as const) {
      const { sim, target } = junction(turn);
      stepUntil(sim, () => along(sim) >= 17);
      sim.act(turn);
      sim.step(DT);
      expect(sim.dir).toBe(turn === 'left' ? 3 : 1);
      expect(sim.sideJumps).toBe(1);
      stepUntil(sim, () => sim.grounded || sim.phase !== 'playing', 2);
      expect(sim.phase).toBe('playing');
      expect(sim.platform).toBe(target());
    }
  });

  it('re-centres on the new run after landing off-centre', () => {
    const { sim } = junction('right');
    stepUntil(sim, () => along(sim) >= 16.2); // 1.8 short of the junction centre
    sim.act('right');
    sim.step(DT);
    stepUntil(sim, () => sim.grounded, 2);
    stepFor(sim, 1);
    expect(Math.abs(sim.z - -18)).toBeLessThan(0.05);
  });

  it('a slightly early press waits for the window', () => {
    const { sim } = junction('right');
    const look = CONFIG.startSpeed * CONFIG.sideBufferSeconds;
    stepUntil(sim, () => along(sim) >= 16.1 - look * 0.8);
    sim.act('right');
    sim.step(DT);
    expect(sim.dir).toBe(0); // held, not executed
    stepFor(sim, 2);
    expect(sim.dir).toBe(1);
    expect(sim.phase).toBe('playing');
  });

  it('a side jump with no building there drops into the void', () => {
    const sim = straight();
    stepFor(sim, 0.5);
    sim.act('left');
    sim.step(DT);
    expect(sim.dir).toBe(3);
    finish(sim);
    expect(sim.deathCause).toBe('fell');
  });

  it('jumping the wrong way at a junction falls', () => {
    const { sim } = junction('right');
    stepUntil(sim, () => along(sim) >= 17);
    sim.act('left');
    finish(sim);
    expect(sim.phase).toBe('gameover');
  });

  it('missing the exit runs off the dead end', () => {
    const { sim } = junction('right');
    finish(sim);
    expect(sim.deathCause).toBe('fell');
    expect(sim.dir).toBe(0);
  });

  it('side jumps are ignored while paused and buffered while airborne', () => {
    const { sim } = junction('right');
    stepUntil(sim, () => along(sim) >= 12);
    sim.act('jump');
    sim.step(DT);
    stepUntil(sim, () => along(sim) >= 16.6);
    expect(sim.grounded).toBe(false);
    sim.act('right'); // in the air: held until landing
    stepUntil(sim, () => sim.dir === 1 || sim.phase !== 'playing', 1);
    expect(sim.dir).toBe(1);
    stepFor(sim, 1.5);
    expect(sim.phase).toBe('playing');
  });
});

describe('trampoline (bounce, then steer in mid-air)', () => {
  /** Same layout the generator builds: dead end with a pad, side building past the end. */
  function trampolineWorld(side: 'left' | 'right' = 'right') {
    return custom((w, run) => {
      w.addPlatform(run, -5, 10, 1.5, 'rect', 'plain');
      const a = 12;
      const b = a + CONFIG.trampolineLength;
      const t = w.addPlatform(run, a, b, 1.5, 'rect', 'trampoline');
      w.addPad(t, b - CONFIG.padFromEnd, b - CONFIG.padFromEnd + 2);
      const half = CONFIG.airWindow / 2;
      const next = w.addExit(t, b + CONFIG.trampolineGap + half, side, false, 'air', half);
      w.addPlatform(
        next,
        CONFIG.airEntryStart,
        CONFIG.airEntryStart + CONFIG.airEntryLength,
        half,
        'rect',
        'entry',
      );
    });
  }

  function reachTrampoline(sim: GameSim, speed: number): void {
    sim.speed = speed;
    sim.step(DT);
    stepUntil(sim, () => along(sim) >= 9.5);
    sim.act('jump'); // onto the trampoline building
    sim.step(DT);
    stepUntil(sim, () => sim.grounded, 3);
  }

  for (const speed of [CONFIG.startSpeed, CONFIG.maxSpeed]) {
    for (const side of ['left', 'right'] as const) {
      it(`bounce + steer ${side} lands on the side building (v=${speed})`, () => {
        const sim = trampolineWorld(side);
        reachTrampoline(sim, speed);
        sim.act(side); // pressed early, on the trampoline building: held for the mid-air window
        stepUntil(sim, () => sim.bounces > 0 || sim.phase !== 'playing', 4);
        expect(sim.bounces).toBe(1);
        stepUntil(sim, () => sim.grounded || sim.phase !== 'playing', 4);
        expect(sim.phase).toBe('playing');
        expect(sim.platform?.role).toBe('entry');
        expect(sim.dir).toBe(side === 'left' ? 3 : 1);
      });
    }
  }

  it('bouncing without steering falls: nothing lies ahead', () => {
    const sim = trampolineWorld();
    reachTrampoline(sim, CONFIG.startSpeed);
    finish(sim);
    expect(sim.bounces).toBe(1);
    expect(sim.deathCause).toBe('fell');
  });

  it('jumping over the pad falls, and steering only works after a bounce', () => {
    const sim = trampolineWorld();
    reachTrampoline(sim, CONFIG.startSpeed);
    const padStart = 12 + CONFIG.trampolineLength - CONFIG.padFromEnd;
    stepUntil(sim, () => along(sim) >= padStart - 2.5);
    sim.act('jump');
    sim.step(DT);
    stepUntil(sim, () => along(sim) > 12 + CONFIG.trampolineLength + CONFIG.trampolineGap + 1, 3);
    sim.act('right'); // in the window, but not bouncing
    finish(sim);
    expect(sim.bounces).toBe(0);
    expect(sim.dir).toBe(0);
    expect(sim.deathCause).toBe('fell');
  });
});

describe('parallel lane hop', () => {
  /** Same layout the generator builds: this lane ends beside a parallel lane, same heading. */
  function laneWorld(side: 'left' | 'right' = 'right') {
    return custom((w, run) => {
      const p = w.addPlatform(run, -5, 40, 1.5, 'rect', 'switch');
      const w0 = 40 - CONFIG.hopWindow;
      const lane = w.addExit(
        p,
        w0 + CONFIG.hopWindow / 2,
        side,
        false,
        'hop',
        CONFIG.hopWindow / 2,
      );
      w.addPlatform(lane, w0, w0 + CONFIG.hopWindow + 30, 1.5, 'rect', 'lane');
    });
  }

  for (const speed of [CONFIG.startSpeed, CONFIG.maxSpeed]) {
    for (const side of ['left', 'right'] as const) {
      it(`hopping ${side} lands on the parallel lane and keeps running forward (v=${speed})`, () => {
        const sim = laneWorld(side);
        sim.speed = speed;
        stepUntil(sim, () => along(sim) >= 40 - CONFIG.hopWindow + 0.5);
        sim.act(side);
        sim.step(DT);
        expect(sim.dir).toBe(0); // heading unchanged
        stepUntil(sim, () => sim.grounded || sim.phase !== 'playing', 3);
        expect(sim.phase).toBe('playing');
        expect(sim.platform?.role).toBe('lane');
        expect(sim.x).toBeCloseTo((side === 'right' ? 1 : -1) * CONFIG.laneOffset, 1);
        stepFor(sim, 1.5);
        expect(sim.phase).toBe('playing');
      });
    }
  }

  it('pressing early on the ending lane waits for the hop window', () => {
    const sim = laneWorld('left');
    stepFor(sim, 0.3); // ~30 m before the window
    sim.act('left');
    stepFor(sim, 0.5);
    expect(sim.grounded).toBe(true); // held, not wasted
    stepUntil(sim, () => sim.platform?.role === 'lane' || sim.phase !== 'playing', 6);
    expect(sim.platform?.role).toBe('lane');
  });

  it('not hopping runs off the end of the lane', () => {
    const sim = laneWorld();
    finish(sim);
    expect(sim.deathCause).toBe('fell');
  });

  it('hopping the wrong way falls', () => {
    const sim = laneWorld('right');
    stepUntil(sim, () => along(sim) >= 40 - CONFIG.hopWindow + 1);
    sim.act('left');
    finish(sim);
    expect(sim.phase).toBe('gameover');
  });
});

describe('black portal (darkness)', () => {
  /** A long building with a black portal 10 m in. */
  function gateWorld(extra?: (w: World, p: Platform, run: Run) => void) {
    return custom((w, run) => {
      const p = w.addPlatform(run, -5, 400, 1.5, 'rect', 'plain');
      w.addSpell(p, 10);
      extra?.(w, p, run);
    });
  }

  it('running through it brings the darkness for its time, then it lifts', () => {
    const sim = gateWorld();
    stepUntil(sim, () => sim.effect === 'shadow', 3);
    expect(sim.spellsTaken).toBe(1);
    expect(sim.world.spells[0]!.taken).toBe(true);
    stepFor(sim, CONFIG.shadowSeconds - 0.1);
    expect(sim.effect).toBe('shadow');
    stepFor(sim, 0.2);
    expect(sim.effect).toBe('auto'); // survived: the pilot plays for a while
    expect(sim.shadowExits).toBe(1);
    expect(sim.act('jump')).toBe(false);
    stepFor(sim, CONFIG.autoSeconds + 0.5);
    expect(sim.effect).toBe('none');
    expect(sim.act('jump')).toBe(true);
    expect(sim.phase).toBe('playing');
  });

  it('auto-run plays the course for you (jumps the obstacles)', () => {
    const sim = gateWorld((w, p) => {
      for (let at = 40 + CONFIG.shadowSeconds * 12; at < 380; at += 25) w.addObstacle(p, 'low', at);
    });
    stepUntil(sim, () => sim.effect === 'auto', CONFIG.shadowSeconds + 3);
    stepFor(sim, CONFIG.autoSeconds - 0.2);
    expect(sim.phase).toBe('playing');
  });

  it('after surviving it, black portals are harmless for the cooldown', () => {
    const sim = gateWorld((w, p) => {
      // A second portal reached during the cooldown, a third after it.
      w.addSpell(p, 10 + 16 * 12);
    });
    stepUntil(sim, () => sim.effect === 'auto', CONFIG.shadowSeconds + 3);
    stepUntil(sim, () => sim.world.spells[1]!.taken, 30);
    expect(sim.darkCooldown).toBeGreaterThan(0);
    expect(sim.effect).not.toBe('shadow');
    expect(sim.spellsTaken).toBe(1);
  });

  it('it cannot be jumped over', () => {
    const sim = gateWorld();
    stepUntil(sim, () => along(sim) >= 10 - CONFIG.startSpeed * 0.3);
    sim.act('jump');
    stepFor(sim, 1);
    expect(sim.effect).toBe('shadow');
  });

  it('controls work as normal in the dark, and obstacles still count', () => {
    const sim = gateWorld((w, p) => w.addObstacle(p, 'low', 40));
    stepUntil(sim, () => sim.effect === 'shadow', 3);
    expect(sim.act('jump')).toBe(true);
    finish(sim);
    expect(sim.deathCause).toBe('hit');
  });

  it('dying clears the darkness', () => {
    const sim = custom((w, run) => {
      const p = w.addPlatform(run, -5, 25, 1.5, 'rect', 'plain');
      w.addSpell(p, 3);
    });
    stepUntil(sim, () => sim.effect === 'shadow', 3);
    finish(sim);
    expect(sim.effect).toBe('none');
  });
});

describe('autopilot proves generated worlds are survivable', () => {
  const run = (seed: number, takeForks: boolean, seconds: number) => {
    const sim = new GameSim(seed);
    sim.act('start');
    let forks = 0;
    const maxP = { platforms: 0, obstacles: 0 };
    for (let i = 0; i < Math.round(seconds / DT) && sim.phase === 'playing'; i++) {
      const a = autopilot(sim, { takeForks });
      if (a) {
        if (
          (a === 'left' || a === 'right') &&
          sim.world.exits.some((e) => e.optional && sim.inExit(e))
        )
          forks++;
        sim.control(a);
      }
      sim.step(DT);
      maxP.platforms = Math.max(maxP.platforms, sim.world.platforms.length);
      maxP.obstacles = Math.max(maxP.obstacles, sim.world.obstacles.length);
    }
    return { sim, forks, maxP };
  };

  const totals = { bounces: 0, spells: 0, forks: 0, vaults: 0, wallRuns: 0, climbs: 0 };
  for (const seed of [1, 2, 3, 4, 5, 77, 2024, 31337, 8675309, 123456, 999, 4242]) {
    for (const takeForks of [false, true]) {
      it(`survives 3 minutes (seed ${seed}, ${takeForks ? 'side branches' : 'main route'})`, () => {
        const { sim, forks, maxP } = run(seed, takeForks, 180);
        expect(
          sim.phase,
          `died: ${sim.deathCause} at (${sim.x.toFixed(1)}, ${sim.z.toFixed(1)}) dir ${sim.dir} on ${sim.platform?.role}`,
        ).toBe('playing');
        expect(sim.speed).toBe(CONFIG.maxSpeed);
        expect(sim.sideJumps).toBeGreaterThan(10);
        expect(sim.score).toBeGreaterThan(2500);
        expect(maxP.platforms).toBeLessThanOrEqual(CONFIG.maxPlatforms);
        expect(maxP.obstacles).toBeLessThanOrEqual(CONFIG.maxObstacles);
        if (!takeForks) expect(forks).toBe(0);
        totals.bounces += sim.bounces;
        totals.spells += sim.spellsTaken;
        totals.forks += forks;
        totals.vaults += sim.vaults;
        totals.wallRuns += sim.wallRuns;
        totals.climbs += sim.climbs;
      });
    }
  }

  it('across those runs every mechanic was exercised', () => {
    expect(totals.bounces).toBeGreaterThan(10);
    expect(totals.spells).toBeGreaterThan(10);
    expect(totals.forks).toBeGreaterThan(5);
    expect(totals.vaults).toBeGreaterThan(10);
    expect(totals.wallRuns).toBeGreaterThan(10);
    expect(totals.climbs).toBeGreaterThan(10);
  });
});

describe('parkour moves', () => {
  it('a vault ledge is cleared automatically and never kills', () => {
    const sim = straight(200, { kind: 'vault', at: 30 });
    stepUntil(sim, () => along(sim) > 40);
    expect(sim.phase).toBe('playing');
    expect(sim.vaults).toBe(1);
  });

  /** Start building, a wall-run gap from 20 to 36, and the landing building after it. */
  function wallWorld() {
    return custom((w, run) => {
      w.addPlatform(run, -5, 20, 1.5, 'rect', 'plain');
      const landing = w.addPlatform(run, 36, 200, 1.5, 'rect', 'plain');
      landing.approach = 'wallrun';
      w.addWall(run, 20, 36, landing, 1);
    });
  }

  it('jump, then side-step toward the wall: runs along it and lands across the gap', () => {
    const sim = wallWorld();
    stepUntil(sim, () => along(sim) >= 19.6);
    sim.act('jump');
    stepFor(sim, 0.15);
    expect(sim.move).toBe('none'); // a jump alone does not catch the wall
    sim.act('right'); // the wall is on the right
    stepUntil(sim, () => sim.move === 'wallrun', 1);
    expect(sim.act('slide')).toBe(false); // committed to the wall
    stepUntil(sim, () => sim.grounded, 3);
    expect(along(sim)).toBeGreaterThan(36); // landed on the building across the gap
    stepFor(sim, 1);
    expect(sim.phase).toBe('playing');
    expect(sim.wallRuns).toBe(1);
  });

  it('a jump without the side step, or a step away from the wall, falls into the gap', () => {
    for (const step of [null, 'left'] as const) {
      const sim = wallWorld();
      stepUntil(sim, () => along(sim) >= 19.6);
      sim.act('jump');
      stepFor(sim, 0.15);
      if (step) sim.act(step);
      finish(sim);
      expect(sim.deathCause).toBe('fell');
      expect(sim.wallRuns).toBe(0);
    }
  });

  it('running off the edge without jumping does not catch the wall', () => {
    const sim = wallWorld();
    finish(sim);
    expect(sim.deathCause).toBe('fell');
    expect(sim.wallRuns).toBe(0);
  });

  /** A climb building, 2.5 m taller, after a normal gap. */
  function climbWorld() {
    return custom((w, run) => {
      w.addPlatform(run, -5, 20, 1.5, 'rect', 'plain');
      w.level = CONFIG.climbRise;
      w.addPlatform(run, 22.2, 200, 1.5, 'rect', 'plain').approach = 'climb';
    });
  }

  it('running into a climb face climbs it and flips onto the deck', () => {
    const sim = climbWorld();
    stepUntil(sim, () => sim.move === 'climb', 4);
    expect(sim.act('jump')).toBe(false);
    stepUntil(sim, () => sim.move === 'flip', 2);
    stepUntil(sim, () => sim.grounded, 2);
    expect(sim.y).toBeCloseTo(CONFIG.climbRise, 6);
    stepFor(sim, 1);
    expect(sim.phase).toBe('playing');
    expect(sim.climbs).toBe(1);
  });

  it('jumping into a climb face also grabs it', () => {
    const sim = climbWorld();
    stepUntil(sim, () => along(sim) >= 19.6);
    sim.act('jump');
    stepFor(sim, 0.05);
    stepUntil(sim, () => sim.move === 'climb' || sim.grounded, 2);
    expect(sim.move).toBe('climb');
    stepUntil(sim, () => sim.grounded && sim.move === 'none', 3);
    expect(sim.y).toBeCloseTo(CONFIG.climbRise, 6);
  });

  it('an ordinary taller face is still a crash', () => {
    const sim = custom((w, run) => {
      w.addPlatform(run, -5, 20, 1.5, 'rect', 'plain');
      w.level = CONFIG.climbRise;
      w.addPlatform(run, 22.2, 200, 1.5, 'rect', 'plain');
    });
    finish(sim);
    expect(sim.deathCause).not.toBeNull();
    expect(sim.climbs).toBe(0);
  });
});

describe('side-leap safety', () => {
  it('a leap onto a building whose route runs the other way is refused', () => {
    const sim = custom((w, run) => {
      w.addPlatform(run, -5, 200, 1.5, 'rect', 'plain');
      // To the right: a building whose route heads west (back toward us), like a fork hub.
      const west = w.newRun(3, 30, -10, 0);
      w.addPlatform(west, 0, 24, 3, 'rect', 'hub');
    });
    stepUntil(sim, () => along(sim) >= 8);
    sim.act('right');
    stepFor(sim, 1);
    expect(sim.dir).toBe(0);
    expect(sim.sideJumps).toBe(0);
    // Leaping into empty air is still allowed.
    sim.act('left');
    sim.step(DT);
    expect(sim.dir).toBe(3);
  });

  it('a leap that would head south is refused (it could only land on a dead branch)', () => {
    const sim = custom((w) => {
      const east = w.newRun(1, 0, 0, 0);
      w.addPlatform(east, -5, 200, 1.5, 'rect', 'plain');
      // A solid building to the south, like the side branch beside a fork hub.
      const south = w.newRun(2, 10, 0, 0);
      w.addPlatform(south, 3, 30, 1.5, 'rect', 'plain');
    });
    sim.dir = 1;
    stepFor(sim, 0.5);
    sim.act('right'); // east + right = south
    stepFor(sim, 1);
    expect(sim.dir).toBe(1);
    expect(sim.sideJumps).toBe(0);
    expect(sim.phase).toBe('playing');
  });

  it('pressing early anywhere on a dead-end building waits for its window', () => {
    for (const turn of ['left', 'right'] as const) {
      const { sim, target } = junction(turn);
      stepFor(sim, 0.1); // right at the start of the dead-end building, 16 m before the window
      sim.act(turn);
      stepFor(sim, 1);
      expect(sim.dir).toBe(0); // still held
      stepFor(sim, 2.5);
      expect(sim.dir).toBe(turn === 'left' ? 3 : 1);
      expect(sim.platform).toBe(target());
      expect(sim.phase).toBe('playing');
    }
  });

  it('fuzz: leaping onto any building in reach never leads to a dead end', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const sim = new GameSim(seed);
      sim.act('start');
      const rng = new Rng(seed * 7);
      let offRoute = 0;
      for (let i = 0; i < 120 * 120 && sim.phase === 'playing'; i++) {
        let a = autopilot(sim);
        if (!a && sim.grounded && sim.effect === 'none' && rng.chance(0.02)) {
          for (const turn of ['left', 'right'] as const) {
            const d = turnDir(sim.dir, turn);
            const R = jumpDistance(sim.speed);
            if (sim.world.supportAt(sim.x + DIR_X[d]! * R, sim.z + DIR_Z[d]! * R)) {
              a = turn;
              offRoute++;
              break;
            }
          }
        }
        if (a) sim.control(a);
        sim.step(DT);
      }
      expect(
        sim.phase,
        `seed ${seed}: ${sim.deathCause} on ${sim.platform?.role} dir ${sim.dir}`,
      ).toBe('playing');
      expect(offRoute).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('mirror portal', () => {
  function portalWorld() {
    return custom((w, run) => {
      const p = w.addPlatform(run, -5, 400, 1.5, 'rect', 'plain');
      w.addPortal(p, 5);
    });
  }

  it('running through it mirrors for 10 s: jump slides, slide jumps', () => {
    const sim = portalWorld();
    stepUntil(sim, () => sim.mirrored);
    expect(sim.portalsTaken).toBe(1);
    expect(sim.world.portals[0]!.taken).toBe(true);
    sim.act('jump');
    sim.step(DT);
    expect(sim.sliding).toBe(true);
    expect(sim.grounded).toBe(true);
    stepFor(sim, 1);
    sim.act('slide');
    sim.step(DT);
    expect(sim.grounded).toBe(false); // slide input jumped
    stepUntil(sim, () => sim.grounded);
    stepFor(sim, CONFIG.mirrorSeconds - 2);
    expect(sim.mirrored).toBe(true);
    stepUntil(sim, () => !sim.mirrored, 2);
    sim.act('jump');
    sim.step(DT);
    expect(sim.grounded).toBe(false); // back to normal
  });

  it('swaps left and right too, and bots bypass the swap', () => {
    const sim = portalWorld();
    stepUntil(sim, () => sim.mirrored);
    sim.control('jump');
    sim.step(DT);
    expect(sim.grounded).toBe(false);
    stepUntil(sim, () => sim.grounded);
    sim.act('left'); // mirrored: leaps right
    sim.step(DT);
    expect(sim.dir).toBe(1);
  });

  it('a portal only triggers once, and restart or death clears the mirror', () => {
    const sim = portalWorld();
    stepUntil(sim, () => sim.mirrored);
    stepFor(sim, 1);
    expect(sim.portalsTaken).toBe(1);
    sim.act('pause');
    sim.act('restart');
    expect(sim.mirrored).toBe(false);
    expect(sim.world.portals[0]!.taken).toBe(false);
  });
});

describe('randomness', () => {
  it('every start gets a different world', () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const w = new GameSim(randomSeed()).world;
      firsts.add(
        w.platforms
          .slice(0, 6)
          .map((p) => `${p.shape}:${p.b - p.a}:${p.run.dir}`)
          .join('|'),
      );
    }
    expect(firsts.size).toBeGreaterThanOrEqual(18);
  });
});

describe('jump timing window', () => {
  it('at start speed, a jump anywhere in the last 3.5 m before the widest early gap lands', () => {
    // Early in a run gaps are at most minGap + 0.4.
    const gap = CONFIG.minGap + 0.4;
    for (const early of [0.2, 1, 2, 3, 3.5]) {
      const sim = custom((w, run) => {
        w.addPlatform(run, -5, 20, 1.5, 'rect', 'plain');
        w.addPlatform(run, 20 + gap, 50, 1.5, 'rect', 'plain');
      });
      sim.speed = CONFIG.startSpeed;
      stepUntil(sim, () => along(sim) >= 20 - early);
      sim.act('jump');
      sim.step(DT);
      stepUntil(sim, () => sim.grounded || sim.phase !== 'playing', 3);
      expect(sim.phase, `pressed ${early} m early`).toBe('playing');
    }
  });
});

describe('presentation events and queries (read-only)', () => {
  it('counts landings once per touchdown', () => {
    const sim = straight();
    expect(sim.landings).toBe(0);
    sim.act('jump');
    sim.step(DT);
    stepUntil(sim, () => sim.grounded);
    expect(sim.landings).toBe(1);
    stepFor(sim, 1);
    expect(sim.landings).toBe(1); // running along does not count
  });

  it('records a refused leap and its side, but not a permitted one', () => {
    const sim = custom((w, run) => {
      w.addPlatform(run, -5, 200, 1.5, 'rect', 'plain');
      const west = w.newRun(3, 30, -10, 0);
      w.addPlatform(west, 0, 24, 3, 'rect', 'hub');
    });
    stepUntil(sim, () => along(sim) >= 8);
    sim.act('right');
    stepFor(sim, 0.2);
    expect(sim.leapsRefused).toBe(1);
    expect(sim.lastRefused).toBe('right');
    sim.act('left'); // empty air: allowed
    sim.step(DT);
    expect(sim.leapsRefused).toBe(1);
    expect(sim.sideJumps).toBe(1);
  });

  it('reports the upcoming exit and the building it lands on', () => {
    const { sim, target } = junction('right');
    expect(sim.upcomingExit(5)).toBeNull(); // window is ~15 m away
    const up = sim.upcomingExit(30)!;
    expect(up.exit.turn).toBe('right');
    expect(up.target).toBe(target());
    stepUntil(sim, () => along(sim) >= 17);
    expect(sim.upcomingExit(0)!.target).toBe(target()); // inside the window
  });

  it('queries do not change the simulation', () => {
    const a = straight();
    const b = straight();
    for (let i = 0; i < 300; i++) {
      a.upcomingExit(40);
      a.step(DT);
      b.step(DT);
    }
    expect([a.x, a.z, a.speed, a.distance]).toEqual([b.x, b.z, b.speed, b.distance]);
  });

  it('restart clears the event counters', () => {
    const sim = straight();
    sim.act('jump');
    sim.step(DT);
    stepUntil(sim, () => sim.grounded);
    sim.act('pause');
    sim.act('restart');
    expect([sim.landings, sim.leapsRefused, sim.lastRefused]).toEqual([0, 0, null]);
  });
});

describe('energy shards', () => {
  function rowWorld() {
    return custom((w, run) => {
      const p = w.addPlatform(run, -5, 200, 1.5, 'rect', 'plain');
      w.addShardRow(p, 10, 30, 5);
    });
  }

  it('running through a row collects every shard exactly once', () => {
    const sim = rowWorld();
    expect(sim.world.shards).toHaveLength(5);
    stepUntil(sim, () => along(sim) > 25);
    expect(sim.shards).toBe(5);
    expect(sim.world.shards.every((s) => s.taken)).toBe(true);
    stepFor(sim, 1);
    expect(sim.shards).toBe(5);
  });

  it('a high jump can sail over a shard (it is a choice, not a trap)', () => {
    const sim = custom((w, run) => {
      const p = w.addPlatform(run, -5, 200, 1.5, 'rect', 'plain');
      w.addShardRow(p, 12, 12, 1);
    });
    stepUntil(sim, () => along(sim) >= 12 - sim.speed * 0.36);
    sim.act('jump');
    stepFor(sim, 1.2);
    expect(sim.shards).toBe(0);
    expect(sim.phase).toBe('playing');
  });

  it('shards never change movement, and restart clears them', () => {
    const a = rowWorld();
    const b = straight();
    stepFor(a, 3);
    stepFor(b, 3);
    expect([a.x, a.z, a.speed]).toEqual([b.x, b.z, b.speed]);
    a.act('pause');
    a.act('restart');
    expect(a.shards).toBe(0);
    expect(a.world.shards.every((s) => !s.taken)).toBe(true);
  });
});

describe('gaps must be jumped', () => {
  for (const speed of [CONFIG.startSpeed, 13, CONFIG.maxSpeed]) {
    it(`running off the smallest gap without jumping falls (v=${speed})`, () => {
      const sim = custom((w, run) => {
        w.addPlatform(run, -5, 20, 1.5, 'rect', 'plain');
        w.addPlatform(run, 20 + CONFIG.minGap, 80, 1.5, 'rect', 'plain');
      });
      sim.speed = speed;
      stepUntil(sim, () => sim.phase !== 'playing' || along(sim) > 30, 5);
      expect(sim.phase, `crossed the gap without jumping at ${speed} m/s`).not.toBe('playing');
    });
  }
});

describe('buildings at different heights', () => {
  /** Start building at 0, then a gap, then a building `rise` higher (negative = lower). */
  function step(rise: number, gap: number = CONFIG.minGap + 0.4) {
    return custom((w, run) => {
      w.addPlatform(run, -5, 20, 1.5, 'rect', 'plain');
      const next = w.addPlatform(run, 20 + gap, 80, 1.5, 'rect', 'plain');
      next.top = rise;
    });
  }

  for (const speed of [CONFIG.startSpeed, CONFIG.maxSpeed]) {
    it(`a jump from the edge climbs the tallest rise (v=${speed})`, () => {
      const sim = step(CONFIG.maxRise);
      sim.speed = speed;
      stepUntil(sim, () => along(sim) >= 19.6);
      sim.act('jump');
      sim.step(DT);
      stepUntil(sim, () => sim.grounded || sim.phase !== 'playing', 3);
      expect(sim.phase).toBe('playing');
      expect(sim.y).toBeCloseTo(CONFIG.maxRise, 9);
    });

    it(`running into a taller building without jumping fails (v=${speed})`, () => {
      const sim = step(CONFIG.minRise);
      sim.speed = speed;
      finish(sim);
      expect(sim.phase).toBe('gameover');
    });

    it(`a jump onto a lower building lands on its deck (v=${speed})`, () => {
      const sim = step(-CONFIG.maxDrop, CONFIG.maxGap);
      sim.speed = speed;
      stepUntil(sim, () => along(sim) >= 19.6);
      sim.act('jump');
      sim.step(DT);
      stepUntil(sim, () => sim.grounded || sim.phase !== 'playing', 3);
      expect(sim.phase).toBe('playing');
      expect(sim.y).toBeCloseTo(-CONFIG.maxDrop, 9);
      stepFor(sim, 1);
      expect(sim.y).toBeCloseTo(-CONFIG.maxDrop, 9); // stays on it
    });
  }

  it('obstacles, shards and pads on a raised building sit on its deck', () => {
    const sim = custom((w, run) => {
      const p = w.addPlatform(run, -5, 200, 1.5, 'rect', 'plain');
      p.top = 0; // start level
      const q = w.addPlatform(run, 210, 400, 1.5, 'rect', 'plain');
      q.top = 2;
      const o = w.addObstacle(q, 'low', 260);
      w.addShardRow(q, 220, 230, 3);
      w.addPad(q, 300, 302);
      expect(o.minY).toBe(2);
      expect(o.maxY).toBeCloseTo(2 + 0.8, 9);
      expect(w.shards[0]!.y).toBeCloseTo(2.9, 9);
      expect(w.pads[0]!.top).toBe(2);
    });
    expect(sim.world.obstacles).toHaveLength(1);
  });
});
