import * as THREE from 'three';
import { CONFIG } from '../game/config';
import {
  dirYaw,
  runPoint,
  turnDir,
  type Exit,
  type Obstacle,
  type Pad,
  type Platform,
  type Portal,
  type Spell,
  type Wall,
} from '../game/world';
import type { Assets } from './assets';
import { RISE_DEPTH } from './palette';

/**
 * A building's meshes. `root` only moves vertically (the rise animation) and holds every
 * attached entity in world coordinates; `body` carries the run's position and heading.
 */
export interface PlatformVisual {
  root: THREE.Group;
  body: THREE.Group;
  prism: THREE.Mesh;
  outline: THREE.LineLoop;
  riseStart: number | null;
  /** Height difference to slide through after rising: previous building's deck minus this one's. */
  slide: number;
  cx: number;
  cz: number;
}

export function placePlatform(
  a: Assets,
  pooled: PlatformVisual | undefined,
  p: Platform,
): PlatformVisual {
  let v = pooled;
  if (!v) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    const prism = new THREE.Mesh(a.prisms.get('rect')!, a.building);
    const outline = new THREE.LineLoop(a.outlines.get('rect')!, a.outline);
    body.add(prism, outline);
    root.add(body);
    v = { root, body, prism, outline, riseStart: null, slide: 0, cx: 0, cz: 0 };
  }
  v.prism.geometry = a.prisms.get(p.shape)!;
  v.outline.geometry = a.outlines.get(p.shape)!;
  v.body.position.set(p.run.ox, p.top, p.run.oz);
  v.slide = p.fromTop - p.top;
  v.body.rotation.set(0, dirYaw(p.run.dir), 0);
  for (const m of [v.prism, v.outline]) {
    m.position.set(0, 0, -p.a);
    m.scale.set(p.hw, p.depth, p.b - p.a);
  }
  const c = runPoint(p.run, (p.a + p.b) / 2, 0);
  v.cx = c.x;
  v.cz = c.z;
  v.riseStart = null;
  v.root.position.set(0, -RISE_DEPTH, 0);
  v.root.visible = false;
  return v;
}

/**
 * Obstacle: its real-world model (laser gate, pipes, AC units) fitted exactly into the collision
 * box, turned to face along its run, with the glowing part (child) in its action colour. Plain
 * coloured box while the models load, or for kinds without one.
 */
export function placeObstacle(a: Assets, pooled: THREE.Mesh | undefined, o: Obstacle): THREE.Mesh {
  const m = pooled ?? new THREE.Mesh(a.box);
  const model = a.obstacleModels?.get(o.kind);
  m.position.set((o.minX + o.maxX) / 2, (o.minY + o.maxY) / 2, (o.minZ + o.maxZ) / 2);
  m.visible = true;
  let glow = m.children[0] as THREE.Mesh | undefined;
  if (!model) {
    m.geometry = a.box;
    m.material = a.obstacle.get(o.kind)!;
    m.scale.set(o.maxX - o.minX, o.maxY - o.minY, o.maxZ - o.minZ);
    m.rotation.set(0, 0, 0);
    if (glow) glow.visible = false;
    return m;
  }
  // Models are authored across the lane (x) and along the run (z): swap extents for E/W runs.
  const ew = o.dir === 1 || o.dir === 3;
  const across = ew ? o.maxZ - o.minZ : o.maxX - o.minX;
  const along = ew ? o.maxX - o.minX : o.maxZ - o.minZ;
  m.geometry = model.body;
  m.material = a.obstacleBody;
  m.rotation.set(0, dirYaw(o.dir), 0);
  m.scale.set(across, o.maxY - o.minY, along);
  if (!glow) m.add((glow = new THREE.Mesh(model.glow)));
  glow.geometry = model.glow;
  glow.material = a.obstacleGlow.get(o.kind)!;
  glow.visible = true;
  return m;
}

/** Trampoline: the pad disc (children[0], squashed on bounce) and a light beam above it. */
export function placePad(a: Assets, pooled: THREE.Group | undefined, p: Pad): THREE.Group {
  let g = pooled;
  if (!g) {
    g = new THREE.Group();
    const beam = new THREE.Mesh(a.beamGeo, a.beam);
    beam.position.y = 3;
    beam.scale.set(1, 6, 1);
    g.add(new THREE.Mesh(a.padGeo, a.pad), beam);
  }
  const r = Math.min(p.maxX - p.minX, p.maxZ - p.minZ);
  g.position.set((p.minX + p.maxX) / 2, p.top + 0.1, (p.minZ + p.maxZ) / 2);
  g.children[0]!.scale.set(r, 0.2, r);
  g.visible = true;
  return g;
}

/** Wall-run wall: a tall slab beside the gap, from below the deck to well above head height. */
export function placeWall(a: Assets, pooled: THREE.Mesh | undefined, w: Wall): THREE.Mesh {
  // Building wall shader: same facade as the route, and it darkens with the world.
  const m = pooled ?? new THREE.Mesh(a.wallGeo, a.building[1]);
  const bottom = w.deck - 4;
  const mid = runPoint(
    w.run,
    (w.a + w.b) / 2,
    w.side * (CONFIG.pathHalfWidth + CONFIG.wallOffset + 0.3),
  );
  m.position.set(mid.x, w.top, mid.z); // the shader measures depth down from the top
  m.rotation.set(0, dirYaw(w.run.dir), 0);
  m.scale.set(0.6, w.top - bottom, w.b - w.a);
  m.userData.entity = w;
  m.visible = true;
  return m;
}

/** Black portal: the energy gate in its void variant, upright across the path. */
export function placeSpell(a: Assets, pooled: THREE.Group | undefined, s: Spell): THREE.Group {
  let g = pooled;
  if (!g) {
    const core = new THREE.Mesh(a.portalGeo, a.blackCore);
    core.position.z = 0.01;
    g = new THREE.Group().add(new THREE.Mesh(a.portalGeo, a.blackRing), core);
  }
  g.position.set(s.x, s.y + 1.45, s.z);
  g.rotation.set(0, dirYaw(s.dir), 0);
  g.userData.entity = s;
  g.visible = true;
  return g;
}

/** Upright energy portal across the path, facing the runner. */
export function placePortal(a: Assets, pooled: THREE.Group | undefined, p: Portal): THREE.Group {
  let g = pooled;
  if (!g) {
    g = new THREE.Group();
    const core = new THREE.Mesh(a.portalGeo, a.portalCore);
    core.position.z = 0.01; // just in front of the ring, so the two never z-fight
    g.add(new THREE.Mesh(a.portalGeo, a.portalRing), core);
  }
  g.position.set(p.x, p.minY + 1.45, p.z);
  g.rotation.set(0, dirYaw(p.dir), 0);
  g.userData.entity = p;
  g.visible = true;
  return g;
}

/** Floor arrow on an exit window pointing where the side leap goes. */
export function placeArrow(a: Assets, pooled: THREE.Mesh | undefined, e: Exit): THREE.Mesh {
  const m = pooled ?? new THREE.Mesh(a.arrowGeo, a.arrow);
  m.material = e.optional ? a.forkArrow : a.arrow;
  // Mid-air steering arrows float at flight height past the trampoline; others lie on the deck.
  const y = e.kind === 'air' ? e.top + 3 : e.top + 0.03;
  m.position.set((e.minX + e.maxX) / 2, y, (e.minZ + e.maxZ) / 2);
  m.rotation.set(0, dirYaw(turnDir(e.fromDir, e.turn)), 0);
  m.scale.setScalar(1.3);
  m.visible = true;
  return m;
}
