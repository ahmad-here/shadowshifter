import { describe, expect, it } from 'vitest';
import { initialSnapshot, loadBest, saveBest, UiStore } from '../app/store';
import { FixedStepper } from './stepper';

describe('FixedStepper', () => {
  it('runs whole steps and carries the remainder', () => {
    const s = new FixedStepper(0.01, 0.25);
    expect(s.advance(0.025, () => {})).toBe(2);
    expect(s.alpha).toBeCloseTo(0.5);
    expect(s.advance(0.005, () => {})).toBe(1);
    expect(s.alpha).toBeCloseTo(0, 5);
  });

  it('runs exactly 2 steps per 1/60 frame at 120 Hz despite float error', () => {
    const s = new FixedStepper(1 / 120, 0.25);
    let total = 0;
    for (let i = 0; i < 600; i++) total += s.advance(1 / 60, () => {});
    expect(total).toBe(1200);
  });

  it('clamps long frames to avoid a spiral of death', () => {
    const s = new FixedStepper(0.01, 0.25);
    expect(s.advance(10, () => {})).toBe(25);
  });

  it('ignores zero, negative and NaN frame times', () => {
    const s = new FixedStepper(0.01, 0.25);
    expect(s.advance(0, () => {})).toBe(0);
    expect(s.advance(-1, () => {})).toBe(0);
    expect(s.advance(NaN, () => {})).toBe(0);
    expect(s.alpha).toBe(0);
  });

  it('reset drops accumulated time', () => {
    const s = new FixedStepper(0.01, 0.25);
    s.advance(0.009, () => {});
    s.reset();
    expect(s.advance(0.002, () => {})).toBe(0);
  });
});

describe('UiStore', () => {
  it('only notifies on real changes', () => {
    const store = new UiStore(initialSnapshot());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.set({ score: 0 });
    expect(calls).toBe(0);
    const before = store.get();
    store.set({ score: 5 });
    expect(calls).toBe(1);
    expect(store.get()).not.toBe(before);
    expect(store.get().score).toBe(5);
    off();
    store.set({ score: 6 });
    expect(calls).toBe(1);
  });
});

describe('best score storage', () => {
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
  } as Storage;

  it('round-trips a saved best', () => {
    saveBest(1234);
    expect(loadBest()).toBe(1234);
  });

  it('rejects a hand-edited or garbage value', () => {
    saveBest(500);
    const raw = mem.get('shadowshift.best')!;
    mem.set('shadowshift.best', raw.replace('500', '999999'));
    expect(loadBest()).toBe(0);
    for (const junk of ['abc', '-5.x', '1e9.1', '', '12']) {
      mem.set('shadowshift.best', junk);
      expect(loadBest()).toBe(0);
    }
  });
});
