import { CONFIG, OBSTACLE_BANDS } from './config';
import { Rng } from './rng';

/** Heading on the ground plane. 0 = north (-Z), 1 = east (+X), 2 = south (+Z), 3 = west (-X). */
export type Dir = 0 | 1 | 2 | 3;
export type Turn = 'left' | 'right';

export const DIR_X: readonly number[] = [0, 1, 0, -1];
export const DIR_Z: readonly number[] = [-1, 0, 1, 0];

export function turnDir(dir: Dir, turn: Turn): Dir {
  return ((dir + (turn === 'left' ? 3 : 1)) % 4) as Dir;
}

/** Yaw (radians about +Y) that rotates the -Z forward axis onto `dir`. */
export function dirYaw(dir: Dir): number {
  return (-dir * Math.PI) / 2;
}

export interface Vec2 {
  x: number;
  z: number;
}

/**
 * A straight line of buildings. Positions on it are (along, lateral) where `along` runs in
 * `dir` from the origin and `lateral` is positive to the runner's right.
 */
export interface Run {
  id: number;
  dir: Dir;
  ox: number;
  oz: number;
  /** Main-route distance at the origin; used for generation and recycling. */
  route: number;
}

export function runPoint(run: Run, along: number, lateral: number): Vec2 {
  const dx = DIR_X[run.dir]!;
  const dz = DIR_Z[run.dir]!;
  return { x: run.ox + dx * along - dz * lateral, z: run.oz + dz * along + dx * lateral };
}

export function runAlong(run: Run, x: number, z: number): number {
  return (x - run.ox) * DIR_X[run.dir]! + (z - run.oz) * DIR_Z[run.dir]!;
}

export function runLateral(run: Run, x: number, z: number): number {
  return -(x - run.ox) * DIR_Z[run.dir]! + (z - run.oz) * DIR_X[run.dir]!;
}

export type ShapeKind = 'rect' | 'hex' | 'tri' | 'triBack' | 'wedgeL' | 'wedgeR';
export type PlatformRole =
  | 'start'
  | 'plain'
  | 'obstacle'
  | 'end'
  | 'entry'
  | 'fork'
  | 'hub'
  | 'trampoline'
  /** Lane that ends beside a parallel lane: hop across to continue. */
  | 'switch'
  /** First building of the parallel lane after a hop. */
  | 'lane';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Platform extends Bounds {
  id: number;
  run: Run;
  a: number;
  b: number;
  hw: number;
  shape: ShapeKind;
  role: PlatformRole;
  /** Convex footprint, counter-clockwise in (x, z). */
  poly: Vec2[];
  routeEnd: number;
  /** Visual depth of the building below the deck. */
  depth: number;
  /** Deck height (world y). */
  top: number;
  /** Deck height of the building before it (for the slide-into-place animation). */
  fromTop: number;
  /**
   * How it is reached from the building before it, when that is not an ordinary jump:
   * along a wall (the gap is too long to jump), or by climbing its face (too tall to jump).
   */
  approach?: 'wallrun' | 'climb';
}

/**
 * Wall beside a wall-run gap, on one side of the lane. A real jump into the gap attaches the
 * runner to it; they run along it and kick off onto the next building (`platformId`).
 */
export interface Wall extends Bounds {
  id: number;
  run: Run;
  /** -1 = left of the lane, 1 = right. */
  side: -1 | 1;
  /** Along the run: where the gap (and the wall) starts and ends. */
  a: number;
  b: number;
  /** Deck height the runner holds while on the wall, and the wall's top. */
  deck: number;
  top: number;
  platformId: number;
  routeEnd: number;
}

export type ObstacleKind = keyof typeof OBSTACLE_BANDS;

export interface Box extends Bounds {
  minY: number;
  maxY: number;
}

export interface Obstacle extends Box {
  id: number;
  kind: ObstacleKind;
  dir: Dir;
  platformId: number;
  routeEnd: number;
}

export interface Pad extends Bounds {
  top: number;
  id: number;
  platformId: number;
  routeEnd: number;
}

/**
 * Black portal: an upright dark energy gate across the lane. Running through it (at any jump
 * height) brings on the darkness. (x, y, z) is its foot on the deck; its gate spans `a`..`b`
 * along the run and the full building width.
 */
export interface Spell {
  id: number;
  x: number;
  y: number;
  z: number;
  dir: Dir;
  a: number;
  b: number;
  halfWidth: number;
  platformId: number;
  routeEnd: number;
  taken: boolean;
}

