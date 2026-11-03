/**
 * Debug hooks (`?seed=`, `?autopilot`, `window.__shadowShift`) exist only in development and in
 * the e2e test build. Production builds compile them out, so players cannot use them to cheat.
 */
export const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

export interface DebugOptions {
  seed?: number;
  autopilot: boolean;
}

export function debugOptions(): DebugOptions {
  if (!DEBUG) return { autopilot: false };
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed');
  return {
    seed: seed !== null && /^\d+$/.test(seed) ? Number(seed) : undefined,
    autopilot: params.has('autopilot'),
  };
}
