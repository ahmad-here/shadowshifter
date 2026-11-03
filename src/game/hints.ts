import { CONFIG } from './config';
import type { GameSim } from './sim';
import { DIR_X, DIR_Z, runAlong, type Bounds, type Turn } from './world';

export type HintKind =
  | 'jump'
  | 'barrier'
  | 'slide'
  | 'either'
  | 'leftLeap'
  | 'rightLeap'
  | 'leftHop'
  | 'rightHop'
  | 'trampoline'
  | 'spell'
  | 'portal'
  | 'leftWall'
  | 'rightWall';

/** Every hint, in the order players normally meet them. */
export const HINTS: readonly HintKind[] = [
  'jump',
  'barrier',
  'slide',
  'either',
  'leftLeap',
  'rightLeap',
  'leftHop',
  'rightHop',
  'trampoline',
  'spell',
  'portal',
  'leftWall',
  'rightWall',
];

/** How far ahead (m) a mechanic is announced: about 1.6 s of running, never under 14 m. */
export function hintLookahead(speed: number): number {
  return Math.max(14, speed * 1.6);
}

/**
 * The nearest upcoming mechanic on the runner's line that the player has not been taught yet,
 * or null. Pure and read-only; the sim is never changed.
 */
export function nextHint(sim: GameSim, seen: ReadonlySet<HintKind>): HintKind | null {
  if (sim.phase !== 'playing') return null;
  const look = hintLookahead(sim.speed);
  let best: HintKind | null = null;
  let bestD = Infinity;
  const consider = (kind: HintKind, d: number) => {
    if (seen.has(kind) || d < 0 || d > look || d >= bestD) return;
    best = kind;
    bestD = d;
  };

  const up = sim.upcomingExit(look);
  // Mid-air steers are taught by the trampoline tip; side leaps and lane hops get their own.
  if (up && !up.exit.optional && up.exit.kind !== 'air') {
    const kind = up.exit.kind === 'hop' ? hopHint(up.exit.turn) : leapHint(up.exit.turn);
    consider(kind, Math.max(0, sim.distanceToExit(up.exit)));
  }

  const w = sim.world;
  for (const o of w.obstacles) {
    if (o.kind === 'sideWall' || o.kind === 'wall') continue;
    const kind: HintKind = o.kind === 'low' ? 'barrier' : o.kind === 'high' ? 'slide' : 'either';
    consider(kind, aheadOnLine(sim, o));
  }
  for (const p of w.pads) consider('trampoline', aheadOnLine(sim, p));
  // Keep the trampoline tip up through the bounce: steering is the part to learn.
  if (sim.bouncing && up?.exit.kind === 'air') consider('trampoline', 0);
  for (const s of w.spells) if (!s.taken) consider('spell', aheadOnLine(sim, pointBox(s.x, s.z)));
  for (const p of w.portals) if (!p.taken) consider('portal', aheadOnLine(sim, p));
  for (const wall of w.walls) {
    // Only walls on the runner's own run, measured along it (walls stand beside the lane, so the
    // on-the-line test used for obstacles does not apply). Announced until the runner is on it.
    if (sim.move === 'wallrun' || wall.run !== sim.platform?.run) continue;
    const kind: HintKind = wall.side === 1 ? 'rightWall' : 'leftWall';
    const d = wall.a - runAlong(wall.run, sim.x, sim.z);
    if (d > -(wall.b - wall.a)) consider(kind, Math.max(0, d));
  }

  // A gap: the building underfoot ends ahead and is not a dead end.
  if (!seen.has('jump') && sim.grounded) {
    const dx = DIR_X[sim.dir]!;
    const dz = DIR_Z[sim.dir]!;
    for (let d = 1; d <= look; d += 1) {
      if (w.supportAt(sim.x + dx * d, sim.z + dz * d)) continue;
      const beyond = w.supportAt(
        sim.x + dx * (d + CONFIG.maxGap + 0.5),
        sim.z + dz * (d + CONFIG.maxGap + 0.5),
      );
      if (beyond && beyond.run.dir === sim.dir) consider('jump', d);
      break;
    }
  }
  return best;
}

function hopHint(turn: Turn): HintKind {
  return turn === 'left' ? 'leftHop' : 'rightHop';
}

function leapHint(turn: Turn): HintKind {
  return turn === 'left' ? 'leftLeap' : 'rightLeap';
}

function pointBox(x: number, z: number): Bounds {
  return { minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 };
}

/** Distance ahead to the near face of `b` if it lies on the runner's line, else -1. */
function aheadOnLine(sim: GameSim, b: Bounds): number {
  const dx = DIR_X[sim.dir]!;
  const dz = DIR_Z[sim.dir]!;
  if (dx !== 0) {
    if (sim.z < b.minZ || sim.z > b.maxZ) return -1;
    return dx > 0 ? b.minX - sim.x : sim.x - b.maxX;
  }
  if (sim.x < b.minX || sim.x > b.maxX) return -1;
  return dz > 0 ? b.minZ - sim.z : sim.z - b.maxZ;
}
