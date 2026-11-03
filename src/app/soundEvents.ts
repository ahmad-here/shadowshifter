import type { GameSim } from '../game/sim';

export type SoundEvent =
  | 'jump'
  | 'leap'
  | 'land'
  | 'slide'
  | 'bounce'
  | 'refused'
  | 'spell'
  | 'emerge'
  | 'portal'
  | 'nearMiss'
  | 'mirrorEnd'
  | 'crash'
  | 'burn'
  | 'fall'
  | 'start'
  | 'shard';

/** Snapshot of the sim counters that sounds react to. */
export interface SoundState {
  phase: GameSim['phase'];
  jumps: number;
  sideJumps: number;
  landings: number;
  sliding: boolean;
  bounces: number;
  refused: number;
  spells: number;
  shadowExits: number;
  portals: number;
  nearMisses: number;
  mirrored: boolean;
  cause: GameSim['deathCause'];
  shards: number;
}

export function soundState(sim: GameSim): SoundState {
  return {
    phase: sim.phase,
    jumps: sim.jumps,
    sideJumps: sim.sideJumps,
    landings: sim.landings,
    sliding: sim.sliding,
    bounces: sim.bounces,
    refused: sim.leapsRefused,
    spells: sim.spellsTaken,
    shadowExits: sim.shadowExits,
    portals: sim.portalsTaken,
    nearMisses: sim.nearMisses,
    mirrored: sim.mirrored,
    cause: sim.deathCause,
    shards: sim.shards,
  };
}

/**
 * Which sounds to play between two snapshots. Pure, so it can be tested without audio hardware.
 * A counter going *down* means a new run (restart), which plays nothing but 'start'.
 */
export function soundEvents(a: SoundState, b: SoundState): SoundEvent[] {
  if (b.jumps < a.jumps || b.landings < a.landings) return b.phase === 'playing' ? ['start'] : [];
  const out: SoundEvent[] = [];
  if (a.phase !== 'playing' && b.phase === 'playing' && a.phase === 'ready') out.push('start');
  const leaps = b.sideJumps - a.sideJumps;
  const bounces = b.bounces - a.bounces;
  // A side leap and a bounce are also counted as jumps; give each its own sound.
  if (leaps > 0) out.push('leap');
  if (bounces > 0) out.push('bounce');
  if (b.jumps - a.jumps > leaps + bounces) out.push('jump');
  if (b.landings > a.landings) out.push('land');
  if (b.shards > a.shards) out.push('shard');
  if (b.sliding && !a.sliding) out.push('slide');
  if (b.refused > a.refused) out.push('refused');
  if (b.spells > a.spells) out.push('spell');
  if (b.shadowExits > a.shadowExits) out.push('emerge');
  if (b.portals > a.portals) out.push('portal');
  if (b.nearMisses > a.nearMisses) out.push('nearMiss');
  if (a.mirrored && !b.mirrored && b.phase === 'playing') out.push('mirrorEnd');
  if (a.phase === 'playing' && b.phase === 'dying')
    out.push(b.cause === 'fell' ? 'fall' : b.cause === 'burn' ? 'burn' : 'crash');
  return out;
}