/** Energy shard: a small collectible on the lane. */
export interface Shard {
  id: number;
  x: number;
  y: number;
  z: number;
  platformId: number;
  routeEnd: number;
  taken: boolean;
}

/** Mirror portal: a vertical ring across the path. Running through it reverses the controls. */
export interface Portal extends Box {
  id: number;
  dir: Dir;
  x: number;
  z: number;
  platformId: number;
  routeEnd: number;
  taken: boolean;
}

/** Area on a platform from which a side jump lands on the next run. */
/**
 * How an exit is taken: `turn` leaps sideways onto a building heading the new way; `air` steers
 * in mid-air after a trampoline bounce; `hop` jumps across to a parallel lane, same heading.
 */
export type ExitKind = 'turn' | 'air' | 'hop';

export interface Exit extends Bounds {
  kind: ExitKind;
  /** Deck height of the building the window is on. */
  top: number;
  id: number;
  fromDir: Dir;
  turn: Turn;
  /** True at forks, where running straight on is also valid. */
  optional: boolean;
  platformId: number;
  routeEnd: number;
}

/** Unit footprints in (lateral u in [-1,1]-ish, along v in [0,1]) before scaling. */
const UNIT_SHAPES: Record<ShapeKind, [number, number][]> = {
  rect: [
    [-1, 0],
    [1, 0],
    [1, 1],
    [-1, 1],
  ],
  hex: [
    [-1, 0],
    [1, 0],
    [1.45, 0.5],
    [1, 1],
    [-1, 1],
    [-1.45, 0.5],
  ],
  tri: [
    [-1.6, 0],
    [1.6, 0],
    [0, 1],
  ],
  triBack: [
    [0, 0],
    [1.6, 1],
    [-1.6, 1],
  ],
  wedgeL: [
    [-1, 0],
    [1, 0],
    [1, 1],
    [-1, 1],
    [-1.9, 0.5],
  ],
  wedgeR: [
    [-1, 0],
    [1, 0],
    [1.9, 0.5],
    [1, 1],
    [-1, 1],
  ],
};

export function unitShape(kind: ShapeKind): readonly [number, number][] {
  return UNIT_SHAPES[kind];
}

export function pointInPoly(poly: Vec2[], x: number, z: number): boolean {
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    if ((q.x - p.x) * (z - p.z) - (q.z - p.z) * (x - p.x) < -1e-9) return false;
  }
  return true;
}

function inBounds(b: Bounds, x: number, z: number): boolean {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

function boundsOf(points: Vec2[]): Bounds {
  const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of points) {
    b.minX = Math.min(b.minX, p.x);
    b.maxX = Math.max(b.maxX, p.x);
    b.minZ = Math.min(b.minZ, p.z);
    b.maxZ = Math.max(b.maxZ, p.z);
  }
  return b;
}

/**
 * Endless, bounded, seeded world of floating buildings.
 *
 * Validity guarantees (all covered by tests):
 * - Runs only head north, east or west, so the route is monotone in -Z and never overlaps.
 * - Forks form a rectangle whose two branches have equal length and rejoin at a hub.
 * - Every gap is shorter than a jump at minimum speed, and every landing zone is longer than
 *   a jump at maximum speed, so jumping at the edge is always safe.
 * - Obstacles sit beyond any landing point and leave room to land before the next edge.
 */
export class World {
  platforms: Platform[] = [];
  obstacles: Obstacle[] = [];
  pads: Pad[] = [];
  spells: Spell[] = [];
  shards: Shard[] = [];
  portals: Portal[] = [];
  walls: Wall[] = [];
  exits: Exit[] = [];

  /** Disable to build hand-made worlds in tests. */
  autoGenerate = true;
  private rng: Rng;
  private nextId = 1;
  private frontier: { run: Run; along: number };
  private lastSpellRoute = -Infinity;
  private lastPortalRoute = -Infinity;
  // Due from the moment trampolines unlock, so the first one comes right after its stage.
  private lastTrampolineRoute: number = CONFIG.intro.trampolines - CONFIG.trampolineMaxGap;
  private justForked = false;
  // Each special is due from the moment it unlocks, so the first one comes right after its stage.
  private lastForkRoute: number = CONFIG.intro.forks - CONFIG.forkEvery;
  private lastHopRoute: number = CONFIG.intro.hops - CONFIG.hopEvery;
  private lastRecycle = -Infinity;
  /** Platforms left that must be obstacle-free (recovery after a big moment). */
  private calm = 0;
  /** Deck height for new buildings, and the height of the last one placed. */
  /** Deck height for the next building added (generation sets it; tests may too). */
  level = 0;
  private lastTop = 0;

