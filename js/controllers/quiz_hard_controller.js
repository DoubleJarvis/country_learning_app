import { Controller } from "@hotwired/stimulus"
import maplibregl from "maplibre-gl"
import { allCountryNames, nameToCode, countriesMapping, getCountriesForRegion, countryBounds } from "country_names"
import { quizDb } from "db"
import { getSharedMap, whenMapReady } from "shared_map"

export default class extends Controller {
  static targets = ["mainContainer", "overlayContainer", "searchInput", "searchBox", "dropdown",
                    "regionSelection", "statsBar", "remainingCount", "greenCount",
                    "yellowCount", "redCount", "actionBtn", "finishedBanner",
                    "finalGreen", "finalYellow", "finalRed", "debugSearchInput", "debugDropdown",
                    "navButtons", "finalTime", "timerDisplay",
                    "lastGuess", "lastGuessCard", "lastGuessShape", "lastGuessName"]

  connect() {
    this.highlightedIndex = -1
    this.suggestions = []
    this.debugHighlightedIndex = -1
    this.debugSuggestions = []
    this.currentRegion = null
    this.remainingCountries = []
    this.currentCountry = null
    this.attemptCount = 0
    this.stats = { green: 0, yellow: 0, red: 0 }
    this.guessedCountries = []
    this.isFinished = false
    this.startTime = null
    this.endTime = null
    this.countryStartTime = null
    this.timerInterval = null
    this.countrySvgs = {}

    this.initializeMaps()
    this.initializeDatabase()
  }

  async initializeDatabase() {
    await quizDb.initialize()
  }

  disconnect() {
    this.stopTimer()
    if (this.overlayMap) this.overlayMap.remove()
  }

