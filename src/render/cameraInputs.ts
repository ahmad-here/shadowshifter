import { CONFIG } from '../game/config';
import type { GameSim } from '../game/sim';

/** The sim counters and states the camera reacts to, as last seen. */
export function seen(sim?: GameSim) {
  return {
    landings: sim?.landings ?? 0,
    jumps: sim?.jumps ?? 0,
    side: sim?.sideJumps ?? 0,
    crash: sim?.phase === 'dying' && sim.deathCause === 'hit',
    sliding: sim?.sliding ?? false,
    dir: sim?.dir ?? 0,
    moves: sim ? sim.vaults + sim.wallRuns + sim.climbs : 0,
  };
}

/** 0 at the start speed, 1 at top speed. */
export function paceOf(sim: GameSim): number {
  const k = (sim.speed - CONFIG.startSpeed) / (CONFIG.maxSpeed - CONFIG.startSpeed);
  return Math.min(1, Math.max(0, k));
}
