import * as THREE from 'three';
import type { GameSim } from '../game/sim';
import { dirYaw } from '../game/world';
import type { CharacterModel } from './CharacterModel';
import { chooseClip } from './characterState';
import { approach, approachAngle } from './math';
import { movePose } from './movePose';
import { COLORS } from './palette';

const TRAIL_POINTS = 12;

/** Articulated placeholder runner with a run cycle, leap/slide poses and a short light trail. */
export class RunnerView {
  readonly group = new THREE.Group();
  private pose = new THREE.Group();
  /** Lean and offset for parkour moves, in the runner's own frame. */
  private tilt = new THREE.Group();
  private armL: THREE.Group;
  private armR: THREE.Group;
  private legL: THREE.Group;
  private legR: THREE.Group;
  private trailPoints = new Float32Array(TRAIL_POINTS * 3);
  private trail: THREE.Line;
  private yaw = 0;
  private flip = 0;
  private phase = 0;
  /** Landing squash (+) / takeoff stretch (-), decaying to 0. */
  private squash = 0;
  private seenJumps = 0;
  private seenLandings = 0;
  private body: THREE.MeshLambertMaterial;

  constructor(box: THREE.BufferGeometry) {
    const body = new THREE.MeshLambertMaterial({
      color: COLORS.runner,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.25,
    });
    this.body = body;
    const dark = new THREE.MeshLambertMaterial({ color: 0x1b2433 });
    const limb = (w: number, h: number, mat: THREE.Material, x: number, y: number) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(box, mat);
      m.scale.set(w, h, w);
      m.position.y = -h / 2;
      g.add(m);
      g.position.set(x, y, 0);
      return g;
    };
    const torso = new THREE.Mesh(box, body);
    torso.scale.set(0.42, 0.6, 0.26);
    torso.position.y = 1.08;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), body);
    head.position.y = 1.52;
    this.armL = limb(0.12, 0.55, body, -0.29, 1.34);
    this.armR = limb(0.12, 0.55, body, 0.29, 1.34);
    this.legL = limb(0.16, 0.78, dark, -0.12, 0.78);
    this.legR = limb(0.16, 0.78, dark, 0.12, 0.78);
    this.pose.add(torso, head, this.armL, this.armR, this.legL, this.legR);
    this.group.add(this.tilt);
    this.tilt.add(this.pose);

    // Short and pink-white so it never reads as a building's cyan edge.
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPoints, 3));
    this.trail = new THREE.Line(
      tg,
      new THREE.LineBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.45 }),
    );
    this.trail.frustumCulled = false;
  }

  private model: CharacterModel | null = null;

  /** Swap the placeholder figure for the animated character once it has loaded. */
  setModel(model: CharacterModel): void {
    // Only ever one character: replace (and free) any previous model.
    if (this.model && this.model !== model) {
      this.model.root.removeFromParent();
      this.model.dispose();
    }
    this.model = model;
    // Mixamo characters face +Z; the game's forward is -Z.
    model.root.rotation.y = Math.PI;
    this.tilt.add(model.root);
    this.pose.visible = false;
  }

  get hasModel(): boolean {
    return this.model !== null;
  }

  get trailObject(): THREE.Line {
    return this.trail;
  }

  /** Snap pose, heading and trail to the sim (new run). */
  reset(sim: GameSim): void {
    this.yaw = dirYaw(sim.dir);
    this.flip = sim.mirrored ? Math.PI : 0;
    this.squash = 0;
    this.seenJumps = sim.jumps;
    this.seenLandings = sim.landings;
    this.model?.reset(sim);
    for (let i = 0; i < this.trailPoints.length; i += 3) {
      this.trailPoints[i] = sim.x;
      this.trailPoints[i + 1] = 0.9;
      this.trailPoints[i + 2] = sim.z;
    }
  }

  update(sim: GameSim, dt: number, reduced = false): void {
    const fall = movePose(sim);
    this.group.position.set(sim.x, sim.y + fall.y, sim.z);
    // Eased, so moves blend in and out instead of snapping.
    const k = 1 - Math.exp(-14 * dt);
    // Mirrored, the figure is turned round, so its own left and right swap.
    const m = Math.cos(this.flip);
    this.tilt.position.x += (fall.x * m - this.tilt.position.x) * k;
    this.tilt.rotation.x += (-fall.pitch - this.tilt.rotation.x) * k;
    this.tilt.rotation.z += (-fall.roll * m - this.tilt.rotation.z) * k;
    this.model?.setShadow(fall.shadow);
    if (sim.deathCause === 'burn' && sim.phase !== 'playing') {
      // Charred within a third of a second; embers flicker hot, then die down.
      const t = sim.dyingTime;
      const flicker = 0.75 + 0.25 * Math.sin(t * 47) * Math.sin(t * 23);
      this.model?.setBurn(Math.min(1, t / 0.3), Math.max(0, 1 - t / 1.1) * flicker);
    }
    this.body.color.setHex(fall.shadow > 0.5 ? 0x020306 : COLORS.runner);
    // Face along the carved turn (sim.facing), so the body visibly arcs round corners.
    this.yaw = approachAngle(this.yaw, sim.facing, 18, dt);
    // Mirrored: the runner turns around and runs backwards.
    this.flip = approach(this.flip, sim.mirrored ? Math.PI : 0, 8, dt);
    this.group.rotation.y = this.yaw + this.flip;

    // Squash on touchdown, stretch on takeoff: reads weight without changing the hitbox.
    if (!reduced && sim.landings > this.seenLandings) this.squash = 1;
    else if (!reduced && sim.jumps > this.seenJumps) this.squash = -1;
    this.seenLandings = sim.landings;
    this.seenJumps = sim.jumps;
    this.squash = approach(this.squash, 0, 12, dt);
    const sq = this.squash;
    const sy = sq > 0 ? 1 - 0.2 * sq : 1 - 0.14 * sq;
    const sxz = sq > 0 ? 1 + 0.12 * sq : 1 + 0.07 * sq;
    this.group.scale.set(sxz * fall.scale, sy * fall.scale, sxz * fall.scale);

    if (this.model) {
      this.model.update(chooseClip(sim), dt, sim);
      this.updateTrail(sim);
      return;
    }

    const playing = sim.phase === 'playing';
    if (playing) this.phase += dt * sim.speed * 1.1;
    let leg = playing && sim.grounded ? Math.sin(this.phase) * 0.9 : 0;
    let arm = -leg * 0.8;
    let lean = playing ? -0.15 : 0;
    let crouch = 0;
    if (!sim.grounded && playing) {
      // Leap pose: one leg forward, one back, arms thrown out (like the reference art).
      leg = 0.9;
      arm = -1.2;
      lean = -0.3;
    }
    if (sim.sliding) {
      lean = 1.15;
      crouch = -0.55;
      leg = -1.3;
      arm = -2.4;
    }
    if (sim.phase === 'dying' && sim.deathCause === 'hit') lean = 1.4;
    this.legL.rotation.x = leg;
    this.legR.rotation.x = sim.sliding ? leg : -leg;
    this.armL.rotation.x = arm;
    this.armR.rotation.x = sim.sliding ? arm : -arm;
    this.pose.rotation.x = approach(this.pose.rotation.x, lean, 14, dt);
    this.pose.position.y = approach(this.pose.position.y, crouch, 14, dt);

    this.updateTrail(sim);
  }

  private updateTrail(sim: GameSim): void {
    const tp = this.trailPoints;
    tp.copyWithin(3, 0, tp.length - 3);
    tp[0] = sim.x;
    tp[1] = sim.y + 0.9 + this.pose.position.y;
    tp[2] = sim.z;
    (this.trail.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
