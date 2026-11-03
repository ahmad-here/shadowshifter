import type { Action, Phase } from './sim';

export type Gesture = 'left' | 'right' | 'jump' | 'slide';

/** High-level input, before it is mapped onto a sim action for the current phase. */
export type Intent =
  'left' | 'right' | 'jump' | 'slide' | 'primary' | 'togglePause' | 'restart' | 'menu';

export const SWIPE_THRESHOLD_PX = 30;

/** Map an intent onto the sim action it means in the current phase. */
export function intentToAction(intent: Intent, phase: Phase): Action | null {
  switch (intent) {
    case 'left':
    case 'right':
    case 'jump':
    case 'slide':
      return phase === 'playing' ? intent : null;
    case 'primary':
      if (phase === 'ready') return 'start';
      if (phase === 'paused') return 'resume';
      if (phase === 'gameover') return 'restart';
      if (phase === 'playing') return 'jump';
      return null;
    case 'togglePause':
      if (phase === 'playing') return 'pause';
      if (phase === 'paused') return 'resume';
      return null;
    case 'restart':
      return phase === 'paused' || phase === 'gameover' ? 'restart' : null;
    case 'menu':
      return phase === 'paused' || phase === 'gameover' ? 'menu' : null;
  }
}

/** Classify a drag by its dominant axis; null until it passes the threshold. */
export function classifySwipe(
  dx: number,
  dy: number,
  threshold = SWIPE_THRESHOLD_PX,
): Gesture | null {
  if (Math.hypot(dx, dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'jump' : 'slide';
}

const KEYMAP: Record<string, Intent> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  ArrowDown: 'slide',
  KeyS: 'slide',
  Space: 'primary',
  Enter: 'primary',
  Escape: 'togglePause',
  KeyP: 'togglePause',
};

export function keyToIntent(code: string): Intent | null {
  return KEYMAP[code] ?? null;
}

/**
 * Collects keyboard and swipe input into a queue drained once per frame.
 * A single swipe gesture fires at most one intent, however far it continues.
 */
export class InputController {
  private queue: Intent[] = [];
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private fired = false;

  constructor(private readonly target: Window) {
    target.addEventListener('keydown', this.onKey);
    target.addEventListener('pointerdown', this.onDown);
    target.addEventListener('pointermove', this.onMove);
    target.addEventListener('pointerup', this.onUp);
    target.addEventListener('pointercancel', this.onUp);
  }

  drain(): Intent[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKey);
    this.target.removeEventListener('pointerdown', this.onDown);
    this.target.removeEventListener('pointermove', this.onMove);
    this.target.removeEventListener('pointerup', this.onUp);
    this.target.removeEventListener('pointercancel', this.onUp);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    // Let focused buttons handle their own activation keys.
    if ((e.code === 'Space' || e.code === 'Enter') && isInteractive(e.target)) return;
    const intent = keyToIntent(e.code);
    if (!intent) return;
    e.preventDefault();
    this.queue.push(intent);
  };

  private onDown = (e: PointerEvent): void => {
    if (isInteractive(e.target)) return;
    this.pointerId = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.fired = false;
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId || this.fired) return;
    const g = classifySwipe(e.clientX - this.startX, e.clientY - this.startY);
    if (!g) return;
    this.fired = true;
    this.queue.push(g);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) this.pointerId = null;
  };
}

function isInteractive(target: EventTarget | null): boolean {
  return (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    target.closest('button, a, input, select, textarea') !== null
  );
}
