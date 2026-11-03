import { expect, test, type Page } from '@playwright/test';

interface DebugState {
  phase: string;
  score: number;
  seed: number;
  x: number;
  y: number;
  z: number;
  dir: number;
  grounded: boolean;
  sliding: boolean;
  speed: number;
  jumps: number;
  sideJumps: number;
  bounces: number;
  effect: string;
  cause: string | null;
  role: string | null;
  worldPlatforms: number;
  fps: number;
  mirror: number;
  render: { platforms: number; obstacles: number; calls: number };
  /** Meshes that do not match their physics; must always be empty. */
  mismatches: string[];
  audio: { state: string; played: number };
  quality: 'low' | 'medium' | 'high';
  character: 'model' | 'placeholder';
  skinned: number;
}

const state = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __shadowShift: { state(): DebugState } }).__shadowShift.state(),
  );

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function open(page: Page, query = '?seed=1') {
  await page.goto('/' + query);
  await expect(page.getByTestId('ready')).toBeVisible();
  await page.waitForFunction(() => '__shadowShift' in window);
}

/**
 * Dispatch a whole swipe as real PointerEvents in one round trip. Driving it through
 * page.mouse takes >1s per swipe under headless software WebGL, longer than a turn window.
 */
async function swipe(page: Page, dx: number, dy: number) {
  await page.evaluate(
    ([dx, dy]) => {
      const canvas = document.querySelector('canvas')!;
      const x = innerWidth / 2;
      const y = innerHeight / 2;
      const ev = (type: string, cx: number, cy: number) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 5,
            clientX: cx,
            clientY: cy,
            bubbles: true,
            pointerType: 'touch',
          }),
        );
      ev('pointerdown', x, y);
      ev('pointermove', x + dx! / 2, y + dy! / 2);
      ev('pointermove', x + dx!, y + dy!);
      ev('pointerup', x + dx!, y + dy!);
    },
    [dx, dy],
  );
}

test('boots without errors and renders the scene', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await expect(page.locator('h1')).toContainText(/shadow/i);
  const st = await state(page);
  expect(st.phase).toBe('ready');
  expect(st.render.platforms).toBeGreaterThan(3);
  expect(st.render.calls).toBeGreaterThan(5);
  // Canvas fills the viewport at device resolution.
  const size = await page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    return {
      w: c.width,
      h: c.height,
      cw: c.clientWidth,
      ch: c.clientHeight,
      dpr: devicePixelRatio,
    };
  });
  expect(size.cw).toBe(page.viewportSize()!.width);
  // The pixel ratio is capped by the active graphics profile (low 1, medium 1.5, high 2).
  const cap = { low: 1, medium: 1.5, high: 2 }[st.quality];
  expect(size.w).toBe(Math.floor(size.cw * Math.min(size.dpr, cap)));
  // Something other than background colour was drawn.
  const shot = await page.getByTestId('canvas').screenshot();
  expect(shot.length).toBeGreaterThan(5000);
  expect(errors).toEqual([]);
});

test('start, score grows, pause freezes, resume continues', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.getByTestId('start-btn').click();
  await expect(page.getByTestId('score')).toBeVisible();
  await expect.poll(async () => (await state(page)).score).toBeGreaterThan(5);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('paused')).toBeVisible();
  const frozen = await state(page);
  await page.waitForTimeout(500);
  const later = await state(page);
  expect(later.z).toBe(frozen.z);
  expect(later.phase).toBe('paused');

  await page.keyboard.press('Space');
  await expect(page.getByTestId('paused')).toBeHidden();
  await expect.poll(async () => (await state(page)).z).toBeLessThan(frozen.z);

  await page.getByTestId('pause-btn').click();
  await expect(page.getByTestId('paused')).toBeVisible();
  await page.getByTestId('resume-btn').click();
  await expect.poll(async () => (await state(page)).phase).toBe('playing');
  expect(errors).toEqual([]);
});

test('missing a turn ends the run; restart works without reloading', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 42));
  await page.keyboard.press('Space');
  await expect(page.getByTestId('gameover')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('gameover')).toContainText(/You fell|You crashed/);
  const over = await state(page);
  expect(over.phase).toBe('gameover');
  await expect(page.getByTestId('final-score')).toHaveText(`${over.score} m`);

  await page.getByTestId('again-btn').click();
  await expect(page.getByTestId('gameover')).toBeHidden();
  const st = await state(page);
  expect(st.phase).toBe('playing');
  expect(st.role).toBe('start');
  expect(st.jumps).toBe(0);
  expect(st.score).toBeLessThan(15);
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(42);
  expect(errors).toEqual([]);
});

