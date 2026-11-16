// Generates the static website around the game (crawlable without JavaScript, no Three.js) into
// public/: guide pages, trust pages, the blog and sitemap.xml. Run `npm run build:pages` after
// editing content here (or in tools/articles.mjs). Plain HTML + public/pages.css: no framework,
// no effect on the game bundle.
import { mkdirSync, writeFileSync } from 'node:fs';
import { ARTICLES as FIRST } from './articles.mjs';
import { MORE_ARTICLES } from './articles-phase4.mjs';

const ARTICLES = [...FIRST, ...MORE_ARTICLES];

const SITE = 'https://shadowshifter.wasmer.app';
const CONTACT = 'ahmaddot909@gmail.com';
const UPDATED = '2026-11-16';

const NAV = [
  ['/', 'Home'],
  ['/how-to-play/', 'How to Play'],
  ['/game-features/', 'Features'],
  ['/gameplay-tips/', 'Gameplay Tips'],
  ['/blog/', 'Blog'],
  ['/about/', 'About'],
];
const FOOT = [
  ['/about/', 'About'],
  ['/how-to-play/', 'How to Play'],
  ['/game-features/', 'Features'],
  ['/gameplay-tips/', 'Gameplay Tips'],
  ['/blog/', 'Blog'],
  ['/contact/', 'Contact'],
  ['/privacy-policy/', 'Privacy Policy'],
  ['/terms/', 'Terms'],
];

/** A gameplay screenshot (public/images/<name>.webp, 1024x576), lazy unless `eager`. */
export function fig(name, alt, caption, eager = false) {
  return `<figure>
  <img src="/images/${name}.webp" alt="${alt}" width="1024" height="576"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'} />
  ${caption ? `<figcaption>${caption}</figcaption>` : ''}
</figure>`;
}

/** "Keep reading" links at the end of a page: [href, label, why] triples. */
function related(items) {
  return `<aside class="related" aria-label="Keep reading">
  <h2>Keep reading</h2>
  <ul>
    ${items.map(([href, label, why]) => `<li><a href="${href}"><strong>${label}</strong><span>${why}</span></a></li>`).join('\n    ')}
  </ul>
</aside>`;
}

