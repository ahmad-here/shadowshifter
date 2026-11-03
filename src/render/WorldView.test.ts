import { describe, expect, it } from 'vitest';
import { autopilot } from '../game/autopilot';
import { CONFIG } from '../game/config';
import { randomSeed } from '../game/rng';
import { GameSim } from '../game/sim';
import { Assets } from './assets';
import { RISE_DISTANCE } from './palette';
import { WorldView } from './WorldView';

const DT = CONFIG.stepSeconds;

function play(sim: GameSim, view: WorldView, seconds: number, onSync: () => void): void {
  let t = 0;
  for (let i = 0; i < Math.round(seconds / DT) && sim.phase === 'playing'; i++) {
    const a = autopilot(sim);
    if (a) sim.control(a);
    sim.step(DT);
    t += DT;
    // Sync like the render loop does, a few times per simulated second.
    if (i % 12 === 0) {
      view.sync(sim.world, sim.x, sim.z, t, false);
      onSync();
    }
  }
}

describe('WorldView stays faithful to the physics', () => {
  it('every mesh matches its building/obstacle during a long run', () => {
    const view = new WorldView(new Assets());
    const sim = new GameSim(7);
    sim.act('start');
    let checks = 0;
    play(sim, view, 90, () => {
      expect(view.verify(sim.world)).toEqual([]);
      checks++;
    });
    expect(checks).toBeGreaterThan(500);
  });

  it('after restarts with new random worlds no stale mesh survives (ids repeat across worlds)', () => {
    const view = new WorldView(new Assets());
    const sim = new GameSim(randomSeed());
    for (let run = 0; run < 6; run++) {
      sim.seed = randomSeed();
      if (run === 0) sim.act('start');
      else {
        sim.act('pause');
        sim.act('restart');
      }
      view.sync(sim.world, sim.x, sim.z, 0, true);
      expect(view.verify(sim.world), `run ${run}`).toEqual([]);
      play(sim, view, 15, () => expect(view.verify(sim.world)).toEqual([]));
      // Nothing from an older world may remain in the scene graph.
      view.sync(sim.world, sim.x, sim.z, 99, false);
      const ids = new Set(sim.world.platforms.map((p) => p.id));
      expect(view.group.children.length).toBe(ids.size);
    }
  });

  it('a different world object with identical ids is fully re-placed', () => {
    const view = new WorldView(new Assets());
    const a = new GameSim(1).world;
    const b = new GameSim(2).world;
    // Ids are per-world counters, so both start at the same numbers.
    expect(a.platforms[0]!.id).toBe(b.platforms[0]!.id);
    view.sync(a, 0, 0, 0, true);
    view.sync(b, 0, 0, 0, true);
    expect(view.verify(b)).toEqual([]);
  });

  it('at the start only buildings within the reveal distance show, fully risen', () => {
    const view = new WorldView(new Assets());
    const sim = new GameSim(3);
    view.sync(sim.world, 0, 0, 0, true);
    const roots = view.group.children;
    let visible = 0;
    let hidden = 0;
    for (const r of roots) {
      const v = r.userData.visual as { cx: number; cz: number };
      const near = Math.hypot(v.cx, v.cz) < RISE_DISTANCE;
      expect(r.visible, `building at ${v.cx.toFixed(0)},${v.cz.toFixed(0)}`).toBe(near);
      if (r.visible) {
        visible++;
        expect(r.position.y).toBeCloseTo(0, 9); // snapped up: never half-risen next to the runner
      } else hidden++;
    }
    expect(visible).toBeGreaterThanOrEqual(1);
    expect(hidden).toBeGreaterThan(0); // the rest of the route is not revealed yet
    expect(sim.world.supportAt(0, 0)).not.toBeNull();
  });
});
