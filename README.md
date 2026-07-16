# Country Learning

A static, no-build single-page app for learning world geography (quizzes, border
games, "name all" modes, practice). Stimulus controllers + MapLibre, served as
plain files.

- Map basemap: self-hosted Natural Earth vector tiles — see [tiles/README.md](tiles/README.md).
- Offline support: a service worker ([sw.js](sw.js)) — see below.

## Running locally

Serve the project root with any static server, e.g.:

```sh
python -m http.server 8899
```

No build step. Local JS modules are loaded through an import map in
`index.html` with a per-load `?v=` cache-buster (see the inline `<script>`).

## Service worker / caching

[sw.js](sw.js) makes the app installable and fully playable offline, and is
tuned for a **snappy production** experience: it is **cache-first for
everything**. Once a page is controlled by the worker, it serves all assets
(HTML, JS, CSS, map tiles, SVGs, fonts, CDN libs) straight from the Cache
Storage and **never waits on — or even contacts — the network** for them.

This is great for prod and **deliberately trades away the dev experience**.

### ⚠️ Dev caveat: your edits won't show up

Because nothing is revalidated against the network, editing a file and reloading
shows **no change** — the worker keeps serving the cached copy. The `?v=`
cache-buster does **not** help here; the worker ignores the query string on
purpose so one cache entry serves every reload.

To see changes, pick one:

1. **Bump `CACHE_VERSION`** in [sw.js](sw.js) (`v3` → `v4`, …) and reload twice.
   - 1st reload: the new worker installs (re-fetching the precache with
     `cache:"reload"`, i.e. bypassing the HTTP cache) and activates.
   - 2nd reload: the new worker controls the page from the start and serves the
     fresh assets. `activate` also deletes the old versioned cache.
2. **DevTools → Application → Service Workers → tick "Update on reload"** while
   you work. Each reload reinstalls the worker, so edits appear (after the
   reinstall completes). Easiest day-to-day option.
3. **DevTools → Application → Service Workers → Unregister** (or **Storage →
   Clear site data**) to drop the worker entirely, then reload. Use this if
   things get into a weird state.

If you don't want the worker interfering at all during a dev session, Unregister
it — registration only re-happens on a normal (non-DevTools-blocked) load of
`index.html`.

### Deploying (prod)

The same rule applies to releases: **bump `CACHE_VERSION` on every deploy.**
Otherwise returning visitors keep serving the previously cached code forever.
The version bump is what ships new code/assets to clients (old caches are purged
in `activate`).

If you regenerate the map tiles (see [tiles/README.md](tiles/README.md)), that's
just another asset change — bump `CACHE_VERSION` so the new `countries.pmtiles`
is precached.

### Testing offline

The DevTools **Network → Offline** toggle does **not** throttle the service
worker's own requests, so you may still see requests in your server log. For a
localhost server, turning off Wi-Fi doesn't help either (loopback stays up).

The reliable test is to **stop the dev server** (Ctrl+C) and reload — if the app
loads and plays with the server down, it's genuinely offline-capable. (DevTools
→ Application → Service Workers also has its own **Offline** checkbox that does
cover the worker, if you prefer to stay in the browser.)

### What's cached

- Precached on install: the app shell (`index.html`, `index.css`, every JS file
  under `js/`), `adjacency.json`, `tiles/countries.pmtiles`, app icons, all
  country SVGs under `icons/countries/`, and the top-level CDN libraries.
- Cached at runtime (first online load): CDN transitive imports, glyph fonts,
  and anything else fetched. So **full** offline coverage is guaranteed after one
  complete online load following an install.
