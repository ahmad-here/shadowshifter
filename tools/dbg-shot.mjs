// Dev-only: screenshot a run on the dev server. Usage: node tools/dbg-shot.mjs <url> <out.png> [waitMs]
import { chromium } from '@playwright/test';
const [url, out, wait = '4000'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('error', m.text().slice(0, 300)));
await page.goto(url);
await page.waitForFunction(() => '__shadowShift' in window, null, { timeout: 60000 });
await page.getByTestId('settings-btn').click();
await page.getByTestId('quality-high').click();
await page.getByTestId('settings-close').click();
await page.waitForTimeout(2500);
await page.keyboard.press('Space');
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
console.log(
  JSON.stringify(
    await page.evaluate(() => {
      const s = window.__shadowShift.state();
      return [s.character, s.score, s.render.calls];
    }),
  ),
);
await browser.close();
