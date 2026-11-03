import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { autopilot } from '../game/autopilot';
import { CONFIG } from '../game/config';
import { GameSim } from '../game/sim';
import { DIR_X, DIR_Z } from '../game/world';
import { CameraRig } from './CameraRig';

const DT = CONFIG.stepSeconds;

function onScreen(rig: CameraRig, x: number, y: number, z: number): boolean {
  rig.camera.updateMatrixWorld();
  const p = new THREE.Vector3(x, y, z).project(rig.camera);
  return Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1;
}

describe('CameraRig', () => {
  for (const [name, w, h] of [
    ['landscape', 1280, 720],
    ['portrait', 390, 844],
  ] as const) {
    it(`${name}: runner and the route ~15 m ahead stay on screen for a whole run`, () => {
      const rig = new CameraRig();
      rig.resize(w, h);
      const sim = new GameSim(7);
      sim.act('start');
      rig.reset(sim);
      let checked = 0;
      let lastSide = 0;
      let swingUntil = -1;
      for (let i = 0; i < 120 * 90 && sim.phase === 'playing'; i++) {
        const a = autopilot(sim);
        if (a) sim.control(a);
        sim.step(DT);
        rig.update(sim, DT, false);
        if (i % 30 !== 0) continue;
        expect(onScreen(rig, sim.x, sim.y + 0.9, sim.z), `runner t=${i * DT}`).toBe(true);
        const ax = sim.x + DIR_X[sim.dir]! * 15;
        const az = sim.z + DIR_Z[sim.dir]! * 15;
        // Allow the deliberate swing round after a side leap (about a second) to catch up.
        if (sim.sideJumps > lastSide) {
          lastSide = sim.sideJumps;
          swingUntil = i + 120;
        }
        if (sim.grounded && i > swingUntil)
          expect(onScreen(rig, ax, sim.y, az), `ahead t=${i * DT}`).toBe(true);
        checked++;
      }
      expect(checked).toBeGreaterThan(200);
    });
  }

  it('the landing dip settles back to the resting position', () => {
    const rig = new CameraRig();
    rig.resize(1280, 720);
    const sim = new GameSim(1);
    rig.reset(sim);
    rig.update(sim, DT, false);
    const rest = rig.camera.position.y;
    sim.landings += 1; // simulate a touchdown event
    sim.landingSpeed = 9; // as hard as a normal jump
    rig.update(sim, DT, false);
    expect(rig.camera.position.y).toBeLessThan(rest);
    for (let i = 0; i < 240; i++) rig.update(sim, DT, false);
    expect(rig.camera.position.y).toBeCloseTo(rest, 3);
  });

  it('reduced effects disables the dip and the speed FOV change', () => {
    const rig = new CameraRig();
    rig.resize(1280, 720);
    const sim = new GameSim(1);
    rig.reset(sim);
    rig.update(sim, DT, true);
    const y = rig.camera.position.y;
    sim.landings += 1;
    sim.speed = CONFIG.maxSpeed;
    rig.update(sim, DT, true);
    expect(rig.camera.fov).toBe(60);
    expect(rig.camera.position.y).toBeGreaterThanOrEqual(y);
  });
});