  initializeMaps() {
    // Main progress map - stays zoomed out
    this.mainMap = getSharedMap()

    // Overlay isolated country map
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

    // Add scale control to overlay map
    this.scaleControl = new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    })
    this.overlayMap.addControl(this.scaleControl, 'bottom-left')

    // Hide scale control initially (will show when quiz starts)
    setTimeout(() => {
      const scaleElements = document.querySelectorAll('.maplibregl-ctrl-scale')
      scaleElements.forEach(el => el.style.display = 'none')
    }, 100)

    this.mainMapLoaded = false
    this.overlayMapLoaded = false

    whenMapReady(() => {
      this.mainMapLoaded = true
      this.setupMainMapLayers()
    })

    this.overlayMap.on("load", () => {
      this.overlayMapLoaded = true
      this.setupOverlayMapLayers()
    })
  }

  setupMainMapLayers() {
    // Countries outline layer (only shown for guessed countries)
    this.mainMap.addLayer({
      id: "countries-outline",
      type: "line",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "line-color": "#555555",
        "line-width": 1
      },
      filter: ["in", "ADM0_A3", ""]
    })

    // Green layer (first try)
    this.mainMap.addLayer({
      id: "countries-green",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#4ade80",
        "fill-opacity": 0.7
      },
      filter: ["in", "ADM0_A3"]
    })

    // Yellow layer (second try)
    this.mainMap.addLayer({
      id: "countries-yellow",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#fbbf24",
        "fill-opacity": 0.7
      },
      filter: ["in", "ADM0_A3"]
    })

    // Red layer (failed)
    this.mainMap.addLayer({
      id: "countries-red",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#ef4444",
        "fill-opacity": 0.7
      },
      filter: ["in", "ADM0_A3"]
    })

    // Country names layers - separate for white (green/yellow) and red
    const nameMatchExpression = ["match", ["get", "ADM0_A3"]]
    Object.entries(countriesMapping).forEach(([code, data]) => {
      nameMatchExpression.push(code, data.display_name)
    })
    nameMatchExpression.push("")

    // White names for green/yellow countries
    this.mainMap.addLayer({
      id: "country-names-white",
      type: "symbol",
      source: "countries",
      "source-layer": "countries",
      layout: {
        "text-field": nameMatchExpression,
        "text-font": ["Noto Sans Regular"],
        "text-max-width": 10,
        "text-size": {
          stops: [
            [1, 8],
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
      filter: ["in", "ADM0_A3", ""]
    })

    // Red names for red countries
    this.mainMap.addLayer({
      id: "country-names-red",
      type: "symbol",
      source: "countries",
      "source-layer": "countries",
      layout: {
        "text-field": nameMatchExpression,
        "text-font": ["Noto Sans Regular"],
        "text-max-width": 10,
        "text-size": {
          stops: [
            [1, 8],
            [2, 10],
            [4, 12],
            [6, 16]
          ]
        }
      },
      paint: {
        "text-color": "#ef4444",
        "text-halo-blur": 1,
        "text-halo-color": "rgba(0, 0, 0, 0.8)",
        "text-halo-width": 1.5
      },
      filter: ["in", "ADM0_A3", ""]
    })
  }

  setupOverlayMapLayers() {
    // Single country fill layer with lighter grey background
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

    // Yellow outline for isolated country
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

  selectRegion(event) {
    const region = event.currentTarget.dataset.region
    this.currentRegion = region
    this.remainingCountries = [...getCountriesForRegion(region)]
    this.remainingCountries.sort(() => Math.random() - 0.5)

    // Start timer
    this.startTime = Date.now()
    this.startTimer()

    // Hide region selection
    this.regionSelectionTarget.style.display = "none"
    this.statsBarTarget.style.display = "flex"
    this.searchBoxTarget.style.display = "flex"
    this.updateStats()

    // Set main map view to show entire region (no zooming later)
    this.setRegionView(region)


    if (this.mainMapLoaded && this.overlayMapLoaded) {
      this.startQuiz()
    } else {
      const checkLoaded = () => {
        if (this.mainMapLoaded && this.overlayMapLoaded) {
          this.startQuiz()
        }
      }

      if (!this.mainMapLoaded) {
        whenMapReady(() => {
          this.mainMapLoaded = true
          checkLoaded()
        })
      }

      if (!this.overlayMapLoaded) {
        this.overlayMap.once("load", () => {
          this.overlayMapLoaded = true
          checkLoaded()
        })
      }
    }
  }

  setRegionView(region) {
    const regionViews = {
      world: { center: [0, 20], zoom: 1.5 },
      africa: { center: [5, 0], zoom: 2.5 },
      asia: { center: [60, 20], zoom: 2 },
      europe: { center: [-15, 54], zoom: 3 },
      north_america: { center: [-130, 60], zoom: 1.9 },
      south_america: { center: [-100, -30], zoom: 2.5 },
      oceania: { center: [120, -25], zoom: 3 }
    }

    const view = regionViews[region] || regionViews.world
    this.mainMap.flyTo({ center: view.center, zoom: view.zoom, duration: 1000 })
  }

  startQuiz() {
    // Wait for both maps to be fully loaded
    const startWhenReady = () => {
      // Ensure layers are set up
      if (!this.mainMap.getLayer("countries-green")) {
        this.setupMainMapLayers()
      }
      if (!this.overlayMap.getLayer("isolated-country")) {
        this.setupOverlayMapLayers()
      }

      // Hide the preview map once the game starts
      this.mainMap.setFilter("countries-preview-fill", ["in", "ADM0_A3"])
      this.mainMap.setFilter("countries-preview-outline", ["in", "ADM0_A3"])

      // Show scale control when quiz starts
      const scaleElements = document.querySelectorAll('.maplibregl-ctrl-scale')
      scaleElements.forEach(el => el.style.display = 'block')

      // Start the quiz
      this.nextCountry()
      this.searchInputTarget.focus()
    }

    // Use our own loaded flags instead of map.loaded()
    if (this.mainMapLoaded && this.overlayMapLoaded) {
      startWhenReady()
    } else {
      const checkBothLoaded = () => {
        if (this.mainMapLoaded && this.overlayMapLoaded) {
          startWhenReady()
        }
      }

      if (!this.mainMapLoaded) {
        whenMapReady(() => {
          this.mainMapLoaded = true
          checkBothLoaded()
        })
      }

      if (!this.overlayMapLoaded) {
        this.overlayMap.once("load", () => {
          this.overlayMapLoaded = true
          checkBothLoaded()
        })
      }
    }
  }

  updateStats() {
    this.remainingCountTarget.textContent = this.remainingCountries.length
    this.greenCountTarget.textContent = this.stats.green
    this.yellowCountTarget.textContent = this.stats.yellow
    this.redCountTarget.textContent = this.stats.red
  }

  nextCountry() {
    if (this.remainingCountries.length === 0) {
      this.endQuiz(true)  // true = completed fully
      return
    }

    this.currentCountry = this.remainingCountries[0]
    this.attemptCount = 0
    this.countryStartTime = Date.now()
    this.searchInputTarget.value = ""

    // Show only current country on overlay map
    this.showIsolatedCountry(this.currentCountry)

    // Main map stays at region zoom (no zooming)
  }

  showIsolatedCountry(countryCode) {
    // Ensure layers exist before filtering
    if (!this.overlayMap.getLayer("isolated-country")) {
      // Wait for style to load, then try again
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

    // Filter overlay map to show only this country
    this.overlayMap.setFilter("isolated-country", ["==", "ADM0_A3", countryCode])
    this.overlayMap.setFilter("isolated-country-outline", ["==", "ADM0_A3", countryCode])

    // Zoom overlay map to fit country bounds (no animation)
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
             data-action="click->quiz-hard#selectSuggestion">${highlightedName}</div>`
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
    // Clear input immediately
    this.searchInputTarget.value = ""
    this.hideDropdown()

    const countryCode = nameToCode[countryName.toLowerCase()]

    if (!countryCode) return

    // Check if this is the correct country
    if (countryCode === this.currentCountry) {
      this.correctGuess(countryCode, countryName)
    } else {
      this.incorrectGuess(countryCode, countryName)
    }
  }

  correctGuess(guessedCode, guessedName) {
    this.attemptCount++

    // Calculate time taken
    const timeMs = Date.now() - this.countryStartTime

    // Determine color based on attempt count
    let color, guessType
    if (this.attemptCount === 1) {
      color = "green"
      guessType = "correct"
      this.stats.green++
    } else {
      color = "yellow"
      guessType = "shaky"
      this.stats.yellow++
    }

    // Record guess in database
    const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry
    quizDb.recordGuess(this.currentCountry, displayName, "hard", guessType, guessedCode, guessedName, timeMs)

    // Show the resolved country in the last-guess card
    this.showLastGuess(this.currentCountry, displayName, true)

    // Add country to the appropriate layer
    this.guessedCountries.push({ code: this.currentCountry, color })
    this.updateMapLayers()

    // Remove from remaining
    this.remainingCountries.shift()

    // Update stats
    this.updateStats()

    // Move to next country immediately
    this.nextCountry()
  }

  incorrectGuess(guessedCode, guessedName) {
    this.attemptCount++

    // Calculate time taken
    const timeMs = Date.now() - this.countryStartTime

    // Record the wrong guess in database
    const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry

    if (this.attemptCount >= 2) {
      // Failed after 2 tries - mark as red
      this.stats.red++
      this.guessedCountries.push({ code: this.currentCountry, color: "red" })
      this.updateMapLayers()
      this.showLastGuess(this.currentCountry, displayName, false)

      // Record final failed guess
      quizDb.recordGuess(this.currentCountry, displayName, "hard", "incorrect", guessedCode, guessedName, timeMs)

      this.remainingCountries.shift()
      this.updateStats()

      this.nextCountry()
    } else {
      // First incorrect guess - record it and shake the input
      quizDb.recordGuess(this.currentCountry, displayName, "hard", "incorrect", guessedCode, guessedName, timeMs)

      this.searchInputTarget.style.borderColor = "#ef4444"
      setTimeout(() => {
        this.searchInputTarget.style.borderColor = "#404040"
      }, 500)
    }

    this.searchInputTarget.value = ""
  }

  // Last-guess "It was:" card, identical to Practice mode (practice_controller.js)
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
    // Clear the inline "none" so the stylesheet's flex column layout applies
    this.lastGuessTarget.style.display = ""
  }

  updateMapLayers() {
    const greenCountries = this.guessedCountries
      .filter(c => c.color === "green")
      .map(c => c.code)
    const yellowCountries = this.guessedCountries
      .filter(c => c.color === "yellow")
      .map(c => c.code)
    const redCountries = this.guessedCountries
      .filter(c => c.color === "red")
      .map(c => c.code)
    const allGuessedCountries = this.guessedCountries.map(c => c.code)
    const greenYellowCountries = [...greenCountries, ...yellowCountries]

    // Ensure we always have at least one element to avoid invalid filter syntax
    this.mainMap.setFilter("countries-green", ["in", "ADM0_A3", ...(greenCountries.length > 0 ? greenCountries : [""])])
    this.mainMap.setFilter("countries-yellow", ["in", "ADM0_A3", ...(yellowCountries.length > 0 ? yellowCountries : [""])])
    this.mainMap.setFilter("countries-red", ["in", "ADM0_A3", ...(redCountries.length > 0 ? redCountries : [""])])
    this.mainMap.setFilter("countries-outline", ["in", "ADM0_A3", ...(allGuessedCountries.length > 0 ? allGuessedCountries : [""])])

    // Show country names - white for green/yellow, red for failed countries
    if (this.mainMap.getLayer("country-names-white")) {
      this.mainMap.setFilter("country-names-white", ["in", ["get", "ADM0_A3"], ["literal", greenYellowCountries.length > 0 ? greenYellowCountries : [""]]])
    }
    if (this.mainMap.getLayer("country-names-red")) {
      this.mainMap.setFilter("country-names-red", ["in", ["get", "ADM0_A3"], ["literal", redCountries.length > 0 ? redCountries : [""]]])
    }
  }

  skip() {
    // Skip is same as failing immediately
    if (this.currentCountry && !this.isFinished) {
      const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry
      this.showLastGuess(this.currentCountry, displayName, false)

      // Calculate time taken
      const timeMs = Date.now() - this.countryStartTime

      this.stats.red++
      this.guessedCountries.push({ code: this.currentCountry, color: "red" })
      this.updateMapLayers()

      // Record skipped country in database (no guessed country)
      quizDb.recordGuess(this.currentCountry, displayName, "hard", "incorrect", null, null, timeMs)

      this.remainingCountries.shift()
      this.updateStats()

      this.nextCountry()
    }
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay()
    }, 1000)
    this.updateTimerDisplay()
  }

  updateTimerDisplay() {
    if (!this.startTime) return

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    this.timerDisplayTarget.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  }

  finish() {
    this.endQuiz(false)  // false = finished early
  }

  restart() {
    // Reset all state
    this.stopTimer()
    this.isFinished = false
    this.currentRegion = null
    this.remainingCountries = []
    this.currentCountry = null
    this.attemptCount = 0
    this.stats = { green: 0, yellow: 0, red: 0 }
    this.guessedCountries = []
    this.startTime = null
    this.endTime = null
    this.countryStartTime = null

    // Clear all country highlights and names
    this.mainMap.setFilter("countries-green", ["in", "ADM0_A3", ""])
    this.mainMap.setFilter("countries-yellow", ["in", "ADM0_A3", ""])
    this.mainMap.setFilter("countries-red", ["in", "ADM0_A3", ""])
    this.mainMap.setFilter("country-names-white", ["in", "ADM0_A3", ""])
    this.mainMap.setFilter("country-names-red", ["in", "ADM0_A3", ""])
    this.mainMap.setFilter("countries-outline", ["in", "ADM0_A3", ""])

    // Show the preview map again behind the region selection screen
    this.mainMap.setFilter("countries-preview-fill", null)
    this.mainMap.setFilter("countries-preview-outline", null)

    this.overlayMap.setFilter("isolated-country", ["==", "ADM0_A3", ""])
    this.overlayMap.setFilter("isolated-country-outline", ["==", "ADM0_A3", ""])

    // Hide stats, search box and finished banner
    this.statsBarTarget.style.display = "none"
    this.searchBoxTarget.style.display = "none"
    this.finishedBannerTarget.style.display = "none"
    this.lastGuessTarget.style.display = "none"

    // Hide scale control
    const scaleElements = document.querySelectorAll('.maplibregl-ctrl-scale')
    scaleElements.forEach(el => el.style.display = 'none')

    // Show region selection
    this.regionSelectionTarget.style.display = "block"

    // Show overlay map container again
    this.overlayContainerTarget.style.display = "block"

    // Disable main map interaction again
    if (this.mainMap) {
      this.mainMap.boxZoom.disable()
      this.mainMap.scrollZoom.disable()
      this.mainMap.dragPan.disable()
      this.mainMap.dragRotate.disable()
      this.mainMap.keyboard.disable()
      this.mainMap.doubleClickZoom.disable()
      this.mainMap.touchZoomRotate.disable()
    }

    // Zoom out
    this.mainMap.flyTo({
      center: [0, 20],
      zoom: 2,
      duration: 1000
    })
  }

  endQuiz(completedFully = true) {
    this.isFinished = true

    // Stop timer
    this.stopTimer()
    this.endTime = Date.now()
    const elapsedMs = this.endTime - this.startTime
    const totalSeconds = Math.floor(elapsedMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const milliseconds = Math.floor((elapsedMs % 1000) / 10) // Show centiseconds (2 digits)
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`

    // Record quiz run to database
    quizDb.recordQuizRun(
      "hard",
      this.currentRegion,
      this.stats.green,
      this.stats.yellow,
      this.stats.red,
      elapsedMs,
      completedFully ? 1 : 0
    )

    // Update final stats
    this.finalGreenTarget.textContent = this.stats.green
    this.finalYellowTarget.textContent = this.stats.yellow
    this.finalRedTarget.textContent = this.stats.red
    this.finalTimeTarget.textContent = `Time: ${timeString}`

    // Hide top left stats banner and search box
    this.statsBarTarget.style.display = "none"
    this.searchBoxTarget.style.display = "none"
    this.lastGuessTarget.style.display = "none"

    // Show finished banner
    this.finishedBannerTarget.style.display = "block"

    // Hide overlay map container
    this.overlayContainerTarget.style.display = "none"

    // Enable main map interaction
    if (this.mainMap) {
      this.mainMap.boxZoom.enable()
      this.mainMap.scrollZoom.enable()
      this.mainMap.dragPan.enable()
      this.mainMap.dragRotate.enable()
      this.mainMap.keyboard.enable()
      this.mainMap.doubleClickZoom.enable()
      this.mainMap.touchZoomRotate.enable()
    }
  }

  // Debug search handlers
  handleDebugSearch(event) {
    const query = event.target.value.trim()

    if (!query) {
      this.hideDebugDropdown()
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
      this.hideDebugDropdown()
      return
    }

    this.debugSuggestions = matches.map(m => m.name)
    this.debugSuggestionMatches = matches.map(m => m.matchInfo)
    this.debugHighlightedIndex = 0
    this.showDebugDropdown()
  }

  showDebugDropdown() {
    this.debugDropdownTarget.innerHTML = this.debugSuggestions
      .map((name, index) => {
        const highlightedName = this.highlightMatchedLetters(name, this.debugSuggestionMatches[index])
        return `<div class="autocomplete-item ${index === this.debugHighlightedIndex ? "highlighted" : ""}"
             data-index="${index}"
             data-action="click->quiz-hard#selectDebugSuggestion">${highlightedName}</div>`
      })
      .join("")

    this.debugDropdownTarget.classList.add("show")
  }

  hideDebugDropdown() {
    this.debugDropdownTarget.classList.remove("show")
    this.debugDropdownTarget.innerHTML = ""
    this.debugSuggestions = []
    this.debugHighlightedIndex = -1
  }

  handleDebugKeydown(event) {
    if (this.debugSuggestions.length === 0) return

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        this.debugHighlightedIndex = Math.min(
          this.debugHighlightedIndex + 1,
          this.debugSuggestions.length - 1
        )
        this.showDebugDropdown()
        break

      case "ArrowUp":
        event.preventDefault()
        this.debugHighlightedIndex = Math.max(this.debugHighlightedIndex - 1, 0)
        this.showDebugDropdown()
        break

      case "Enter":
        event.preventDefault()
        if (this.debugHighlightedIndex >= 0) {
          this.selectDebugCountry(this.debugSuggestions[this.debugHighlightedIndex])
        }
        break

      case "Escape":
        this.hideDebugDropdown()
        break
    }
  }

  selectDebugSuggestion(event) {
    const index = parseInt(event.currentTarget.dataset.index)
    const countryName = this.debugSuggestions[index]
    this.selectDebugCountry(countryName)
  }

  selectDebugCountry(countryName) {
    // Clear input immediately
    this.debugSearchInputTarget.value = ""
    this.hideDebugDropdown()

    const countryCode = nameToCode[countryName.toLowerCase()]

    if (!countryCode) return

    // Set this as the current country to guess
    this.currentCountry = countryCode
    this.attemptCount = 0
    this.searchInputTarget.value = ""

    // Show isolated country
    this.showIsolatedCountry(this.currentCountry)
  }

  async debugFill() {
    if (this.isFinished || this.remainingCountries.length === 0) {
      return
    }

    // Disable the button while running
    const button = document.querySelector('.debug-fill-btn')
    if (button) {
      button.disabled = true
      button.textContent = 'Debug: Running...'
    }

    // Process each country one by one
    while (this.remainingCountries.length > 0 && !this.isFinished) {
      const countryCode = this.currentCountry
      const countryData = countriesMapping[countryCode]

      if (!countryData) {
        console.error(`No data found for country code: ${countryCode}`)
        break
      }

      // Use display_name for the quiz
      const countryName = countryData.display_name

      // Simulate typing the country name
      this.searchInputTarget.value = countryName
      this.searchInputTarget.dispatchEvent(new Event('input'))

      // Wait a bit for the autocomplete to show
      await this.sleep(100)

      // Select the country (simulate pressing Enter)
      this.selectCountry(countryName)

      // Wait before next country
      await this.sleep(300)
    }

    // Re-enable the button
    if (button) {
      button.disabled = false
      button.textContent = 'Debug: Fill'
    }
  }

  debugFastFill() {
    if (this.isFinished || this.remainingCountries.length === 0) {
      return
    }

    // Mark all remaining countries as green (first try correct)
    while (this.remainingCountries.length > 0) {
      const countryCode = this.remainingCountries[0]

      // Mark as green
      this.stats.green++
      this.guessedCountries.push({ code: countryCode, color: "green" })

      // Record in database
      const displayName = countriesMapping[countryCode]?.display_name || countryCode
      quizDb.recordGuess(countryCode, displayName, "hard", "correct")

      // Remove from remaining
      this.remainingCountries.shift()
    }

    // Update the map and stats
    this.updateMapLayers()
    this.updateStats()

    // End the quiz (completed fully via debug fill)
    this.endQuiz(true)
  }

  debugRealisticFill() {
    if (this.isFinished || this.remainingCountries.length === 0) {
      return
    }

    // Mark all remaining countries with random outcomes: 1/3 green, 1/3 yellow, 1/3 red
    while (this.remainingCountries.length > 0) {
      const countryCode = this.remainingCountries[0]
      const random = Math.random()

      let color, guessType
      if (random < 1/3) {
        // Green - correct on first try
        color = "green"
        guessType = "correct"
        this.stats.green++
      } else if (random < 2/3) {
        // Yellow - correct on second try
        color = "yellow"
        guessType = "shaky"
        this.stats.yellow++
      } else {
        // Red - failed
        color = "red"
        guessType = "incorrect"
        this.stats.red++
      }

      this.guessedCountries.push({ code: countryCode, color })

      // Record in database
      const displayName = countriesMapping[countryCode]?.display_name || countryCode
      quizDb.recordGuess(countryCode, displayName, "hard", guessType)

      // Remove from remaining
      this.remainingCountries.shift()
    }

    // Update the map and stats
    this.updateMapLayers()
    this.updateStats()

    // End the quiz (completed fully via debug fill)
    this.endQuiz(true)
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Shape extraction from the main map's vector source, same approach as the
  // Practice and Name All modes (practice_controller.js)
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
}
