// Dev-only: screenshot the landing page. Usage: node tools/dbg-landing.mjs <url> <out.png>
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
await page.goto(url);
await page.waitForFunction(() => '__shadowShift' in window, null, { timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
await browser.close();
