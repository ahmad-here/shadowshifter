import { CONFIG } from '../game/config';
import type { GameSim } from '../game/sim';
import { runLateral } from '../game/world';

/**
 * Body offset and tilt for the moves the clips don't cover, in the runner's own frame (x = to
 * the right, z = backwards): leaning into a wall-run, hugging a climb face, the mantle over its top
 * and the tuck of a vault. Pure: derived from sim state only.
 */
export interface MovePose {
  /** Offset from the sim position: sideways (right +) and up. */
  x: number;
  y: number;
  /** Lean: pitch (+ = forward) and roll (+ = toward the right). */
  pitch: number;
  roll: number;
  scale: number;
  /** 0 = the normal suit, 1 = the shadow form. */
  shadow: number;
}

export function movePose(sim: GameSim): MovePose {
  const pose: MovePose = {
    x: 0,
    y: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    shadow: sim.effect === 'shadow' ? 1 : 0,
  };
  switch (sim.move) {
    case 'wallrun': {
      // The wall-run clip carries the pose (hips rolled 55 degrees, feet on the wall); shift the
      // body over so its feet meet the wall face, which stands `face` out from the lane centre.
      const side = sim.wall?.side ?? 1;
      const face = CONFIG.pathHalfWidth + CONFIG.wallOffset;
      const lat = sim.wall ? runLateral(sim.wall.run, sim.x, sim.z) : 0;
      return { ...pose, x: side * (face - 0.75) - lat, y: 0.35 };
    }
    case 'climb':
      // Scrambling up the face: chest in, leaning hard into the wall.
      return { ...pose, pitch: 0.5, y: -0.15 };
    case 'flip': {
      // Mantle over the edge: pitched forward as the body rolls over the lip, straightening up
      // smoothly by the time the feet land on the deck.
      const p = Math.min(
        1,
        Math.max(0, (CONFIG.flipVelocity - sim.vy) / (2 * CONFIG.flipVelocity)),
      );
      return { ...pose, pitch: 0.9 * (1 - p) * (1 - p), y: -0.25 * (1 - p) };
    }
    case 'vault':
      return { ...pose, pitch: 0.45, roll: 0.25 };
    default:
      return pose;
  }
}
