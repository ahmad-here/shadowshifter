/** Frame-rate independent exponential approach. */
export function approach(from: number, to: number, rate: number, dt: number): number {
  return from + (to - from) * (1 - Math.exp(-rate * dt));
}

/** Like `approach`, but for angles, along the shortest arc. */
export function approachAngle(from: number, to: number, rate: number, dt: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * (1 - Math.exp(-rate * dt));
}

/** Stable pseudo-random value in [0, 1) for a grid cell. */
export function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
