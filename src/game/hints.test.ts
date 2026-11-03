import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { HINTS, nextHint, type HintKind } from './hints';
import { GameSim } from './sim';
import { World, type Run } from './world';

const DT = CONFIG.stepSeconds;
const none = new Set<HintKind>();

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

function runTo(sim: GameSim, along: number): void {
  for (let i = 0; i < 20000 && -sim.z < along; i++) sim.step(DT);
}

describe('tutorial hints', () => {
  it('announces a gap shortly before it, not long before', () => {
    const sim = custom((w, run) => {
      w.addPlatform(run, -5, 40, 1.5, 'rect', 'plain');
      w.addPlatform(run, 42, 90, 1.5, 'rect', 'plain');
    });
    expect(nextHint(sim, none)).toBeNull(); // 40 m away
    runTo(sim, 30);
    expect(nextHint(sim, none)).toBe('jump');
    expect(nextHint(sim, new Set(['jump']))).toBeNull(); // already taught
  });

  it('does not call a dead end a gap', () => {
    const sim = custom((w, run) => {
      w.addPlatform(run, -5, 20, 1.5, 'rect', 'plain');
    });
    runTo(sim, 12);
    expect(nextHint(sim, none)).toBeNull();
  });

  it('names the right action for each obstacle and picks the nearest', () => {
    for (const [kind, hint] of [
      ['low', 'barrier'],
      ['high', 'slide'],
      ['mid', 'either'],
    ] as const) {
      const sim = custom((w, run) => {
        const p = w.addPlatform(run, -5, 200, 1.5, 'rect', 'plain');
        w.addObstacle(p, kind, 20);
        w.addObstacle(p, 'low', 28);
      });
      runTo(sim, 10);
      expect(nextHint(sim, none)).toBe(hint);
    }
  });

  it('tells which way to leap at a dead end', () => {
    const sim = custom((w, run) => {
      const half = CONFIG.junctionHalfWidth;
      const end = w.addPlatform(run, -5, 18 + half, half, 'rect', 'end');
      const next = w.addExit(end, 18, 'left', false);
      w.addPlatform(next, half + 2, 40, half, 'rect', 'entry');
    });
    runTo(sim, 8);
    expect(nextHint(sim, none)).toBe('leftLeap');
  });

  it('announces trampolines, spells and portals', () => {
    const sim = custom((w, run) => {
      const p = w.addPlatform(run, -5, 300, 1.5, 'rect', 'plain');
      w.addPad(p, 20, 22);
      w.addSpell(p, 60);
      w.addPortal(p, 100);
    });
    runTo(sim, 10);
    expect(nextHint(sim, none)).toBe('trampoline');
    runTo(sim, 48);
    expect(nextHint(sim, none)).toBe('spell');
    expect(nextHint(sim, new Set(['spell']))).toBeNull();
  });

  it('is silent when not playing, and covers every kind', () => {
    const sim = custom((w, run) => {
      const p = w.addPlatform(run, -5, 200, 1.5, 'rect', 'plain');
      w.addObstacle(p, 'low', 12);
    });
    sim.act('pause');
    expect(nextHint(sim, none)).toBeNull();
    sim.act('resume');

    expect(new Set(HINTS).size).toBe(13);
  });

  it('announces a wall-run only for a wall on the runner’s own run', () => {
    const sim = custom((w, run) => {
      w.addPlatform(run, -5, 10, 1.5, 'rect', 'plain');
      const landing = w.addPlatform(run, 26, 200, 1.5, 'rect', 'plain');
      w.addWall(run, 10, 26, landing, 1);
      // A parallel run 4.8 m to the side with a nearer wall: never announced from here.
      const other = w.newRun(0, 4.8, 0, 0);
      const far = w.addPlatform(other, 20, 60, 1.5, 'rect', 'plain');
      w.addWall(other, 4, 20, far, -1);
    });
    expect(nextHint(sim, none)).toBe('rightWall');
    expect(nextHint(sim, new Set(['rightWall']))).toBeNull();
  });

  it('keeps the trampoline tip up during the bounce, until the steer', () => {
    const sim = custom((w, run) => {
      w.addPlatform(run, -5, 10, 1.5, 'rect', 'plain');
      const b = 12 + CONFIG.trampolineLength;
      const t = w.addPlatform(run, 12, b, 1.5, 'rect', 'trampoline');
      w.addPad(t, b - CONFIG.padFromEnd, b - CONFIG.padFromEnd + 2);
      const half = CONFIG.airWindow / 2;
      const next = w.addExit(t, b + CONFIG.trampolineGap + half, 'right', false, 'air', half - 0.1);
      w.addPlatform(next, CONFIG.airEntryStart, CONFIG.airEntryStart + 30, half, 'rect', 'entry');
    });
    runTo(sim, 9.5);
    sim.act('jump');
    for (let i = 0; i < 600 && sim.bounces === 0; i++) sim.step(DT);
    expect(sim.bouncing).toBe(true);
    expect(nextHint(sim, none)).toBe('trampoline');
  });
});
