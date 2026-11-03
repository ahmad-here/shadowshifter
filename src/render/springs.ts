import type * as THREE from 'three';

/** Camera motion helpers: smooth noise and two kinds of spring. Presentation only. */

/** Irregular but smooth noise in about -1..1 (sum of incommensurate sines). */
export function jitter(t: number): number {
  return 0.5 * Math.sin(t * 2.31) + 0.3 * Math.sin(t * 3.73 + 1.3) + 0.2 * Math.sin(t * 5.97 + 2.1);
}

/** Critically damped spring toward a moving target (frame-rate independent). */
export class Spring {
  x = 0;
  y = 0;
  z = 0;
  private v = [0, 0, 0];

  follow(to: THREE.Vector3, omega: number, dt: number, snap: boolean): void {
    if (snap) {
      [this.x, this.y, this.z] = [to.x, to.y, to.z];
      this.v = [0, 0, 0];
      return;
    }
    [this.x, this.v[0]] = damp(this.x, this.v[0]!, to.x, omega, dt);
    [this.y, this.v[1]] = damp(this.y, this.v[1]!, to.y, omega, dt);
    [this.z, this.v[2]] = damp(this.z, this.v[2]!, to.z, omega, dt);
  }
}

function damp(x: number, v: number, to: number, omega: number, dt: number): [number, number] {
  const e = Math.exp(-omega * dt);
  const d = x - to;
  const temp = (v + omega * d) * dt;
  return [to + (d + temp) * e, (v - omega * temp) * e];
}

/** Under-damped spring back to rest: kicked by events, it overshoots a little and settles. */
export class Wobble {
  x = 0;
  y = 0;
  roll = 0;
  private v = [0, 0, 0];

  reset(): void {
    this.x = this.y = this.roll = 0;
    this.v = [0, 0, 0];
  }

  /** Add velocity: lateral and vertical in m/s, roll in rad/s. */
  kick(x: number, y: number, roll: number): void {
    this.v[0]! += x;
    this.v[1]! += y;
    this.v[2]! += roll;
  }

  update(dt: number): void {
    const k = 140;
    const c = 10;
    const vals = [this.x, this.y, this.roll];
    // Small fixed substeps keep the spring stable at any frame rate.
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < 3; i++) {
        this.v[i]! += (-k * vals[i]! - c * this.v[i]!) * h;
        vals[i]! += this.v[i]! * h;
      }
    }
    [this.x, this.y, this.roll] = [vals[0]!, vals[1]!, vals[2]!];
  }
}
