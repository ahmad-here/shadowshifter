export type QualitySetting = 'auto' | 'low' | 'medium' | 'high';
export type QualityProfile = Exclude<QualitySetting, 'auto'>;

export interface Settings {
  sound: boolean;
  quality: QualitySetting;
  /** No flicker, pulsing or screen-filling motion. Defaults to the OS reduced-motion preference. */
  reducedEffects: boolean;
}

const KEY = 'shadowshift.settings';
const QUALITIES: readonly QualitySetting[] = ['auto', 'low', 'medium', 'high'];

export function defaultSettings(): Settings {
  let reduced = false;
  try {
    reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    // matchMedia unavailable: keep the default.
  }
  return { sound: true, quality: 'auto', reducedEffects: reduced };
}

/** Parse stored settings defensively: anything malformed falls back to the default. */
export function parseSettings(raw: string | null, fallback: Settings): Settings {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    return {
      sound: typeof v.sound === 'boolean' ? v.sound : fallback.sound,
      quality: QUALITIES.includes(v.quality as QualitySetting)
        ? (v.quality as QualitySetting)
        : fallback.quality,
      reducedEffects:
        typeof v.reducedEffects === 'boolean' ? v.reducedEffects : fallback.reducedEffects,
    };
  } catch {
    return fallback;
  }
}

type Listener = () => void;

/** Persisted player settings with change notification. Presentation only; never touches the sim. */
export class SettingsStore {
  private value: Settings;
  private listeners = new Set<Listener>();

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage(),
  ) {
    let raw: string | null;
    try {
      raw = storage?.getItem(KEY) ?? null;
    } catch {
      raw = null;
    }
    this.value = parseSettings(raw, defaultSettings());
  }

  get = (): Settings => this.value;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  set(patch: Partial<Settings>): void {
    const next = { ...this.value, ...patch };
    if (JSON.stringify(next) === JSON.stringify(this.value)) return;
    this.value = next;
    try {
      this.storage?.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: settings last for this session only.
    }
    this.listeners.forEach((l) => l());
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
