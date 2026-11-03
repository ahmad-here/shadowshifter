import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../game/config';
import { runLateral, World } from '../game/world';
import { DecorView } from './DecorView';

function positions(im: THREE.InstancedMesh): THREE.Vector3[] {
  const m = new THREE.Matrix4();
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < im.count; i++) {
    im.getMatrixAt(i, m);
    out.push(new THREE.Vector3().setFromMatrixPosition(m));
  }
  return out;
}

describe('DecorView', () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    it(`seed ${seed}: decoration stays out of the lane and off risky buildings`, () => {
      const world = new World(seed);
      const view = new DecorView();
      let placed = 0;
      for (let route = 0; route < 1500; route += 40) {
        world.update(route);
        view.update(world, route, () => 0, true);
        const [flames, holos] = view.group.children as THREE.InstancedMesh[];
        expect(flames!.count).toBeLessThanOrEqual(48);
        expect(holos!.count).toBeLessThanOrEqual(24);
        for (const p of positions(flames!)) {
          const on = world.supportAt(p.x, p.z);
          expect(on, 'flame sits on a building').not.toBeNull();
          expect(['plain', 'entry', 'landing', 'start']).toContain(on!.role);
          // Outside the runner's body at the lane centre.
          expect(Math.abs(runLateral(on!.run, p.x, p.z))).toBeGreaterThan(
            CONFIG.runnerRadius + 0.5,
          );
          placed++;
        }
        for (const h of positions(holos!)) {
          // Floats ~3 m above the deck of a building right beside it (within its bob range).
          const owner = world.platforms.find(
            (p) =>
              Math.abs(h.y - (p.top + 3)) < 0.3 &&
              h.x > p.minX - 5 &&
              h.x < p.maxX + 5 &&
              h.z > p.minZ - 5 &&
              h.z < p.maxZ + 5,
          );
          expect(owner, `hologram at y=${h.y.toFixed(2)}`).toBeDefined();
        }
      }
      expect(placed).toBeGreaterThan(10);
    });
  }

  it('hides everything when disabled (low quality) and when buildings are not shown', () => {
    const world = new World(1);
    const view = new DecorView();
    view.update(world, 0, () => null, false);
    expect((view.group.children[0] as THREE.InstancedMesh).count).toBe(0);
    view.enabled = false;
    view.update(world, 0, () => 0, false);
    expect(view.group.visible).toBe(false);
  });
});

describe('fire model', () => {
  it('replaces the fallback flame and stands on the deck with a base-to-tip gradient', async () => {
    const { withFireColors } = await import('./props');
    const geo = withFireColors(new THREE.ConeGeometry(0.3, 1, 6).translate(0, 0.5, 0));
    const colors = geo.getAttribute('color');
    // Bottom vertices are redder (less green) than the tip.
    let low = Infinity;
    let high = -Infinity;
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < 0.01) low = Math.min(low, colors.getY(i));
      if (pos.getY(i) > 0.99) high = Math.max(high, colors.getY(i));
    }
    expect(high).toBeGreaterThan(low);

    const world = new World(1);
    world.update(400);
    const view = new DecorView();
    view.setFlameGeometry(geo);
    view.update(world, 0, () => 0, true);
    const flames = view.group.children[0] as THREE.InstancedMesh;
    expect(flames.geometry).toBe(geo);
    for (const p of positions(flames)) {
      const on = world.supportAt(p.x, p.z)!;
      expect(p.y).toBeCloseTo(on.top, 6); // base on the deck, not floating or sunk
    }
  });
});
