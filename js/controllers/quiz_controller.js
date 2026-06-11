import { Controller } from "@hotwired/stimulus"
import maplibregl from "maplibre-gl"
import { allCountryNames, nameToCode, countriesMapping, getCountriesForRegion, countryBounds } from "country_names"
import { quizDb } from "db"
import { getSharedMap, whenMapReady } from "shared_map"

export default class extends Controller {
  static targets = ["container", "searchInput", "searchBox", "dropdown", "regionSelection", "statsBar",
                    "remainingCount", "greenCount", "yellowCount", "redCount",
                    "actionBtn", "finishedBanner", "finalGreen", "finalYellow", "finalRed",
                    "debugSearchInput", "debugDropdown", "navButtons", "finalTime"]

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

    this.initializeMap()
    this.initializeDatabase()
  }

  async initializeDatabase() {
    await quizDb.initialize()
  }

  disconnect() {
    if (this.map) {
      this.map.removeControl(this.navControl)
      this.map.removeControl(this.scaleControl)
    }
  }

  initializeMap() {
    this.map = getSharedMap()

    this.navControl = new maplibregl.NavigationControl()
    this.map.addControl(this.navControl, "top-right")
    this.scaleControl = new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    })
    this.map.addControl(this.scaleControl, 'bottom-left')

    // Hide scale and navigation controls initially
    const scaleElement = document.querySelector('.maplibregl-ctrl-scale')
    if (scaleElement) {
      scaleElement.style.display = 'none'
    }
    const navElement = document.querySelector('.maplibregl-ctrl-top-right')
    if (navElement) {
      navElement.style.display = 'none'
    }

    whenMapReady(() => {
      this.setupLayers()
    })
  }

  setupLayers() {
    // Green layer (first try)
    this.map.addLayer({
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
    this.map.addLayer({
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

    // Red layer (third try/failed)
    this.map.addLayer({
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

    // Country names layer - build match expression for custom names
    const nameMatchExpression = ["match", ["get", "ADM0_A3"]]
    Object.entries(countriesMapping).forEach(([code, data]) => {
      nameMatchExpression.push(code, data.display_name)
    })
    nameMatchExpression.push("") // default value

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

    // Current country border highlight (added last to appear on top)
    this.map.addLayer({
      id: "current-country-border",
      type: "line",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "line-color": "#ffd700",
        "line-width": 3
      },
      filter: ["==", "ADM0_A3", ""]
    })
  }

  selectRegion(event) {
    const region = event.currentTarget.dataset.region
    this.currentRegion = region
    this.remainingCountries = [...getCountriesForRegion(region)]

    // Shuffle the countries
    this.remainingCountries.sort(() => Math.random() - 0.5)

    // Start timer
    this.startTime = Date.now()

    // Hide region selection
    this.regionSelectionTarget.style.display = "none"

    // Show stats bar and search box
    this.statsBarTarget.style.display = "flex"
    this.searchBoxTarget.style.display = "flex"

    // Update stats
    this.updateStats()

    // Wait for map to be ready before starting
    whenMapReady(() => this.startQuiz())
  }

  startQuiz() {
    // Ensure layers are set up
    if (!this.map.getLayer("current-country-border")) {
      this.setupLayers()
    }

    // Show scale and navigation controls when quiz starts
    const scaleElement = document.querySelector('.maplibregl-ctrl-scale')
    if (scaleElement) {
      scaleElement.style.display = 'block'
    }
    const navElement = document.querySelector('.maplibregl-ctrl-top-right')
    if (navElement) {
      navElement.style.display = 'block'
    }

    // Enable map interaction now that the game has started
    this.map.boxZoom.enable()
    this.map.scrollZoom.enable()
    this.map.dragPan.enable()
    this.map.dragRotate.enable()
    this.map.keyboard.enable()
    this.map.doubleClickZoom.enable()
    this.map.touchZoomRotate.enable()

    // Start the quiz
    this.nextCountry()
    this.searchInputTarget.focus()
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

    // Zoom to the country
    this.zoomToCountry(this.currentCountry)
  }

  zoomToCountry(countryCode) {
    // Highlight the current country border
    if (this.map.getLayer("current-country-border")) {
      this.map.setFilter("current-country-border", ["==", "ADM0_A3", countryCode])
    }

    const bounds = countryBounds[countryCode]

    if (!bounds) {
      console.warn(`No bounds found for country: ${countryCode}`)
      return
    }

    // bounds format: [west, south, east, north]
    this.map.fitBounds(
      [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
      {
        padding: { top: 150, bottom: 150, left: 150, right: 150 },
        duration: 500,
        maxZoom: 4
      }
    )
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
             data-action="click->quiz#selectSuggestion">${highlightedName}</div>`
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

    // Determine color based on attempt count (only 2 tries now)
    let color, guessType
    if (this.attemptCount === 1) {
      color = "green"
      guessType = "correct"
      this.stats.green++
    } else {
      // Second try
      color = "yellow"
      guessType = "shaky"
      this.stats.yellow++
    }

    // Record guess in database
    const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry
    quizDb.recordGuess(this.currentCountry, displayName, "normal", guessType, guessedCode, guessedName, timeMs)

    // Add country to the appropriate layer
    this.guessedCountries.push({ code: this.currentCountry, color })
    this.updateMapLayers()

    // Clear the border highlight
    if (this.map.getLayer("current-country-border")) {
      this.map.setFilter("current-country-border", ["==", "ADM0_A3", ""])
    }

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
      console.log("This was: ", displayName)

      // Record final failed guess
      quizDb.recordGuess(this.currentCountry, displayName, "normal", "incorrect", guessedCode, guessedName, timeMs)

      // Clear the border highlight
      if (this.map.getLayer("current-country-border")) {
        this.map.setFilter("current-country-border", ["==", "ADM0_A3", ""])
      }

      this.remainingCountries.shift()
      this.updateStats()

      this.nextCountry()
    } else {
      // First incorrect guess - record it and shake the input
      quizDb.recordGuess(this.currentCountry, displayName, "normal", "incorrect", guessedCode, guessedName, timeMs)

      this.searchInputTarget.style.borderColor = "#ef4444"
      setTimeout(() => {
        this.searchInputTarget.style.borderColor = "#404040"
      }, 500)
    }

    this.searchInputTarget.value = ""
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

    // Ensure we always have at least one element to avoid invalid filter syntax
    this.map.setFilter("countries-green", ["in", "ADM0_A3", ...(greenCountries.length > 0 ? greenCountries : [""])])
    this.map.setFilter("countries-yellow", ["in", "ADM0_A3", ...(yellowCountries.length > 0 ? yellowCountries : [""])])
    this.map.setFilter("countries-red", ["in", "ADM0_A3", ...(redCountries.length > 0 ? redCountries : [""])])
    this.map.setFilter("country-names", ["in", "ADM0_A3", ...(allGuessedCountries.length > 0 ? allGuessedCountries : [""])])
  }

  skip() {
    // Skip is same as failing immediately
    if (this.currentCountry && !this.isFinished) {
      const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry
      console.log("This was: ", displayName)

      // Calculate time taken
      const timeMs = Date.now() - this.countryStartTime

      this.stats.red++
      this.guessedCountries.push({ code: this.currentCountry, color: "red" })
      this.updateMapLayers()

      // Record skipped country in database (no guessed country)
      quizDb.recordGuess(this.currentCountry, displayName, "normal", "incorrect", null, null, timeMs)

      // Clear the border highlight
      if (this.map.getLayer("current-country-border")) {
        this.map.setFilter("current-country-border", ["==", "ADM0_A3", ""])
      }

      this.remainingCountries.shift()
      this.updateStats()

      this.nextCountry()
    }
  }

  restart() {
    this.restart()
  }

  finish() {
    this.endQuiz(false)  // false = finished early
  }

  restart() {
    // Reset all state
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
    this.map.setFilter("countries-green", ["in", "ADM0_A3", ""])
    this.map.setFilter("countries-yellow", ["in", "ADM0_A3", ""])
    this.map.setFilter("countries-red", ["in", "ADM0_A3", ""])
    this.map.setFilter("current-country-border", ["==", "ADM0_A3", ""])
    this.map.setFilter("country-names", ["in", "ADM0_A3", ""])

    // Hide stats, search box and finished banner
    this.statsBarTarget.style.display = "none"
    this.searchBoxTarget.style.display = "none"
    this.finishedBannerTarget.style.display = "none"

    // Hide scale and navigation controls
    const scaleElement = document.querySelector('.maplibregl-ctrl-scale')
    if (scaleElement) {
      scaleElement.style.display = 'none'
    }
    const navElement = document.querySelector('.maplibregl-ctrl-top-right')
    if (navElement) {
      navElement.style.display = 'none'
    }

    // Disable map interaction again for the region selection screen
    if (this.map) {
      this.map.boxZoom.disable()
      this.map.scrollZoom.disable()
      this.map.dragPan.disable()
      this.map.dragRotate.disable()
      this.map.keyboard.disable()
      this.map.doubleClickZoom.disable()
      this.map.touchZoomRotate.disable()
    }

    // Show region selection
    this.regionSelectionTarget.style.display = "block"

    // Zoom out
    this.map.flyTo({
      center: [0, 20],
      zoom: 2,
      duration: 1000
    })
  }

  endQuiz(completedFully = true) {
    this.isFinished = true

    // Stop timer
    this.endTime = Date.now()
    const elapsedMs = this.endTime - this.startTime
    const totalSeconds = Math.floor(elapsedMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const milliseconds = Math.floor((elapsedMs % 1000) / 10) // Show centiseconds (2 digits)
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`

    // Record quiz run to database
    quizDb.recordQuizRun(
      "normal",
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

    // Show finished banner
    this.finishedBannerTarget.style.display = "block"

    // Zoom out to show the whole region
    this.map.flyTo({
      center: [0, 20],
      zoom: 2,
      duration: 2000
    })
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
             data-action="click->quiz#selectDebugSuggestion">${highlightedName}</div>`
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

    // Zoom to the country
    this.zoomToCountry(this.currentCountry)
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

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
