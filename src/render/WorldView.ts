import * as THREE from 'three';
import type { Exit, Obstacle, Pad, Platform, Portal, Spell, Wall, World } from '../game/world';
import type { Assets } from './assets';
import * as place from './entities';
import type { PlatformVisual } from './entities';
import { Layer } from './Layer';
import { RISE_DEPTH, RISE_DISTANCE, RISE_SECONDS, SLIDE_SECONDS } from './palette';

/** Group wrapper so platform visuals can live in a Layer like every other entity. */
type PlatformObj = THREE.Group & { userData: { visual: PlatformVisual } };

/** Keeps the scene's buildings, obstacles, pads, spells, portals and arrows matching the world. */
export class WorldView {
  readonly group = new THREE.Group();
  private world: World | null = null;
  private live = new Set<number>();
  private platforms: Layer<Platform, PlatformObj>;
  private obstacles: Layer<Obstacle, THREE.Mesh>;
  private pads: Layer<Pad, THREE.Group>;
  private spells: Layer<Spell, THREE.Group>;
  private portals: Layer<Portal, THREE.Group>;
  private arrows: Layer<Exit, THREE.Mesh>;
  private walls: Layer<Wall, THREE.Mesh>;

  constructor(private readonly assets: Assets) {
    const a = assets;
    this.platforms = new Layer((pooled, p) => {
      const v = place.placePlatform(a, pooled?.userData.visual, p);
      v.root.userData.visual = v;
      return v.root as PlatformObj;
    });
    this.obstacles = new Layer((m, o) => place.placeObstacle(a, m, o));
    this.pads = new Layer((m, p) => place.placePad(a, m, p));
    this.spells = new Layer((g, s) => place.placeSpell(a, g, s));
    this.portals = new Layer((g, p) => place.placePortal(a, g, p));
    this.arrows = new Layer((m, e) => place.placeArrow(a, m, e));
    this.walls = new Layer((m, w) => place.placeWall(a, m, w));
  }

  /**
   * Sync with `world`. A different world object (restart, new run) drops every mesh first, and
   * `snapRise` makes nearby buildings appear fully risen (start of a run).
   */
  sync(world: World, x: number, z: number, elapsed: number, snapRise: boolean): void {
    if (world !== this.world) {
      this.clear();
      this.world = world;
      snapRise = true;
    }
    const parentOf = (e: { platformId: number }) =>
      (this.platforms.items.get(e.platformId)?.obj as THREE.Object3D | undefined) ?? this.group;
    this.platforms.sync(world.platforms, () => this.group, this.live);
    this.obstacles.sync(world.obstacles, parentOf, this.live);
    this.pads.sync(world.pads, parentOf, this.live);
    this.spells.sync(world.spells, parentOf, this.live);
    this.portals.sync(world.portals, parentOf, this.live);
    this.arrows.sync(world.exits, parentOf, this.live);
    this.walls.sync(world.walls, parentOf, this.live);
    this.animateRise(x, z, elapsed, snapRise);
  }

  /** Per-frame animation of entities (pads, portals, pulsing arrows). */
  animate(elapsed: number, padSquash: number): void {
    for (const { obj } of this.pads.items.values()) obj.children[0]!.scale.y = 0.2 * padSquash;
    // A used black portal keeps its swirl but its core goes out.
    for (const { entity, obj } of this.spells.items.values())
      obj.children[1]!.visible = !entity.taken;
    for (const { entity, obj } of this.portals.items.values()) {
      obj.children[1]!.visible = !entity.taken;
    }
    this.assets.portalTime.value = elapsed;
    this.assets.arrow.opacity = 0.6 + Math.sin(elapsed * 6) * 0.3;
  }

  private animateRise(x: number, z: number, elapsed: number, snap: boolean): void {
    for (const { obj } of this.platforms.items.values()) {
      const v = obj.userData.visual;
      const near = Math.hypot(v.cx - x, v.cz - z) < RISE_DISTANCE;
      if (v.riseStart === null && near) v.riseStart = snap ? -Infinity : elapsed;
      if (v.riseStart === null) {
        v.root.visible = false;
        continue;
      }
      const age = elapsed - v.riseStart;
      const t = Math.min(1, age / RISE_SECONDS);
      // Then slide from the previous building's height to its own: it visibly sinks or rises.
      const s = Math.min(1, Math.max(0, (age - RISE_SECONDS) / SLIDE_SECONDS));
      const slide = v.slide * (1 - s * s * (3 - 2 * s));
      v.root.visible = true;
      v.root.position.y = -RISE_DEPTH * (1 - t) ** 3 + slide;
    }
  }

  /**
   * Compare every mesh with the physics it represents. Returns human-readable mismatches;
   * empty means what is drawn is exactly what can be stood on or hit.
   */
  verify(world: World): string[] {
    const bad: string[] = [];
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    const count = (
      name: string,
      list: readonly { id: number }[],
      layer: { items: Map<number, unknown> },
    ) => {
      if (list.length !== layer.items.size)
        bad.push(`${name}: ${layer.items.size} meshes for ${list.length}`);
    };
    count('platforms', world.platforms, this.platforms);
    count('obstacles', world.obstacles, this.obstacles);
    count('pads', world.pads, this.pads);
    count('portals', world.portals, this.portals);
    count('exits', world.exits, this.arrows);
    count('walls', world.walls, this.walls);
    for (const p of world.platforms) {
      const cur = this.platforms.items.get(p.id);
      const v = cur?.obj.userData.visual;
      if (!cur || cur.entity !== p || !v) {
        bad.push(`platform ${p.id} has no mesh`);
        continue;
      }
      const ok =
        v.prism.geometry === this.assets.prisms.get(p.shape) &&
        near(v.body.position.x, p.run.ox) &&
        near(v.body.position.y, p.top) &&
        near(v.body.position.z, p.run.oz) &&
        near(v.prism.scale.x, p.hw) &&
        near(v.prism.scale.z, p.b - p.a) &&
        near(v.prism.position.z, -p.a);
      if (!ok) bad.push(`platform ${p.id} mesh does not match its footprint`);
    }
    for (const o of world.obstacles) {
      const cur = this.obstacles.items.get(o.id);
      const ok =
        cur &&
        cur.entity === o &&
        near(cur.obj.position.x, (o.minX + o.maxX) / 2) &&
        near(cur.obj.position.z, (o.minZ + o.maxZ) / 2) &&
        near(cur.obj.scale.y, o.maxY - o.minY);
      if (!ok) bad.push(`obstacle ${o.id} mesh does not match its box`);
    }
    return bad;
  }

  /** Current rise offset of a building's mesh (0 = in place), or null if it is not shown. */
  riseOffset(platformId: number): number | null {
    const v = this.platforms.items.get(platformId)?.obj.userData.visual;
    return v && v.root.visible ? v.root.position.y : null;
  }

  stats(): { platforms: number; obstacles: number } {
    return { platforms: this.platforms.items.size, obstacles: this.obstacles.items.size };
  }

  clear(): void {
    for (const l of [this.obstacles, this.pads, this.spells, this.portals, this.arrows, this.walls])
      l.clear();
    this.platforms.clear();
  }

  /** Every object ever created (live and pooled), so their resources can be released. */
  objects(): THREE.Object3D[] {
    return [
      ...this.platforms.all(),
      ...this.obstacles.all(),
      ...this.pads.all(),
      ...this.spells.all(),
      ...this.portals.all(),
      ...this.arrows.all(),
      ...this.walls.all(),
    ];
  }
}