const PAGES = [
  {
    slug: 'how-to-play',
    title: 'How to Play Shadow Shift – Controls and Beginner Guide',
    description:
      'Shadow Shift controls for keyboard and touch: jump, slide, turn corners, wall-run and pause. A short beginner guide to surviving your first runs.',
    h1: 'How to Play Shadow Shift',
    image: 'shadow-shift-jumping-gap',
    body: `
<p class="lead">Shadow Shift is an endless rooftop runner: your runner sprints forward on their own and
speeds up over time. Your job is to read the route ahead and pick the right move at the right moment.</p>
${fig('shadow-shift-jumping-gap', 'The runner leaping across the gap between two rooftops', 'Jumping a gap between buildings.', true)}

<h2 id="start">How to start playing</h2>
<p>Open the <a href="/">game page</a> and press <strong>Start run</strong> (or Space). There is nothing to
install and no account. The game runs in any modern browser with WebGL2, on desktop or mobile.</p>

<h2 id="controls">Controls</h2>
<table>
  <thead><tr><th>Move</th><th>Keyboard</th><th>Touch</th></tr></thead>
  <tbody>
    <tr><td>Jump</td><td>↑, W or Space</td><td>Swipe up</td></tr>
    <tr><td>Slide (or slam down in mid-air)</td><td>↓ or S</td><td>Swipe down</td></tr>
    <tr><td>Turn, steer in the air, step onto a wall</td><td>← → or A D</td><td>Swipe left or right</td></tr>
    <tr><td>Pause</td><td>Esc or P</td><td>Pause button</td></tr>
  </tbody>
</table>

<h2>Movement</h2>
<h3 id="jump">Jumping</h3>
<p>Buildings float apart, with gaps of a few metres between them. Jump just before the edge: any jump
from the edge reaches the next building, even at top speed. Running off an edge without jumping is a fall.
Some buildings sit higher or lower than the one you are on: small rises must be jumped, drops are simply landed on.</p>
<h3 id="slide">Sliding</h3>
<p>Slide to pass under overhead pipes. Pressing slide in mid-air slams you down faster and slides on landing.</p>
<h3>Turning and sideways moves</h3>
<p>When a building ends with another one beside it, press left or right at the corner and the runner
carves round it on the ground. You can also turn in mid-air during a jump. Where your lane ends
beside a parallel one, press toward it to hop across.</p>
<h3 id="moves">Wall-running and climbing</h3>
<p>Some gaps are too long to jump but have a wall on one side: jump, then press toward the wall while in
the air to run along it. Run or jump into the face of a much taller building to climb it and pull up onto the roof.</p>

<h2 id="obstacles">Obstacles and hazards</h2>
<ul>
  <li><strong>Red laser gates:</strong> jump them. Touching a laser burns you.</li>
  <li><strong>Pipe bundles with cyan bands:</strong> slide under them.</li>
  <li><strong>A single pipe with an amber valve:</strong> jump or slide, either works.</li>
  <li><strong>Rooftop AC units:</strong> vaulted automatically, no input needed.</li>
  <li><strong>Trampolines:</strong> bounce on the glowing pad, then press left or right in mid-air to steer onto the side building.</li>
</ul>

<h2 id="portals">Portals</h2>
<p><strong>Mirror portals</strong> turn the runner around for 10 seconds and reverse every control:
jump and slide swap, and so do left and right. <strong>Black portals</strong> bring 8 seconds of
darkness; survive it and the game runs for you for a few seconds.</p>

<h2>Restarting</h2>
<p>After a fall or crash, press Space or tap the button to run again. Each run builds a new city.
Your best distance is saved in your browser.</p>

<h2>Beginner tips</h2>
<ul>
  <li>Jump late, at the edge, rather than early.</li>
  <li>Let the obstacle colour decide: red jump, cyan slide, amber either.</li>
  <li>On a dead-end building, press the turn early: the game holds it until the corner.</li>
</ul>
<p>More in the <a href="/gameplay-tips/">gameplay tips</a>.</p>

<h2>FAQ</h2>
<h3>Is Shadow Shift free?</h3>
<p>Yes, completely free, with no ads or purchases.</p>
<h3>Can I play on mobile?</h3>
<p>Yes. Swipe up to jump, down to slide and sideways to turn.</p>
<h3>Do I need to download anything?</h3>
<p>No. It runs in the browser; it needs WebGL2, which all current browsers support.</p>
<h3>Why does the screen go dark?</h3>
<p>You ran through a black portal. The darkness lasts 8 seconds; watch the glowing edges of the route.</p>`,
    related: [
      ['/game-features/', 'Game features', 'everything you will meet on the rooftops'],
      ['/gameplay-tips/', 'Gameplay tips', 'strategies for longer runs'],
      ['/', 'Play Shadow Shift', 'start a run now'],
    ],
  },
  {
    slug: 'game-features',
    title: 'Shadow Shift Features – 3D Rooftop Parkour Gameplay',
    description:
      'Inside Shadow Shift: rooftop gaps, connected corners, wall-runs, climbs, lasers, pipes, trampolines, mirror and black portals, and a run that keeps speeding up.',
    h1: 'Explore Shadow Shift Game Features',
    image: 'shadow-shift-wall-running',
    body: `
<p class="lead">Every feature below is in the game today.</p>

<h2>3D rooftop running</h2>
${fig('shadow-shift-rooftop-run', 'The runner sprinting along a rooftop past glowing fires toward the next building', '', true)}
<p>Square, hexagonal, triangular and wedge-shaped buildings float above a neon city at night. The
runner sprints on their own and accelerates from 10 to 19 metres per second, so the same route
gets harder the longer you survive.</p>

<h2>Jumping between buildings</h2>
${fig('shadow-shift-jumping-gap', 'The runner in mid-air over the gap between two rooftops', '')}
<p>Gaps of a few metres separate the buildings, and buildings sit at different heights: rises to jump
up onto and drops to land on. The route is generated so that a jump from any edge always lands on the
next building, at every speed. Falling is always a timing mistake, never bad luck.</p>

<h2>Wall-running</h2>
${fig('shadow-shift-wall-running', 'The runner running along the side of a tall wall over a long gap', '')}
<p>Some gaps are too long for any jump, with a tall wall along one side. Jump, then step toward the wall
in mid-air: the runner plants their feet on it, runs along it and kicks off onto the next building.</p>

<h2>Climbing</h2>
${fig('shadow-shift-climbing', 'The runner pulling up onto the roof of a taller building', '')}
<p>Some buildings are far taller than the one before. Run or jump into the face and the runner climbs it
and pulls up onto the roof.</p>

<h2>Sliding under obstacles</h2>
${fig('shadow-shift-slide-under-pipes', 'An overhead pipe bundle with cyan bands across the rooftop', '')}
<p>Overhead pipe bundles with cyan bands must be slid under. A single pipe with an amber valve can be
jumped or slid. Rooftop AC units are vaulted automatically.</p>

<h2>Laser hazards</h2>
${fig('shadow-shift-laser-gate', 'A red laser gate stretched across the rooftop ahead', '')}
<p>Red laser gates stretch across the roof at knee height. Jump them: touching a beam burns the runner.</p>

<h2>Branching paths and special routes</h2>
<ul>
  <li><strong>Connected corners</strong> you carve round at full speed.</li>
  <li><strong>Forks</strong> offering a side branch or the straight route; both rejoin.</li>
  <li><strong>Trampolines</strong> that launch you high enough to steer onto a side building.</li>
  <li><strong>Parallel lanes</strong> you hop between.</li>
</ul>

<h2>Mirror portals</h2>
${fig('shadow-shift-mirror-portal', 'The runner diving through a glowing blue electric mirror portal', '')}
<p>Run through one and the runner turns around for 10 seconds, with every control reversed: jump and
slide swap, and so do left and right.</p>

<h2>Black portals and darkness</h2>
${fig('shadow-shift-darkness', 'The runner as a black silhouette in the darkness, the route edges glowing', '')}
<p>A black portal plunges the city into darkness for 8 seconds. Only the glowing edges of the route stay
easy to see. Survive it and the game runs for you for a few seconds as a reward.</p>

<h2>Endless and fair</h2>
<p>Every run is a new, randomly generated city. Amber energy shards are collected along the way and
counted per run and in total. Your best distance is saved in your browser.</p>`,
    related: [
      ['/how-to-play/', 'How to play', 'the controls for every feature'],
      [
        '/blog/parkour-movement-in-3d-games/',
        'Parkour movement in 3D games',
        'how these moves are designed',
      ],
      ['/blog/avoid-obstacles-in-running-games/', 'Avoiding obstacles', 'reading hazards at speed'],
      ['/', 'Play Shadow Shift', 'try them yourself'],
    ],
  },
  {
    slug: 'gameplay-tips',
    title: 'Shadow Shift Gameplay Tips – Improve Your Parkour Skills',
    description:
      'Practical Shadow Shift tips: when to jump, how to read obstacles, taking corners, wall-running, handling mirror portals and surviving the darkness.',
    h1: 'Shadow Shift Gameplay Tips and Strategies',
    image: 'shadow-shift-laser-gate',
    body: `
<p class="lead">Advice built on how the game actually works. New to the game? Start with
<a href="/how-to-play/">how to play</a>.</p>
<h2>Jump late, not early</h2>
<p>A jump from the very edge of a building always reaches the next one, so there is no need to jump
early. Jumping too soon is the most common way to fall short.</p>
<h2>Read colour, not shape</h2>
${fig('shadow-shift-laser-gate', 'A red laser gate ahead on the rooftop: red means jump', 'Red means jump.', true)}
<p>Red means jump, cyan means slide, amber means either. At top speed there is no time to study the
obstacle, so let the colour decide.</p>
<h2>Time slides to the pipe, not the building</h2>
<p>A slide lasts a little under a second. Start it just before the pipe, not as soon as you see it, or it
ends too early.</p>
<h2>Press turns early</h2>
<p>On a dead-end building you can press left or right early: the game holds the press and turns at the
corner. Pressing early is safer than pressing late.</p>
<h2>Wall-runs need two inputs</h2>
<p>Jump first, then press toward the wall while in the air. A jump alone falls into the gap.</p>
<h2>Trampolines: steer during the bounce</h2>
<p>A normal jump cannot reach the side building. Land on the pad, then steer in the air.</p>
<h2>Forks: pick a side early</h2>
<p>At a fork both branches rejoin, so neither is a trap. Decide early and commit.</p>
<h2>Mirror portals: think "opposite"</h2>
<p>For 10 seconds, up means slide and left means right. Many players find it easier to think
"opposite" before every press.</p>
<h2>Darkness: follow the glowing edges</h2>
<p>In the darkness after a black portal, the neon edges of the route stay lit. Watch them, not the
buildings. Survive the 8 seconds and the game runs for you briefly.</p>
<h2>Use mid-air steering to fix mistakes</h2>
<p>Turns also work in the air. If you jump and realise the route turns, press the direction straight away.</p>`,
    related: [
      ['/how-to-play/', 'How to play', 'controls and the basics'],
      ['/game-features/', 'Game features', 'what each obstacle and portal does'],
      [
        '/blog/improve-timing-in-endless-runner-games/',
        'Improve your timing',
        'a deeper guide to reaction and rhythm',
      ],
      [
        '/blog/beat-your-high-score-endless-runner/',
        'Beat your high score',
        'consistency over risk',
      ],
      ['/', 'Play Shadow Shift', 'put the tips into practice'],
    ],
  },
  {
    slug: 'about',
    title: 'About Shadow Shift – Free 3D Parkour Game',
    description:
      'Shadow Shift is a free 3D parkour runner for the browser, built with Three.js. What the game is, how it plays and how it was made.',
    h1: 'About Shadow Shift',
    image: 'shadow-shift-rooftop-run',
    body: `
<p class="lead">Shadow Shift is a free, single-player 3D parkour runner that plays in the web browser.</p>
${fig('shadow-shift-rooftop-run', 'The runner sprinting across a neon rooftop at night', '', true)}
<h2>The game</h2>
<p>It is an endless runner: the runner sprints forward on their own and the player decides when to jump,
slide and turn. The longer you last, the faster it gets, and the score is simply the distance run.</p>
<h2>The rooftops</h2>
<p>The game takes place on the rooftops of a neon city at night. Buildings of different shapes and
heights float apart, and each run builds a new city, so no route can be memorised.</p>
<h2>The moves</h2>
<p>Beyond jumping and sliding, the runner carves round corners, runs along walls, climbs taller
buildings, bounces on trampolines and hops between lanes, while lasers, pipes and two kinds of portal
test their reactions. See every <a href="/game-features/">feature</a>.</p>
<h2>In the browser</h2>
<p>The game is written in TypeScript with React and Three.js (WebGL2), and runs entirely in your
browser: no server, no account, no download. Your best distance and shard total are stored only on your
own device, and once loaded the game also works offline.</p>
<h2>What comes next</h2>
<p>The game is actively developed: movement, animation and new route types are being improved.
Feedback is welcome on the <a href="/contact/">contact page</a>.</p>`,
    related: [
      ['/how-to-play/', 'How to play', 'controls and the basics'],
      ['/blog/', 'Blog', 'guides to parkour and runner games'],
      ['/', 'Play Shadow Shift', 'start a run'],
    ],
  },
  {
    slug: 'contact',
    title: 'Contact – Shadow Shift',
    description:
      'Get in touch about Shadow Shift: feedback, bug reports and questions about the free 3D parkour game.',
    h1: 'Contact',
    priority: '0.3',
    body: `
<p>Feedback, bug reports and questions are welcome.</p>
<p>Email: <a href="mailto:${CONTACT}">${CONTACT}</a></p>
<h2>Feedback</h2>
<p>Tell us what you enjoyed, what felt unfair and what you would like to see next.</p>
<h2>Bug reports</h2>
<p>Please include your browser and device, what happened just before the problem, and a screenshot if
you can.</p>`,
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy – Shadow Shift',
    description:
      'How Shadow Shift handles data: no accounts, no analytics, no cookies. Scores and settings stay in your own browser.',
    h1: 'Privacy Policy',
    priority: '0.2',
    body: `
<p>Last updated: ${UPDATED}</p>
<h2>What we collect</h2>
<p>Nothing. Shadow Shift has no accounts, no analytics, no advertising, no cookies and no third-party
scripts, and sends no gameplay data to any server.</p>
<h2>What is stored on your device</h2>
<p>The game stores your best distance, your total energy shards, your settings (sound, graphics
quality, reduced effects) and which tips you have seen, in your browser's local storage. It also caches
the game's files so it can run offline. This data never leaves your device, and you can delete it at
any time by clearing this site's data in your browser.</p>
<h2>Hosting</h2>
<p>The site is hosted by Wasmer. Like any web host, it may keep standard server logs (such as IP
addresses and requested pages) under its own policies.</p>
<h2>Your rights</h2>
<p>Because we hold no personal data about you, there is nothing to access, correct or delete on our
side. Data on your own device is under your control as described above.</p>
<h2>Changes</h2>
<p>If the game ever adds analytics or other data collection, this page will be updated first.</p>
<h2>Contact</h2>
<p><a href="mailto:${CONTACT}">${CONTACT}</a></p>`,
  },
  {
    slug: 'terms',
    title: 'Terms of Use – Shadow Shift',
    description: 'The terms for using the Shadow Shift website and playing the free browser game.',
    h1: 'Terms of Use',
    priority: '0.2',
    body: `
<p>Last updated: ${UPDATED}</p>
<h2>Using the website and game</h2>
<p>Shadow Shift is free to play for personal, non-commercial use in a web browser.</p>
<h2>Acceptable use</h2>
<p>Please do not attempt to disrupt the site, overload it, or tamper with it.</p>
<h2>Intellectual property</h2>
<p>The game, its code, art and name belong to its creator. Please do not copy, resell or re-host the
game without permission.</p>
<h2>No warranty</h2>
<p>The game is provided as it is, without guarantees. It may change, or be unavailable, at any time.
Saved scores live in your browser and can be lost if browser data is cleared.</p>
<h2>Contact</h2>
<p><a href="mailto:${CONTACT}">${CONTACT}</a></p>`,
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Splits page HTML into the hero lead and numbered section cards (one per <h2>). A figure of the
 * hero image in the intro is dropped (the hero already shows it).
 */
function panels(html, heroImage) {
  const parts = html.trim().split(/(?=<h2[\s>])/);
  let intro = parts[0].startsWith('<h2') ? '' : parts.shift();
  if (heroImage) {
    intro = intro.replace(
      new RegExp(`<figure>\\s*<img src="/images/${heroImage}\\.webp"[\\s\\S]*?</figure>`),
      '',
    );
  }
  const lead = (intro.match(/<p class="lead">[\s\S]*?<\/p>/) ?? [''])[0];
  intro = intro.replace(lead, '').trim();
  const cards = parts
    .map(
      (s, i) => `<section class="panel">
  <span class="num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
${s.trim()}
</section>`,
    )
    .join('\n');
  return { lead, body: `${intro}\n<div class="panels">\n${cards}\n</div>` };
}

function layout({
  path,
  title,
  description,
  h1,
  crumbs,
  jsonld,
  ogType = 'website',
  image,
  heroAlt = '',
  kicker = 'Guide',
  lead = '',
  meta = '',
  article,
  body,
}) {
  const url = `${SITE}${path}`;
  const img = image ? `${SITE}/images/${image}.webp` : `${SITE}/og-image.jpg`;
  const nav = NAV.map(
    ([href, label]) =>
      `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('\n        ');
  const foot = FOOT.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n        ');
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, href], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${SITE}${href}`,
    })),
  };
  const ld = [breadcrumb, ...(jsonld ? [jsonld] : [])]
    .map((d) => `    <script type="application/ld+json">${JSON.stringify(d)}</script>`)
    .join('\n');
  const trail = crumbs
    .map(([name, href], i) =>
      i < crumbs.length - 1 ? `<a href="${href}">${esc(name)}</a>` : esc(name),
    )
    .join(' / ');
  const artMeta = article
    ? `\n    <meta property="article:published_time" content="${article.published}" />\n    <meta property="article:modified_time" content="${article.updated ?? article.published}" />`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0a1830" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="Shadow Shift" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1024" />
    <meta property="og:image:height" content="576" />${artMeta}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${img}" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="/pages.css" />
