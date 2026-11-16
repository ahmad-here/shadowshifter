# Shadow Shift: SEO and Codebase Audit (Phase 0)

Audit date: 2026-11-16. Live site: https://shadowshifter.wasmer.app/

Everything below was checked directly (repository, production build, live HTTP responses).
Items marked **owner** need account access I do not have.

## 1. Architecture

| Item | Finding |
| --- | --- |
| Rendering | Pure client-side React 19 + Three.js r186, built with Vite. One page (`index.html`), no router, no SSR or pre-rendering. |
| Runtime dependencies | `react`, `react-dom`, `three` only. No analytics, no router. |
| Entry | `index.html` → `src/main.tsx` → `ui/App.tsx` → `GameController` (canvas + game loop). |
| Hosting | Wasmer (static). No Wasmer config file in the repo. |
| Routing on host | Real files only: an unknown URL returns a true **HTTP 404** (checked). Good: no soft-404s, and extra static HTML pages will work on direct navigation with no fallback setup. |
| Offline | Service worker (`pwa/serviceWorkerPlugin.ts`) emits a versioned `sw.js`. |

## 2. Current SEO (live, verified)

| Check | Status |
| --- | --- |
| HTTP status `/` | 200 |
| Title | "Shadow Shift: 3D Parkour Game Online, Free, No Download" (55 chars) ✅ |
| Meta description | 160 chars, accurate ✅ |
| Canonical | `https://shadowshifter.wasmer.app/` ✅ |
| Robots meta | `index, follow, max-image-preview:large` ✅ |
| Open Graph / Twitter | Complete, 1200×630 `og-image.jpg` (39 KB) ✅ |
| JSON-LD | `VideoGame` + `WebSite`, valid JSON ✅ (not yet run through validator.schema.org: **owner** can, or I can after deploy) |
| robots.txt | 200, allows all, points to sitemap ✅ |
| sitemap.xml | 200, valid, 1 URL ✅ |
| Favicon / manifest | SVG icon + manifest ✅. No `favicon.ico` or PNG icons (older browsers, Google favicon in results prefers a raster/ICO ≥ 48 px). ⚠️ |
| Google verification | `google83b2…html` present ✅. Whether Search Console verification and sitemap submission are done: **owner**. |

## 3. Issues found (priority order)

### Critical
1. **Thin rendered content.** The served HTML contains a good intro, feature list and controls,
   but React replaces `#root` on load. Googlebot renders JavaScript, so the indexed page is the
   game's home panel: one H1 ("Shadow Shift") and UI labels, almost no descriptive text. The
   pre-load text is effectively invisible to Google.
2. **Only one indexable URL.** Every keyword must rank on the homepage; there are no pages for
   informational searches ("how to play", tips, features).

### High
3. **H1 is just "Shadow Shift"** after render (no keyword context).
4. **Raster favicons missing** (`favicon.ico`, 192/512 PNG, apple-touch PNG).
5. **Large first load for the game:** main JS 954 kB (261 kB gzip, mostly Three.js) plus
   `runner.glb` 3.5 MB. The runner loads in the background with a fallback, so it does not block
   first paint, but it hurts mobile data use. Model compression (meshopt/Draco) needs a tool my
   permissions blocked earlier.
6. **No analytics:** no way to measure visitors → game starts → restarts.

### Medium
7. No legal/trust pages (privacy, terms, contact). Needed once analytics is added.
8. Hero image `alt=""` is correct (decorative), but there is no crawlable gameplay screenshot.

## 4. Not measured here (needs a browser tool or account)

- **Lighthouse / PageSpeed / Core Web Vitals:** run https://pagespeed.web.dev/ on the live URL
  (**owner**, 1 minute). I have not fabricated scores.
- **Index status, queries, impressions:** Google Search Console (**owner**).
- **Keyword volumes/difficulty:** need Keyword Planner, Ahrefs or Semrush (**owner**). Earlier
  research found competitor wording only, no volumes.

## 5. Proposed plan (for approval)

All pages are **static HTML files** built by Vite alongside the game (multi-page build). Reasons:
fully crawlable without JavaScript, zero runtime cost, no router or framework, and the host
already serves real files with real 404s. The game page itself stays as it is.

**Phase 1: technical foundation (small, low risk)**
- Keep the descriptive intro crawlable *after* render: add a short visible "About the game"
  section and footer links below the game home (outside the 100vh panel), so the rendered page
  has real text and internal links.
- H1 → "Shadow Shift – Free 3D Parkour Game" (visually unchanged styling).
- Add `favicon.ico` + 192/512 PNG icons from the existing logo.
- Sitemap and canonical per page.

**Phase 2: content pages (static, real content only)**
`/how-to-play/`, `/game-features/`, `/gameplay-tips/`, `/about/`, plus `/privacy-policy/` and
`/terms/`. Each: unique title/description, one H1, BreadcrumbList JSON-LD, links back to Play.
Text written from the actual mechanics and controls in the code. No blog yet: a blog only pays
off with regular publishing, which needs you.

**Phase 3: analytics (needs your decision)**
GA4 and/or Microsoft Clarity need your account IDs, and add third-party scripts (affects privacy
policy and possibly a consent banner in the EU/UK). I will not add them without your IDs and OK.

**Phase 4: owner tasks (documented, not done by me)**
Search Console sitemap submission and URL inspection, Bing Webmaster Tools, PageSpeed baseline,
directory submissions (itch.io, CrazyGames, Poki, Game Jolt), YouTube/TikTok trailer upload
(the 10 s ad is ready in `ad/`).

**Risks to gameplay:** none for Phases 1–2 (separate static pages; the game bundle is
untouched). The visible section under the home panel must not interfere with the 100vh home or
input; it will be tested with the existing unit and e2e checks.

**Decisions needed from you**
1. Approve Phases 1–2 as described.
2. Analytics: GA4, Clarity, both or none? If yes, send the measurement IDs.
3. Contact: an email address to show on the contact/privacy pages (I will not invent one).
4. Custom domain: buy one (for example shadowshiftgame.com) or stay on `wasmer.app` for now?