test('keyboard: jump, slide and side leap all register', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, '?seed=1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await state(page)).jumps).toBe(1);
  await expect.poll(async () => (await state(page)).grounded).toBe(true);
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await state(page)).sliding).toBe(true);
  // A side leap from the long start building with nothing there drops into the void.
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await state(page)).dir).toBe(3);
  await expect(page.getByTestId('gameover')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('gameover')).toContainText('You fell');
  expect(errors).toEqual([]);
});

test('swipe gestures jump, slide and leap sideways', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, '?seed=1');
  await page.getByTestId('start-btn').click();
  await swipe(page, 0, -80);
  await expect.poll(async () => (await state(page)).y).toBeGreaterThan(0.1);
  await expect.poll(async () => (await state(page)).grounded).toBe(true);
  await swipe(page, 0, 80);
  await expect.poll(async () => (await state(page)).sliding).toBe(true);
  await swipe(page, 80, 0);
  await expect.poll(async () => (await state(page)).dir).toBe(1);
  expect(errors).toEqual([]);
});

test('autopilot long run: bounded world, pooled meshes, no errors', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await open(page, '?seed=7&autopilot');
  await page.keyboard.press('Space');
  let maxPlatforms = 0;
  let sawEffect = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const st = await state(page);
    expect(st.phase, `cause ${st.cause}`).toBe('playing');
    maxPlatforms = Math.max(maxPlatforms, st.render.platforms);
    // Every live building has exactly one pooled mesh.
    expect(st.render.platforms).toBe(st.worldPlatforms);
    expect(st.mismatches).toEqual([]);
    if (st.effect !== 'none') {
      sawEffect = true;
      await expect(page.getByTestId('effect')).toBeVisible();
    }
  }
  const st = await state(page);
  expect(st.sideJumps).toBeGreaterThan(1);
  expect(st.jumps).toBeGreaterThan(10);
  expect(maxPlatforms).toBeLessThanOrEqual(90);
  console.log(
    `autopilot: score=${st.score} jumps=${st.jumps} side=${st.sideJumps} bounces=${st.bounces} effectSeen=${sawEffect} fps=${st.fps} calls=${st.render.calls}`,
  );
  expect(errors).toEqual([]);
});

test('survives resizing between portrait and landscape', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, '?seed=3&autopilot');
  await page.keyboard.press('Space');
  for (const [w, h] of [
    [390, 844],
    [844, 390],
    [1280, 720],
    [320, 568],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const c = await page.evaluate(() => {
      const el = document.querySelector('canvas')!;
      return { cw: el.clientWidth, ch: el.clientHeight, w: el.width };
    });
    expect(c.cw).toBe(w);
    expect(c.ch).toBe(h);
    expect(c.w).toBeGreaterThanOrEqual(w);
    // Panel/HUD never overflows horizontally.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
  }
  expect((await state(page)).phase).toBe('playing');
  expect(errors).toEqual([]);
});

test('losing window focus pauses the game', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).phase).toBe('playing');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('paused')).toBeVisible();
  await page.getByTestId('restart-btn').click();
  await expect(page.getByTestId('paused')).toBeHidden();
  const st = await state(page);
  expect(st.phase).toBe('playing');
  expect(st.role).toBe('start');
  expect(st.jumps).toBe(0);
  expect(st.score).toBeLessThan(15);
});

test('every start and every restart builds a new random world', async ({ page }) => {
  const seeds = new Set<number>();
  for (let i = 0; i < 3; i++) {
    await open(page, '');
    seeds.add((await state(page)).seed);
  }
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await page.getByTestId('restart-btn').click();
  seeds.add((await state(page)).seed);
  expect(seeds.size).toBe(4);
});

test('landing page fills the screen and How to play opens and closes', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  const box = await page.getByTestId('ready').boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.height).toBeCloseTo(vp.height, -1);
  expect(box!.width).toBeCloseTo(vp.width, -1);
  await page.getByTestId('howto-btn').click();
  await expect(page.getByTestId('howto')).toBeVisible();
  await expect(page.getByTestId('howto')).toContainText('Mirror portal');
  await page.getByTestId('howto-close').click();
  await expect(page.getByTestId('howto')).toBeHidden();
  await page.getByTestId('howto-btn').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('howto')).toBeHidden();
  expect((await state(page)).phase).toBe('ready');
  // Focus returns to Play, so Space starts the game instead of reopening the guide.
  await page.keyboard.press('Space');
  await expect(page.getByTestId('howto')).toBeHidden();
  await expect.poll(async () => (await state(page)).phase).toBe('playing');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test('main menu from pause and from game over returns to the landing page', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, '');
  await page.getByTestId('start-btn').click();
  await page.getByTestId('pause-btn').click();
  await page.getByTestId('menu-btn').click();
  await expect(page.getByTestId('ready')).toBeVisible();
  expect((await state(page)).phase).toBe('ready');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('gameover')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('over-menu-btn').click();
  await expect(page.getByTestId('ready')).toBeVisible();
  expect(errors).toEqual([]);
});

