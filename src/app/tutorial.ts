import { HINTS, nextHint, type HintKind } from '../game/hints';
import type { GameSim } from '../game/sim';

const KEY = 'shadowshift.tutorial';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

interface Counters {
  jumps: number;
  sideJumps: number;
  bounces: number;
  spells: number;
  wallRuns: number;
  portals: number;
  sliding: boolean;
}

/**
 * First-run tips. A tip is shown just before the player first meets a mechanic and is marked
 * learned once the sim shows they did the move, or once they get past it alive. Dying on it
 * shows it again next run. Learned tips are persisted so they appear only once.
 */
export class Tutorial {
  private seen = new Set<HintKind>();
  private current: HintKind | null = null;
  private start: Counters | null = null;

  constructor(private readonly storage: Storage | null = safeStorage()) {
    try {
      const list = JSON.parse(storage?.getItem(KEY) ?? '[]') as unknown;
      if (Array.isArray(list)) {
        for (const k of list) if (HINTS.includes(k as HintKind)) this.seen.add(k as HintKind);
      }
    } catch {
      // Corrupt storage: start the tutorial fresh.
    }
  }

  get done(): boolean {
    return this.seen.size === HINTS.length;
  }

  /** The tip to show this frame, or null. */
  update(sim: GameSim): HintKind | null {
    if (this.current && this.start && learned(this.current, this.start, counters(sim))) {
      this.learn(this.current);
    }
    const next = sim.phase === 'playing' ? nextHint(sim, this.seen) : null;
    if (next !== this.current) {
      // Moving on to something else while still alive means this one was handled.
      if (this.current && sim.phase === 'playing') this.learn(this.current);
      this.current = next && !this.seen.has(next) ? next : null;
      this.start = this.current ? counters(sim) : null;
    }
    return this.current;
  }

  reset(): void {
    this.seen.clear();
    this.current = null;
    this.persist();
  }

  private learn(kind: HintKind): void {
    this.seen.add(kind);
    if (this.current === kind) this.current = null;
    this.persist();
  }

  private persist(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify([...this.seen]));
    } catch {
      // Storage unavailable: tips repeat next session.
    }
  }
}

function counters(sim: GameSim): Counters {
  return {
    jumps: sim.jumps,
    sideJumps: sim.sideJumps,
    bounces: sim.bounces,
    spells: sim.spellsTaken,
    wallRuns: sim.wallRuns,
    portals: sim.portalsTaken,
    sliding: sim.sliding,
  };
}

function learned(kind: HintKind, a: Counters, b: Counters): boolean {
  switch (kind) {
    case 'jump':
    case 'barrier':
      return b.jumps > a.jumps;
    case 'slide':
      return b.sliding && !a.sliding;
    case 'either':
      return b.jumps > a.jumps || (b.sliding && !a.sliding);
    case 'leftLeap':
    case 'rightLeap':
    case 'leftHop':
    case 'rightHop':
      return b.sideJumps > a.sideJumps;
    case 'trampoline':
      // Learned once they bounced and steered, not merely bounced.
      return b.bounces > a.bounces && b.sideJumps > a.sideJumps;
    case 'spell':
      return b.spells > a.spells;
    case 'portal':
      return b.portals > a.portals;
    case 'leftWall':
    case 'rightWall':
      return b.wallRuns > a.wallRuns;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
