// Dev/preview only: serve the static site pages (public/<page>/index.html) at their folder URLs,
// like the real host does, instead of Vite's SPA fallback to the game. Plain JS so the
// typecheck (browser types only) does not need Node's type definitions.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function serve(root) {
  return (req, res, next) => {
    const path = (req.url ?? '/').split(/[?#]/)[0];
    if (path === '/' || path.includes('..')) return next();
    const dir = path.endsWith('/') ? path : `${path}/`;
    const file = join(root, dir, 'index.html');
    if (!existsSync(file)) return next();
    if (!path.endsWith('/')) {
      res.statusCode = 301;
      res.setHeader('Location', dir);
      return res.end();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(readFileSync(file));
  };
}

export function staticPages() {
  return {
    name: 'static-pages',
    configureServer(s) {
      s.middlewares.use(serve(join(s.config.root, 'public')));
    },
    configurePreviewServer(s) {
      s.middlewares.use(serve(join(s.config.root, s.config.build.outDir)));
    },
  };
}
