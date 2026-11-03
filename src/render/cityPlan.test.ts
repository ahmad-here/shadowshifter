import { describe, expect, it } from 'vitest';
import { CONFIG } from '../game/config';
import { pointInPoly, runLateral, World } from '../game/world';
import { MAX_SIGILS, MAX_TOWERS, planCity } from './cityPlan';

describe('planCity', () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    it(`seed ${seed}: a dense skyline that never touches the route or hides the runner`, () => {
      const world = new World(seed);
      let towersSeen = 0;
      for (let route = 0; route < 1500; route += 60) {
        world.update(route);
        const { towers, sigils } = planCity(world);
        expect(towers.length).toBeLessThanOrEqual(MAX_TOWERS);
        expect(sigils.length).toBeLessThanOrEqual(MAX_SIGILS);
        towersSeen += towers.length;
        const byId = new Map(world.platforms.map((p) => [p.id, p]));
        for (const t of towers) {
          const r = t.size * 0.75;
          for (const p of world.platforms) {
            const hit =
              t.x + r > p.minX && t.x - r < p.maxX && t.z + r > p.minZ && t.z - r < p.maxZ;
            expect(hit, `tower overlaps ${p.role}#${p.id}`).toBe(false);
          }
          const owner = byId.get(t.platformId)!;
          // Camera side (runner's right): always below the deck.
          if (runLateral(owner.run, t.x, t.z) > 0) expect(t.top).toBeLessThan(owner.top);
        }
        for (const s of sigils) {
          const p = byId.get(s.platformId)!;
          expect(pointInPoly(p.poly, s.x, s.z)).toBe(true);
          expect(Math.abs(runLateral(p.run, s.x, s.z))).toBeGreaterThan(CONFIG.runnerRadius + 0.2);
          expect(s.y).toBeCloseTo(p.top + 0.02, 9);
        }
      }
      expect(towersSeen / 25).toBeGreaterThan(15); // ~dozens of towers around every stretch
    });
  }

  it('is deterministic for the same world', () => {
    const a = new World(9);
    const b = new World(9);
    expect(planCity(a)).toEqual(planCity(b));
  });
});
