import { describe, expect, it } from 'vitest';
import { classifySwipe, InputController, intentToAction, keyToIntent, type Intent } from './input';
import type { Phase } from './sim';

describe('classifySwipe', () => {
  it('ignores small movements', () => {
    expect(classifySwipe(0, 0)).toBeNull();
    expect(classifySwipe(20, 20)).toBeNull();
    expect(classifySwipe(-29, 0)).toBeNull();
  });

  it('uses the dominant axis', () => {
    expect(classifySwipe(-40, 5)).toBe('left');
    expect(classifySwipe(40, -30)).toBe('right');
    expect(classifySwipe(10, -40)).toBe('jump');
    expect(classifySwipe(-10, 40)).toBe('slide');
  });
});

describe('keyToIntent', () => {
  it('maps the documented keys', () => {
    expect(keyToIntent('ArrowLeft')).toBe('left');
    expect(keyToIntent('KeyA')).toBe('left');
    expect(keyToIntent('ArrowRight')).toBe('right');
    expect(keyToIntent('KeyD')).toBe('right');
    expect(keyToIntent('ArrowUp')).toBe('jump');
    expect(keyToIntent('KeyW')).toBe('jump');
    expect(keyToIntent('ArrowDown')).toBe('slide');
    expect(keyToIntent('KeyS')).toBe('slide');
    expect(keyToIntent('Space')).toBe('primary');
    expect(keyToIntent('Enter')).toBe('primary');
    expect(keyToIntent('Escape')).toBe('togglePause');
    expect(keyToIntent('KeyP')).toBe('togglePause');
    expect(keyToIntent('KeyZ')).toBeNull();
  });
});

describe('intentToAction', () => {
  const table: [Intent, Phase, string | null][] = [
    ['left', 'playing', 'left'],
    ['left', 'ready', null],
    ['left', 'paused', null],
    ['jump', 'dying', null],
    ['slide', 'playing', 'slide'],
    ['slide', 'paused', null],
    ['primary', 'ready', 'start'],
    ['primary', 'playing', 'jump'],
    ['primary', 'paused', 'resume'],
    ['primary', 'dying', null],
    ['primary', 'gameover', 'restart'],
    ['togglePause', 'playing', 'pause'],
    ['togglePause', 'paused', 'resume'],
    ['togglePause', 'ready', null],
    ['togglePause', 'gameover', null],
    ['restart', 'paused', 'restart'],
    ['restart', 'gameover', 'restart'],
    ['restart', 'playing', null],
    ['restart', 'ready', null],
    ['menu', 'paused', 'menu'],
    ['menu', 'gameover', 'menu'],
    ['menu', 'playing', null],
    ['menu', 'ready', null],
  ];
  it.each(table)('%s in %s -> %s', (intent, phase, expected) => {
    expect(intentToAction(intent, phase)).toBe(expected);
  });
});

/** Minimal stand-in for window that dispatches synthetic events to the controller. */
function fakeWindow() {
  const target = new EventTarget();
  const fire = (type: string, props: Record<string, unknown>) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, props);
    target.dispatchEvent(e);
    return e;
  };
  return { win: target as unknown as Window, fire };
}

describe('InputController', () => {
  it('queues keys once and ignores auto-repeat and modifiers', () => {
    const { win, fire } = fakeWindow();
    const input = new InputController(win);
    const e = fire('keydown', { code: 'ArrowLeft' });
    expect(e.defaultPrevented).toBe(true);
    fire('keydown', { code: 'ArrowLeft', repeat: true });
    fire('keydown', { code: 'KeyA', ctrlKey: true });
    fire('keydown', { code: 'KeyQ' });
    expect(input.drain()).toEqual(['left']);
    expect(input.drain()).toEqual([]);
    input.dispose();
  });

  it('one swipe fires exactly one intent no matter how far it continues', () => {
    const { win, fire } = fakeWindow();
    const input = new InputController(win);
    fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    fire('pointermove', { pointerId: 1, clientX: 90, clientY: 100 });
    expect(input.drain()).toEqual([]);
    fire('pointermove', { pointerId: 1, clientX: 50, clientY: 100 });
    fire('pointermove', { pointerId: 1, clientX: 0, clientY: 100 });
    fire('pointermove', { pointerId: 1, clientX: 0, clientY: 0 });
    fire('pointerup', { pointerId: 1 });
    expect(input.drain()).toEqual(['left']);

    fire('pointerdown', { pointerId: 2, clientX: 100, clientY: 100 });
    fire('pointermove', { pointerId: 2, clientX: 105, clientY: 40 });
    fire('pointerup', { pointerId: 2 });
    fire('pointermove', { pointerId: 2, clientX: 300, clientY: 40 });
    expect(input.drain()).toEqual(['jump']);
    input.dispose();
  });

  it('swipe down slides; moves from other pointers are ignored', () => {
    const { win, fire } = fakeWindow();
    const input = new InputController(win);
    fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    fire('pointermove', { pointerId: 7, clientX: 200, clientY: 0 });
    expect(input.drain()).toEqual([]);
    fire('pointermove', { pointerId: 1, clientX: 0, clientY: 100 });
    expect(input.drain()).toEqual(['slide']);
    input.dispose();
  });

  it('a cancelled pointer stops producing input', () => {
    const { win, fire } = fakeWindow();
    const input = new InputController(win);
    fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    fire('pointercancel', { pointerId: 1 });
    fire('pointermove', { pointerId: 1, clientX: 100, clientY: 0 });
    expect(input.drain()).toEqual([]);
    input.dispose();
  });

  it('stops listening after dispose', () => {
    const { win, fire } = fakeWindow();
    const input = new InputController(win);
    input.dispose();
    fire('keydown', { code: 'ArrowLeft' });
    expect(input.drain()).toEqual([]);
  });
});
