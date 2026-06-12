import { Controller } from "@hotwired/stimulus"
import maplibregl from "maplibre-gl"
import { allCountryNames, nameToCode, countriesMapping, countryBounds } from "country_names"
import { quizDb } from "db"
import { getSharedMap } from "shared_map"

// Practice mode: shows shapes of the player's worst (or slowest) countries in
// random order, endlessly, until Finish is pressed. One controller serves both
// variants — the data-practice-source-value attribute picks the pool query.
// Nothing is ever recorded to the database.
export default class extends Controller {
  static values = { source: String } // "worst" or "slowest"

  static targets = ["startScreen", "startBtn", "statsBar", "correctCount", "incorrectCount",
                    "searchInput", "searchBox", "dropdown", "actionBtn", "finishedBanner",
                    "finalCorrect", "finalIncorrect", "finalTime",
                    "lastGuess", "lastGuessCard", "lastGuessName", "lastGuessShape",
                    "mainContainer", "overlayContainer", "navButtons"]

  connect() {
    this.highlightedIndex = -1
    this.suggestions = []
    this.pool = []
    this.deck = []
    this.currentCountry = null
    this.countrySvgs = {} // Cache of extracted shape SVGs per country code
    this.stats = { correct: 0, incorrect: 0 }
    this.isFinished = false
    this.startTime = null

    this.initializeMaps()
    this.initializeDatabase()
  }

  async initializeDatabase() {
    await quizDb.initialize()
    this.updateStartButton()
  }

  disconnect() {
    if (this.overlayMap) this.overlayMap.remove()
  }

