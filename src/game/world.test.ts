import { describe, expect, it } from 'vitest';
import { CONFIG, jumpDistance } from './config';
import { Rng } from './rng';
import {
  DIR_X,
  DIR_Z,
  dirYaw,
  pointInPoly,
  runAlong,
  runLateral,
  runPoint,
  turnDir,
  World,
  type Exit,
  type Obstacle,
  type Platform,
  type Vec2,
} from './world';

const SEEDS = [1, 2, 3, 7, 42, 1337, 99999, 123456789, 0x7ffffffe, 555];

interface Snapshot {
  platforms: Platform[];
  obstacles: Obstacle[];
  exits: Exit[];
  pads: number;
  portals: number;
  spells: { x: number; z: number; route: number }[];
}

/** Generate a long stretch of world by advancing progress, keeping everything ever created. */
function generate(seed: number, route = 3000): Snapshot {
  const w = new World(seed);
  const platforms = new Map<number, Platform>();
  const obstacles = new Map<number, Obstacle>();
  const exits = new Map<number, Exit>();
  const pads = new Set<number>();
  const portals = new Set<number>();
  const spells = new Map<number, { x: number; z: number; route: number }>();
  for (let p = 0; p <= route; p += 5) {
    w.update(p);
    expect(w.platforms.length).toBeLessThanOrEqual(CONFIG.maxPlatforms);
    expect(w.obstacles.length).toBeLessThanOrEqual(CONFIG.maxObstacles);
    for (const x of w.platforms) platforms.set(x.id, x);
    for (const x of w.obstacles) obstacles.set(x.id, x);
    for (const x of w.exits) exits.set(x.id, x);
    for (const x of w.pads) pads.add(x.id);
    for (const x of w.portals) portals.add(x.id);
    for (const s of w.spells) {
      const pl = platforms.get(s.platformId)!;
      spells.set(s.id, { x: s.x, z: s.z, route: pl.run.route + runAlong(pl.run, s.x, s.z) });
    }
  }
  return {
    platforms: [...platforms.values()],
    obstacles: [...obstacles.values()],
    exits: [...exits.values()],
    pads: pads.size,
    portals: portals.size,
    spells: [...spells.values()],
  };
}

/**
 * Horizontal distance a jump covers at speed `v` before touching down on a deck `rise` m higher
 * (negative = lower) than takeoff, or NaN when the deck is out of reach.
 */
function landingDistance(v: number, rise: number): number {
  const vj = CONFIG.jumpVelocity;
  const disc = vj * vj - 2 * CONFIG.gravity * rise;
  return disc < 0 ? NaN : (v * (vj + Math.sqrt(disc))) / CONFIG.gravity;
}

/** Next building on the same run after `p`, if generated. */
function nextOnRun(platforms: Platform[], p: Platform): Platform | undefined {
  return platforms.filter((q) => q.run.id === p.run.id && q.a > p.b).sort((a, b) => a.a - b.a)[0];
}

function supportedBy(platforms: Platform[], x: number, z: number): Platform | undefined {
  return platforms.find(
    (p) => x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && pointInPoly(p.poly, x, z),
  );
}

/** Separating-axis overlap test for convex polygons, with a small tolerance for touching edges. */
function polysOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const nx = -(q.z - p.z);
      const nz = q.x - p.x;
      const len = Math.hypot(nx, nz);
      const proj = (pts: Vec2[]) => pts.map((v) => (v.x * nx + v.z * nz) / len);
      const pa = proj(a);
      const pb = proj(b);
      if (Math.max(...pa) <= Math.min(...pb) + 0.01 || Math.max(...pb) <= Math.min(...pa) + 0.01) {
        return false;
      }
    }
  }
  return true;
}

