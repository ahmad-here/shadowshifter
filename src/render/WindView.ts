import * as THREE from 'three';
import { CONFIG } from '../game/config';
import type { GameSim } from '../game/sim';
import { DIR_X, DIR_Z } from '../game/world';

const STREAKS = 60;
/** Every Nth streak is a "lens" streak: spawned close to the camera, it whips past the frame edge. */
const LENS_EVERY = 4;
/** Streaks live in a box around the runner: this far behind to this far ahead (metres). */
const BEHIND = 9;
const AHEAD = 42;
const WHITE = new THREE.Color(0xeaf6ff);
const BLUE = new THREE.Color(0x7fd4ff);

/**
 * Wind and speed lines: thin streaks rushing backwards past the runner (opposite to the run),
 * mostly at the sides of the frame. Bright head, tail fading to nothing (additive), longer, denser
 * and brighter with speed, swelling in gusts, slanting down during slides. One line mesh with a
 * fixed number of segments, recycled from behind the camera to far ahead. Presentation only.
 */
export class WindView {
  readonly lines: THREE.LineSegments;
  private positions = new Float32Array(STREAKS * 6);
  private colors = new Float32Array(STREAKS * 6);
  /** Per streak: along (runner-relative), lateral, height above the deck, speed factor. */
  private along = new Float32Array(STREAKS);
  private lat = new Float32Array(STREAKS);
  private up = new Float32Array(STREAKS);
  private rate = new Float32Array(STREAKS);
  private tint: THREE.Color[] = [];
  private t = 0;
  private slant = 0;
  enabled = true;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.lines.frustumCulled = false;
    for (let i = 0; i < STREAKS; i++) {
      this.tint.push(Math.random() < 0.65 ? WHITE : BLUE);
      this.spawn(i, -BEHIND + Math.random() * (AHEAD + BEHIND));
    }
  }

  private spawn(i: number, along: number): void {
    const lens = i % LENS_EVERY === 0;
    const side = Math.random() < 0.5 ? -1 : 1;
    // Mostly out to the sides (clear of the runner); lens streaks pass right by the camera.
    this.along[i] = lens ? Math.min(along, 6 + Math.random() * 4) : along;
    this.lat[i] = side * (lens ? 0.9 + Math.random() * 1.3 : 1.4 + Math.random() * 6);
    this.up[i] = lens ? 0.6 + Math.random() * 2.2 : -1 + Math.random() * 3.5;
    this.rate[i] = (lens ? 1.3 : 0.75) + Math.random() * 0.5;
  }

  update(sim: GameSim, dt: number, reduced: boolean): void {
    this.lines.visible = this.enabled && !reduced && sim.phase !== 'ready';
    if (!this.lines.visible) return;
    this.t += dt;
    const pace = Math.min(
      1,
      Math.max(0, (sim.speed - CONFIG.startSpeed) / (CONFIG.maxSpeed - CONFIG.startSpeed)),
    );
    // Gusts: two slow waves, so the wind swells and calms irregularly.
    const gust = 0.55 + 0.3 * Math.sin(this.t * 0.7) + 0.15 * Math.sin(this.t * 1.9 + 1);
    const moving = sim.phase === 'playing';
    const wind = moving ? sim.speed * 1.4 + 6 + 8 * gust : 3;
    // Density grows with speed: only the first `active` streaks are drawn.
    const active = Math.round(STREAKS * (0.45 + 0.55 * pace));
    const glow = (0.25 + 0.45 * pace) * (0.6 + 0.4 * gust);
    // Slides: the streaks tilt with the dive (tails rise behind as the camera drops).
    this.slant = sim.sliding ? Math.min(1, this.slant + dt * 8) : Math.max(0, this.slant - dt * 5);
    const fx = DIR_X[sim.dir]!;
    const fz = DIR_Z[sim.dir]!;
    const len = 1 + wind * (0.08 + 0.06 * pace);
    const base = sim.platform?.top ?? sim.y;
    const p = this.positions;
    const c = this.colors;
    for (let i = 0; i < active; i++) {
      const next = this.along[i]! - wind * this.rate[i]! * dt;
      if (next < -BEHIND) this.spawn(i, AHEAD);
      else this.along[i] = next;
      const a = this.along[i]!;
      const lens = i % LENS_EVERY === 0;
      const l = this.lat[i]! + Math.sin(this.t * 1.3 + i) * 0.35 * gust;
      const x = sim.x + fx * a - fz * l;
      const z = sim.z + fz * a + fx * l;
      const y = base + this.up[i]!;
      const sl = lens ? len * 0.6 : len;
      p.set([x, y, z, x - fx * sl, y + this.slant * sl * 0.18, z - fz * sl], i * 6);
      // Fade in from far ahead so streaks never pop into view.
      const k = glow * Math.min(1, (AHEAD - a) / 8) * (lens ? 1.4 : 1);
      const col = this.tint[i]!;
      c.set([col.r * k, col.g * k, col.b * k, 0, 0, 0], i * 6);
    }
    this.lines.geometry.setDrawRange(0, active * 2);
    (this.lines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.lines.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
}
