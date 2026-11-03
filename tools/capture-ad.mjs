// Dev-only: captures gameplay one exact frame at a time (paused browser clock) for the promo
// video. Needs the dev server on :5199. Usage: node tools/capture-ad.mjs [frames] [out-dir]
// Then: python tools/make-ad.py <out-dir> ad.mp4
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = process.argv[3] ?? 'ad/frames';
const FRAMES = Number(process.argv[2] ?? 1500);
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.clock.install();
// Frame timestamps from the controlled clock, so game time advances exactly one frame per shot.
await p.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now()));
});
await p.goto('http://localhost:5199/?seed=8&autopilot');
for (let i = 0; i < 400 && !(await p.evaluate(() => '__shadowShift' in window)); i++) {
  await p.clock.runFor(50);
  await new Promise((r) => setTimeout(r, 50));
}
console.log('booted', await p.evaluate(() => '__shadowShift' in window));
// Freeze time: from here on it only moves when a frame is stepped.
await p.clock.pauseAt(new Date(Date.now() + 5000));
await p.addStyleTag({ content: '.hud-top,.hud-buttons,.hint,.notice,.banners{display:none!important}' });
// Let the character model load (real time), with the game still on its menu.
for (let i = 0; i < 60; i++) { await p.clock.runFor(33); await new Promise((r) => setTimeout(r, 50)); }
await p.keyboard.press('Space');
const log = [];
for (let f = 0; f < FRAMES; f++) {
  await p.clock.runFor(1000 / 30);
  await p.screenshot({ path: OUT + '/f' + String(f).padStart(5, '0') + '.jpg', type: 'jpeg', quality: 92 });
  const s = await p.evaluate(() => window.__shadowShift.state());
  log.push([f, s.score, s.phase, s.effect, s.move, s.sliding ? 1 : 0, s.grounded ? 1 : 0, s.mirror > 0 ? 1 : 0, s.character]);
  if (s.phase !== 'playing') break;
}
writeFileSync(OUT + '/../log.json', JSON.stringify(log));
console.log('frames', log.length, 'last', JSON.stringify(log.at(-1)));
await b.close();