${ld}
  </head>
  <body>
    <header class="top">
      <a class="brand" href="/"><span class="brand-tab"><img src="/icon.svg" alt="" width="26" height="26" /></span><span>Shadow Shift<small>Free 3D parkour game</small></span></a>
      <nav aria-label="Main">
        ${nav}
      </nav>
      <a class="play" href="/">Play now</a>
    </header>
    <header class="hero${image ? '' : ' plain'}">
      ${image ? `<img class="hero-bg" src="/images/${image}.webp" alt="${esc(heroAlt)}" width="1024" height="576" fetchpriority="high" />` : ''}
      <div class="hero-in">
        <nav class="crumbs" aria-label="Breadcrumb">${trail}</nav>
        <p class="kicker">${esc(kicker)}</p>
        <h1>${esc(h1)}</h1>
        ${lead}
        ${meta}
      </div>
    </header>
    <main>
${body.trim()}
    </main>
    <section class="cta-band" aria-label="Play">
      <div>
        <p class="kicker">Ready to run?</p>
        <p class="cta-title">Free-run the neon rooftops</p>
        <p>No download, no account. Plays in your browser on desktop and mobile.</p>
      </div>
      <a class="start" href="/">Start run</a>
    </section>
    <footer>
      <div class="foot-brand">
        <a class="brand" href="/"><img src="/icon.svg" alt="" width="24" height="24" />Shadow Shift</a>
        <p>A free 3D parkour runner that plays in your browser.</p>
      </div>
      <nav aria-label="Footer">
        ${foot}
      </nav>
    </footer>
  </body>
