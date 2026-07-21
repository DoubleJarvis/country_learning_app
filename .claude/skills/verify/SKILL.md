---
name: verify
description: Build/launch/drive recipe for verifying changes to this SPA in a real browser.
---

# Verifying changes in this app

Static SPA, no build step — edits to js/css are live on reload.

## Launch

```bash
python3 serve.py   # HTTP on :8800, HTTPS on :8843 (needs the mkcert pair in repo root)
```

Drive `http://localhost:8800/#<route>` (routes in js/app.js). localhost is a
secure context, so the service worker registers even over HTTP.

## Drive with Playwright

`npx playwright` v1.61+ is installed globally with chromium cached; `npm i playwright`
in a scratch dir gives a scriptable module. Gotchas that matter:

- Wait for `#asset-loader` to be **detached** before interacting — the app
  blocks on downloading tiles/countries.pmtiles first.
- The importmap (index.html) maps bare names, so page-context
  `await import('db')` / `import('shared_map')` returns the same module
  instances the controllers use. Seed test data through the app's own db:
  ```js
  const { quizDb } = await import('db')
  await quizDb.initialize()
  quizDb.recordGuess('SVN','Slovenia','normal','incorrect','SVK','Slovakia',4200)
  await quizDb.saveNow()
  ```
  Data persists in IndexedDB per browser context; a fresh context = empty db.
- To click a country on the map, project geo coords to pixels in page context:
  `getSharedMap().project([lng,lat])` + container `getBoundingClientRect()`,
  then `page.mouse.click` at that point. Allow ~1.5s after starting a mode for
  the fitBounds animation before clicking.
- Mobile layout: viewport ≤700px wide, use `hasTouch: true` and
  `page.touchscreen.tap`.

## Service worker

`sw.js` precaches controllers by filename — a new controller file must be added
to `PRECACHE_SHELL` and `CACHE_VERSION` bumped, or installed PWAs keep the old
code. Dev reloads over localhost are unaffected (fresh contexts each run).
