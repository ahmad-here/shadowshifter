import * as THREE from 'three';
import type { GameSim } from '../game/sim';
import { dirYaw } from '../game/world';
import { approach, approachAngle } from './math';
import { markSeen, paceOf, seen, setFov, turnRoll } from './cameraInputs';
import { jitter, Spring, Wobble } from './springs';

/** Follow stiffness (1/s), critically damped: loose enough that speed-ups and turns visibly lag. */
const FOLLOW = 5;
const AIM = 8;

/**
 * Handheld chase camera: a camera operator sprinting behind the runner, just above shoulder
 * height. The ideal spot is followed with a little lag; on top of that the operator's "body" is
 * an under-damped spring that real sim events kick (footsteps, jumps, landings, slides, turns),
 * so it jolts, overshoots slightly and recovers like a person, plus irregular micro-jitter and
 * roll. Presentation only: it reacts to sim state and counters, never the reverse.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.2, 320);
  private yaw = 0;
  private baseFov = 60;
  private dip = 0;
  private shake = 0;
  private t = 0;
  private stride = 0;
  private step = 0;
  private ground = 0;
  private crouch = 0;
  /** Roll held through a slide (alternates side per slide), and the side of the last one. */
  private slideRoll = 0;
  private slideSide = 1;
  private wallRoll = 0; // roll held while running along a wall
  private turnRoll = 0; // roll into a turn while swinging round
  /** Near-miss speed punch (FOV kick), decaying to 0. */
  private kick = 0;
  private seenNear = 0;
  private seen = seen();
  private pos = new Spring();
  private aim = new Spring();
  /** Operator body: lateral, vertical and roll offsets on an under-damped spring. */
  private body = new Wobble();
  private target = new THREE.Vector3();

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.baseFov = this.camera.aspect < 1 ? 72 : 60;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  reset(sim: GameSim): void {
    this.yaw = dirYaw(sim.dir);
    this.dip = this.shake = this.crouch = this.slideRoll = 0;
    this.seen = seen(sim);
    this.body.reset();
    this.kick = 0;
    this.seenNear = sim.nearMisses;
    this.ground = sim.platform?.top ?? sim.y;
    this.place(sim, 0, true);
  }

  update(sim: GameSim, dt: number, reduced: boolean): void {
    this.t += dt;
    const live = sim.phase === 'playing' && !reduced;
    const pace = paceOf(sim);
    this.react(sim, live, reduced, pace);
    this.dip = approach(this.dip, 0, 9, dt);
    this.shake = approach(this.shake, 0, 7, dt);
    this.slideRoll = approach(
      this.slideRoll,
      live && sim.sliding ? 0.32 * this.slideSide : 0,
      10,
      dt,
    );
    this.wallRoll = approach(
      this.wallRoll,
      live && sim.move === 'wallrun' ? -0.25 * (sim.wall?.side ?? 1) : 0,
      5,
      dt,
    );
    this.body.update(dt);
    this.place(sim, dt, false);

    // Footsteps: the operator's own stride, faster as the runner speeds up. Each footfall
    // jolts the camera down and alternately sideways, by slightly different amounts.
    const running = live && sim.grounded;
    if (running) {
      this.stride += dt * (2.6 + 1.4 * pace);
      const step = Math.floor(this.stride);
      if (step !== this.step) {
        this.step = step;
        const s = step % 2 ? 1 : -1;
        const r = jitter(step * 7.3);
        this.body.kick(s * (0.3 + 0.15 * r), -(0.55 + 0.35 * pace) * (0.8 + 0.4 * r), s * 0.07);
      }
    }
    // Micro-jitter: irregular, faster and stronger at speed.
    const j = live ? 0.012 + 0.02 * pace : 0;
    const jx = j * jitter(this.t * 9);
    const jy = j * jitter(this.t * 11 + 5);
    const shx = Math.sin(this.t * 61) * this.shake * 0.3;
    const shy = Math.cos(this.t * 53) * this.shake * 0.2;
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const lat = this.body.x + jx + shx;
    const up = this.body.y + jy + shy - this.dip;
    // The springs hold offsets from the runner, so the camera never falls behind at speed.
    this.camera.position.set(
      sim.x + this.pos.x + rx * lat,
      sim.y + this.pos.y + up,
      sim.z + this.pos.z + rz * lat,
    );
    // Never inside a building (e.g. swinging round after a side leap): ride over its deck.
    const under = sim.world.supportAt(this.camera.position.x, this.camera.position.z);
    if (under && this.camera.position.y < under.top + 0.8) this.camera.position.y = under.top + 0.8;
    this.camera.lookAt(
      sim.x + this.aim.x + rx * lat * 0.3,
      sim.y + this.aim.y + up * 0.4,
      sim.z + this.aim.z + rz * lat * 0.3,
    );
    this.camera.rotateZ(
      this.body.roll +
        this.slideRoll +
        this.wallRoll +
        this.turnRoll +
        (live ? 0.01 * jitter(this.t * 4 + 9) : 0),
    );

    if (sim.nearMisses > this.seenNear && !reduced) this.kick = 1;
    this.seenNear = sim.nearMisses;
    this.kick = approach(this.kick, 0, 6, dt);
    setFov(this.camera, this.baseFov + (reduced ? 0 : pace * 8 + this.kick * 6));
  }

  /** Kick the operator's body for what just happened in the sim. */
  private react(sim: GameSim, live: boolean, reduced: boolean, pace: number): void {
    const s = this.seen;
    const crashed = sim.phase === 'dying' && sim.deathCause !== 'fell';
    if (sim.landings > s.landings && !reduced) {
      this.dip = Math.min(0.7, 0.25 * (sim.landingSpeed / 9) ** 2);
      if (live) this.body.kick(jitter(this.t * 3) * 0.6, -2.2, jitter(this.t * 5) * 0.08);
    }
    if (live || crashed) {
      if (sim.jumps > s.jumps) this.body.kick(0, 1.2, 0);
      if (sim.dir !== s.dir || sim.sideJumps > s.side) {
        // Sudden direction change: the operator is thrown the other way and catches up.
        const turn = Math.sign(Math.sin(dirYaw(s.dir) - dirYaw(sim.dir))) || 1;
        this.body.kick(turn * 3, 0.5, turn * 0.9);
      }
      if (sim.sliding && !s.sliding) {
        this.slideSide = -this.slideSide;
        this.body.kick(this.slideSide * (1.8 + pace), -1.6, this.slideSide * 0.6);
      }
      // A parkour move starting (vault, wall catch, climb grab): the operator lurches.
      if (sim.vaults + sim.wallRuns + sim.climbs > s.moves)
        this.body.kick(jitter(this.t * 7) * 1.5, 1.4, (sim.wall?.side ?? 1) * -0.5);
      if (crashed && !s.crash && !reduced) this.shake = 1;
    }
    markSeen(s, sim, crashed);
  }

  /** Move the follow springs toward their ideal spots (or jump there when `snap`). */
  private place(sim: GameSim, dt: number, snap: boolean): void {
    // Turns: the camera lags the carved heading and swings round behind (the runner is seen
    // three-quarter on mid-turn, as in the reference footage).
    this.yaw = snap ? sim.facing : approachAngle(this.yaw, sim.facing, 2.8, dt);
    this.turnRoll = snap ? 0 : turnRoll(this.turnRoll, sim.facing, this.yaw, dt);
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const portrait = this.camera.aspect < 1;
    const pace = paceOf(sim);
    // About 4 m behind, a bit above head height, runner near the centre (like the reference
    // footage); struggling to keep up, it drops back a touch at speed. Slides swoop in close
    // and low beside the runner, then pull back out.
    const swoop = this.crouch;
    const back = (portrait ? 4.8 : 4.1) + pace * 0.8 - swoop * 2;
    const up = (portrait ? 2.7 : 2.4) - swoop * 1.3;
    const side = 0.25 + swoop * 0.6;
    const ahead = 7 + pace * 3;
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const top = sim.platform?.top ?? sim.y;
    this.ground = snap ? top : approach(this.ground, top, 5, dt);
    const rel = Math.max(-1.5, Math.min(sim.y - this.ground, 8));
    this.crouch = snap ? 0 : approach(this.crouch, sim.sliding ? 1 : 0, 7, dt);
    const y = this.ground + rel * 0.65;
    // Offsets from the runner, height included: the camera rises with jumps (a little less, and
    // a beat later) but a high trampoline bounce can never leave it behind.
    this.target.set(-fx * back + rx * side, y + up - sim.y, -fz * back + rz * side);
    this.pos.follow(this.target, FOLLOW, dt, snap);
    this.target.set(
      fx * ahead + rx * side * 0.3,
      y + 0.6 + rel * 0.3 - sim.y - swoop * 0.2,
      fz * ahead + rz * side * 0.3,
    );
    this.aim.follow(this.target, AIM, dt, snap);
  }
}
