// Runs tools/convert.html in headless Chromium (Vite dev server must be running on :5199,
// or pass a URL) and writes public/models/runner.glb.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:5199/tools/convert.html';
const targetTris = Number(process.argv[3] ?? 12000);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(url);
await page.waitForFunction(() => 'convertRunner' in window, null, { timeout: 120000 });
const { base64, report } = await page.evaluate((t) => window.convertRunner(t), targetTris);
mkdirSync('public/models', { recursive: true });
writeFileSync('public/models/runner.glb', Buffer.from(base64, 'base64'));
console.log(JSON.stringify(report, null, 1));
await browser.close();
