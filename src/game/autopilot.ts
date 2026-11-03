import { CONFIG } from './config';
import type { Action, GameSim } from './sim';
import { DIR_X, DIR_Z, runAlong } from './world';

export interface PilotOptions {
  /** Take optional fork exits instead of running straight on. */
  takeForks?: boolean;
}

/**
 * Rule-based perfect player. Drives phantom mode, the `?autopilot` debug flag and the long-run
 * tests that prove generated worlds are survivable.
 */
export function autopilot(sim: GameSim, options: PilotOptions = {}): Action | null {
  if (sim.phase !== 'playing') return null;
  const w = sim.world;

  for (const e of w.exits) {
    if (e.fromDir !== sim.dir || (e.optional && !options.takeForks)) continue;
    // Side leaps and lane hops start from the ground; mid-air steers happen in the bounce.
    if ((e.kind === 'air') === !sim.grounded && sim.inExit(e)) return e.turn;
  }
  // Wall-run: after jumping into the gap, side-step toward the wall.
  if (!sim.grounded && sim.move === 'none') {
    for (const wall of w.walls) {
      if (wall.run.dir !== sim.dir) continue;
      const along = runAlong(wall.run, sim.x, sim.z);
      if (along > wall.a - 1 && along < wall.b - CONFIG.wallKickLead - 1)
        return wall.side === 1 ? 'right' : 'left';
    }
  }
  if (!sim.grounded) return null;

  const dx = DIR_X[sim.dir]!;
  const dz = DIR_Z[sim.dir]!;
  const r = CONFIG.runnerRadius;

  // Nearest obstacle straight ahead on the runner's line.
  let nearest = Infinity;
  let kind: string | null = null;
  for (const o of w.obstacles) {
    if (o.kind === 'wall' || o.kind === 'sideWall') continue;
    const onLine = dx !== 0 ? sim.z > o.minZ && sim.z < o.maxZ : sim.x > o.minX && sim.x < o.maxX;
    if (!onLine) continue;
    const gap =
      dx > 0 ? o.minX - sim.x : dx < 0 ? sim.x - o.maxX : dz > 0 ? o.minZ - sim.z : sim.z - o.maxZ;
    if (gap - r > -0.05 && gap < nearest) {
      nearest = gap - r;
      kind = o.kind;
    }
  }
  if (kind === 'low' && nearest <= sim.speed * 0.2) return 'jump';
  if (
    (kind === 'high' || kind === 'mid') &&
    nearest <= Math.max(0.8, sim.speed * 0.12) &&
    !sim.sliding
  ) {
    return 'slide';
  }

  // Jump just before running out of building.
  const lead = 0.4 + sim.speed * CONFIG.stepSeconds * 2;
  if (!w.supportAt(sim.x + dx * lead, sim.z + dz * lead)) return 'jump';
  return null;
}
