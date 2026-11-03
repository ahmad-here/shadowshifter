import { describe, expect, it } from 'vitest';
import { ADAPTIVE_DEFAULTS, AdaptiveQuality, initialProfile } from './AdaptiveQuality';

/** Feed `seconds` worth of frames of length `dt`; return every profile change. */
function feed(q: AdaptiveQuality, dt: number, seconds: number): string[] {
  const changes: string[] = [];
  for (let t = 0; t < seconds; t += dt) {
    const c = q.sample(dt);
    if (c) changes.push(c);
  }
  return changes;
}

describe('AdaptiveQuality', () => {
  it('holds steady at a smooth 60 fps', () => {
    const q = new AdaptiveQuality('high');
    expect(feed(q, 1 / 60, 30)).toEqual([]);
    expect(q.profile).toBe('high');
  });

  it('steps down one level at a time under sustained load, with a cooldown between steps', () => {
    const q = new AdaptiveQuality('high');
    const changes = feed(q, 1 / 30, 3.6); // 2 s cooldown + 90 slow frames (3 s) not yet full
    expect(changes).toEqual([]);
    const more = feed(q, 1 / 30, 20);
    expect(more).toEqual(['medium', 'low']);
    expect(q.profile).toBe('low');
  });

  it('ignores a single hitch (90th percentile, not max)', () => {
    const q = new AdaptiveQuality('high');
    for (let i = 0; i < 2000; i++) expect(q.sample(i % 100 === 0 ? 0.2 : 1 / 60)).toBeNull();
  });

  it('ignores tab-switch sized gaps and invalid frame times', () => {
    const q = new AdaptiveQuality('high');
    for (const dt of [0, -1, NaN, 2, 30]) expect(q.sample(dt)).toBeNull();
    expect(q.profile).toBe('high');
  });

  it('climbs back after sustained headroom, but never above the starting level', () => {
    const q = new AdaptiveQuality('medium');
    expect(feed(q, 1 / 30, 10)).toEqual(['low']);
    const up = feed(q, 1 / 60, 30);
    expect(up).toEqual(['medium']);
    expect(feed(q, 1 / 60, 60)).toEqual([]); // ceiling is the starting level
  });

  it('stops oscillating: after repeated reversals it stays on the lower level', () => {
    const q = new AdaptiveQuality('high');
    const all: string[] = [];
    for (let cycle = 0; cycle < 6; cycle++) {
      all.push(...feed(q, 1 / 30, 6), ...feed(q, 1 / 60, ADAPTIVE_DEFAULTS.upAfter + 6));
    }
    const ups = all.filter((c, i) => i > 0 && c === 'high').length;
    expect(ups).toBeLessThanOrEqual(ADAPTIVE_DEFAULTS.maxReversals);
    expect(all.length).toBeLessThan(12);
  });

  it('hold() discards measurements (e.g. paused)', () => {
    const q = new AdaptiveQuality('high');
    feed(q, 1 / 30, 4.5); // window almost full of slow frames
    q.hold();
    expect(feed(q, 1 / 60, 10)).toEqual([]);
  });

  it('initial estimate: phones start lower than desktops', () => {
    expect(initialProfile({ hardwareConcurrency: 4 }, true)).toBe('low');
    expect(initialProfile({ hardwareConcurrency: 8 }, true)).toBe('medium');
    expect(initialProfile({ hardwareConcurrency: 8 }, false)).toBe('high');
    expect(initialProfile({}, false)).toBe('high');
  });
});
