import maplibregl from "maplibre-gl"
import { PMTiles } from "pmtiles"

// Single shared MapLibre instance reused across all game modes, so switching
// modes doesn't re-create the canvas and reload tiles (which made the page jump).
// app.js moves the element into each page's [data-map-slot] on render.

// Self-hosted Natural Earth (1:10m) country polygons, built into a single
// PMTiles archive (see tiles/README.md). Higher quality than MapLibre's demo
// tiles, keeping the same "countries" source-layer and ADM0_A3 property.
//
// PMTiles normally streams tiles via HTTP range requests on demand. We don't
// want that here - we download the whole archive once (preloadCountryTiles) and
// serve every tile from memory through a custom "countrytiles://" protocol, so
// there are zero network requests while playing (and no range-serving needed).
const TILES_URL = new URL("./tiles/countries.pmtiles", document.baseURI).href
export const GLYPHS_URL = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"

// The tiles template uses our custom protocol instead of a pmtiles:// url, so
// MapLibre never resolves a real URL or issues a tile HTTP request - it just
// hands z/x/y to our handler. maxzoom must match the archive (built with -z8).
export const COUNTRIES_SOURCE = {
  type: "vector",
  tiles: ["countrytiles://{z}/{x}/{y}"],
  minzoom: 0,
  maxzoom: 8
}

// In-memory PMTiles source: slices byte ranges out of the downloaded ArrayBuffer
// instead of issuing HTTP range requests.
class BufferSource {
  constructor(key, buffer) {
    this._key = key
    this._buffer = buffer
  }
  getKey() {
    return this._key
  }
  async getBytes(offset, length) {
    return { data: this._buffer.slice(offset, offset + length) }
  }
}

let countriesArchive = null

// tippecanoe gzips tiles by default; depending on the pmtiles build getZxy may
// return them still gzipped, so inflate only when we see the gzip magic bytes.
async function maybeGunzip(buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return buffer
  const stream = new Response(bytes).body.pipeThrough(new DecompressionStream("gzip"))
  return await new Response(stream).arrayBuffer()
}

maplibregl.addProtocol("countrytiles", async (params, abortController) => {
  const match = params.url.match(/countrytiles:\/\/(\d+)\/(\d+)\/(\d+)/)
  if (!match || !countriesArchive) return { data: new Uint8Array() }

  const [, z, x, y] = match
  try {
    const tile = await countriesArchive.getZxy(+z, +x, +y, abortController.signal)
    if (!tile || !tile.data) return { data: new Uint8Array() }
    return { data: await maybeGunzip(tile.data) }
  } catch {
    return { data: new Uint8Array() }
  }
})

// Downloads the whole archive once into memory, reporting download progress via
// onProgress(receivedBytes, totalBytes) (totalBytes is 0 if unknown). Resolves
// even on failure so a missing tiles file doesn't block the rest of the app.
// Memoized; awaited in app.js init() before the first map is built.
let preloadPromise = null
export function preloadCountryTiles(onProgress) {
  if (!preloadPromise) {
    preloadPromise = fetch(TILES_URL)
      .then(async response => {
        if (!response.ok) throw new Error(`tiles fetch failed: ${response.status}`)

        const total = Number(response.headers.get("Content-Length")) || 0
        const reader = response.body.getReader()
        const chunks = []
        let received = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          onProgress?.(received, total)
        }

        const buffer = new Uint8Array(received)
        let offset = 0
        for (const chunk of chunks) {
          buffer.set(chunk, offset)
          offset += chunk.length
        }
        countriesArchive = new PMTiles(new BufferSource(TILES_URL, buffer.buffer))
      })
      .catch(error => {
        console.error("Failed to preload country tiles:", error)
      })
  }
  return preloadPromise
}

const BASE_LAYER_IDS = ["background", "countries-preview-fill", "countries-preview-outline"]

// Width at/below which the mobile layout is active (must match the CSS
// breakpoint in index.css).
export const MOBILE_BREAKPOINT = 700
export const isMobileLayout = () => window.innerWidth <= MOBILE_BREAKPOINT

// fitBounds options for framing a single country. Desktop keeps its generous
// symmetric padding; mobile uses tight, asymmetric padding so the country lands
// in the clear band between the top status strip and the bottom action row /
// keyboard rather than behind them, and a higher maxZoom because a country that
// fills a 1280px window is a speck at 360.
export function countryFitOptions() {
  if (isMobileLayout()) {
    return { padding: { top: 60, bottom: 104, left: 24, right: 24 }, maxZoom: 5.5 }
  }
  return { padding: { top: 150, bottom: 150, left: 150, right: 150 }, maxZoom: 4 }
}

let map = null
let mapElement = null
let styleReady = false
let pendingReadyCallbacks = []

export function getSharedMapElement() {
  if (!mapElement) {
    mapElement = document.createElement("div")
    mapElement.id = "shared-map"
    mapElement.style.width = "100%"
    mapElement.style.height = "100%"
  }
  return mapElement
}

export function getSharedMap() {
  if (map) return map

  map = new maplibregl.Map({
    container: getSharedMapElement(),
    style: {
      version: 8,
      glyphs: GLYPHS_URL,
      sources: {
        countries: COUNTRIES_SOURCE
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color": "#1a1a1a"
          }
        },
        {
          id: "countries-preview-fill",
          type: "fill",
          source: "countries",
          "source-layer": "countries",
          paint: {
            "fill-color": "#2a2a2a",
            "fill-opacity": 1
          }
        },
        {
          id: "countries-preview-outline",
          type: "line",
          source: "countries",
          "source-layer": "countries",
          paint: {
            "line-color": "#555555",
            "line-width": 1
          }
        }
      ]
    },
    center: [0, 20],
    zoom: 1.5,
    projection: "mercator"
  })

  map.on("load", () => {
    styleReady = true
    const callbacks = pendingReadyCallbacks
    pendingReadyCallbacks = []
    callbacks.forEach(callback => callback())
  })

  return map
}

// Runs the callback once the shared map's style is ready. Tracked with our own
// flag: the "load" event only ever fires once per map instance, and MapLibre's
// isStyleLoaded() is unreliable here (it also reports false while tiles load).
export function whenMapReady(callback) {
  getSharedMap()
  if (styleReady) {
    callback()
  } else {
    pendingReadyCallbacks.push(callback)
  }
}

// Returns the shared map to its mode-neutral state: only the base preview
// layers, default world view. Called between mode switches.
//
// Interaction is deliberately left on: the shared map is pannable/zoomable in
// every mode from the moment it renders, including on the region-selection and
// results screens.
export function resetSharedMap() {
  if (!map) return

  whenMapReady(stripModeLayers)

  map.jumpTo({ center: [0, 20], zoom: 1.5 })
}

function stripModeLayers() {
  for (const layer of map.getStyle().layers) {
    if (!BASE_LAYER_IDS.includes(layer.id)) {
      map.removeLayer(layer.id)
    }
  }
  map.setFilter("countries-preview-fill", null)
  map.setFilter("countries-preview-outline", null)
}