  constructor(seed: number, options: { empty?: boolean } = {}) {
    this.rng = new Rng(seed);
    const run = this.newRun(0, 0, 0, 0);
    this.frontier = { run, along: 0 };
    if (options.empty) {
      this.autoGenerate = false;
      return;
    }
    // The opening varies per seed too, so no two runs start the same way.
    const startLen = Math.round(this.rng.range(26, 40));
    this.addPlatform(run, -12, startLen, CONFIG.pathHalfWidth, 'rect', 'start');
    this.frontier.along = startLen + this.gap();
    this.update(0);
  }

  get frontierRoute(): number {
    return this.frontier.run.route + this.frontier.along;
  }

  /** Generate ahead of route progress `progress` and recycle what is far behind. */
  update(progress: number): void {
    const cutoff = progress - CONFIG.keepBehind;
    if (cutoff > this.lastRecycle + 5) {
      this.lastRecycle = cutoff;
      const keep = <T extends { routeEnd: number }>(list: T[]) =>
        list.filter((e) => e.routeEnd >= cutoff);
      this.platforms = keep(this.platforms);
      this.obstacles = keep(this.obstacles);
      this.pads = keep(this.pads);
      this.spells = keep(this.spells);
      this.shards = keep(this.shards);
      this.portals = keep(this.portals);
      this.walls = keep(this.walls);
      this.exits = keep(this.exits);
    }
    if (!this.autoGenerate) return;
    while (
      this.frontierRoute < progress + CONFIG.lookAhead &&
      this.platforms.length < CONFIG.maxPlatforms - 30
    ) {
      this.extend();
    }
  }

  supportAt(x: number, z: number): Platform | null {
    for (const p of this.platforms) {
      if (inBounds(p, x, z) && pointInPoly(p.poly, x, z)) return p;
    }
    return null;
  }

  padAt(x: number, z: number): Pad | null {
    for (const p of this.pads) if (inBounds(p, x, z)) return p;
    return null;
  }

  exitAt(x: number, z: number, fromDir: Dir): Exit | null {
    for (const e of this.exits) if (e.fromDir === fromDir && inBounds(e, x, z)) return e;
    return null;
  }

  // ------------------------------------------------------------ building blocks (public for tests)

  newRun(dir: Dir, ox: number, oz: number, route: number): Run {
    return { id: this.nextId++, dir, ox, oz, route };
  }

