// Dev-only: screenshot the first trampoline bounce and the first lane hop of an autopilot run.
import { chromium } from '@playwright/test';
const [url, outDir] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(url);
await page.waitForFunction(() => '__shadowShift' in window, null, { timeout: 60000 });
await page.waitForTimeout(2000);
await page.keyboard.press('Space');
const st = () => page.evaluate(() => window.__shadowShift.state());
let s = await st();
const shots = { bounce: false, hop: false };
for (let i = 0; i < 3000 && !(shots.bounce && shots.hop) && s.phase === 'playing'; i++) {
  await page.waitForTimeout(40);
  s = await st();
  if (!shots.bounce && s.bounces > 0 && s.y > 3) {
    await page.screenshot({ path: `${outDir}/bounce.png` });
    shots.bounce = true;
  }
  if (!shots.hop && s.role === 'switch') {
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${outDir}/hop.png` });
    shots.hop = true;
  }
}
console.log(JSON.stringify({ shots, phase: s.phase, score: s.score, bounces: s.bounces }));
await browser.close();
