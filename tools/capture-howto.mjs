// Dev-only: captures real in-game thumbnails for the How to Play cards (public/howto/*.webp).
// Plays with the autopilot on the dev server and grabs a frame at each mechanic. Portals are
// taken from a short rolling buffer, so the frame shows the portal just before the runner enters.
// Usage: npx vite --port 5174 (running), then node tools/capture-howto.mjs [seed]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const SEED = process.argv[2] ?? '8';
const OUT = 'ad/howto-raw';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 720 } });
await p.goto(`http://localhost:5174/?seed=${SEED}&autopilot`);
await p.waitForFunction(() => '__shadowShift' in window, null, { timeout: 60000 });
await p.addStyleTag({
  content: '.hud-top,.hud-buttons,.hint,.notice,.banners,.toast{display:none!important}',
});
await p.waitForTimeout(4000); // character model
await p.keyboard.press('Space');

const want = new Set(
  process.argv[3]
    ? process.argv[3].split(',')
    : ['jump', 'slide', 'leap', 'wallrun', 'colors', 'hop', 'pad', 'shadow', 'mirror'],
);
const got = {};
const buf = [];
let prev = null;
let prevRole = null;
const t0 = Date.now();
const save = (name, img) => {
  if (got[name] || !want.has(name)) return;
  got[name] = true;
  writeFileSync(`${OUT}/${name}.jpg`, img);
  console.log('got', name, Object.keys(got).length, '/', want.size);
};
while (Object.keys(got).length < want.size && Date.now() - t0 < 240000) {
  const img = await p.screenshot({ type: 'jpeg', quality: 92 });
  const s = await p.evaluate(() => window.__shadowShift.state());
  if (s.phase !== 'playing') break;
  buf.push(img);
  if (buf.length > 8) buf.shift();
  const light = s.effect === 'none' && s.mirror <= 0;
  if (prev) {
    if (s.effect === 'shadow' && prev.effect !== 'shadow')
      save('shadow', buf[Math.max(0, buf.length - 5)]);
    if (s.mirror > 0 && prev.mirror <= 0 && s.effect === 'none')
      save('mirror', buf[Math.max(0, buf.length - 5)]);
    if (light && s.move === 'wallrun') save('wallrun', img);
    if (light && s.bounces > prev.bounces) save('pad', buf[Math.max(0, buf.length - 3)]);
    if (light && s.sideJumps > prev.sideJumps) save(prevRole === 'switch' ? 'hop' : 'leap', img);
    if (light && s.jumps > prev.jumps && s.move === 'none' && !s.grounded) save('jump', img);
    const o = s.obstacleAhead;
    if (light && o && o.kind === 'high' && o.d < 9 && o.d > 4) save('slide', img);
    if (light && o && o.kind === 'low' && o.d < 12 && o.d > 6) save('colors', img);
  }
  prevRole = s.role;
  prev = s;
}
console.log(
  'missing',
  [...want].filter((w) => !got[w]),
);
await b.close();