</html>
`;
}

function write(path, html) {
  mkdirSync(`public${path}`, { recursive: true });
  writeFileSync(`public${path}index.html`, html);
}

const urls = [{ loc: '/', priority: '1.0', lastmod: UPDATED }];

const KICKER = {
  'how-to-play': 'Guide · Controls',
  'game-features': 'Inside the game',
  'gameplay-tips': 'Strategy',
  about: 'The game',
  contact: 'Get in touch',
  'privacy-policy': 'Legal',
  terms: 'Legal',
};

for (const p of PAGES) {
  const path = `/${p.slug}/`;
  const { lead, body } = panels(p.body, p.image);
  write(
    path,
    layout({
      path,
      title: p.title,
      description: p.description,
      h1: p.h1,
      image: p.image,
      kicker: KICKER[p.slug] ?? 'Guide',
      lead,
      crumbs: [
        ['Shadow Shift', '/'],
        [p.h1, path],
      ],
      body: body + (p.related ? '\n' + related(p.related) : ''),
    }),
  );
  urls.push({ loc: path, priority: p.priority ?? '0.7', lastmod: UPDATED });
}

// Blog: listing + articles.
const byDate = [...ARTICLES].sort((a, b) => b.published.localeCompare(a.published));
const card = (a) => `<li class="post">
  <a href="/blog/${a.slug}/">
    <span class="post-img"><img src="/images/${a.image}.webp" alt="" width="1024" height="576" loading="lazy" decoding="async" /></span>
    <span class="post-body">
      <span class="tag">${a.minutes} min read · <time datetime="${a.published}">${a.published}</time></span>
      <h2>${esc(a.h1)}</h2>
      <span class="post-desc">${esc(a.description)}</span>
      <span class="go">Read guide</span>
    </span>
  </a>
