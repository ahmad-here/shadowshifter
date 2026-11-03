import type { HintKind } from '../game/hints';

const TOUCH =
  typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);

/** [touch wording, keyboard wording] per tip. Short enough to read at a glance. */
const TEXT: Record<HintKind, [string, string]> = {
  jump: ['Swipe up to jump the gap', 'Press ↑ or Space to jump the gap'],
  barrier: ['Swipe up to jump the red barrier', 'Press ↑ to jump the red barrier'],
  slide: ['Swipe down to slide under the cyan beam', 'Press ↓ to slide under the cyan beam'],
  either: ['Amber bar: jump or slide', 'Amber bar: ↑ jump or ↓ slide'],
  leftLeap: ['Dead end! Swipe left to leap across', 'Dead end! Press ← to leap across'],
  rightLeap: ['Dead end! Swipe right to leap across', 'Dead end! Press → to leap across'],
  trampoline: [
    'Bounce on the pad, then swipe ← or → in the air',
    'Bounce on the pad, then press ← or → in the air',
  ],
  leftHop: ['Lane ends! Swipe left to hop across', 'Lane ends! Press ← to hop across'],
  rightHop: ['Lane ends! Swipe right to hop across', 'Lane ends! Press → to hop across'],
  spell: [
    'Black portal: 8 s of darkness, watch the neon edges',
    'Black portal: 8 s of darkness, watch the neon edges',
  ],
  leftWall: ['Wall! Jump, then swipe left onto it', 'Wall! Jump, then press ← onto it'],
  rightWall: ['Wall! Jump, then swipe right onto it', 'Wall! Jump, then press → onto it'],
  portal: ['Mirror portal: controls reverse for 10 s', 'Mirror portal: controls reverse for 10 s'],
};

/** First-run tip, shown low on screen so it never covers the route ahead. */
export function HintPill({ hint }: { hint: HintKind }) {
  return (
    <div className="hint" role="status" data-testid="hint">
      {TEXT[hint][TOUCH ? 0 : 1]}
    </div>
  );
}
