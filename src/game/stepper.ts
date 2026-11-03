import { CONFIG } from './config';

/** Accumulates variable frame time and runs a whole number of fixed-size simulation steps. */
export class FixedStepper {
  private acc = 0;

  constructor(
    readonly step: number = CONFIG.stepSeconds,
    readonly maxFrame: number = CONFIG.maxFrameSeconds,
  ) {}

  /** Returns the number of steps run. */
  advance(frameSeconds: number, run: (dt: number) => void): number {
    if (!(frameSeconds > 0)) return 0;
    this.acc += Math.min(frameSeconds, this.maxFrame);
    let n = 0;
    // Small epsilon so float drift (e.g. 1/60 = 2 * 1/120) never drops a step.
    while (this.acc >= this.step - 1e-9) {
      run(this.step);
      this.acc -= this.step;
      n++;
    }
    if (this.acc < 0) this.acc = 0;
    return n;
  }

  /** Fraction of a step left over, for render interpolation. */
  get alpha(): number {
    return this.acc / this.step;
  }

  reset(): void {
    this.acc = 0;
  }
}
