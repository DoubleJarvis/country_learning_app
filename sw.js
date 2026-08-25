// Service worker for offline play. Optimized for a snappy production app:
// cache-first for EVERYTHING, so a controlled page never waits on the network.
//
// Strategy:
//  - install: precache the same-origin app shell (HTML, CSS, all JS, JSON data,
//    the tiles archive, icons and every country silhouette SVG) plus the CORS-
//    enabled CDN libs, fetched with cache:"reload" so a version bump always
//    pulls fresh bytes. Best-effort: one bad URL won't fail the whole install.
//  - fetch: cache-first for all GETs. Served from cache with no network hit (the
//    dev cache-buster ?v= is ignored on match). Cache misses fall through to the
//    network and get cached. CDN transitive imports are picked up this way, so
//    full offline works after one online load.
//
// CONSEQUENCE (see README "Service worker / caching"): because nothing is ever
// revalidated against the network, code/asset edits are INVISIBLE until the
// cache is refreshed. Every deploy AND every local code change that you want to
// see must bump CACHE_VERSION (or use DevTools "Update on reload" / Unregister).
const CACHE_VERSION = "v6"
const CACHE = `country-learning-${CACHE_VERSION}`

// Known CORS-enabled CDN entry points (transitive deps cached at runtime).
//
// These are precached rather than left to the runtime cache-first path because
// that path only fills on first use: anything not fetched during an online
// session simply isn't there offline. sql.js is needed for the stats database
// (and pulls its own .wasm via locateFile), and the glyph range is only
// requested once a symbol layer first draws a label - so without these two, a
// player who installs and goes offline early loses their stats or their map
// labels. Latin covers every display_name, hence the single 0-255 range.
const PRECACHE_CDN = [
  "https://unpkg.com/@hotwired/stimulus@3.2.2/dist/stimulus.js",
  "https://ga.jspm.io/npm:maplibre-gl@4.7.1/dist/maplibre-gl.js",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css",
  "https://esm.sh/pmtiles@3",
  "https://sql.js.org/dist/sql-wasm.js",
  "https://sql.js.org/dist/sql-wasm.wasm",
  "https://demotiles.maplibre.org/font/Noto%20Sans%20Regular/0-255.pbf"
]

