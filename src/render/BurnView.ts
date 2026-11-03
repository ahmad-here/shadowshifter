import * as THREE from 'three';
import { CONFIG } from '../game/config';
import type { GameSim } from '../game/sim';

const EMBERS = 70;
const SMOKE = 30;

/**
 * Burning in a laser: glowing embers streaming up from the body and grey smoke rolling off it,
 * for as long as the burn lasts. Two fixed point pools (two draw calls, only while burning).
 * Presentation only: driven by the sim's death cause.
 */
export class BurnView {
  readonly group = new THREE.Group();
  private embers: Pool;
  private smoke: Pool;
  private wasBurning = false;

  constructor() {
    this.embers = new Pool(
      EMBERS,
      new THREE.PointsMaterial({
        color: 0xff7a1a,
        size: 0.12,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.smoke = new Pool(
      SMOKE,
      new THREE.PointsMaterial({
        color: 0x3a3d44,
        size: 0.55,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.group.add(this.embers.points, this.smoke.points);
  }

  update(sim: GameSim, dt: number, reduced: boolean): void {
    const burning = sim.phase !== 'playing' && sim.deathCause === 'burn' && !reduced;
    if (burning && !this.wasBurning) {
      this.embers.reset();
      this.smoke.reset();
    }
    this.wasBurning = burning;
    this.group.visible = burning;
    if (!burning) return;
    // Strongest at first, dying down over the burn.
    const heat = Math.max(0, 1 - sim.dyingTime / CONFIG.dyingSeconds);
    this.embers.emit(sim, dt, 90 * heat, (v) => {
      v.set((Math.random() - 0.5) * 1.6, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 1.6);
    });
    this.smoke.emit(sim, dt, 24 * (0.3 + heat), (v) => {
      v.set((Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4);
    });
    this.embers.step(dt, 0.9, -1.5);
    this.smoke.step(dt, 1.6, 0.2);
    (this.embers.points.material as THREE.PointsMaterial).opacity = 0.6 + 0.4 * heat;
  }
}

/** A ring buffer of points with velocities and ages. */
class Pool {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private next = 0;
  private carry = 0;
  private v = new THREE.Vector3();

  constructor(
    private readonly n: number,
    material: THREE.PointsMaterial,
  ) {
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(99);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
  }

  reset(): void {
    this.age.fill(99);
    this.carry = 0;
  }

  /** Spawn `rate` per second around the runner's body, each with `init` setting its velocity. */
  emit(sim: GameSim, dt: number, rate: number, init: (v: THREE.Vector3) => void): void {
    this.carry += rate * dt;
    while (this.carry >= 1) {
      this.carry -= 1;
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      this.pos[i * 3] = sim.x + (Math.random() - 0.5) * 0.5;
      this.pos[i * 3 + 1] = sim.y + 0.2 + Math.random() * 1.4;
      this.pos[i * 3 + 2] = sim.z + (Math.random() - 0.5) * 0.5;
      init(this.v);
      this.vel[i * 3] = this.v.x;
      this.vel[i * 3 + 1] = this.v.y;
      this.vel[i * 3 + 2] = this.v.z;
      this.age[i] = 0;
    }
  }

  /** Advance: particles older than `life` are parked; `gravity` pulls (negative = rise slows). */
  step(dt: number, life: number, gravity: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.age[i]! >= life) {
        this.pos[i * 3 + 1] = -1e4;
        continue;
      }
      this.age[i]! += dt;
      this.vel[i * 3 + 1]! += gravity * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k]! += this.vel[i * 3 + k]! * dt;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
