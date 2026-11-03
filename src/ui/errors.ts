type Listener = (message: string) => void;

const listeners = new Set<Listener>();
let firstError: string | null = null;

/** Surface a fatal error to the player and the console. The first error wins. */
export function reportError(message: string): void {
  console.error('[shadow-shift]', message);
  if (firstError) return;
  firstError = message;
  listeners.forEach((l) => l(message));
}

export function subscribeErrors(l: Listener): () => void {
  listeners.add(l);
  if (firstError) l(firstError);
  return () => listeners.delete(l);
}

export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (e) => reportError(e.message || String(e.error)));
  window.addEventListener('unhandledrejection', (e) => reportError(String(e.reason)));
}
