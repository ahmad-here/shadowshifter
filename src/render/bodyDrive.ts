import * as THREE from 'three';
import { CONFIG } from '../game/config';
import type { GameSim } from '../game/sim';
import { dirYaw } from '../game/world';
import { approach, approachAngle } from './math';

/** Lower spine bones take more of the lean and bank. */
const SHARE = [0.45, 0.33, 0.22];
/** Most the body may bank into a turn (about 22 degrees: the hard lean of the reference). */
const MAX_BANK = 0.38;

/**
 * Procedural layer on top of the animation clips that gives the runner an athletic, driven feel
 * (like professional parkour footage): a forward lean that grows with speed, banking into turns
 * and side leaps, a level, stabilised head while the body pumps, and a compression on landing.
 * Lean is spread down the spine (lower bones more) and every input is smoothed, so it never
 * jitters. Presentation only: derived from sim state, applied after the mixer each frame (the
 * clips set these bones every frame, so the offsets can never accumulate).
 */
export class BodyDrive {
  private lean = 0;
  private bank = 0;
  private crouch = 0;
  private yaw = 0;
  private seenLandings = 0;
  private spine: THREE.Object3D[] = [];
  private hips: THREE.Object3D | null = null;
  private head: THREE.Object3D | null = null;
  private neck: THREE.Object3D | null = null;

  constructor(root: THREE.Object3D) {
    const byName = (n: string) => root.getObjectByName(`mixamorig${n}`) ?? null;
    this.spine = ['Spine', 'Spine1', 'Spine2'].map(byName).filter((b) => b !== null);
    this.hips = byName('Hips');
    this.neck = byName('Neck');
    this.head = byName('Head');
  }

  reset(sim: GameSim): void {
    this.lean = this.bank = this.crouch = 0;
    this.yaw = dirYaw(sim.dir);
    this.seenLandings = sim.landings;
  }

  /** Update the drive from the sim and apply it to the posed skeleton. */
  apply(sim: GameSim, dt: number): void {
    if (dt <= 0) return;
    const playing = sim.phase === 'playing';
    const pace = Math.min(
      1,
      Math.max(0, (sim.speed - CONFIG.startSpeed) / (CONFIG.maxSpeed - CONFIG.startSpeed)),
    );
    // Forward drive: leaning into the run, more at speed; upright in the air and on walls.
    const running = playing && sim.grounded && !sim.sliding && sim.move === 'none';
    this.lean = approach(this.lean, running ? 0.14 + 0.16 * pace : 0.04, 6, dt);
    // Bank into turns: from the rate the heading swings (smoothed), clamped.
    const target = sim.facing;
    const before = this.yaw;
    this.yaw = approachAngle(this.yaw, target, 9, dt);
    let rate = (this.yaw - before) / dt;
    rate = Math.atan2(Math.sin(rate * dt), Math.cos(rate * dt)) / dt;
    const bankTarget = Math.max(-MAX_BANK, Math.min(MAX_BANK, -rate * 0.09));
    this.bank = approach(this.bank, bankTarget, 10, dt);
    // Landing compression, settling back.
    if (sim.landings > this.seenLandings) this.crouch = 1;
    this.seenLandings = sim.landings;
    this.crouch = approach(this.crouch, 0, 7, dt);

    // Spread down the spine: lower bones take more of the lean and bank.
    this.spine.forEach((b, i) => {
      const s = SHARE[i] ?? 0.2;
      b.rotation.x += (this.lean + this.crouch * 0.22) * s;
      b.rotation.z += this.bank * s;
    });
    if (this.hips) this.hips.position.y -= this.crouch * 0.05; // metres
    // Head stabilisation: counter the lean and bank so the gaze stays level and forward.
    if (this.neck) this.neck.rotation.x -= this.lean * 0.35;
    if (this.head) {
      this.head.rotation.x -= (this.lean + this.crouch * 0.22) * 0.55;
      this.head.rotation.z -= this.bank * 0.8;
    }
  }
}
