import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../game/config';
import { GameSim } from '../game/sim';
import { World } from '../game/world';
import { FeedbackView } from './FeedbackView';

const DT = CONFIG.stepSeconds;

function visibleCount(view: FeedbackView): number {
  return view.group.children.filter((c) => c.visible).length;
}

function junctionSim(): GameSim {
  const sim = new GameSim(1, {
    world: () => {
      const w = new World(1, { empty: true });
      const run = w.newRun(0, 0, 0, 0);
      const half = CONFIG.junctionHalfWidth;
      const end = w.addPlatform(run, -5, 18 + half, half, 'rect', 'end');
      const next = w.addExit(end, 18, 'right', false);
      w.addPlatform(next, half + 2, 40, half, 'rect', 'entry');
      return w;
    },
  });
  sim.act('start');
  return sim;
}

describe('FeedbackView', () => {
  it('shows a landing marker only when a legal exit is near, on the side building', () => {
    const sim = junctionSim();
    const view = new FeedbackView();
    view.reset(sim);
    view.update(sim, DT, 0, true);
    const marker = view.group.children.find((c) => c instanceof THREE.Mesh && c.visible);
    expect(marker).toBeDefined();
    expect(marker!.position.x).toBeGreaterThan(4); // to the right (east) of the dead end
    expect(sim.world.supportAt(marker!.position.x, marker!.position.z)?.role).toBe('entry');
  });

  it('fires a ring per landing and none after a restart resets the counters', () => {
    const sim = new GameSim(3);
    sim.act('start');
    const view = new FeedbackView();
    view.reset(sim);
    sim.act('jump');
    for (let i = 0; i < 200 && sim.landings === 0; i++) sim.step(DT);
    view.update(sim, DT, 0, true);
    expect(visibleCount(view)).toBeGreaterThanOrEqual(1);
    // Let every pulse finish.
    for (let i = 0; i < 120; i++) view.update(sim, DT, 0, true);
    const settled = visibleCount(view);
    sim.act('pause');
    sim.act('restart');
    view.reset(sim);
    view.update(sim, DT, 0, true);
    expect(visibleCount(view)).toBeLessThanOrEqual(settled);
  });

  it('flashes the blocked bar on the refused side and then hides it', () => {
    const sim = new GameSim(1, {
      world: () => {
        const w = new World(1, { empty: true });
        const run = w.newRun(0, 0, 0, 0);
        w.addPlatform(run, -5, 200, 1.5, 'rect', 'plain');
        w.addPlatform(w.newRun(3, 30, -10, 0), 0, 24, 3, 'rect', 'hub');
        return w;
      },
    });
    sim.act('start');
    const view = new FeedbackView();
    view.reset(sim);
    for (let i = 0; i < 120; i++) sim.step(DT);
    sim.act('right');
    sim.step(DT);
    expect(sim.leapsRefused).toBe(1);
    view.update(sim, DT, 0, true);
    const bar = view.group.children.find(
      (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.BoxGeometry,
    )!;
    expect(bar.visible).toBe(true);
    expect(bar.position.x).toBeGreaterThan(sim.x); // right of a north-facing runner
    for (let i = 0; i < 120; i++) view.update(sim, DT, 0, true);
    expect(bar.visible).toBe(false);
  });
});
