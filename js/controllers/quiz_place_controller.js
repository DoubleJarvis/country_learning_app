import { Controller } from "@hotwired/stimulus"
import { countriesMapping, getCountriesForRegion, countryBounds } from "country_names"
import { quizDb } from "db"
import { getSharedMap, whenMapReady } from "shared_map"
import { applyCountryShape } from "country_shapes"

const TROPIC_LAT = 23.43656

export default class extends Controller {
  static targets = ["container", "regionSelection", "statsBar", "remainingCount",
                    "correctCount", "incorrectCount", "actionBtn", "finishedBanner",
                    "finalCorrect", "finalIncorrect", "finalTime",
                    "tray", "countryName", "shapeSlot", "shape"]

  connect() {
    this.currentRegion = null
    this.remainingCountries = []
    this.currentCountry = null
    this.stats = { correct: 0, incorrect: 0 }
    this.placedCountries = []
    this.isFinished = false
    this.isDragging = false
    this.startTime = null
    this.countryStartTime = null
    this.hoverCountry = ""

    this.map = getSharedMap()
    this.boundResizeShape = () => this.resizeShape()
    this.map.on("zoom", this.boundResizeShape)

    whenMapReady(() => this.setupLayers())
    this.initializeDatabase()
  }

  async initializeDatabase() {
    await quizDb.initialize()
  }

  disconnect() {
    this.map.off("zoom", this.boundResizeShape)
  }

