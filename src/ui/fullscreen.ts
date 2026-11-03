import { useEffect, useState } from 'react';

/** True where the page itself can go full screen (not iPhone Safari, for example). */
export function fullscreenSupported(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenEnabled;
}

export function isFullscreen(): boolean {
  return typeof document !== 'undefined' && document.fullscreenElement !== null;
}

/** Toggle full screen. Must be called from a click or key press (browsers require a gesture). */
export async function toggleFullscreen(): Promise<void> {
  try {
    if (isFullscreen()) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    // Refused (no gesture, iframe policy...): the game just stays windowed.
  }
}

/** Current full-screen state, updated when the browser enters or leaves it (including Esc). */
export function useFullscreen(): boolean {
  const [on, setOn] = useState(isFullscreen());
  useEffect(() => {
    const onChange = () => setOn(isFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    // Re-read now: the state may have changed between the first render and subscribing (e.g. the
    // HUD button mounting just as the game goes full screen).
    onChange();
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  return on;
}

/** The F key toggles full screen on every screen (menus and gameplay). */
export function useFullscreenKey(): void {
  useEffect(() => {
    if (!fullscreenSupported()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      void toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
