import { describe, expect, it } from 'vitest';
import { CONFIG } from '../game/config';
import { GameSim } from '../game/sim';
import { World } from '../game/world';
import { chooseClip, CLIP_SECONDS } from './characterState';

const DT = CONFIG.stepSeconds;

function flat(): GameSim {
  return new GameSim(1, {
    world: () => {
      const w = new World(1, { empty: true });
      w.addPlatform(w.newRun(0, 0, 0, 0), -5, 400, 1.5, 'rect', 'plain');
      w.addPortal(w.platforms[0]!, 60);
      return w;
    },
  });
}

describe('chooseClip', () => {
  it('holds a still pose on the menu and while paused', () => {
    const sim = flat();
    expect(chooseClip(sim)).toMatchObject({ clip: 'run', timeScale: 0 });
    sim.act('start');
    sim.act('pause');
    expect(chooseClip(sim).timeScale).toBe(0);
  });

  it('runs faster as the runner speeds up', () => {
    const sim = flat();
    sim.act('start');
    const slow = chooseClip(sim).timeScale;
    sim.speed = CONFIG.maxSpeed;
    expect(chooseClip(sim).clip).toBe('run');
    expect(chooseClip(sim).timeScale).toBeGreaterThan(slow);
  });

  it('follows a jump: one jump pose for the whole flight, run again after landing', () => {
    const sim = flat();
    sim.act('start');
    sim.act('jump');
    sim.step(DT);
    expect(chooseClip(sim).clip).toBe('jumpUp');
    while (sim.vy > 0) sim.step(DT);
    sim.step(DT);
    expect(chooseClip(sim).clip).toBe('jumpUp'); // no switch to a falling clip at the top
    while (!sim.grounded) sim.step(DT);
    expect(chooseClip(sim).clip).toBe('run');
  });

  it('times the slide clip to the simulation slide', () => {
    const sim = flat();
    sim.act('start');
    sim.act('slide');
    sim.step(DT);
    const c = chooseClip(sim);
    expect(c.clip).toBe('slide');
    expect(CLIP_SECONDS.slide / c.timeScale).toBeCloseTo(CONFIG.slideSeconds, 5);
  });

  it('runs backwards while mirrored', () => {
    const sim = flat();
    sim.act('start');
    for (let i = 0; i < 2000 && !sim.mirrored; i++) sim.step(DT);
    expect(sim.mirrored).toBe(true);
    expect(chooseClip(sim).clip).toBe('runBack');
  });
});
