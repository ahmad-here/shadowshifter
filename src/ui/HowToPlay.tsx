import { useEffect, useRef } from 'react';

interface Card {
  icon: string;
  title: string;
  text: string;
  keys?: string;
  touch?: string;
}

const CARDS: Card[] = [
  {
    icon: 'jump',
    title: 'Jump the gaps',
    text: 'Buildings float apart. Jump just before the edge.',
    keys: '↑ W Space',
    touch: 'Swipe up',
  },
  {
    icon: 'slide',
    title: 'Slide under',
    text: 'Cyan beams are too high to jump. Slide under them.',
    keys: '↓ S',
    touch: 'Swipe down',
  },
  {
    icon: 'leap',
    title: 'Leap sideways',
    text: 'At a dead end, leap onto the building beside you. The arrow shows which way.',
    keys: '← → A D',
    touch: 'Swipe left / right',
  },
  {
    icon: 'leap',
    title: 'Wall-run',
    text: 'A gap too long to jump with a wall beside it: jump, then step toward the wall to run along it.',
    keys: 'Jump, then ← / →',
    touch: 'Swipe up, then sideways',
  },
  {
    icon: 'colors',
    title: 'Read the colours',
    text: 'Red: jump. Cyan: slide. Amber: either works.',
  },
  {
    icon: 'hop',
    title: 'Hop lanes',
    text: 'When your lane ends beside a parallel one, hop across and keep running.',
    keys: '← → A D',
    touch: 'Swipe left / right',
  },
  {
    icon: 'pad',
    title: 'Trampolines',
    text: 'Nothing ahead? Bounce on the glowing pad, then steer left or right in mid-air onto the side building.',
  },
  {
    icon: 'shadow',
    title: 'Black portal',
    text: 'Running through it brings 8 s of darkness. Follow the glowing edges of the route.',
  },
  {
    icon: 'mirror',
    title: 'Mirror portal',
    text: 'For 10 s you run backwards and every control is reversed.',
  },
  {
    icon: 'pause',
    title: 'Pause',
    text: 'The game also pauses itself when you switch apps.',
    keys: 'Esc P',
    touch: 'Pause button',
  },
];

/** Line glyphs drawn inside each card icon (24x24, stroked in the icon's colour). */
const GLYPHS: Record<string, string> = {
  jump: 'M4 19h5M15 19h5M12 15V5M8 9l4-4 4 4',
  slide: 'M4 6h16M12 10v9M8 15l4 4 4-4',
  leap: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
  hop: 'M7 4v16M17 4v16M7 14c3-5 7-5 10 0M14 11l3 3 1-4',
  pad: 'M5 20h14M12 17C8 10 8 6 12 4c4 2 4 6 0 13',
  shadow: 'M3 15h18M6 15c0 4 12 4 12 0M10 11c-1-2 1-3 0-5M14 11c-1-2 1-3 0-5',
  mirror: 'M5 9a7 7 0 0 1 13-2M19 15a7 7 0 0 1-13 2M18 3v4h-4M6 21v-4h4',
  pause: 'M9 6v12M15 6v12',
};

/** Modal guide to every mechanic. Esc or the close button dismisses it. */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="howto-title"
      data-testid="howto"
    >
      <div className="modal-card howto">
        <div className="modal-head">
          <h2 id="howto-title">How to play</h2>
          <button
            ref={closeRef}
            className="btn icon"
            aria-label="Close"
            onClick={onClose}
            data-testid="howto-close"
          >
            ✕
          </button>
        </div>
        <ul className="cards">
          {CARDS.map((c) => (
            <li key={c.title} className="card">
              <span className={`card-icon ${c.icon}`} aria-hidden="true">
                {GLYPHS[c.icon] && (
                  <svg viewBox="0 0 24 24">
                    <path d={GLYPHS[c.icon]} />
                  </svg>
                )}
              </span>
              <div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
                {(c.keys || c.touch) && (
                  <p className="controls">
                    {c.keys && <span className="kbd">{c.keys}</span>}
                    {c.touch && <span className="touch">{c.touch}</span>}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="howto-foot">
          <button className="btn primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