  setupLayers() {
    // DEBUG: country fills/borders stay visible for now; the blank-world look
    // hides them by filtering the preview layers to nothing:
    // this.map.setFilter("countries-preview-fill", ["==", "ADM0_A3", ""])
    // this.map.setFilter("countries-preview-outline", ["==", "ADM0_A3", ""])

    // Reference lines: equator, prime meridian, tropics
    if (!this.map.getSource("graticule")) {
      const latLine = lat => ({
        type: "Feature",
        properties: { kind: lat === 0 ? "major" : "tropic" },
        geometry: { type: "LineString", coordinates: [[-180, lat], [180, lat]] }
      })
      this.map.addSource("graticule", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            latLine(0),
            latLine(TROPIC_LAT),
            latLine(-TROPIC_LAT),
            {
              type: "Feature",
              properties: { kind: "major" },
              geometry: { type: "LineString", coordinates: [[0, -85], [0, 85]] }
            }
          ]
        }
      })
    }

    this.map.addLayer({
      id: "graticule-major",
      type: "line",
      source: "graticule",
      paint: {
        "line-color": "#555555",
        "line-width": 1
      },
      filter: ["==", "kind", "major"]
    })

    this.map.addLayer({
      id: "graticule-tropics",
      type: "line",
      source: "graticule",
      paint: {
        "line-color": "#444444",
        "line-width": 1,
        "line-dasharray": [3, 3]
      },
      filter: ["==", "kind", "tropic"]
    })

    // Country under the pointer while dragging
    this.map.addLayer({
      id: "country-hover",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#4a9eff",
        "fill-opacity": 0.4
      },
      filter: ["==", "ADM0_A3", ""]
    })

    // Locked-in countries
    this.map.addLayer({
      id: "countries-placed-green",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#4ade80",
        "fill-opacity": 0.7
      },
      filter: ["in", "ADM0_A3"]
    })

    this.map.addLayer({
      id: "countries-placed-red",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#ef4444",
        "fill-opacity": 0.7
      },
      filter: ["in", "ADM0_A3"]
    })

    this.map.addLayer({
      id: "countries-placed-outline",
      type: "line",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "line-color": "#555555",
        "line-width": 1
      },
      filter: ["in", "ADM0_A3"]
    })

    // Names for locked-in countries
    const nameMatchExpression = ["match", ["get", "ADM0_A3"]]
    Object.entries(countriesMapping).forEach(([code, data]) => {
      nameMatchExpression.push(code, data.display_name)
    })
    nameMatchExpression.push("")

    this.map.addLayer({
      id: "country-names",
      type: "symbol",
      source: "countries",
      "source-layer": "countries",
      layout: {
        "text-field": nameMatchExpression,
        "text-font": ["Noto Sans Regular"],
        "text-max-width": 10,
        "text-size": {
          stops: [
            [2, 10],
            [4, 12],
            [6, 16]
          ]
        }
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-blur": 1,
        "text-halo-color": "rgba(0, 0, 0, 0.8)",
        "text-halo-width": 1.5
      },
      filter: ["in", "ADM0_A3", ""],
      minzoom: 2
    })
  }

  selectRegion(event) {
    const region = event.currentTarget.dataset.region
    this.currentRegion = region
    this.remainingCountries = [...getCountriesForRegion(region)]
    this.remainingCountries.sort(() => Math.random() - 0.5)

    this.startTime = Date.now()

    this.regionSelectionTarget.style.display = "none"
    this.statsBarTarget.style.display = "flex"
    this.trayTarget.style.display = "flex"
    this.updateStats()

    whenMapReady(() => this.startGame())
  }

  startGame() {
    if (!this.map.getLayer("countries-placed-green")) {
      this.setupLayers()
    }

    this.map.boxZoom.enable()
    this.map.scrollZoom.enable()
    this.map.dragPan.enable()
    this.map.dragRotate.enable()
    this.map.keyboard.enable()
    this.map.doubleClickZoom.enable()
    this.map.touchZoomRotate.enable()

    this.nextCountry()
  }

  updateStats() {
    this.remainingCountTarget.textContent = this.remainingCountries.length
    this.correctCountTarget.textContent = this.stats.correct
    this.incorrectCountTarget.textContent = this.stats.incorrect
  }

  nextCountry() {
    this.resetShape()

    if (this.remainingCountries.length === 0) {
      this.endQuiz(true)
      return
    }

    this.currentCountry = this.remainingCountries[0]
    this.countryStartTime = Date.now()

    const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry
    this.countryNameTarget.textContent = displayName

    applyCountryShape(this.shapeTarget, this.currentCountry)
    this.resizeShape()
  }

  // Sizes the draggable shape to the country's projected on-map size at the
  // current zoom, clamped so tiny countries stay grabbable and huge ones fit
  // the tray. The slot keeps the size while the shape is dragged out.
  resizeShape() {
    if (!this.currentCountry || this.isFinished) return

    const bounds = countryBounds[this.currentCountry]
    let width = 60
    let height = 60

    if (bounds) {
      const sw = this.map.project([bounds[0], bounds[1]])
      const ne = this.map.project([bounds[2], bounds[3]])
      width = Math.abs(ne.x - sw.x)
      // Antimeridian-crossing bounds (west > east) project the wrong way around
      if (bounds[0] > bounds[2]) {
        const worldWidth = Math.abs(this.map.project([180, 0]).x - this.map.project([-180, 0]).x)
        width = Math.max(8, worldWidth - width)
      }
      height = Math.abs(sw.y - ne.y)
    }

    const maxDim = Math.max(width, height)
    let scale = 1
    if (maxDim > 280) scale = 280 / maxDim
    else if (maxDim < 28) scale = 28 / maxDim
    width = Math.round(width * scale)
    height = Math.round(height * scale)

    this.shapeTarget.style.width = `${width}px`
    this.shapeTarget.style.height = `${height}px`
    this.shapeSlotTarget.style.width = `${width}px`
    this.shapeSlotTarget.style.height = `${height}px`
  }

  startDrag(event) {
    if (!this.currentCountry || this.isFinished) return
    event.preventDefault()

    this.isDragging = true
    this.shapeTarget.setPointerCapture(event.pointerId)
    this.shapeTarget.classList.add("dragging")
    this.moveShapeTo(event.clientX, event.clientY)
  }

  moveDrag(event) {
    if (!this.isDragging) return
    this.moveShapeTo(event.clientX, event.clientY)
  }

  endDrag() {
    this.finishDrag()
  }

  cancelDrag() {
    this.finishDrag()
  }

  // Uses the last pointermove position rather than the release event's
  // coordinates: with pointer capture active, pointerup/pointercancel
  // coordinates are not reliable in every browser
  finishDrag() {
    if (!this.isDragging) return
    this.isDragging = false
    this.setHoverCountry("")

    const dropped = this.dropPointHitsCountry(this.lastDragX, this.lastDragY)
    if (dropped) {
      this.lockIn("green")
    } else {
      // Missed - back to the tray for another try
      this.resetShape()
    }
  }

  // The dragged shape is centered on the pointer, so the pointer position is
  // the drop point
  moveShapeTo(clientX, clientY) {
    this.lastDragX = clientX
    this.lastDragY = clientY
    this.shapeTarget.style.left = `${clientX}px`
    this.shapeTarget.style.top = `${clientY}px`
    this.updateHover(clientX, clientY)
  }

  // Highlights the country under the pointer while dragging
  updateHover(clientX, clientY) {
    const rect = this.map.getContainer().getBoundingClientRect()
    const features = this.map.queryRenderedFeatures(
      [clientX - rect.left, clientY - rect.top],
      { layers: ["countries-preview-fill"] }
    )
    this.setHoverCountry(features.length > 0 ? features[0].properties.ADM0_A3 : "")
  }

  setHoverCountry(code) {
    if (code === this.hoverCountry) return
    this.hoverCountry = code
    if (this.map.getLayer("country-hover")) {
      this.map.setFilter("country-hover", ["==", "ADM0_A3", code])
    }
  }

  dropPointHitsCountry(clientX, clientY) {
    const bounds = countryBounds[this.currentCountry]
    if (!bounds) return false

    const rect = this.map.getContainer().getBoundingClientRect()
    const lngLat = this.map.unproject([clientX - rect.left, clientY - rect.top])

    const [west, south, east, north] = bounds
    const lat = lngLat.lat
    // Normalize longitude: the map can pan across world copies
    const lng = ((lngLat.lng + 180) % 360 + 360) % 360 - 180

    const inLng = west <= east
      ? (lng >= west && lng <= east)
      : (lng >= west || lng <= east) // antimeridian-crossing bounds
    return inLng && lat >= south && lat <= north
  }

  resetShape() {
    this.shapeTarget.classList.remove("dragging")
    this.shapeTarget.style.left = ""
    this.shapeTarget.style.top = ""
  }

  lockIn(color) {
    const timeMs = Date.now() - this.countryStartTime
    const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry

    if (color === "green") {
      this.stats.correct++
      quizDb.recordGuess(this.currentCountry, displayName, "place", "correct", this.currentCountry, displayName, timeMs)
    } else {
      this.stats.incorrect++
      quizDb.recordGuess(this.currentCountry, displayName, "place", "incorrect", null, null, timeMs)
    }

    this.placedCountries.push({ code: this.currentCountry, color })
    this.updateMapLayers()

    this.remainingCountries.shift()
    this.updateStats()
    this.nextCountry()
  }

  skip() {
    if (!this.currentCountry || this.isFinished || this.isDragging) return
    this.lockIn("red")
  }

  updateMapLayers() {
    const greenCountries = this.placedCountries
      .filter(c => c.color === "green")
      .map(c => c.code)
    const redCountries = this.placedCountries
      .filter(c => c.color === "red")
      .map(c => c.code)
    const allPlaced = this.placedCountries.map(c => c.code)

    this.map.setFilter("countries-placed-green", ["in", "ADM0_A3", ...greenCountries])
    this.map.setFilter("countries-placed-red", ["in", "ADM0_A3", ...redCountries])
    this.map.setFilter("countries-placed-outline", ["in", "ADM0_A3", ...allPlaced])
    this.map.setFilter("country-names", ["in", "ADM0_A3", ...allPlaced])
  }

  finish() {
    this.endQuiz(false)
  }

  endQuiz(completedFully = true) {
    this.isFinished = true
    this.currentCountry = null

    const elapsedMs = Date.now() - this.startTime
    const totalSeconds = Math.floor(elapsedMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const milliseconds = Math.floor((elapsedMs % 1000) / 10)
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`

    quizDb.recordQuizRun(
      "place",
      this.currentRegion,
      this.stats.correct,
      0,
      this.stats.incorrect,
      elapsedMs,
      completedFully ? 1 : 0
    )

    this.finalCorrectTarget.textContent = this.stats.correct
    this.finalIncorrectTarget.textContent = this.stats.incorrect
    this.finalTimeTarget.textContent = `Time: ${timeString}`

    this.statsBarTarget.style.display = "none"
    this.trayTarget.style.display = "none"
    this.finishedBannerTarget.style.display = "block"

    this.map.flyTo({
      center: [0, 20],
      zoom: 1.5,
      duration: 1000
    })
  }

  restart() {
    this.currentRegion = null
    this.remainingCountries = []
    this.currentCountry = null
    this.stats = { correct: 0, incorrect: 0 }
    this.placedCountries = []
    this.isFinished = false
    this.isDragging = false
    this.startTime = null
    this.countryStartTime = null

    this.updateMapLayers()
    this.resetShape()

    this.finishedBannerTarget.style.display = "none"
    this.statsBarTarget.style.display = "none"
    this.trayTarget.style.display = "none"
    this.regionSelectionTarget.style.display = "block"

    this.map.boxZoom.disable()
    this.map.scrollZoom.disable()
    this.map.dragPan.disable()
    this.map.dragRotate.disable()
    this.map.keyboard.disable()
    this.map.doubleClickZoom.disable()
    this.map.touchZoomRotate.disable()

    this.map.jumpTo({ center: [0, 20], zoom: 1.5 })
  }

}
