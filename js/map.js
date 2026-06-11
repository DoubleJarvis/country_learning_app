import maplibregl from "maplibre-gl"

// Single shared MapLibre instance reused across all game modes, so switching
// modes doesn't re-create the canvas and reload tiles (which made the page jump).
// app.js moves the element into each page's [data-map-slot] on render.

const BASE_LAYER_IDS = ["background", "countries-preview-fill", "countries-preview-outline"]

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
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        countries: {
          type: "vector",
          url: "https://demotiles.maplibre.org/tiles/tiles.json"
        }
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
    projection: "mercator",
    interactive: false
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
// layers, default world view, no interaction. Called between mode switches.
export function resetSharedMap() {
  if (!map) return

  whenMapReady(stripModeLayers)

  map.boxZoom.disable()
  map.scrollZoom.disable()
  map.dragPan.disable()
  map.dragRotate.disable()
  map.keyboard.disable()
  map.doubleClickZoom.disable()
  map.touchZoomRotate.disable()

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
