import { CONFIG } from '../game/config';
import type { GameSim } from '../game/sim';

export type ClipName = 'run' | 'runBack' | 'jumpUp' | 'jumpDown' | 'slide';

/** Source clip lengths (s) in runner.glb, used to time clips to the simulation. */
export const CLIP_SECONDS: Record<ClipName, number> = {
  run: 0.63,
  runBack: 0.63,
  jumpUp: 0.83,
  jumpDown: 2.3,
  slide: 1.53,
};

export interface ClipChoice {
  clip: ClipName;
  /** Playback rate so the clip matches what the simulation is doing. */
  timeScale: number;
  loop: boolean;
}

/**
 * Which animation shows the simulation's current state. Pure (presentation only): the clip
 * follows the sim, never the other way round, so a pose can't promise what physics didn't do.
 */
export function chooseClip(sim: GameSim): ClipChoice {
  if (sim.phase === 'ready' || sim.phase === 'paused') {
    return { clip: 'run', timeScale: 0, loop: true };
  }
  if (sim.phase === 'dying' || sim.phase === 'gameover') {
    return { clip: 'jumpDown', timeScale: 1.2, loop: false };
  }
  // Parkour moves: the run cycle on the wall and (fast, scrambling) up a climb; a tuck for the
  // flip and the vault.
  if (sim.move === 'wallrun') return { clip: 'run', timeScale: sim.speed / 9, loop: true };
  if (sim.move === 'climb') return { clip: 'jumpUp', timeScale: 2.2, loop: false };
  if (sim.move === 'flip') return { clip: 'jumpUp', timeScale: 1.4, loop: false };
  if (sim.move === 'vault') return { clip: 'jumpUp', timeScale: 1.4, loop: false };
  if (sim.sliding) {
    // Squeeze the slide clip into the simulation's slide time.
    return { clip: 'slide', timeScale: CLIP_SECONDS.slide / CONFIG.slideSeconds, loop: false };
  }
  if (!sim.grounded) {
    // One jump pose for the whole flight (no switch to a falling clip at the top), held once
    // the clip ends.
    const airtime = (2 * CONFIG.jumpVelocity) / CONFIG.gravity;
    return { clip: 'jumpUp', timeScale: CLIP_SECONDS.jumpUp / airtime, loop: false };
  }
  // Running: cadence rises with speed (1.0 at the clip's natural pace, ~10 m/s).
  const timeScale = Math.max(0.8, sim.speed / 10);
  return sim.mirrored
    ? { clip: 'runBack', timeScale, loop: true }
    : { clip: 'run', timeScale, loop: true };
}