  addPlatform(
    run: Run,
    a: number,
    b: number,
    hw: number,
    shape: ShapeKind,
    role: PlatformRole,
  ): Platform {
    let poly = UNIT_SHAPES[shape].map(([u, v]) => runPoint(run, a + v * (b - a), u * hw));
    // Mirror transforms flip winding; normalise to counter-clockwise for pointInPoly.
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      area += p.x * q.z - q.x * p.z;
    }
    if (area < 0) poly = poly.reverse();
    const p: Platform = {
      id: this.nextId++,
      run,
      a,
      b,
      hw,
      shape,
      role,
      poly,
      ...boundsOf(poly),
      routeEnd: run.route + b,
      depth: 18 + this.rng.next() * 22,
      top: this.level,
      fromTop: this.lastTop,
    };
    this.lastTop = p.top;
    this.platforms.push(p);
    return p;
  }

  addObstacle(
    p: Platform,
    kind: ObstacleKind,
    along: number,
    lateral = 0,
    width = p.hw * 2,
    depth?: number,
  ): Obstacle {
    const band = OBSTACLE_BANDS[kind];
    const d = depth ?? band.depth;
    const b = boundsOf([
      runPoint(p.run, along - d / 2, lateral - width / 2),
      runPoint(p.run, along + d / 2, lateral + width / 2),
    ]);
    const o: Obstacle = {
      id: this.nextId++,
      kind,
      dir: p.run.dir,
      platformId: p.id,
      routeEnd: p.routeEnd,
      minY: p.top + band.minY,
      maxY: p.top + band.maxY,
      ...b,
    };
    this.obstacles.push(o);
    return o;
  }

  addPad(p: Platform, a: number, b: number): Pad {
    const pad: Pad = {
      id: this.nextId++,
      top: p.top,
      platformId: p.id,
      routeEnd: p.routeEnd,
      ...boundsOf([runPoint(p.run, a, -p.hw), runPoint(p.run, b, p.hw)]),
    };
    this.pads.push(pad);
    return pad;
  }

  /** A row of shards on the lane centre from `from`, spaced 1.6 m, never past `to`. */
  addShardRow(p: Platform, from: number, to: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const along = from + i * 1.6;
      if (along > to || this.shards.length >= CONFIG.maxShards) return;
      const pt = runPoint(p.run, along, 0);
      this.shards.push({
        id: this.nextId++,
        x: pt.x,
        y: p.top + 0.9,
        z: pt.z,
        platformId: p.id,
        routeEnd: p.routeEnd,
        taken: false,
      });
    }
  }

  /** Black portal standing `along` the run of `p`, across the whole lane. */
  addSpell(p: Platform, along: number): Spell {
    const mid = along;
    const pt = runPoint(p.run, mid, 0);
    const s: Spell = {
      id: this.nextId++,
      x: pt.x,
      y: p.top,
      z: pt.z,
      dir: p.run.dir,
      a: along - CONFIG.gateDepth / 2,
      b: along + CONFIG.gateDepth / 2,
      halfWidth: p.hw,
      platformId: p.id,
      routeEnd: p.routeEnd,
      taken: false,
    };
    this.spells.push(s);
    return s;
  }

  addPortal(p: Platform, along: number): Portal {
    const c = runPoint(p.run, along, 0);
    const portal: Portal = {
      id: this.nextId++,
      dir: p.run.dir,
      x: c.x,
      z: c.z,
      platformId: p.id,
      routeEnd: p.routeEnd,
      taken: false,
      minY: p.top,
      maxY: p.top + 2.8,
      ...boundsOf([runPoint(p.run, along - 0.3, -p.hw), runPoint(p.run, along + 0.3, p.hw)]),
    };
    this.portals.push(portal);
    return portal;
  }

  /** Side exit centred at `center` on `p`; returns the run it leads to. */
  addExit(
    p: Platform,
    center: number,
    turn: Turn,
    optional: boolean,
    kind: ExitKind = 'turn',
    // Slightly narrower than the building it lands on, so its edge always lands inside.
    half: number = CONFIG.junctionHalfWidth - 0.1,
  ): Run {
    const e: Exit = {
      kind,
      id: this.nextId++,
      fromDir: p.run.dir,
      turn,
      optional,
      top: p.top,
      platformId: p.id,
      routeEnd: p.routeEnd,
      ...boundsOf([runPoint(p.run, center - half, -p.hw), runPoint(p.run, center + half, p.hw)]),
    };
    this.exits.push(e);
    if (kind === 'hop') {
      // Same heading, axis shifted one lane to the side; along-coordinates stay the same.
      const o = runPoint(p.run, 0, (turn === 'right' ? 1 : -1) * CONFIG.laneOffset);
      return this.newRun(p.run.dir, o.x, o.z, p.run.route);
    }
    const o = runPoint(p.run, center, 0);
    return this.newRun(turnDir(p.run.dir, turn), o.x, o.z, p.run.route + center);
  }

  // ------------------------------------------------------------ generation

  private gap(): number {
    const route = this.frontierRoute;
    // Gaps start small and widen slowly, so early jumps have a generous timing window.
    const max = Math.min(CONFIG.maxGap, CONFIG.minGap + 0.4 + route / 400);
    return Math.round(this.rng.range(CONFIG.minGap, max) * 10) / 10;
  }

  private exitGap(): number {
    return Math.round(this.rng.range(CONFIG.minGap, CONFIG.maxExitGap) * 10) / 10;
  }

  private extend(): void {
    const { run } = this.frontier;
    let along = this.frontier.along;
    // Short stretches between junctions keep the special junctions coming.
    const count = 2 + Math.floor(this.rng.next() * 2);
    let approach: Platform['approach'];
    let gapStart = along;
    for (let i = 0; i < count; i++) {
      const len = this.chooseLength(Infinity);
      const end = this.platformAt(run, along, len, i > 0, approach);
      if (approach === 'wallrun') {
        const landing = this.platforms[this.platforms.length - 1]!;
        this.addWall(run, gapStart, along, landing, this.rng.chance(0.5) ? -1 : 1);
      }
      gapStart = end;
      approach = i < count - 1 ? this.parkourGap(run.route + end) : undefined;
      // The next building may sit higher or lower. Rises get a short gap, so a jump from the
      // edge is still high enough when it reaches the taller building.
      let delta = i < count - 1 && !approach ? this.levelChange() : 0;
      let g = delta > 0 ? Math.min(this.gap(), CONFIG.minGap + 0.4) : this.gap();
      if (approach === 'climb') {
        delta = CONFIG.climbRise;
        g = CONFIG.minGap;
      } else if (approach === 'wallrun') {
        g = Math.round(this.rng.range(CONFIG.wallRunMinGap, CONFIG.wallRunMaxGap) * 10) / 10;
      }
      this.level = Math.round((this.level + delta) * 10) / 10;
      along = end + g;
    }

    const route = run.route + along;
    const kind = this.pickJunction(run, route);
    if (kind === 'fork') {
      this.fork(run, along, this.rng.chance(0.5) ? 'left' : 'right');
      this.calm = CONFIG.calmPlatforms;
    } else if (kind === 'trampoline') {
      this.trampoline(run, along, this.sideFor(run));
      this.calm = CONFIG.calmPlatforms;
    } else if (kind === 'hop') {
      this.hop(run, along, this.sideFor(run));
    } else {
      const end = this.endPlatform(run, along, 'end');
      const next = this.addExit(end, end.b - CONFIG.junctionHalfWidth, this.sideFor(run), false);
      this.frontier = { run: next, along: this.entry(next) };
    }
  }

  /** Side leaps and lane shifts may only head north, east or west (the route never goes south). */
  private sideFor(run: Run): Turn {
    if (run.dir === 1) return 'left';
    if (run.dir === 3) return 'right';
    return this.rng.chance(0.5) ? 'left' : 'right';
  }

  /**
   * What ends this stretch. Whichever special junction is most overdue against its target spacing
   * goes first; otherwise each gets a fixed chance; otherwise an ordinary side-leap dead end.
   */
  private pickJunction(run: Run, route: number): 'fork' | 'trampoline' | 'hop' | 'turn' {
    const options: {
      kind: 'fork' | 'trampoline' | 'hop';
      last: number;
      every: number;
      p: number;
    }[] = [];
    // Checked in this order when nothing is overdue: trampolines first (they were too rare).
    if (route > CONFIG.intro.trampolines) {
      options.push({
        kind: 'trampoline',
        last: this.lastTrampolineRoute,
        every: CONFIG.trampolineMaxGap,
        p: 0.35,
      });
    }
    if (route > CONFIG.intro.hops) {
      options.push({ kind: 'hop', last: this.lastHopRoute, every: CONFIG.hopEvery, p: 0.3 });
    }
    // No fork straight after a fork: its continuation always heads north, so forks could chain.
    if (run.dir === 0 && route > CONFIG.intro.forks && !this.justForked) {
      options.push({ kind: 'fork', last: this.lastForkRoute, every: CONFIG.forkEvery, p: 0.35 });
    }
    const overdue = options
      .map((o) => ({ ...o, ratio: (route - o.last) / o.every }))
      .filter((o) => o.ratio >= 1)
      .sort((a, b) => b.ratio - a.ratio)[0];
    const pick = overdue?.kind ?? options.find((o) => this.rng.chance(o.p))?.kind ?? 'turn';
    this.justForked = pick === 'fork';
    if (pick === 'fork') this.lastForkRoute = route;
    if (pick === 'trampoline') this.lastTrampolineRoute = route;
    if (pick === 'hop') this.lastHopRoute = route;
    return pick;
  }

  /**
   * Whether the next gap is a parkour move instead of a jump: a wall-run across a long gap, or a
   * climb up a much taller building (only when that stays inside the height band).
   */
  private parkourGap(route: number): Platform['approach'] {
    const r = this.rng;
    if (route > CONFIG.intro.climbs && this.level + CONFIG.climbRise <= CONFIG.maxLevel) {
      if (r.chance(CONFIG.climbChance)) return 'climb';
    }
    if (route > CONFIG.intro.wallRuns && r.chance(CONFIG.wallRunChance)) return 'wallrun';
    return undefined;
  }

  /** The wall beside the wall-run gap from `a` to `b`; `landing` is the building at `b`. */
  addWall(run: Run, a: number, b: number, landing: Platform, side: -1 | 1): Wall {
    const lat = side * (CONFIG.pathHalfWidth + CONFIG.wallOffset);
    const corners = [runPoint(run, a, lat), runPoint(run, b, lat + side * 0.6)];
    const wall: Wall = {
      id: this.nextId++,
      run,
      side,
      a,
      b,
      deck: landing.top,
      top: landing.top + CONFIG.wallHeight,
      platformId: landing.id,
      routeEnd: landing.routeEnd,
      minX: Math.min(corners[0]!.x, corners[1]!.x),
      maxX: Math.max(corners[0]!.x, corners[1]!.x),
      minZ: Math.min(corners[0]!.z, corners[1]!.z),
      maxZ: Math.max(corners[0]!.z, corners[1]!.z),
    };
    this.walls.push(wall);
    return wall;
  }

  /** Height change for the next ordinary building: 0, a rise (must jump up) or a drop. */
  private levelChange(): number {
    const r = this.rng;
    if (this.frontierRoute < CONFIG.intro.heights || !r.chance(0.4)) return 0;
    const up = r.chance(0.5);
    let d = up ? r.range(CONFIG.minRise, CONFIG.maxRise) : -r.range(CONFIG.minDrop, CONFIG.maxDrop);
    // Stay within a band so the route never climbs or sinks out of view.
    if (Math.abs(this.level + d) > CONFIG.maxLevel) {
      // Flip direction, clamped to the limit for that direction (a rise must stay jumpable).
      d = d < 0 ? Math.min(-d, CONFIG.maxRise) : Math.max(-d, -CONFIG.maxDrop);
    }
    return Math.round(d * 10) / 10;
  }

  private chooseLength(max: number): number {
    const r = this.rng;
    const route = this.frontierRoute;
    // An overdue spell or portal needs a plain building to sit on: make the next one plain.
    const needsPlain =
      (route > CONFIG.spellMinRoute &&
        route - this.lastSpellRoute > CONFIG.overdueFactor * CONFIG.spellSpacing) ||
      (route > CONFIG.portalMinRoute &&
        route - this.lastPortalRoute > CONFIG.overdueFactor * CONFIG.portalSpacing);
    const calm = this.calm > 0;
    if (calm) this.calm -= 1;
    // Obstacle density ramps up with distance.
    const density = Math.min(0.7, 0.35 + route / 1500);
    // Round down so a rounded length never exceeds the space it was chosen to fit.
    if (
      !calm &&
      !needsPlain &&
      route > CONFIG.intro.obstacles &&
      max >= CONFIG.obstacleMinLength &&
      r.chance(density)
    ) {
      return Math.floor(r.range(CONFIG.obstacleMinLength, Math.min(max, CONFIG.obstacleMaxLength)));
    }
    return Math.floor(r.range(CONFIG.plainMinLength, Math.min(max, CONFIG.plainMaxLength)));
  }

  /** One ordinary platform of length `len` at `a`; long ones get obstacles. Returns its end. */
  private platformAt(
    run: Run,
    a: number,
    len: number,
    allowShapes: boolean,
    approach?: Platform['approach'],
  ): number {
    const r = this.rng;
    const b = a + len;
    if (approach) {
      // Reached by a wall-run or a climb: a calm rectangle, so the landing is always clean.
      this.addPlatform(run, a, b, CONFIG.pathHalfWidth, 'rect', 'plain').approach = approach;
      return b;
    }
    if (len >= CONFIG.obstacleMinLength) {
      const shape: ShapeKind = allowShapes
        ? r.pick(['rect', 'rect', 'hex', 'wedgeL', 'wedgeR'])
        : 'rect';
      const p = this.addPlatform(run, a, b, CONFIG.pathHalfWidth, shape, 'obstacle');
      // The usable stretch between the landing zone and the room needed before the edge.
      const last = b - CONFIG.obstacleEndMargin;
      const slack = Math.max(0, last - (a + CONFIG.obstacleStartMargin));
      let s = a + CONFIG.obstacleStartMargin + r.range(0, Math.min(3, slack));
      for (;;) {
        // Round up (never into the landing zone), but never past the last allowed spot either,
        // so every obstacle building really gets an obstacle.
        const at = Math.min(Math.ceil(s * 10) / 10, last);
        if (s > last + 1e-9 || this.obstacles.length >= CONFIG.maxObstacles) break;
        this.addObstacle(p, this.obstacleKind(run.route + at), at);
        s += CONFIG.obstacleSpacing + r.range(0, 6);
      }
      return b;
    }
    const route = run.route + a;
    // Spells and portals come often, and never go missing for long: past 1.5x their spacing
    // the next calm building is forced to carry one (and made rectangular to hold it).
    const since = (last: number) => route - last;
    const spellDue =
      route > CONFIG.spellMinRoute && since(this.lastSpellRoute) > CONFIG.spellSpacing;
    const portalDue =
      route > CONFIG.portalMinRoute && since(this.lastPortalRoute) > CONFIG.portalSpacing;
    const spellOverdue =
      spellDue && since(this.lastSpellRoute) > CONFIG.overdueFactor * CONFIG.spellSpacing;
    const portalOverdue =
      portalDue && since(this.lastPortalRoute) > CONFIG.overdueFactor * CONFIG.portalSpacing;
    const shape: ShapeKind =
      allowShapes && !spellOverdue && !portalOverdue
        ? r.pick(['rect', 'rect', 'hex', 'tri', 'triBack', 'wedgeL', 'wedgeR'])
        : 'rect';
    const p = this.addPlatform(run, a, b, CONFIG.pathHalfWidth, shape, 'plain');
    const special =
      shape === 'rect' &&
      this.placeSpecials(p, route, spellOverdue || r.chance(0.5), portalOverdue || r.chance(0.55));
    if (!special && r.chance(0.5)) {
      this.addShardRow(p, a + 3, b - 3, 3 + Math.floor(r.next() * 4));
    }
    return b;
  }

  /**
   * Put a due spell and/or portal on a calm rectangular building (both if both are due and it is
   * long enough: spell first, portal later). Returns true if anything was placed.
   */
  private placeSpecials(
    p: Platform,
    route: number,
    wantSpell: boolean,
    wantPortal: boolean,
  ): boolean {
    const since = (last: number) => route - last;
    const spell =
      wantSpell && route > CONFIG.spellMinRoute && since(this.lastSpellRoute) > CONFIG.spellSpacing;
    const portal =
      wantPortal &&
      route > CONFIG.portalMinRoute &&
      since(this.lastPortalRoute) > CONFIG.portalSpacing;
    const len = p.b - p.a;
    // The black portal stands near the start, so the darkness begins with room to react.
    if (spell && portal && len >= 16) {
      this.addSpell(p, p.a + CONFIG.gateInset);
      this.addPortal(p, p.a + len * 0.75);
    } else if (spell) this.addSpell(p, p.a + CONFIG.gateInset);
    else if (portal) this.addPortal(p, p.a + len * 0.6);
    if (spell) this.lastSpellRoute = route;
    if (portal && (!spell || len >= 16)) this.lastPortalRoute = route;
    return spell || portal;
  }

  /** Obstacle types unlock in stages: jump barriers, then slide beams, then either-way bars. */
  private obstacleKind(route: number): ObstacleKind {
    const kinds: ObstacleKind[] = ['low', 'low'];
    if (route >= CONFIG.intro.vaults) kinds.push('vault');
    if (route >= CONFIG.intro.slideBeams) kinds.push('high', 'high');
    if (route >= CONFIG.intro.midBars) kinds.push('mid');
    return this.rng.pick(kinds);
  }

  /** Dead-end platform: long enough to land on, wide enough for the side-jump window. */
  private endPlatform(run: Run, a: number, role: PlatformRole): Platform {
    const len = Math.round(this.rng.range(CONFIG.endMinLength, CONFIG.endMaxLength));
    return this.addPlatform(run, a, a + len, CONFIG.junctionHalfWidth, 'rect', role);
  }

  /** First platform of a new run after a side exit. Returns where the next platform starts. */
  private entry(run: Run): number {
    const a = CONFIG.junctionHalfWidth + this.exitGap();
    const p = this.addPlatform(
      run,
      a,
      a + CONFIG.entryLength,
      CONFIG.junctionHalfWidth,
      'rect',
      'entry',
    );
    this.placeSpecials(p, run.route + p.a, this.rng.chance(0.5), this.rng.chance(0.5));
    return p.b + this.gap();
  }

  /**
   * Trampoline dead end: nothing lies ahead. The side building starts beyond the end and off to
   * one side, out of reach of any normal jump or side leap. Bouncing on the pad launches the
   * runner high; steering in mid-air (an `air` exit past the end) carries them onto it.
   */
  private trampoline(run: Run, a: number, side: Turn): void {
    const hw = CONFIG.pathHalfWidth;
    const b = a + CONFIG.trampolineLength;
    const t = this.addPlatform(run, a, b, hw, 'rect', 'trampoline');
    this.addPad(t, b - CONFIG.padFromEnd, b - CONFIG.padFromEnd + 2);
    const half = CONFIG.airWindow / 2;
    const center = b + CONFIG.trampolineGap + half;
    // Window slightly narrower than the side building, so its edge always lands inside.
    const next = this.addExit(t, center, side, false, 'air', half - 0.1);
    const entryA = CONFIG.airEntryStart;
    const entry = this.addPlatform(
      next,
      entryA,
      entryA + CONFIG.airEntryLength,
      half,
      'rect',
      'entry',
    );
    this.frontier = { run: next, along: entry.b + this.gap() };
  }

  /**
   * Parallel lanes: this lane ends while a parallel one starts beside its last stretch, heading
   * the same way. A side press there hops across and keeps running forward.
   */
  private hop(run: Run, a: number, side: Turn): void {
    const hw = CONFIG.pathHalfWidth;
    const len = Math.round(this.rng.range(CONFIG.endMinLength, CONFIG.endMaxLength));
    const p = this.addPlatform(run, a, a + len, hw, 'rect', 'switch');
    const w0 = p.b - CONFIG.hopWindow;
    const lane = this.addExit(
      p,
      w0 + CONFIG.hopWindow / 2,
      side,
      false,
      'hop',
      CONFIG.hopWindow / 2,
    );
    // Long enough to land on from anywhere in the window at top speed.
    const first = this.addPlatform(lane, w0, w0 + CONFIG.hopWindow + 30, hw, 'rect', 'lane');
    this.placeSpecials(first, lane.route + first.a, this.rng.chance(0.5), this.rng.chance(0.5));
    this.frontier = { run: lane, along: first.b + this.gap() };
  }

  /**
   * Fork: forward and side branches form a rectangle with equal-length sides and rejoin at a hub,
   * then the route continues north from the hub.
   */
  private fork(run: Run, a: number, side: Turn): void {
    const r = this.rng;
    const back: Turn = side === 'left' ? 'right' : 'left';
    const half = CONFIG.junctionHalfWidth;
    const A = Math.round(r.range(60, 80));
    const B = Math.round(r.range(55, 75));

    const endLen = () => Math.round(r.range(CONFIG.endMinLength, CONFIG.endMaxLength));

    const forkP = this.endPlatform(run, a, 'fork');
    const c = forkP.b - half;
    const sideE = this.addExit(forkP, c, side, true); // optional side branch

    // Forward branch: straight on, dead-ends after A, side-jumps toward the fork side.
    const fCornerA = c + A + half - endLen();
    this.fill(run, forkP.b + this.gap(), fCornerA, false, false);
    const fCorner = this.addPlatform(run, fCornerA, c + A + half, half, 'rect', 'end');
    const fE = this.addExit(fCorner, c + A, side, false);
    const hubA = B + half - endLen();
    this.fill(fE, half + this.exitGap(), hubA, false, true);
    const hub = this.addPlatform(fE, hubA, B + half, half, 'rect', 'hub');
    const cont = this.addExit(hub, B, back, false);

    // Side branch: across for B, dead-ends, jumps back to heading north, runs A into the hub.
    const sCornerA = B + half - endLen();
    this.fill(sideE, half + this.exitGap(), sCornerA, false, true);
    const sCorner = this.addPlatform(sideE, sCornerA, B + half, half, 'rect', 'end');
    const sN = this.addExit(sCorner, B, back, false);
    this.fill(sN, half + this.exitGap(), A - half, true, true);

    this.frontier = { run: cont, along: this.entry(cont) };
  }

  /**
   * Fill a run from `from` with platforms and gaps. With `contiguous` the last platform ends
   * exactly at `to`; otherwise it ends one gap before `to`. With `entryFirst` the first platform
   * is a wide, obstacle-free landing zone for a side jump.
   */
  private fill(run: Run, from: number, to: number, contiguous: boolean, entryFirst: boolean): void {
    const MIN = CONFIG.plainMinLength;
    const endGap = contiguous ? 0 : this.gap();
    let pos = from;
    let first = true;
    for (;;) {
      const space = to - endGap - pos;
      const firstMin = first && entryFirst ? CONFIG.entryLength : MIN;
      if (space < MIN) throw new Error(`World.fill ran out of space (${space})`);
      if (space < firstMin + CONFIG.maxGap + MIN) {
        this.fillPlatform(run, pos, space, first && entryFirst, !first);
        return;
      }
      const len =
        first && entryFirst ? CONFIG.entryLength : this.chooseLength(space - CONFIG.maxGap - MIN);
      this.fillPlatform(run, pos, len, first && entryFirst, !first);
      pos += len + this.gap();
      first = false;
    }
  }

  private fillPlatform(run: Run, a: number, len: number, entry: boolean, shapes: boolean): void {
    if (entry) this.addPlatform(run, a, a + len, CONFIG.junctionHalfWidth, 'rect', 'entry');
    else this.platformAt(run, a, len, shapes);
  }
}
