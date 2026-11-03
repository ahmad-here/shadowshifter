import { describe, expect, it } from 'vitest';
import { CONFIG } from '../game/config';
import { GameSim } from '../game/sim';
import { World } from '../game/world';
import { soundEvents, soundState, type SoundEvent } from './soundEvents';

const DT = CONFIG.stepSeconds;

/** Step the sim and collect every sound event, like the controller does once per frame. */
function record(sim: GameSim, steps: number, each?: (i: number) => void): SoundEvent[] {
  const out: SoundEvent[] = [];
  let prev = soundState(sim);
  for (let i = 0; i < steps; i++) {
    each?.(i);
    sim.step(DT);
    const next = soundState(sim);
    out.push(...soundEvents(prev, next));
    prev = next;
  }
  return out;
}

function flat(len = 300): GameSim {
  const sim = new GameSim(1, {
    world: () => {
      const w = new World(1, { empty: true });
      w.addPlatform(w.newRun(0, 0, 0, 0), -5, len, 1.5, 'rect', 'plain');
      return w;
    },
  });
  return sim;
}

describe('soundEvents', () => {
  it('start, jump and land each fire exactly once', () => {
    const sim = flat();
    const before = soundState(sim);
    sim.act('start');
    expect(soundEvents(before, soundState(sim))).toEqual(['start']);
    const ev = record(sim, 200, (i) => i === 5 && sim.act('jump'));
    expect(ev.filter((e) => e === 'jump')).toHaveLength(1);
    expect(ev.filter((e) => e === 'land')).toHaveLength(1);
  });

  it('a side leap plays "leap", not "jump"', () => {
    const sim = flat();
    sim.act('start');
    const ev = record(sim, 30, (i) => i === 5 && sim.act('left'));
    expect(ev).toContain('leap');
    expect(ev).not.toContain('jump');
  });

  it('slide fires on the start of a slide only', () => {
    const sim = flat();
    sim.act('start');
    const ev = record(sim, 120, (i) => i === 2 && sim.act('slide'));
    expect(ev.filter((e) => e === 'slide')).toHaveLength(1);
  });

  it('falling off the end plays "fall"; running into a barrier plays "crash"', () => {
    const fall = flat(20);
    fall.act('start');
    expect(record(fall, 600)).toContain('fall');
    const hit = new GameSim(1, {
      world: () => {
        const w = new World(1, { empty: true });
        const p = w.addPlatform(w.newRun(0, 0, 0, 0), -5, 300, 1.5, 'rect', 'plain');
        w.addObstacle(p, 'low', 10);
        return w;
      },
    });
    hit.act('start');
    const ev = record(hit, 300);
    expect(ev).toContain('burn'); // a laser barrier burns: zap and sizzle
    expect(ev).not.toContain('fall');
    const beam = new GameSim(1, {
      world: () => {
        const w = new World(1, { empty: true });
        const p = w.addPlatform(w.newRun(0, 0, 0, 0), -5, 300, 1.5, 'rect', 'plain');
        w.addObstacle(p, 'high', 10);
        return w;
      },
    });
    beam.act('start');
    expect(record(beam, 300)).toContain('crash'); // a pipe is a crash
  });

  it('a restart resets counters without replaying every old event', () => {
    const sim = flat();
    sim.act('start');
    record(sim, 120, (i) => i === 2 && sim.act('jump'));
    const before = soundState(sim);
    sim.act('pause');
    sim.act('restart');
    expect(soundEvents(before, soundState(sim))).toEqual(['start']);
  });
});
