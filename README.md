# Country Learning

A static, no-build single-page app for learning world geography (quizzes, border
games, "name all" modes, practice). Stimulus controllers + MapLibre, served as
plain files.

- Map basemap: self-hosted Natural Earth vector tiles — see [tiles/README.md](tiles/README.md).
- Offline support: a service worker ([sw.js](sw.js)) — see below.
- Installable (PWA): [manifest.json](manifest.json) — see below; testing it on a
  desktop or a real phone is covered in [pwa.md](pwa.md).

## Running locally

Serve the project root with any static server, e.g.:

```sh
python -m http.server 8899
```

No build step. Local JS modules are loaded through an import map in
`index.html` with a per-load `?v=` cache-buster (see the inline `<script>`).

## Installing (PWA)

[manifest.json](manifest.json) declares `display: standalone`, so once installed
the app runs in its own window — no tab strip, no URL bar — with its own icon in
the dock/taskbar/home screen. Hash routes still drive navigation, you just can't
see the URL.

- **Desktop**: an install button appears in Chrome/Edge's address bar; Safari has
  "Add to Dock".
- **iOS**: Share → Add to Home Screen.
- **HTTPS is required** to install anywhere except `localhost`, so the local
  `python -m http.server` can't be installed from another device.

Icons: `icon.png` (512, "any"), `icons/icon-192.png`, and
`icons/icon-maskable-512.png` — the maskable one keeps the mark inside the 80%
safe zone on an opaque background so Android's mask crops only background.

**Everything the app needs offline must be in `PRECACHE_*` in [sw.js](sw.js).**
The runtime cache-first path only fills on first use, so anything not precached
is missing for a player who installs and goes offline before happening to
trigger it. That's why `sql.js` (+ its `.wasm`) and the Noto Sans glyph range
are precached rather than left to chance.

## Storage

The stats database is a SQLite file (a `Uint8Array`) held in **IndexedDB**
(`country_learning` → `state` → `database`), stored as raw bytes.

It used to live in `localStorage` as `JSON.stringify(Array.from(bytes))`, which
inflates every byte into up to four UTF-16 characters — measured at ~4x against
a ~5MB quota, so a long enough history would start silently failing to save.
[js/db.js](js/db.js) migrates that copy on first load and only removes the
`quiz_database` key once IndexedDB has committed the replacement.

The app calls `navigator.storage.persist()` on startup ([js/app.js](js/app.js))
so the browser won't evict the one thing here that can't be re-downloaded.
Chrome only grants this for installed apps or sites with real engagement, and
returns `false` otherwise — that's expected, not an error.

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
