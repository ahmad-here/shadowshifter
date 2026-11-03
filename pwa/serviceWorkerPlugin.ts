import type { Plugin } from 'vite';

/** Public files served as-is that the offline game needs. */
const PUBLIC_FILES = ['manifest.webmanifest', 'icon.svg', 'models/runner.glb', 'models/fire.glb'];

/**
 * Emits `sw.js` with the exact file list of this build. The cache name includes a hash of that
 * list, so every build gets its own cache and old ones are dropped only after the new one is
 * fully installed (no mixing of code and assets from different versions).
 */
export function serviceWorkerPlugin(): Plugin {
  return {
    name: 'shadow-shift-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = [...Object.keys(bundle).filter((f) => !f.endsWith('.map')), ...PUBLIC_FILES];
      const version = fnv1a(files.sort().join(','));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(version, files) });
    },
  };
}

/** Short stable hash of the build's file list (hashed file names change with content). */
function fnv1a(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function serviceWorker(version: string, files: string[]): string {
  return `// Generated at build time. Do not edit.
const CACHE = 'shadow-shift-${version}';
const PRECACHE = ${JSON.stringify(['./', ...files.map((f) => './' + f)])};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('shadow-shift-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only same-origin GETs; never cache third-party content.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // The page: network first so updates arrive, cached copy when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreVary: true })),
    );
    return;
  }
  // Hashed build assets: cache first.
  // ignoreVary: the server varies on request headers (e.g. Origin) that module scripts send but
  // the precache request did not; hashed file names already make a URL match exact.
  event.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req)));
});
`;
}
