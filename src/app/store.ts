import type { HintKind } from '../game/hints';
import type { DeathCause, Effect, Phase } from '../game/sim';

/** The only game data React sees. Updated at most ~10x/second, never per frame. */
export interface UiSnapshot {
  phase: Phase;
  score: number;
  best: number;
  /** The run that just ended beat the previous best. */
  newBest: boolean;
  cause: DeathCause | null;
  effect: Effect;
  /** Whole seconds left in the current effect. */
  effectLeft: number;
  /** Whole seconds of mirror mode left (0 = off). */
  mirrorLeft: number;
  /** Non-fatal message, e.g. the device paused graphics. */
  notice: string | null;
  /** First-run tip for the mechanic just ahead. */
  hint: HintKind | null;
  /** Shards this run, and collected across all runs. */
  shards: number;
  totalShards: number;
  error: string | null;
}

export function initialSnapshot(best = 0): UiSnapshot {
  return {
    phase: 'ready',
    score: 0,
    best,
    newBest: false,
    cause: null,
    effect: 'none',
    effectLeft: 0,
    mirrorLeft: 0,
    notice: null,
    hint: null,
    shards: 0,
    totalShards: loadTotalShards(),
    error: null,
  };
}

type Listener = () => void;

export class UiStore {
  private snap: UiSnapshot;
  private listeners = new Set<Listener>();

  constructor(initial: UiSnapshot) {
    this.snap = initial;
  }

  get = (): UiSnapshot => this.snap;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  /** Shallow-merge; listeners only fire when something actually changed. */
  set(patch: Partial<UiSnapshot>): void {
    let changed = false;
    for (const k of Object.keys(patch) as (keyof UiSnapshot)[]) {
      if (this.snap[k] !== patch[k]) changed = true;
    }
    if (!changed) return;
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }
}

const BEST_KEY = 'shadowshift.best';
const SALT = 'ss-neon-7f3a';

/** Cheap checksum so a best score hand-edited in storage is rejected. A deterrent, not security. */
function sign(v: number): string {
  let h = 2166136261;
  for (const c of `${v}:${SALT}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}

export function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return 0;
    const [value, mac] = raw.split('.');
    const v = Number(value);
    if (!Number.isInteger(v) || v <= 0 || v > 1e7 || mac !== sign(v)) return 0;
    return v;
  } catch {
    return 0;
  }
}

export function saveBest(v: number): void {
  try {
    localStorage.setItem(BEST_KEY, `${v}.${sign(v)}`);
  } catch {
    // Storage unavailable (private mode); best score is just not persisted.
  }
}

const SHARDS_KEY = 'shadowshift.shards';

/** Lifetime shard total (a replay hook). Signed like the best score. */
export function loadTotalShards(): number {
  try {
    const raw = localStorage.getItem(SHARDS_KEY);
    if (!raw) return 0;
    const [value, mac] = raw.split('.');
    const v = Number(value);
    return Number.isInteger(v) && v > 0 && v < 1e9 && mac === sign(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function saveTotalShards(v: number): void {
  try {
    localStorage.setItem(SHARDS_KEY, `${v}.${sign(v)}`);
  } catch {
    // Storage unavailable: the total lasts for this session only.
  }
}