  initializeMaps() {
    // Shared main map stays as the dim world preview backdrop
    this.mainMap = getSharedMap()

    // Overlay isolated country map (same setup as the hard quiz)
    this.overlayMap = new maplibregl.Map({
      container: this.overlayContainerTarget,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          countries: {
            type: "vector",
            url: "https://demotiles.maplibre.org/tiles/tiles.json"
          }
        },
        layers: []
      },
      center: [0, 20],
      zoom: 1,
      projection: "mercator",
      interactive: false,
      attributionControl: false
    })

    this.scaleControl = new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    })
    this.overlayMap.addControl(this.scaleControl, 'bottom-left')

    // Hide scale control until the game starts
    setTimeout(() => {
      const scaleElements = document.querySelectorAll('.maplibregl-ctrl-scale')
      scaleElements.forEach(el => el.style.display = 'none')
    }, 100)

    this.overlayMapLoaded = false
    this.overlayMap.on("load", () => {
      this.overlayMapLoaded = true
      this.setupOverlayMapLayers()
    })
  }

  setupOverlayMapLayers() {
    this.overlayMap.addLayer({
      id: "isolated-country",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#3a3a3a",
        "fill-opacity": 1
      },
      filter: ["==", "ADM0_A3", ""]
    })

    this.overlayMap.addLayer({
      id: "isolated-country-outline",
      type: "line",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "line-color": "#ffd700",
        "line-width": 2
      },
      filter: ["==", "ADM0_A3", ""]
    })
  }

  // Same lists the Stats page shows. Codes come from guesses recorded by the
  // map-based quizzes, but filter on countryBounds as a safety net.
  loadPool() {
    const rows = this.sourceValue === "slowest"
      ? quizDb.getSlowestCountries(20)
      : quizDb.getWorstCountries(20)

    return rows
      .map(row => row.country_code)
      .filter(code => countryBounds[code])
  }

  updateStartButton() {
    // The async db init may resolve after navigating away
    if (!this.hasStartBtnTarget) return

    const count = this.loadPool().length
    if (count === 0) {
      this.startBtnTarget.textContent = "No data yet — play some quizzes first"
      this.startBtnTarget.disabled = true
    } else {
      this.startBtnTarget.textContent = `Start practice (${count} ${count === 1 ? "country" : "countries"})`
      this.startBtnTarget.disabled = false
    }
  }

  startPractice() {
    this.pool = this.loadPool()
    if (this.pool.length === 0) return

    this.deck = []

    this.startTime = Date.now()

    this.startScreenTarget.style.display = "none"
    this.statsBarTarget.style.display = "flex"
    this.searchBoxTarget.style.display = "flex"
    this.lastGuessTarget.style.display = "none"
    this.updateStats()

    if (this.overlayMapLoaded) {
      this.beginRound()
    } else {
      this.overlayMap.once("load", () => this.beginRound())
    }
  }

  beginRound() {
    if (!this.overlayMap.getLayer("isolated-country")) {
      this.setupOverlayMapLayers()
    }

    // Blank the world preview so the shape is shown without context
    this.mainMap.setFilter("countries-preview-fill", ["in", "ADM0_A3"])
    this.mainMap.setFilter("countries-preview-outline", ["in", "ADM0_A3"])

    const scaleElements = document.querySelectorAll('.maplibregl-ctrl-scale')
    scaleElements.forEach(el => el.style.display = 'block')

    this.nextCountry()
    this.searchInputTarget.focus()
  }

  updateStats() {
    this.correctCountTarget.textContent = this.stats.correct
    this.incorrectCountTarget.textContent = this.stats.incorrect
  }

  nextCountry() {
    // Endless, but in rounds: draw from a shuffled copy of the pool without
    // replacement, so every country appears once before any repeats. When the
    // deck runs out, reshuffle — avoiding an immediate repeat across rounds.
    if (this.deck.length === 0) {
      this.deck = [...this.pool].sort(() => Math.random() - 0.5)
      if (this.deck.length > 1 && this.deck[0] === this.currentCountry) {
        this.deck.push(this.deck.shift())
      }
    }

    this.currentCountry = this.deck.shift()
    this.searchInputTarget.value = ""
    this.showIsolatedCountry(this.currentCountry)
  }

  showIsolatedCountry(countryCode) {
    if (!this.overlayMap.getLayer("isolated-country")) {
      if (this.overlayMap.isStyleLoaded()) {
        this.setupOverlayMapLayers()
      } else {
        this.overlayMap.once("styledata", () => {
          this.setupOverlayMapLayers()
          this.showIsolatedCountry(countryCode)
        })
        return
      }
    }

    this.overlayMap.setFilter("isolated-country", ["==", "ADM0_A3", countryCode])
    this.overlayMap.setFilter("isolated-country-outline", ["==", "ADM0_A3", countryCode])

    const bounds = countryBounds[countryCode]
    if (bounds) {
      this.overlayMap.fitBounds(
        [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
        {
          padding: 50,
          duration: 0,
          maxZoom: 8
        }
      )
    }
  }

  handleSearch(event) {
    const query = event.target.value.trim()

    if (!query) {
      this.hideDropdown()
      return
    }

    const matches = allCountryNames
      .map(name => {
        const matchResult = this.fuzzyMatch(query.toLowerCase(), name.toLowerCase())
        return matchResult ? { name, ...matchResult } : null
      })
      .filter(match => match !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    if (matches.length === 0) {
      this.hideDropdown()
      return
    }

    this.suggestions = matches.map(m => m.name)
    this.suggestionMatches = matches.map(m => m.matchInfo)
    this.highlightedIndex = 0
    this.showDropdown()
  }

  fuzzyMatch(query, text) {
    let queryIndex = 0
    let textIndex = 0
    const matchedIndices = []

    while (queryIndex < query.length && textIndex < text.length) {
      if (query[queryIndex] === text[textIndex]) {
        matchedIndices.push(textIndex)
        queryIndex++
      }
      textIndex++
    }

    if (queryIndex !== query.length) {
      return null
    }

    let score = 1000

    if (matchedIndices[0] === 0) {
      score += 500
    }

    for (let i = 0; i < matchedIndices.length; i++) {
      const idx = matchedIndices[i]
      if (idx === 0 || text[idx - 1] === ' ') {
        score += 50
      }
    }

    score -= matchedIndices[0] * 10

    if (matchedIndices.length > 1) {
      const span = matchedIndices[matchedIndices.length - 1] - matchedIndices[0]
      score -= span * 2
    }

    let consecutiveBonus = 0
    for (let i = 1; i < matchedIndices.length; i++) {
      if (matchedIndices[i] === matchedIndices[i - 1] + 1) {
        consecutiveBonus += 20
      }
    }
    score += consecutiveBonus

    if (text.includes(query)) {
      score += 1000
    }

    return { matchInfo: matchedIndices, score }
  }

  showDropdown() {
    this.dropdownTarget.innerHTML = this.suggestions
      .map((name, index) => {
        const highlightedName = this.highlightMatchedLetters(name, this.suggestionMatches[index])
        return `<div class="autocomplete-item ${index === this.highlightedIndex ? "highlighted" : ""}"
             data-index="${index}"
             data-action="click->practice#selectSuggestion">${highlightedName}</div>`
      })
      .join("")

    this.dropdownTarget.classList.add("show")
  }

  highlightMatchedLetters(name, matchedIndices) {
    let result = ""
    for (let i = 0; i < name.length; i++) {
      if (matchedIndices.includes(i)) {
        result += `<mark>${name[i]}</mark>`
      } else {
        result += name[i]
      }
    }
    return result
  }

  hideDropdown() {
    this.dropdownTarget.classList.remove("show")
    this.dropdownTarget.innerHTML = ""
    this.suggestions = []
    this.highlightedIndex = -1
  }

  handleKeydown(event) {
    if (this.suggestions.length === 0) return

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        this.highlightedIndex = Math.min(
          this.highlightedIndex + 1,
          this.suggestions.length - 1
        )
        this.showDropdown()
        break

      case "ArrowUp":
        event.preventDefault()
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0)
        this.showDropdown()
        break

      case "Enter":
        if (event.shiftKey) break // Shift+Enter is the Skip hotkey
        event.preventDefault()
        if (this.highlightedIndex >= 0) {
          this.selectCountry(this.suggestions[this.highlightedIndex])
        }
        break

      case "Escape":
        this.hideDropdown()
        break
    }
  }

  selectSuggestion(event) {
    const index = parseInt(event.currentTarget.dataset.index)
    const countryName = this.suggestions[index]
    this.selectCountry(countryName)
  }

  selectCountry(countryName) {
    this.searchInputTarget.value = ""
    this.hideDropdown()

    if (this.isFinished || !this.currentCountry) return

    const countryCode = nameToCode[countryName.toLowerCase()]
    if (!countryCode) return

    const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry

    if (countryCode === this.currentCountry) {
      this.stats.correct++
      this.showLastGuess(this.currentCountry, displayName, true)
    } else {
      this.stats.incorrect++
      this.showLastGuess(this.currentCountry, displayName, false)

      this.searchInputTarget.style.borderColor = "#ef4444"
      setTimeout(() => {
        this.searchInputTarget.style.borderColor = "#404040"
      }, 500)
    }

    this.updateStats()
    this.nextCountry()
  }

  showLastGuess(countryCode, displayName, wasCorrect) {
    this.lastGuessNameTarget.textContent = displayName

    let svg = this.countrySvgs[countryCode]
    if (!svg) {
      svg = this.extractCountrySvg(countryCode)
      if (svg) {
        this.countrySvgs[countryCode] = svg
      }
    }
    this.lastGuessShapeTarget.innerHTML = svg || ""

    this.lastGuessCardTarget.classList.toggle("correct", wasCorrect)
    this.lastGuessCardTarget.classList.toggle("incorrect", !wasCorrect)
    this.lastGuessTarget.style.display = "block"
  }

  // Shape extraction from the map's vector source, same approach as the
  // Name All modes (quiz_name_all_controller.js)
  extractCountrySvg(countryCode) {
    const features = this.mainMap.querySourceFeatures('countries', {
      sourceLayer: 'countries',
      filter: ['==', 'ADM0_A3', countryCode]
    })

    if (!features || features.length === 0) {
      return null
    }

    // Find the largest polygon by calculating rough area
    let largestFeature = null
    let largestArea = 0

    features.forEach(feature => {
      let area = 0

      if (feature.geometry.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0]
        area = this.calculatePolygonArea(coords)
      } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach(polygon => {
          area += this.calculatePolygonArea(polygon[0])
        })
      }

      if (area > largestArea) {
        largestArea = area
        largestFeature = feature
      }
    })

    if (!largestFeature) {
      return null
    }

    // Collect coordinates from only the largest feature
    let allCoordinates = []
    if (largestFeature.geometry.type === 'Polygon') {
      allCoordinates.push(...largestFeature.geometry.coordinates[0])
    } else if (largestFeature.geometry.type === 'MultiPolygon') {
      largestFeature.geometry.coordinates.forEach(polygon => {
        allCoordinates.push(...polygon[0])
      })
    }

    if (allCoordinates.length === 0) {
      return null
    }

    // Calculate center latitude for projection correction
    let sumLat = 0
    allCoordinates.forEach(([lng, lat]) => {
      sumLat += lat
    })
    const centerLat = sumLat / allCoordinates.length

    // Apply projection: scale longitude by cos(latitude) to account for convergence near poles
    const cosLat = Math.cos(centerLat * Math.PI / 180)

    const projectedCoords = allCoordinates.map(([lng, lat]) => [
      lng * cosLat,
      lat
    ])

    // Calculate bounds on projected coordinates
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    projectedCoords.forEach(([x, y]) => {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    })

    const width = maxX - minX
    const height = maxY - minY
    const padding = Math.max(width, height) * 0.1

    // Build SVG path for the largest feature only
    let pathData = ''

    const processRing = (coordinates) => {
      coordinates.forEach(([lng, lat], i) => {
        const projX = lng * cosLat
        const x = projX - minX + padding
        const y = maxY - lat + padding  // Flip Y axis
        pathData += i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `
      })
      pathData += 'Z '
    }

    if (largestFeature.geometry.type === 'Polygon') {
      largestFeature.geometry.coordinates.forEach(ring => processRing(ring))
    } else if (largestFeature.geometry.type === 'MultiPolygon') {
      largestFeature.geometry.coordinates.forEach(polygon => {
        polygon.forEach(ring => processRing(ring))
      })
    }

    const viewBoxWidth = width + padding * 2
    const viewBoxHeight = height + padding * 2

    return `<svg viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <path d="${pathData}" fill="currentColor" stroke="none"/>
    </svg>`
  }

  calculatePolygonArea(coordinates) {
    // Simple rough area calculation using bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    coordinates.forEach(([lng, lat]) => {
      minX = Math.min(minX, lng)
      maxX = Math.max(maxX, lng)
      minY = Math.min(minY, lat)
      maxY = Math.max(maxY, lat)
    })

    return (maxX - minX) * (maxY - minY)
  }

  skip() {
    // Skip counts as an incorrect guess
    if (this.currentCountry && !this.isFinished) {
      const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry
      this.showLastGuess(this.currentCountry, displayName, false)

      this.stats.incorrect++
      this.updateStats()
      this.nextCountry()
    }
  }

  finish() {
    this.isFinished = true

    const elapsedMs = Date.now() - this.startTime
    const totalSeconds = Math.floor(elapsedMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const milliseconds = Math.floor((elapsedMs % 1000) / 10) // centiseconds (2 digits)
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`

    this.finalCorrectTarget.textContent = this.stats.correct
    this.finalIncorrectTarget.textContent = this.stats.incorrect
    this.finalTimeTarget.textContent = `Time: ${timeString}`

    this.statsBarTarget.style.display = "none"
    this.searchBoxTarget.style.display = "none"
    this.lastGuessTarget.style.display = "none"
    this.overlayContainerTarget.style.display = "none"

    const scaleElements = document.querySelectorAll('.maplibregl-ctrl-scale')
    scaleElements.forEach(el => el.style.display = 'none')

    // Bring the world preview back behind the banner
    this.mainMap.setFilter("countries-preview-fill", null)
    this.mainMap.setFilter("countries-preview-outline", null)

    this.finishedBannerTarget.style.display = "block"
  }

  restart() {
    this.isFinished = false
    this.currentCountry = null
    this.stats = { correct: 0, incorrect: 0 }
    this.startTime = null

    this.overlayMap.setFilter("isolated-country", ["==", "ADM0_A3", ""])
    this.overlayMap.setFilter("isolated-country-outline", ["==", "ADM0_A3", ""])

    this.finishedBannerTarget.style.display = "none"
    this.overlayContainerTarget.style.display = "block"
    // Clear the inline style so the stylesheet's flex layout applies again
    this.startScreenTarget.style.display = ""

    this.updateStartButton()
  }
}
