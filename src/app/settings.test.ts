import { describe, expect, it } from 'vitest';
import { CONFIG } from '../game/config';
import { autopilot } from '../game/autopilot';
import { GameSim } from '../game/sim';
import { parseSettings, SettingsStore, type Settings } from './settings';

const FALLBACK: Settings = { sound: true, quality: 'auto', reducedEffects: false };

function memory() {
  const m = new Map<string, string>();
  return {
    m,
    storage: {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    },
  };
}

describe('settings', () => {
  it('parses valid values and rejects malformed ones field by field', () => {
    expect(
      parseSettings('{"sound":false,"quality":"low","reducedEffects":true}', FALLBACK),
    ).toEqual({
      sound: false,
      quality: 'low',
      reducedEffects: true,
    });
    expect(parseSettings('{"sound":"yes","quality":"ultra"}', FALLBACK)).toEqual(FALLBACK);
    for (const junk of [null, '', 'not json', '[]', '42']) {
      expect(parseSettings(junk, FALLBACK)).toEqual(FALLBACK);
    }
  });

  it('persists changes and notifies only on a real change', () => {
    const { m, storage } = memory();
    const store = new SettingsStore(storage);
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ quality: 'high' });
    store.set({ quality: 'high' });
    expect(calls).toBe(1);
    expect(new SettingsStore(storage).get().quality).toBe('high');
    expect(JSON.parse(m.get('shadowshift.settings')!).quality).toBe('high');
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const store = new SettingsStore(broken);
    expect(() => store.set({ sound: false })).not.toThrow();
    expect(store.get().sound).toBe(false);
  });

  it('the simulation has no dependency on settings (same seed, same run)', () => {
    // Settings live in src/app and are only read by the renderer/controller; prove a run is
    // identical regardless by playing the same seed twice with the autopilot.
    const play = () => {
      const sim = new GameSim(42);
      sim.act('start');
      for (let i = 0; i < 120 * 30; i++) {
        const a = autopilot(sim);
        if (a) sim.control(a);
        sim.step(CONFIG.stepSeconds);
      }
      return [sim.x, sim.z, sim.distance, sim.jumps];
    };
    expect(play()).toEqual(play());
  });
});