const PRECACHE_SHELL = [
  "./",
  "./index.html",
  "./index.css",
  "./manifest.json",
  "./adjacency.json",
  "./tiles/countries.pmtiles",
  "./icon.png",
  "./icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-maskable-512.png",
  "./js/app.js",
  "./js/map.js",
  "./js/country_names.js",
  "./js/country_shapes.js",
  "./js/adjacency_helper.js",
  "./js/db.js",
  "./js/settings.js",
  "./js/templates.js",
  "./js/controllers/practice_controller.js",
  "./js/controllers/practice_pairs_controller.js",
  "./js/controllers/quiz_borders_controller.js",
  "./js/controllers/quiz_borders_hard_controller.js",
  "./js/controllers/quiz_controller.js",
  "./js/controllers/quiz_hard_controller.js",
  "./js/controllers/quiz_name_all_controller.js",
  "./js/controllers/quiz_name_all_easy_controller.js",
  "./js/controllers/quiz_name_all_hard_controller.js",
  "./js/controllers/quiz_place_controller.js",
  "./js/controllers/stats_controller.js",
  "./icons/countries/AFG.svg",
  "./icons/countries/AGO.svg",
  "./icons/countries/ALB.svg",
  "./icons/countries/AND.svg",
  "./icons/countries/ARE.svg",
  "./icons/countries/ARG.svg",
  "./icons/countries/ARM.svg",
  "./icons/countries/AUS.svg",
  "./icons/countries/AUT.svg",
  "./icons/countries/AZE.svg",
  "./icons/countries/BDI.svg",
  "./icons/countries/BEL.svg",
  "./icons/countries/BEN.svg",
  "./icons/countries/BFA.svg",
  "./icons/countries/BGD.svg",
  "./icons/countries/BGR.svg",
  "./icons/countries/BHR.svg",
  "./icons/countries/BIH.svg",
  "./icons/countries/BLR.svg",
  "./icons/countries/BLZ.svg",
  "./icons/countries/BOL.svg",
  "./icons/countries/BRA.svg",
  "./icons/countries/BRN.svg",
  "./icons/countries/BTN.svg",
  "./icons/countries/BWA.svg",
  "./icons/countries/CAF.svg",
  "./icons/countries/CAN.svg",
  "./icons/countries/CHE.svg",
  "./icons/countries/CHL.svg",
  "./icons/countries/CHN.svg",
  "./icons/countries/CIV.svg",
  "./icons/countries/CMR.svg",
  "./icons/countries/COD.svg",
  "./icons/countries/COG.svg",
  "./icons/countries/COL.svg",
  "./icons/countries/CRI.svg",
  "./icons/countries/CUB.svg",
  "./icons/countries/CYP.svg",
  "./icons/countries/CZE.svg",
  "./icons/countries/DEU.svg",
  "./icons/countries/DJI.svg",
  "./icons/countries/DNK.svg",
  "./icons/countries/DOM.svg",
  "./icons/countries/DZA.svg",
  "./icons/countries/ECU.svg",
  "./icons/countries/EGY.svg",
  "./icons/countries/ERI.svg",
  "./icons/countries/ESP.svg",
  "./icons/countries/EST.svg",
  "./icons/countries/ETH.svg",
  "./icons/countries/FIN.svg",
  "./icons/countries/FJI.svg",
  "./icons/countries/FRA.svg",
  "./icons/countries/GAB.svg",
  "./icons/countries/GBR.svg",
  "./icons/countries/GEO.svg",
  "./icons/countries/GHA.svg",
  "./icons/countries/GIN.svg",
  "./icons/countries/GMB.svg",
  "./icons/countries/GNB.svg",
  "./icons/countries/GNQ.svg",
  "./icons/countries/GRC.svg",
  "./icons/countries/GRL.svg",
  "./icons/countries/GTM.svg",
  "./icons/countries/GUY.svg",
  "./icons/countries/HKG.svg",
  "./icons/countries/HND.svg",
  "./icons/countries/HRV.svg",
  "./icons/countries/HTI.svg",
  "./icons/countries/HUN.svg",
  "./icons/countries/IDN.svg",
  "./icons/countries/IND.svg",
  "./icons/countries/IRL.svg",
  "./icons/countries/IRN.svg",
  "./icons/countries/IRQ.svg",
  "./icons/countries/ISL.svg",
  "./icons/countries/ISR.svg",
  "./icons/countries/ITA.svg",
  "./icons/countries/JAM.svg",
  "./icons/countries/JOR.svg",
  "./icons/countries/JPN.svg",
  "./icons/countries/KAZ.svg",
  "./icons/countries/KEN.svg",
  "./icons/countries/KGZ.svg",
  "./icons/countries/KHM.svg",
  "./icons/countries/KOR.svg",
  "./icons/countries/KWT.svg",
  "./icons/countries/LAO.svg",
  "./icons/countries/LBN.svg",
  "./icons/countries/LBR.svg",
  "./icons/countries/LBY.svg",
  "./icons/countries/LIE.svg",
  "./icons/countries/LKA.svg",
  "./icons/countries/LSO.svg",
  "./icons/countries/LTU.svg",
  "./icons/countries/LUX.svg",
  "./icons/countries/LVA.svg",
  "./icons/countries/MAC.svg",
  "./icons/countries/MAR.svg",
  "./icons/countries/MCO.svg",
  "./icons/countries/MDA.svg",
  "./icons/countries/MDG.svg",
  "./icons/countries/MDV.svg",
  "./icons/countries/MEX.svg",
  "./icons/countries/MKD.svg",
  "./icons/countries/MLI.svg",
  "./icons/countries/MMR.svg",
  "./icons/countries/MNE.svg",
  "./icons/countries/MNG.svg",
  "./icons/countries/MOZ.svg",
  "./icons/countries/MRT.svg",
  "./icons/countries/MWI.svg",
  "./icons/countries/MYS.svg",
  "./icons/countries/NAM.svg",
  "./icons/countries/NER.svg",
  "./icons/countries/NGA.svg",
  "./icons/countries/NIC.svg",
  "./icons/countries/NLD.svg",
  "./icons/countries/NOR.svg",
  "./icons/countries/NPL.svg",
  "./icons/countries/NZL.svg",
  "./icons/countries/OMN.svg",
  "./icons/countries/PAK.svg",
  "./icons/countries/PAN.svg",
  "./icons/countries/PER.svg",
  "./icons/countries/PHL.svg",
  "./icons/countries/PNG.svg",
  "./icons/countries/POL.svg",
  "./icons/countries/PRK.svg",
  "./icons/countries/PRT.svg",
  "./icons/countries/PRY.svg",
  "./icons/countries/QAT.svg",
  "./icons/countries/ROU.svg",
  "./icons/countries/RUS.svg",
  "./icons/countries/RWA.svg",
  "./icons/countries/SAU.svg",
  "./icons/countries/SDN.svg",
  "./icons/countries/SEN.svg",
  "./icons/countries/SGP.svg",
  "./icons/countries/SLE.svg",
  "./icons/countries/SLV.svg",
  "./icons/countries/SMR.svg",
  "./icons/countries/SOM.svg",
  "./icons/countries/SRB.svg",
  "./icons/countries/SUR.svg",
  "./icons/countries/SVK.svg",
  "./icons/countries/SVN.svg",
  "./icons/countries/SWE.svg",
  "./icons/countries/SWZ.svg",
  "./icons/countries/SXM.svg",
  "./icons/countries/SYR.svg",
  "./icons/countries/TCD.svg",
  "./icons/countries/TGO.svg",
  "./icons/countries/THA.svg",
  "./icons/countries/TJK.svg",
  "./icons/countries/TKM.svg",
  "./icons/countries/TLS.svg",
  "./icons/countries/TUN.svg",
  "./icons/countries/TUR.svg",
  "./icons/countries/TZA.svg",
  "./icons/countries/UGA.svg",
  "./icons/countries/UKR.svg",
  "./icons/countries/URY.svg",
  "./icons/countries/USA.svg",
  "./icons/countries/UZB.svg",
  "./icons/countries/VEN.svg",
  "./icons/countries/VNM.svg",
  "./icons/countries/YEM.svg",
  "./icons/countries/ZAF.svg",
  "./icons/countries/ZMB.svg",
  "./icons/countries/ZWE.svg",
]