</li>`;
const BLOG_TITLE = 'Shadow Shift Blog – Parkour and Runner Game Guides';
write(
  '/blog/',
  layout({
    path: '/blog/',
    title: BLOG_TITLE,
    description:
      'Guides to rooftop parkour and endless runner games: timing, obstacles, parkour movement and how to get better, from the makers of Shadow Shift.',
    h1: 'Shadow Shift Blog',
    image: 'shadow-shift-wall-running',
    kicker: `${ARTICLES.length} guides`,
    lead: '<p class="lead">Guides to parkour and endless runner games: how they work and how to get better at them.</p>',
    crumbs: [
      ['Shadow Shift', '/'],
      ['Blog', '/blog/'],
    ],
    body: `<ul class="posts">
${byDate.map(card).join('\n')}
</ul>`,
  }),
);
urls.push({ loc: '/blog/', priority: '0.6', lastmod: byDate[0].updated ?? byDate[0].published });

for (const a of ARTICLES) {
  const path = `/blog/${a.slug}/`;
  const others = a.related
    .map((slug) => ARTICLES.find((x) => x.slug === slug))
    .filter(Boolean)
    .map((x) => [`/blog/${x.slug}/`, x.h1, x.teaser]);
  const article = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.h1,
    description: a.description,
    image: `${SITE}/images/${a.image}.webp`,
    datePublished: a.published,
    dateModified: a.updated ?? a.published,
    mainEntityOfPage: `${SITE}${path}`,
    author: { '@type': 'Organization', name: 'Shadow Shift', url: `${SITE}/about/` },
    publisher: {
      '@type': 'Organization',
      name: 'Shadow Shift',
      logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` },
    },
  };
  write(
    path,
    layout({
      path,
      title: a.title,
      description: a.description,
      h1: a.h1,
      image: a.image,
      heroAlt: a.imageAlt,
      ogType: 'article',
      article: a,
      jsonld: article,
      kicker: 'Blog · Guide',
      lead: panels(a.body).lead,
      meta: `<p class="meta"><time datetime="${a.published}">Published ${a.published}</time>${
        a.updated ? ` · <time datetime="${a.updated}">Updated ${a.updated}</time>` : ''
      } · ${a.minutes} min read</p>`,
      crumbs: [
        ['Shadow Shift', '/'],
        ['Blog', '/blog/'],
        [a.h1, path],
      ],
      body: `${panels(a.body).body}
${related([...others, ...a.links, ['/', 'Play Shadow Shift', 'try it in your browser']])}`,
    }),
  );
  urls.push({ loc: path, priority: '0.6', lastmod: a.updated ?? a.published });
}

writeFileSync(
  'public/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${SITE}${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`,
);
console.log('pages', PAGES.length, 'articles', ARTICLES.length, 'sitemap urls', urls.length);
const check = [...PAGES, ...ARTICLES, { slug: 'blog', title: BLOG_TITLE }];
for (const p of check)
  if (p.title.length > 60 || (p.description ?? '').length > 160)
    console.log('LONG', p.slug, p.title.length, (p.description ?? '').length);
