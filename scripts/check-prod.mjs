// Fails if debug-only code reached the production bundle (see CLAUDE.md, Security).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist/assets';
// Strings that only occur inside debug-only code paths.
const banned = ['__shadowShift', 'URLSearchParams', 'mismatches', 'worldPlatforms'];
let failed = false;
for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
  const src = readFileSync(join(dir, f), 'utf8');
  for (const word of banned) {
    if (src.includes(word)) {
      console.error(`Production bundle ${f} contains debug-only "${word}"`);
      failed = true;
    }
  }
}
if (!readFileSync('dist/sw.js', 'utf8').includes('shadow-shift-')) {
  console.error('dist/sw.js is missing or has no versioned cache');
  failed = true;
}
if (failed) process.exit(1);
console.log('Production bundle check passed: no debug hooks, service worker present.');
