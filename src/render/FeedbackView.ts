import * as THREE from 'three';
import type { GameSim } from '../game/sim';
import { dirYaw, DIR_X, DIR_Z, turnDir, type Turn } from '../game/world';
import { COLORS } from './palette';

/** How far ahead a legal exit gets its landing marker. */
const TARGET_LOOKAHEAD = 32;
const REFUSED = 0xff3b5c;

interface Pulse {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
  dur: number;
  from: number;
  to: number;
  alpha: number;
}

/**
 * One-shot feedback driven by sim event counters (never by input), so what you see always
 * reflects what the simulation actually did: takeoff/landing rings, a red "blocked" flash for a
 * refused side leap, pickup bursts, and a marker on the building the next legal leap lands on.
 */
export class FeedbackView {
  readonly group = new THREE.Group();
  private pulses: Pulse[] = [];
  private next = 0;
  private marker: THREE.Mesh;
  private markerMat: THREE.MeshBasicMaterial;
  private blocked: THREE.Mesh;
  private blockedMat: THREE.MeshBasicMaterial;
  private blockedT = 1;
  private seen = { jumps: 0, landings: 0, refused: 0, spells: 0, portals: 0, near: 0 };

  constructor() {
    const ring = new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const mat = additive(COLORS.cyan);
      const mesh = new THREE.Mesh(ring, mat);
      mesh.visible = false;
      this.pulses.push({ mesh, mat, t: 1, dur: 1, from: 1, to: 1, alpha: 0 });
      this.group.add(mesh);
    }
    this.markerMat = additive(COLORS.orange);
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.25, 4, 1).rotateX(-Math.PI / 2),
      this.markerMat,
    );
    this.marker.visible = false;
    this.blockedMat = additive(REFUSED);
    this.blocked = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 1.6), this.blockedMat);
    this.blocked.visible = false;
    this.group.add(this.marker, this.blocked);
  }

  /** Forget past events (new run), so nothing fires for counters that were reset. */
  reset(sim: GameSim): void {
    this.markSeen(sim);
    for (const p of this.pulses) {
      p.t = 1;
      p.mesh.visible = false;
    }
    this.blocked.visible = false;
    this.blockedT = 1;
  }

  update(sim: GameSim, dt: number, elapsed: number, reduced: boolean): void {
    const s = this.seen;
    if (sim.landings > s.landings) this.pulse(sim, 0, COLORS.cyan, 0.35, 1, 3, 0.7);
    if (sim.jumps > s.jumps) this.pulse(sim, 0, COLORS.cyan, 0.25, 0.8, 1.8, 0.45);
    if (sim.spellsTaken > s.spells) this.pulse(sim, 0.9, COLORS.magenta, 0.6, 1, 7, 0.9);
    if (sim.portalsTaken > s.portals) this.pulse(sim, 0.9, COLORS.mirror, 0.6, 1, 7, 0.9);
    // Near miss: a quick bright flash ring around the runner.
    if (sim.nearMisses > s.near) this.pulse(sim, 0.8, 0xffffff, 0.3, 0.6, 4, 0.95);
    if (sim.leapsRefused > s.refused && sim.lastRefused) this.flashBlocked(sim, sim.lastRefused);
    this.markSeen(sim);

    for (const p of this.pulses) {
      if (p.t >= 1) continue;
      p.t = Math.min(1, p.t + dt / p.dur);
      const e = 1 - (1 - p.t) ** 2;
      p.mesh.scale.setScalar(p.from + (p.to - p.from) * e);
      p.mat.opacity = p.alpha * (1 - p.t);
      p.mesh.visible = p.t < 1;
    }
    this.blockedT = Math.min(1, this.blockedT + dt / 0.45);
    this.blocked.visible = this.blockedT < 1;
    this.blockedMat.opacity =
      0.85 * (1 - this.blockedT) * (reduced ? 1 : 0.6 + 0.4 * Math.sin(elapsed * 40));

    this.updateMarker(sim, elapsed, reduced);
  }

  private markSeen(sim: GameSim): void {
    this.seen = {
      jumps: sim.jumps,
      landings: sim.landings,
      refused: sim.leapsRefused,
      spells: sim.spellsTaken,
      portals: sim.portalsTaken,
      near: sim.nearMisses,
    };
  }

  private updateMarker(sim: GameSim, elapsed: number, reduced: boolean): void {
    const up =
      sim.phase === 'playing' && sim.effect === 'none' ? sim.upcomingExit(TARGET_LOOKAHEAD) : null;
    const target = up?.target;
    this.marker.visible = !!target;
    if (!up || !target) return;
    const to = turnDir(up.exit.fromDir, up.exit.turn);
    const cx = (up.exit.minX + up.exit.maxX) / 2;
    const cz = (up.exit.minZ + up.exit.maxZ) / 2;
    // Mark where a leap from the window centre lands, on the side building itself.
    const land = 6.5;
    this.marker.position.set(cx + DIR_X[to]! * land, target.top + 0.04, cz + DIR_Z[to]! * land);
    this.marker.rotation.y = dirYaw(to);
    this.markerMat.color.setHex(up.exit.optional ? COLORS.cyan : COLORS.orange);
    this.markerMat.opacity = reduced ? 0.95 : 0.75 + Math.sin(elapsed * 5) * 0.25;
    this.marker.scale.setScalar(reduced ? 1.3 : 1.2 + Math.sin(elapsed * 5) * 0.15);
  }

  private pulse(
    sim: GameSim,
    y: number,
    color: number,
    dur: number,
    from: number,
    to: number,
    alpha: number,
  ): void {
    const p = this.pulses[this.next]!;
    this.next = (this.next + 1) % this.pulses.length;
    p.mesh.position.set(sim.x, sim.y + y + 0.03, sim.z);
    p.mesh.rotation.set(y > 0 ? Math.PI / 2 : 0, y > 0 ? dirYaw(sim.dir) : 0, 0);
    p.mat.color.setHex(color);
    Object.assign(p, { t: 0, dur, from, to, alpha });
    p.mesh.visible = true;
  }

  /** A red bar on the side the player tried to leap toward. */
  private flashBlocked(sim: GameSim, turn: Turn): void {
    const side = turnDir(sim.dir, turn);
    this.blocked.position.set(sim.x + DIR_X[side]! * 1.9, sim.y + 0.8, sim.z + DIR_Z[side]! * 1.9);
    this.blocked.rotation.set(0, dirYaw(sim.dir), 0);
    this.blockedT = 0;
  }
}

function additive(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