const PRECACHE = [...PRECACHE_SHELL, ...PRECACHE_CDN]

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    // Best-effort: don't let a single failed asset abort the whole install.
    // Fetch with cache:"reload" so the precache bypasses the browser HTTP cache
    // - otherwise a regenerated asset (e.g. rebuilt tiles) could be copied stale
    // into the new versioned cache, defeating the CACHE_VERSION bump.
    await Promise.allSettled(PRECACHE.map(async url => {
      const response = await fetch(url, { cache: "reload" })
      if (response && (response.ok || response.type === "opaque")) {
        await cache.put(url, response.clone())
      }
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

function stripSearch(url) {
  const u = new URL(url)
  u.search = ""
  return u.toString()
}

// Cache-first for everything: serve the cached copy without touching the network
// (the ?v= dev cache-buster is ignored on match, so one entry serves every load).
// Only on a cache miss do we hit the network and cache the result. New content
// ships via a CACHE_VERSION bump, whose install repopulates the cache fresh.
async function cacheFirst(request, fallback) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request, { ignoreSearch: true })
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response && (response.ok || response.type === "opaque")) {
      await cache.put(stripSearch(request.url), response.clone())
    }
    return response
  } catch (error) {
    if (fallback) {
      const fb = await cache.match(fallback)
      if (fb) return fb
    }
    throw error
  }
}

self.addEventListener("fetch", event => {
  const request = event.request
  if (request.method !== "GET") return

  // SPA navigations resolve to the cached app shell; everything else is a plain
  // cache-first lookup.
  if (request.mode === "navigate") {
    event.respondWith(cacheFirst(request, "./index.html"))
  } else {
    event.respondWith(cacheFirst(request))
  }
})
