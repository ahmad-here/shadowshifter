import { fullscreenSupported, toggleFullscreen, useFullscreen } from './fullscreen';

/** Full-screen toggle button. Hidden where the browser can't do it. */
export function FullscreenButton() {
  const on = useFullscreen();
  if (!fullscreenSupported()) return null;
  return (
    <button
      className="btn icon"
      aria-label={on ? 'Exit full screen' : 'Full screen'}
      title={on ? 'Exit full screen (F)' : 'Full screen (F)'}
      data-testid="fullscreen-btn"
      onClick={() => void toggleFullscreen()}
    >
      {on ? '⤡' : '⤢'}
    </button>
  );
}
