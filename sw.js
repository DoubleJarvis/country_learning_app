// Service worker for offline play.
//
// Strategy:
//  - install: precache the same-origin app shell (HTML, CSS, all JS, JSON data,
//    the tiles archive, icons and every country silhouette SVG) plus the CORS-
//    enabled CDN libs. Best-effort: one bad URL won't fail the whole install.
//  - same-origin CODE (js/css/html/json): network-first, so edits stay fresh
//    while online; falls back to cache when offline. The dev cache-buster (?v=)
//    is stripped so one cache entry serves every reload.
//  - everything else (tiles/svg/png, CDN libs, glyph fonts): cache-first.
//
// CDN libraries pull in transitive imports that can't all be pre-listed, so
// those are cached at runtime: full offline works after one online load.
//
// Bump CACHE_VERSION to force clients onto a fresh cache.
const CACHE_VERSION = "v1"
const CACHE = `country-learning-${CACHE_VERSION}`

// Known CORS-enabled CDN entry points (transitive deps cached at runtime).
const PRECACHE_CDN = [
  "https://unpkg.com/@hotwired/stimulus@3.2.2/dist/stimulus.js",
  "https://ga.jspm.io/npm:maplibre-gl@4.7.1/dist/maplibre-gl.js",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css",
  "https://esm.sh/pmtiles@3"
]

const PRECACHE_SHELL = [
  "./",
  "./index.html",
  "./index.css",
  "./adjacency.json",
  "./tiles/countries.pmtiles",
  "./icon.png",
  "./icon.svg",
  "./js/app.js",
  "./js/map.js",
  "./js/country_names.js",
  "./js/country_shapes.js",
  "./js/adjacency_helper.js",
  "./js/db.js",
  "./js/settings.js",
  "./js/templates.js",
  "./js/controllers/practice_controller.js",
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
    await Promise.allSettled(PRECACHE.map(url => cache.add(url)))
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

// Same-origin code we edit during development.
function isCode(url) {
  return /\.(js|css|html|json)$/.test(url.pathname)
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request, { ignoreSearch: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(stripSearch(request.url), response.clone())
  }
  return response
}

async function networkFirst(request, fallback) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response && response.ok) await cache.put(stripSearch(request.url), response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true })
    if (cached) return cached
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

  const url = new URL(request.url)
  const sameOrigin = url.origin === self.location.origin

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"))
  } else if (sameOrigin && isCode(url)) {
    event.respondWith(networkFirst(request))
  } else {
    event.respondWith(cacheFirst(request))
  }
})
