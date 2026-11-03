import { describe, expect, it } from 'vitest';
import { CONFIG } from '../game/config';
import { GameSim } from '../game/sim';
import { World } from '../game/world';
import { Tutorial } from './tutorial';

const DT = CONFIG.stepSeconds;

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

function barrierSim(): GameSim {
  const sim = new GameSim(1, {
    world: () => {
      const w = new World(1, { empty: true });
      const p = w.addPlatform(w.newRun(0, 0, 0, 0), -5, 300, 1.5, 'rect', 'plain');
      w.addObstacle(p, 'low', 20);
      return w;
    },
  });
  sim.act('start');
  return sim;
}

describe('Tutorial', () => {
  it('shows a tip before the barrier, and learns it when the player jumps', () => {
    const t = new Tutorial(memory());
    const sim = barrierSim();
    for (let i = 0; i < 300 && -sim.z < 8; i++) sim.step(DT);
    expect(t.update(sim)).toBe('barrier');
    sim.act('jump');
    sim.step(DT);
    expect(t.update(sim)).toBeNull();
    expect(t.update(sim)).toBeNull();
  });

  it('remembers learned tips across sessions', () => {
    const storage = memory();
    const first = new Tutorial(storage);
    const sim = barrierSim();
    for (let i = 0; i < 300 && -sim.z < 8; i++) sim.step(DT);
    first.update(sim);
    sim.act('jump');
    sim.step(DT);
    first.update(sim);
    const again = new Tutorial(storage);
    const sim2 = barrierSim();
    for (let i = 0; i < 300 && -sim2.z < 8; i++) sim2.step(DT);
    expect(again.update(sim2)).toBeNull();
  });

  it('dying on a tip shows it again next run', () => {
    const storage = memory();
    const t = new Tutorial(storage);
    const sim = barrierSim();
    for (let i = 0; i < 300 && -sim.z < 8; i++) sim.step(DT);
    expect(t.update(sim)).toBe('barrier');
    for (let i = 0; i < 2000 && sim.phase === 'playing'; i++) {
      sim.step(DT);
      t.update(sim);
    }
    expect(sim.deathCause).toBe('hit');
    const sim2 = barrierSim();
    for (let i = 0; i < 300 && -sim2.z < 8; i++) sim2.step(DT);
    expect(new Tutorial(storage).update(sim2)).toBe('barrier');
  });

  it('reset brings every tip back, and corrupt storage is ignored', () => {
    const storage = memory();
    storage.setItem('shadowshift.tutorial', '["barrier","nonsense"]');
    const t = new Tutorial(storage);
    const sim = barrierSim();
    for (let i = 0; i < 300 && -sim.z < 8; i++) sim.step(DT);
    expect(t.update(sim)).toBeNull();
    t.reset();
    expect(t.update(sim)).toBe('barrier');
    storage.setItem('shadowshift.tutorial', '{not json');
    expect(() => new Tutorial(storage)).not.toThrow();
  });
});