describe('Rng', () => {
  it('is deterministic per seed and stays in [0,1)', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    for (let i = 0; i < 10000; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('pick returns every item eventually and nothing else', () => {
    const r = new Rng(1);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(r.pick(['a', 'b', 'c']));
    expect([...seen].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('geometry helpers', () => {
  it('turns rotate correctly', () => {
    expect(turnDir(0, 'left')).toBe(3);
    expect(turnDir(0, 'right')).toBe(1);
    expect(turnDir(1, 'left')).toBe(0);
    expect(turnDir(3, 'right')).toBe(0);
  });

  it('yaw maps the -Z forward axis onto each direction', () => {
    for (const d of [0, 1, 2, 3] as const) {
      expect(-Math.sin(dirYaw(d))).toBeCloseTo(DIR_X[d]!);
      expect(-Math.cos(dirYaw(d))).toBeCloseTo(DIR_Z[d]!);
    }
  });

  it('run frame round-trips and lateral is to the runner’s right', () => {
    const w = new World(1, { empty: true });
    for (const d of [0, 1, 2, 3] as const) {
      const run = w.newRun(d, 5, -3, 0);
      const p = runPoint(run, 7, 2);
      expect(runAlong(run, p.x, p.z)).toBeCloseTo(7);
      expect(runLateral(run, p.x, p.z)).toBeCloseTo(2);
      // Right of heading = heading turned right.
      const right = turnDir(d, 'right');
      const q = runPoint(run, 0, 1);
      expect(q.x - 5).toBeCloseTo(DIR_X[right]!);
      expect(q.z + 3).toBeCloseTo(DIR_Z[right]!);
    }
  });

  it('every footprint is counter-clockwise, convex and contains its centre line', () => {
    const w = new World(1, { empty: true });
    for (const d of [0, 1, 3] as const) {
      const run = w.newRun(d, 0, 0, 0);
      for (const shape of ['rect', 'hex', 'tri', 'triBack', 'wedgeL', 'wedgeR'] as const) {
        const p = w.addPlatform(run, 10, 25, 1.5, shape, 'plain');
        for (let i = 0; i < p.poly.length; i++) {
          const a = p.poly[i]!;
          const b = p.poly[(i + 1) % p.poly.length]!;
          const c = p.poly[(i + 2) % p.poly.length]!;
          const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
          expect(cross).toBeGreaterThan(0);
        }
        for (let s = 10.01; s < 25; s += 0.5) {
          const pt = runPoint(run, s, 0);
          expect(pointInPoly(p.poly, pt.x, pt.z), `${shape} d${d} s${s}`).toBe(true);
        }
        const out = runPoint(run, 25.2, 0);
        expect(pointInPoly(p.poly, out.x, out.z)).toBe(false);
      }
    }
  });
});

const totals = { trampolines: 0, mid: 0 };

describe('World generation', () => {
  it('is reproducible from a seed and differs between seeds', () => {
    const strip = (s: Snapshot) =>
      s.platforms.map((p) => [p.minX, p.minZ, p.maxX, p.maxZ, p.shape]);
    expect(strip(generate(42, 800))).toEqual(strip(generate(42, 800)));
    expect(strip(generate(43, 800))).not.toEqual(strip(generate(42, 800)));
  });

  for (const seed of SEEDS) {
    describe(`seed ${seed}`, () => {
      const snap = generate(seed);

      it('uses every feature', () => {
        const roles = new Set(snap.platforms.map((p) => p.role));
        for (const r of ['plain', 'obstacle', 'end', 'entry'] as const) {
          expect(roles.has(r), r).toBe(true);
        }
        const shapes = new Set(snap.platforms.map((p) => p.shape));
        expect(shapes.size, 'shapes').toBeGreaterThanOrEqual(5);
        const kinds = new Set(snap.obstacles.map((o) => o.kind));
        for (const k of ['low', 'high'] as const) expect(kinds.has(k), k).toBe(true);
        totals.mid += snap.obstacles.filter((o) => o.kind === 'mid').length;
        totals.trampolines += snap.pads;
        expect(snap.spells.length, 'spells').toBeGreaterThan(0);
        expect(
          snap.exits.some((e) => e.optional),
          'forks',
        ).toBe(true);
        expect(snap.portals, 'portals').toBeGreaterThan(0);
        // The new junction types appear on every seed.
        expect(
          snap.exits.some((e) => e.kind === 'air'),
          'trampoline steer',
        ).toBe(true);
        expect(
          snap.exits.some((e) => e.kind === 'hop'),
          'lane hop',
        ).toBe(true);
      });

      it('never heads south', () => {
        for (const p of snap.platforms) expect(p.run.dir).not.toBe(2);
      });

      it('no two buildings overlap', () => {
        const ps = snap.platforms;
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const a = ps[i]!;
            const b = ps[j]!;
            if (a.maxX < b.minX || b.maxX < a.minX || a.maxZ < b.minZ || b.maxZ < a.minZ) continue;
            expect(polysOverlap(a.poly, b.poly), `${a.role}#${a.id} vs ${b.role}#${b.id}`).toBe(
              false,
            );
          }
        }
      });

      it('platforms are long enough to land on and gaps are jumpable', () => {
        const byRun = new Map<number, Platform[]>();
        for (const p of snap.platforms) {
          expect(p.b - p.a, `${p.role}`).toBeGreaterThanOrEqual(CONFIG.plainMinLength - 1e-9);
          byRun.set(p.run.id, [...(byRun.get(p.run.id) ?? []), p]);
        }
        for (const list of byRun.values()) {
          list.sort((a, b) => a.a - b.a);
          for (let i = 1; i < list.length; i++) {
            const g = list[i]!.a - list[i - 1]!.b;
            expect(g).toBeGreaterThanOrEqual(CONFIG.minGap - 1e-9);
            if (list[i]!.approach === 'wallrun') {
              // Too long for any jump: only the wall-run crosses it.
              expect(g).toBeGreaterThan(jumpDistance(CONFIG.maxSpeed));
              expect(g).toBeLessThanOrEqual(CONFIG.wallRunMaxGap + 1e-9);
            } else expect(g).toBeLessThanOrEqual(CONFIG.maxGap + 1e-9);
          }
        }
      });

      it('jumping just before any edge lands on a building at every speed', () => {
        for (const p of snap.platforms) {
          if (p.role === 'end' || p.role === 'hub' || p.role === 'trampoline') continue;
          // The world ahead of the last generated platform may not exist yet.
          const next = nextOnRun(snap.platforms, p);
          // Wall-runs and climbs are reached by those moves, not by a plain jump (tested in sim).
          if (!next || next.approach) continue;
          for (const v of [CONFIG.startSpeed, 13, CONFIG.maxSpeed]) {
            for (const early of [0.3, 0.8]) {
              const d = landingDistance(v, next.top - p.top);
              expect(d, `${p.role}#${p.id}: next deck out of reach`).not.toBeNaN();
              const land = runPoint(p.run, p.b - early + d, 0);
              const s = supportedBy(snap.platforms, land.x, land.z);
              // Lands on the next building (at its height), never in the gap or beyond it.
              expect(s, `${p.role}#${p.id} v${v} early${early}`).toBe(next);
            }
          }
        }
      });

      it('after any edge jump you land with time to react before the first obstacle', () => {
        const byRun = new Map<number, Platform[]>();
        for (const p of snap.platforms) byRun.set(p.run.id, [...(byRun.get(p.run.id) ?? []), p]);
        for (const list of byRun.values()) {
          list.sort((a, b) => a.a - b.a);
          for (let i = 1; i < list.length; i++) {
            const next = list[i]!;
            const first = snap.obstacles
              .filter((o) => o.platformId === next.id && o.kind !== 'sideWall')
              .map((o) => runAlong(next.run, (o.minX + o.maxX) / 2, (o.minZ + o.maxZ) / 2))
              .sort((a, b) => a - b)[0];
            if (first === undefined || next.role === 'trampoline') continue;
            for (const v of [CONFIG.startSpeed, 13, CONFIG.maxSpeed]) {
              // Latest landing: jumping right at the edge of the previous building.
              const landing = list[i - 1]!.b + landingDistance(v, next.top - list[i - 1]!.top);
              const reaction = (first - CONFIG.runnerRadius - landing) / v;
              expect(reaction, `v${v} obstacle#${next.id}`).toBeGreaterThanOrEqual(
                CONFIG.obstacleReactionSeconds,
              );
            }
          }
        }
      });

      it('shards sit on the lane centre of calm buildings only', () => {
        const w = new World(seed);
        let n = 0;
        for (let r = 0; r < 2000; r += 5) {
          w.update(r);
          for (const sh of w.shards) {
            const p = w.platforms.find((x) => x.id === sh.platformId)!;
            expect(['plain']).toContain(p.role);
            expect(Math.abs(runLateral(p.run, sh.x, sh.z))).toBeLessThan(1e-6);
            expect(pointInPoly(p.poly, sh.x, sh.z)).toBe(true);
            n++;
          }
          expect(w.shards.length).toBeLessThanOrEqual(CONFIG.maxShards);
        }
        expect(n).toBeGreaterThan(20);
      });

      // North-facing junctions are ~300–450 m apart (an E/W stretch lies between two of them), and
      // at most two pass without a fork, so forks are at most ~3 junction spacings apart.
      it('forks keep coming: never more than 1500 m between them after their stage', () => {
        const at = snap.platforms
          .filter((p) => p.role === 'fork')
          .map((p) => p.run.route + p.a)
          .sort((a, b) => a - b);
        expect(at.length, 'forks').toBeGreaterThan(0);
        let prev: number = CONFIG.intro.forks;
        for (const r of at) {
          expect(r - prev).toBeLessThan(1500);
          prev = r;
        }
      });

      it('height changes stay within the rules', () => {
        let rises = 0;
        let drops = 0;
        for (const p of snap.platforms) {
          expect(Math.abs(p.top)).toBeLessThanOrEqual(CONFIG.maxLevel + 1e-9);
          const next = nextOnRun(snap.platforms, p);
          if (!next) continue;
          const d = next.top - p.top;
          if (next.approach === 'climb') {
            rises++;
            expect(d, 'a climb is exactly one climb tall').toBeCloseTo(CONFIG.climbRise, 9);
          } else if (next.approach === 'wallrun') {
            expect(d, 'a wall-run lands at the same height').toBeCloseTo(0, 9);
          } else if (d > 1e-9) {
            rises++;
            expect(d).toBeLessThanOrEqual(CONFIG.maxRise + 1e-9);
            expect(next.a - p.b, 'a rise only follows a short gap').toBeLessThanOrEqual(
              CONFIG.minGap + 0.4 + 1e-9,
            );
          } else if (d < -1e-9) {
            drops++;
            expect(-d).toBeLessThanOrEqual(CONFIG.maxDrop + 1e-9);
          }
          if (['end', 'fork', 'hub', 'trampoline', 'entry', 'landing'].includes(p.role)) {
            // Junctions, trampolines and their neighbours stay level.
            expect(d, `${p.role}#${p.id}`).toBeCloseTo(0, 9);
          }
        }
        expect(rises).toBeGreaterThan(0);
        expect(drops).toBeGreaterThan(0);
      });

      it('side exits land on a building at the same height', () => {
        for (const e of snap.exits) {
          const p = snap.platforms.find((x) => x.id === e.platformId)!;
          const to = turnDir(e.fromDir, e.turn);
          const cx = (e.minX + e.maxX) / 2;
          const cz = (e.minZ + e.maxZ) / 2;
          const R = jumpDistance(CONFIG.startSpeed);
          const s = supportedBy(snap.platforms, cx + DIR_X[to]! * R, cz + DIR_Z[to]! * R);
          if (s) expect(s.top, `exit#${e.id}`).toBeCloseTo(p.top, 9);
        }
      });

      it('every obstacle building has at least one obstacle', () => {
        const withObstacle = new Set(snap.obstacles.map((o) => o.platformId));
        for (const p of snap.platforms.filter((x) => x.role === 'obstacle')) {
          expect(withObstacle.has(p.id), `obstacle building #${p.id} is empty`).toBe(true);
        }
      });

      it('obstacles leave room to land before them and after them', () => {
        for (const o of snap.obstacles) {
          const p = snap.platforms.find((x) => x.id === o.platformId)!;
          const c = runAlong(p.run, (o.minX + o.maxX) / 2, (o.minZ + o.maxZ) / 2);
          if (p.role === 'obstacle') {
            expect(c - p.a).toBeGreaterThanOrEqual(CONFIG.obstacleStartMargin - 1e-6);
            expect(p.b - c).toBeGreaterThanOrEqual(CONFIG.obstacleEndMargin - 1e-6);
            expect(['low', 'high', 'mid', 'vault']).toContain(o.kind);
          } else {
            expect(p.role).toBe('trampoline');
            expect(['wall', 'sideWall']).toContain(o.kind);
          }
        }
      });

      it('every exit window leads to a building from anywhere inside it', () => {
        for (const e of snap.exits) {
          const p = snap.platforms.find((x) => x.id === e.platformId)!;
          const to = turnDir(e.fromDir, e.turn);
          const a0 = runAlong(p.run, e.minX, e.minZ);
          const a1 = runAlong(p.run, e.maxX, e.maxZ);
          for (let t = 0; t <= 1; t += 0.25) {
            const along = Math.min(a0, a1) + Math.abs(a1 - a0) * t;
            const start = runPoint(p.run, along, 0);
            for (const v of [CONFIG.startSpeed, CONFIG.maxSpeed]) {
              const R = jumpDistance(v);
              let lx: number;
              let lz: number;
              if (e.kind === 'hop') {
                // Forward a jump's length, sideways one lane.
                lx = start.x + DIR_X[p.run.dir]! * R + DIR_X[to]! * CONFIG.laneOffset;
                lz = start.z + DIR_Z[p.run.dir]! * R + DIR_Z[to]! * CONFIG.laneOffset;
              } else {
                // Side leap: a jump's length that way. Mid-air steer: at least past the start.
                const d = e.kind === 'air' ? CONFIG.airEntryStart + 1 : R;
                lx = start.x + DIR_X[to]! * d;
                lz = start.z + DIR_Z[to]! * d;
              }
              const s = supportedBy(snap.platforms, lx, lz);
              expect(s, `${e.kind} exit#${e.id} t${t} v${v}`).toBeDefined();
              expect(s!.run.dir, 'lands on a building heading the right way').toBe(
                e.kind === 'hop' ? p.run.dir : to,
              );
            }
          }
        }
      });

      it('a trampoline side building is out of reach of any normal jump or side leap', () => {
        for (const t of snap.platforms.filter((p) => p.role === 'trampoline')) {
          for (let along = t.a + 0.5; along <= t.b; along += 1.5) {
            for (const v of [CONFIG.startSpeed, CONFIG.maxSpeed]) {
              const R = jumpDistance(v);
              for (const turn of ['left', 'right'] as const) {
                const to = turnDir(t.run.dir, turn);
                const o = runPoint(t.run, along, 0);
                expect(
                  supportedBy(snap.platforms, o.x + DIR_X[to]! * R, o.z + DIR_Z[to]! * R),
                  `side leap from trampoline#${t.id}`,
                ).toBeUndefined();
              }
              const f = runPoint(t.run, along + R, 0);
              if (along + R > t.b) {
                expect(
                  supportedBy(snap.platforms, f.x, f.z),
                  `forward jump from #${t.id}`,
                ).toBeUndefined();
              }
            }
          }
        }
      });

      it('dead ends have nothing straight ahead', () => {
        for (const p of snap.platforms.filter((x) =>
          ['end', 'hub', 'switch', 'trampoline'].includes(x.role),
        )) {
          const ahead = runPoint(p.run, p.b + 6, 0);
          const s = supportedBy(snap.platforms, ahead.x, ahead.z);
          // A hub continues straight on only for runners from the side branch (different heading).
          if (s) expect(s.run.dir).not.toBe(p.run.dir);
        }
      });

      it('spells are spread out', () => {
        const r = snap.spells.map((s) => s.route).sort((a, b) => a - b);
        for (let i = 1; i < r.length; i++)
          expect(r[i]! - r[i - 1]!).toBeGreaterThan(CONFIG.spellSpacing - 1);
      });
    });
  }

  describe('mechanics are introduced in stages', () => {
    const at = (p: Platform) => p.run.route + p.a;
    for (const seed of SEEDS) {
      it(`seed ${seed}: nothing appears before its stage`, () => {
        const snap = generate(seed, 2500);
        const byId = new Map(snap.platforms.map((p) => [p.id, p]));
        const first = (pred: (p: Platform) => boolean) =>
          Math.min(...snap.platforms.filter(pred).map(at));
        expect(first((p) => p.role === 'obstacle')).toBeGreaterThanOrEqual(
          CONFIG.intro.obstacles - 25,
        );
        expect(first((p) => p.role === 'trampoline')).toBeGreaterThan(CONFIG.intro.trampolines - 1);
        expect(first((p) => p.role === 'fork')).toBeGreaterThan(CONFIG.intro.forks - 1);
        for (const o of snap.obstacles) {
          const p = byId.get(o.platformId)!;
          const r = p.run.route + runAlong(p.run, (o.minX + o.maxX) / 2, (o.minZ + o.maxZ) / 2);
          if (o.kind === 'high') expect(r).toBeGreaterThanOrEqual(CONFIG.intro.slideBeams);
          if (o.kind === 'mid') expect(r).toBeGreaterThanOrEqual(CONFIG.intro.midBars);
        }
        for (const sp of snap.spells) expect(sp.route).toBeGreaterThan(CONFIG.spellMinRoute);
      });

      it(`seed ${seed}: the platforms after a trampoline or fork hub are obstacle-free`, () => {
        const snap = generate(seed, 2500);
        const sorted = [...snap.platforms].sort((a, b) => at(a) - at(b));
        let checked = 0;
        for (const big of sorted.filter((p) => p.role === 'trampoline' || p.role === 'hub')) {
          // The run that continues after it: next platforms by route on the main line.
          const after = sorted
            .filter((p) => at(p) > big.routeEnd && p.role !== 'entry')
            .slice(0, CONFIG.calmPlatforms - 1);
          for (const p of after) {
            if (at(p) - big.routeEnd > 60) break; // only the immediately following stretch
            expect(p.role, `#${p.id} after ${big.role}#${big.id}`).not.toBe('obstacle');
            checked++;
          }
        }
        expect(checked).toBeGreaterThan(0);
      });
    }
  });

  it('specials come often: spells, portals, trampolines and lane hops are never far apart', () => {
    // Regression guard on the measured spacing (30 seeds x 3 km at the time of writing: overall
    // average ~205 / 227 / 384 / 411 m, worst ~363 / 407 / 668 / 705 m). One seed's own average
    // varies more than the overall one, so the per-seed limits leave a margin.
    const limits = {
      spell: { first: 450, avg: 300, worst: 480 },
      portal: { first: 500, avg: 320, worst: 520 },
      trampoline: { first: 400, avg: 540, worst: 820 },
      hop: { first: 550, avg: 560, worst: 820 },
    };
    for (const seed of SEEDS) {
      const w = new World(seed);
      const at: Record<keyof typeof limits, Map<number, number>> = {
        spell: new Map(),
        portal: new Map(),
        trampoline: new Map(),
        hop: new Map(),
      };
      for (let r = 0; r < 3000; r += 5) {
        w.update(r);
        const routeOf = (id: number) => {
          const p = w.platforms.find((q) => q.id === id);
          return p ? p.run.route + p.a : undefined;
        };
        for (const x of w.spells) at.spell.set(x.id, routeOf(x.platformId) ?? at.spell.get(x.id)!);
        for (const x of w.portals)
          at.portal.set(x.id, routeOf(x.platformId) ?? at.portal.get(x.id)!);
        for (const p of w.platforms) {
          if (p.role === 'trampoline') at.trampoline.set(p.id, p.run.route + p.a);
          if (p.role === 'switch') at.hop.set(p.id, p.run.route + p.a);
        }
      }
      for (const k of Object.keys(limits) as (keyof typeof limits)[]) {
        const v = [...at[k].values()].sort((a, b) => a - b);
        expect(v[0], `${k} first (seed ${seed})`).toBeLessThan(limits[k].first);
        const gaps = v.slice(1).map((x, i) => x - v[i]!);
        expect(Math.max(...gaps), `${k} worst gap (seed ${seed})`).toBeLessThan(limits[k].worst);
        const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        expect(avg, `${k} average gap (seed ${seed})`).toBeLessThan(limits[k].avg);
      }
    }
  });

  it('recycles behind and keeps a bounded window ahead', () => {
    const w = new World(5);
    for (let p = 0; p < 4000; p += 3) {
      w.update(p);
      expect(w.frontierRoute).toBeGreaterThanOrEqual(p + CONFIG.lookAhead);
      for (const x of w.platforms)
        expect(x.routeEnd).toBeGreaterThanOrEqual(p - CONFIG.keepBehind - 6);
    }
  });

  it('trampolines and either-way bars appear across seeds', () => {
    expect(totals.trampolines).toBeGreaterThan(SEEDS.length);
    expect(totals.mid).toBeGreaterThan(SEEDS.length);
  });

  it('an empty world generates nothing', () => {
    const w = new World(1, { empty: true });
    w.update(500);
    expect(w.platforms).toEqual([]);
  });
});
