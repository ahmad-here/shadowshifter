import { pointInPoly, runPoint, type Platform, type World } from '../game/world';
import { hash } from './math';

export const MAX_TOWERS = 140;
export const MAX_SIGILS = 48;

export interface Tower {
  platformId: number;
  x: number;
  z: number;
  /** Footprint size (m) and deck height (world y). */
  size: number;
  top: number;
  yaw: number;
  shape: 'rect' | 'hex';
  cap: 'none' | 'diamond' | 'pyramid';
}

export interface Sigil {
  platformId: number;
  x: number;
  z: number;
  y: number;
  kind: 'ring' | 'octagon' | 'diamond';
}

/** Buildings whose sides hold side-leap targets or walls: keep their surroundings clear. */
const CLEAR = new Set<Platform['role']>(['end', 'fork', 'hub', 'trampoline', 'switch', 'lane']);
/** Sigils only go on calm decks (never near obstacles, pads or leap windows). */
const SIGIL_ROLES = new Set<Platform['role']>(['plain', 'start', 'entry']);

/**
 * Decorative city around the route, like the reference art: towers of varied height flanking the
 * buildings, some capped with glowing symbols, plus flat glowing sigils on calm decks.
 * Deterministic per building, never overlapping any building, and towers on the camera's side
 * (the runner's right) stay below the deck so they can't hide the runner or the route.
 */
export function planCity(world: World): { towers: Tower[]; sigils: Sigil[] } {
  const towers: Tower[] = [];
  const sigils: Sigil[] = [];
  const blocked = world.platforms.map((p) => ({
    minX: p.minX - 1.5,
    maxX: p.maxX + 1.5,
    minZ: p.minZ - 1.5,
    maxZ: p.maxZ + 1.5,
  }));
  const free = (x: number, z: number, r: number) =>
    !blocked.some((b) => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ);

  for (const p of world.platforms) {
    if (!CLEAR.has(p.role)) {
      for (let along = p.a + 3, i = 0; along < p.b - 2; along += 6 + hash(p.id, i) * 5, i++) {
        if (towers.length >= MAX_TOWERS) break;
        for (const side of [-1, 1]) {
          const h = hash(p.id * 7 + i, side);
          if (h < 0.35) continue; // gaps in the skyline
          const size = 1.6 + hash(p.id, i * 3 + side) * 2.6;
          const lateral = side * (p.hw + 2.2 + size / 2 + hash(i, p.id) * 6);
          const c = runPoint(p.run, along, lateral);
          if (!free(c.x, c.z, size * 0.75)) continue;
          // Left (away from the camera) may tower above the deck; right stays below it.
          const rise = side < 0 ? -4 + h * 9 : -9 + h * 4;
          const capRoll = hash(p.id + i, 11);
          towers.push({
            platformId: p.id,
            x: c.x,
            z: c.z,
            size,
            top: p.top + Math.min(rise, side < 0 ? 5 : -3),
            yaw: (hash(p.id, i + 5) - 0.5) * 0.6,
            shape: h > 0.75 ? 'hex' : 'rect',
            cap: capRoll < 0.45 ? 'none' : capRoll < 0.75 ? 'diamond' : 'pyramid',
          });
        }
      }
    }
    if (SIGIL_ROLES.has(p.role) && sigils.length < MAX_SIGILS && hash(p.id, 3) > 0.45) {
      const kinds = ['ring', 'octagon', 'diamond'] as const;
      // Beside the lane, never on its centre line.
      const lateral = (hash(p.id, 4) > 0.5 ? 1 : -1) * Math.max(0.6, p.hw - 0.75);
      const c = runPoint(
        p.run,
        (p.a + p.b) / 2 + (hash(p.id, 6) - 0.5) * (p.b - p.a) * 0.4,
        lateral,
      );
      // Triangles and wedges narrow toward their ends: only place it on the deck itself.
      if (pointInPoly(p.poly, c.x, c.z))
        sigils.push({
          platformId: p.id,
          x: c.x,
          z: c.z,
          y: p.top + 0.02,
          kind: kinds[Math.floor(hash(p.id, 5) * 3)]!,
        });
    }
  }
  return { towers, sigils };
}
