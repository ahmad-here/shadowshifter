import * as THREE from 'three';
import type { GameSim } from '../game/sim';

const MAX = 48;
const LIFE = 0.55;

/**
 * Dust kicked up at the feet: a burst on every landing and slide start, driven by sim event
 * counters (never by input). One fixed pool of points, one draw call. Presentation only.
 */
export class DustView {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private age = new Float32Array(MAX).fill(LIFE);
  private next = 0;
  private seen = { landings: 0, sliding: false };
  enabled = true;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xc9d8ea,
        size: 0.16,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  reset(sim: GameSim): void {
    this.seen = { landings: sim.landings, sliding: sim.sliding };
    this.age.fill(LIFE);
  }

  update(sim: GameSim, dt: number, reduced: boolean): void {
    this.points.visible = this.enabled && !reduced;
    if (!this.points.visible) return;
    // Bigger burst the harder the landing.
    if (sim.landings > this.seen.landings && sim.grounded) {
      const k = Math.min(2, sim.landingSpeed / 9);
      this.burst(sim, Math.round(10 * k + 4), 1.6 + 1.4 * k);
    }
    if (sim.sliding && !this.seen.sliding) this.burst(sim, 10, 3);
    this.seen = { landings: sim.landings, sliding: sim.sliding };

    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      if (this.age[i]! >= LIFE) {
        this.pos[i * 3 + 1] = -1e4; // parked far below
        continue;
      }
      alive++;
      this.age[i]! += dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k]! += this.vel[i * 3 + k]! * dt;
      this.vel[i * 3 + 1]! -= 4 * dt; // dust settles
      for (const k of [0, 2]) this.vel[i * 3 + k]! *= 1 - 3 * dt; // air drag
    }
    const mat = this.points.material as THREE.PointsMaterial;
    mat.opacity = alive ? 0.7 : 0;
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** `n` puffs at the runner's feet, sprayed sideways and back at up to `spread` m/s. */
  private burst(sim: GameSim, n: number, spread: number): void {
    for (let j = 0; j < n; j++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const r = spread * (0.4 + Math.random() * 0.6);
      this.pos.set([sim.x, sim.y + 0.05, sim.z], i * 3);
      this.vel.set([Math.cos(a) * r, 0.6 + Math.random() * 1.2, Math.sin(a) * r], i * 3);
      this.age[i] = 0;
    }
  }
}
