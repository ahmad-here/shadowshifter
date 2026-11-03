import type * as THREE from 'three';
import { CONFIG } from '../game/config';
import { approach } from './math';
import type { GameSim } from '../game/sim';

/** The sim counters and states the camera reacts to, as last seen. */
export function seen(sim?: GameSim) {
  return {
    landings: sim?.landings ?? 0,
    jumps: sim?.jumps ?? 0,
    side: sim?.sideJumps ?? 0,
    crash: sim?.phase === 'dying' && sim.deathCause !== 'fell',
    sliding: sim?.sliding ?? false,
    dir: sim?.dir ?? 0,
    moves: sim ? sim.vaults + sim.wallRuns + sim.climbs : 0,
  };
}

/** 0 at the start speed, 1 at top speed. */
export function paceOf(sim: GameSim): number {
  const k = (sim.speed - CONFIG.startSpeed) / (CONFIG.maxSpeed - CONFIG.startSpeed);
  return Math.min(1, Math.max(0, k));
}

/** Update a `seen` snapshot in place (no allocation in the render loop). */
export function markSeen(s: ReturnType<typeof seen>, sim: GameSim, crashed: boolean): void {
  s.landings = sim.landings;
  s.jumps = sim.jumps;
  s.side = sim.sideJumps;
  s.crash = crashed;
  s.sliding = sim.sliding;
  s.dir = sim.dir;
  s.moves = sim.vaults + sim.wallRuns + sim.climbs;
}

/** Roll into a turn while the camera swings round behind (up to ~17 degrees), easing out. */
export function turnRoll(current: number, facing: number, yaw: number, dt: number): number {
  const lag = Math.atan2(Math.sin(facing - yaw), Math.cos(facing - yaw));
  return approach(current, Math.max(-0.3, Math.min(0.3, lag * 0.35)), 6, dt);
}

/** Set the field of view, touching the projection matrix only when it really changes. */
export function setFov(camera: THREE.PerspectiveCamera, fov: number): void {
  if (Math.abs(camera.fov - fov) <= 0.01) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}
