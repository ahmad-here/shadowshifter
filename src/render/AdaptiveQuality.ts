import type { QualityProfile } from '../app/settings';
import { QUALITY_ORDER } from './quality';

export interface AdaptiveOptions {
  /** Frames in the measurement window. */
  window: number;
  /** Step down when the window's 90th-percentile frame time exceeds this (s). */
  slowFrame: number;
  /** Step up only when the 90th percentile stays under this (s)... */
  fastFrame: number;
  /** ...for this long (s). */
  upAfter: number;
  /** Ignore measurements for this long after any change or reset (s). */
  cooldown: number;
  /** After this many down-then-up reversals, stop stepping up (prevents oscillation). */
  maxReversals: number;
}

export const ADAPTIVE_DEFAULTS: AdaptiveOptions = {
  window: 90,
  slowFrame: 1 / 45,
  fastFrame: 1 / 57,
  upAfter: 8,
  cooldown: 2,
  maxReversals: 2,
};

/**
 * Picks a graphics profile from measured frame times. Steps one level at a time, waits after
 * every change, and locks to the lower level if it keeps bouncing between two. Presentation only.
 */
export class AdaptiveQuality {
  private frames: number[] = [];
  /** Reused sort buffer, so measuring allocates nothing per frame. */
  private scratch: Float64Array;
  private tick = 0;
  private wait: number;
  private goodFor = 0;
  private reversals = 0;
  private lastStep: 'up' | 'down' | null = null;
  private level: number;
  private readonly ceiling: number;

  constructor(
    start: QualityProfile,
    private readonly o: AdaptiveOptions = ADAPTIVE_DEFAULTS,
  ) {
    this.level = QUALITY_ORDER.indexOf(start);
    this.ceiling = this.level;
    this.wait = o.cooldown;
    this.scratch = new Float64Array(o.window);
  }

  get profile(): QualityProfile {
    return QUALITY_ORDER[this.level]!;
  }

  /** Discard measurements, e.g. while paused or right after a scene rebuild. */
  hold(): void {
    this.frames.length = 0;
    this.goodFor = 0;
    this.wait = this.o.cooldown;
  }

  /** Feed one frame's duration; returns the new profile when it changes, else null. */
  sample(dt: number): QualityProfile | null {
    if (!(dt > 0) || dt > 0.5) return null; // tab switches and debugger pauses are not load
    if (this.wait > 0) {
      this.wait -= dt;
      return null;
    }
    this.frames.push(dt);
    if (this.frames.length > this.o.window) this.frames.shift();
    if (this.frames.length < this.o.window) return null;
    this.tick = (this.tick + 1) % 10;
    if (this.tick !== 0) {
      if (this.goodFor > 0) this.goodFor += dt;
      return null;
    }
    const p90 = percentile(this.frames, 0.9, this.scratch);

    if (p90 > this.o.slowFrame && this.level > 0) return this.step(-1);
    if (p90 < this.o.fastFrame) this.goodFor += dt;
    else this.goodFor = 0;
    const mayRise = this.level < this.ceiling && this.reversals < this.o.maxReversals;
    if (mayRise && this.goodFor >= this.o.upAfter) return this.step(1);
    return null;
  }

  private step(dir: 1 | -1): QualityProfile {
    const kind = dir > 0 ? 'up' : 'down';
    if (this.lastStep === 'down' && kind === 'up') this.reversals += 1;
    this.lastStep = kind;
    this.level += dir;
    this.hold();
    return this.profile;
  }
}

/** Starting estimate only; measurements take over from there. */
export function initialProfile(
  nav: { hardwareConcurrency?: number },
  coarsePointer: boolean,
): QualityProfile {
  const cores = nav.hardwareConcurrency ?? 4;
  if (coarsePointer) return cores >= 8 ? 'medium' : 'low';
  return cores >= 4 ? 'high' : 'medium';
}

function percentile(values: number[], q: number, scratch: Float64Array): number {
  for (let i = 0; i < values.length; i++) scratch[i] = values[i]!;
  const s = scratch.subarray(0, values.length).sort();
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}