test('every mesh matches the physics, including after several restarts', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await open(page, '?autopilot');
  await page.keyboard.press('Space');
  for (let run = 0; run < 4; run++) {
    await page.waitForTimeout(2500);
    const st = await state(page);
    expect(st.mismatches, `run ${run}`).toEqual([]);
    expect(st.render.platforms).toBe(st.worldPlatforms);
    await page.keyboard.press('Escape');
    await page.getByTestId('restart-btn').click();
    await expect.poll(async () => (await state(page)).mismatches).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('settings persist across reloads and reset best needs confirmation', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  await page.getByTestId('quality-low').click();
  await page.getByTestId('setting-sound').uncheck();
  await page.getByTestId('settings-close').click();
  await page.reload();
  await page.waitForFunction(() => '__shadowShift' in window);
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('quality-low')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('setting-sound')).not.toBeChecked();
  // Play a short run so there is a best score, then reset it.
  await page.getByTestId('settings-close').click();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('gameover')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('over-menu-btn').click();
  await page.getByTestId('settings-btn').click();
  await page.getByTestId('reset-best').click();
  await page.getByTestId('reset-confirm').click();
  await expect(page.getByTestId('reset-best')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a new player gets a tip before their first gap, and it clears once they jump', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await open(page, '?seed=1');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('hint')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('hint')).toContainText(/jump/i);
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('hint')).toBeHidden({ timeout: 5000 });
  expect(errors).toEqual([]);
});

test('audio unlocks on the first key press, plays on jumps, and the mute setting silences it', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await open(page, '?seed=1');
  expect((await state(page)).audio.state).toBe('locked');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).audio.state).toBe('running');
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await state(page)).audio.played).toBeGreaterThan(1);
  await page.keyboard.press('Escape');
  await page.getByTestId('pause-settings-btn').click();
  await page.getByTestId('setting-sound').uncheck();
  await page.getByTestId('settings-close').click();
  await page.getByTestId('resume-btn').click();
  const muted = (await state(page)).audio.played;
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(800);
  expect((await state(page)).audio.played).toBe(muted);
  expect(errors).toEqual([]);
});

test('shards are counted in the HUD during a run', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await open(page, '?seed=4&autopilot');
  await page.keyboard.press('Space');
  await expect
    .poll(
      async () => Number((await page.getByTestId('hud-shards').innerText()).replace(/\D/g, '')),
      {
        timeout: 40_000,
      },
    )
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('works offline after the first visit, and removes caches from older versions', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  // A cache left by an "older version", created before the service worker exists.
  await page.goto('/manifest.webmanifest');
  await page.evaluate(() => caches.open('shadow-shift-stale-old-version'));
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 })
    .toBe(true);
  const keys = await page.evaluate(() => caches.keys());
  expect(keys.filter((k) => k.startsWith('shadow-shift-'))).toHaveLength(1);
  expect(keys).not.toContain('shadow-shift-stale-old-version');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('ready')).toBeVisible();
  await page.waitForFunction(() => '__shadowShift' in window);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).score).toBeGreaterThan(3);
  expect((await state(page)).mismatches).toEqual([]);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test('the animated character loads once and stays single through quality changes and restarts', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await open(page, '?seed=4&autopilot');
  await expect.poll(async () => (await state(page)).character, { timeout: 40_000 }).toBe('model');
  for (const q of ['low', 'high', 'medium', 'auto']) {
    await page.getByTestId('settings-btn').click();
    await page.getByTestId(`quality-${q}`).click();
    await page.getByTestId('settings-close').click();
  }
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  expect((await state(page)).skinned).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByTestId('restart-btn').click();
  await expect.poll(async () => (await state(page)).phase).toBe('playing');
  expect((await state(page)).skinned).toBe(1);
  expect(errors).toEqual([]);
});

test('a gap cannot be crossed by just running: without jumping the runner falls', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await open(page, '?seed=1');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('gameover')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('gameover')).toContainText('You fell');
  const st = await state(page);
  // Seed 1's start building is at most 40 m long: the fall happens at the first gap.
  expect(st.score).toBeLessThan(50);
  expect(errors).toEqual([]);
});

test('full screen: the button and the F key enter and leave it', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  const fs = () => page.evaluate(() => document.fullscreenElement !== null);
  await page.getByTestId('fullscreen-btn').click();
  await expect.poll(fs).toBe(true);
  await page.getByTestId('fullscreen-btn').click();
  await expect.poll(fs).toBe(false);
  await page.keyboard.press('Space'); // start a run: F works during gameplay too
  await page.keyboard.press('KeyF');
  await expect.poll(fs).toBe(true);
  await expect(page.getByTestId('fullscreen-btn')).toHaveAttribute(
    'aria-label',
    'Exit full screen',
  );
  await page.keyboard.press('KeyF');
  await expect.poll(fs).toBe(false);
  expect(errors).toEqual([]);
});
