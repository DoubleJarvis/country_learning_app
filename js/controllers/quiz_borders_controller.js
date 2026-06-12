import { Controller } from "@hotwired/stimulus"
import maplibregl from "maplibre-gl"
import { allCountryNames, nameToCode, countriesMapping, countryBounds } from "country_names"
import { getRandomCountryWithBorders, getBorders } from "adjacency_helper"
import { getSharedMap, whenMapReady } from "shared_map"

export default class extends Controller {
  static targets = ["container", "searchInput", "searchBox", "dropdown", "startScreen", "statsBar",
                    "remainingCount", "correctCount", "incorrectCount", "countryName",
                    "actionBtn", "finishedBanner", "finalCorrect", "finalIncorrect",
                    "navButtons", "finalTime", "bordersTotal"]

  connect() {
    this.highlightedIndex = -1
    this.suggestions = []
    this.currentCountry = null
    this.borders = []
    this.guessedBorders = new Set()
    this.incorrectGuesses = 0
    this.correctGuesses = 0
    this.maxAttempts = 0
    this.isFinished = false
    this.startTime = null
    this.endTime = null

    this.initializeMap()
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
    // Target country highlight (the country we're finding borders for)
    this.map.addLayer({
      id: "target-country",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#4a9eff",
        "fill-opacity": 0.6
      },
      filter: ["in", "ADM0_A3"]
    })

    // Target country border
    this.map.addLayer({
      id: "target-country-border",
      type: "line",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "line-color": "#ffd700",
        "line-width": 3
      },
      filter: ["in", "ADM0_A3"]
    })

    // Correct neighbour countries fill (green)
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

    // Correct neighbour countries outline
    this.map.addLayer({
      id: "countries-green-outline",
      type: "line",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "line-color": "#2d7a4f",
        "line-width": 2
      },
      filter: ["in", "ADM0_A3"]
    })

    // Missed neighbour countries fill (red)
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

    // Missed neighbour countries outline
    this.map.addLayer({
      id: "countries-red-outline",
      type: "line",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "line-color": "#991b1b",
        "line-width": 2
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
  }

  async startGame() {
    // Select a random country with borders
    this.currentCountry = await getRandomCountryWithBorders()
    this.borders = await getBorders(this.currentCountry)
    this.guessedBorders = new Set()
    this.incorrectGuesses = 0
    this.correctGuesses = 0
    this.maxAttempts = this.borders.length * 2
    this.isFinished = false

    // Start timer
    this.startTime = Date.now()

    // Hide start screen
    this.startScreenTarget.style.display = "none"

    // Show stats bar and search box
    this.statsBarTarget.style.display = "flex"
    this.searchBoxTarget.style.display = "flex"

    // Update UI with country info
    const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry
    this.countryNameTarget.textContent = displayName
    this.bordersTotalTarget.textContent = this.borders.length

    // Update stats
    this.updateStats()

    // Wait for map to be ready before starting
    whenMapReady(() => this.showCountry())

    // Show scale control when game starts
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

    // Focus the input
    this.searchInputTarget.focus()
  }

  showCountry() {
    // Ensure layers are set up
    if (!this.map.getLayer("target-country")) {
      this.setupLayers()
    }

    // Hide the preview map once the game starts
    this.map.setFilter("countries-preview-fill", ["in", "ADM0_A3"])
    this.map.setFilter("countries-preview-outline", ["in", "ADM0_A3"])

    // Highlight the target country
    this.map.setFilter("target-country", ["==", "ADM0_A3", this.currentCountry])
    this.map.setFilter("target-country-border", ["==", "ADM0_A3", this.currentCountry])

    // Show the country name
    this.map.setFilter("country-names", ["in", "ADM0_A3", this.currentCountry])

    // Zoom to the country
    this.zoomToCountry(this.currentCountry)
  }

  zoomToCountry(countryCode) {
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

  recenter() {
    if (this.currentCountry && !this.isFinished) {
      this.zoomToCountry(this.currentCountry)
    }
    this.searchInputTarget.focus()
  }

  updateStats() {
    this.remainingCountTarget.textContent = this.maxAttempts - this.incorrectGuesses
    this.correctCountTarget.textContent = `${this.correctGuesses} / ${this.borders.length}`
    this.incorrectCountTarget.textContent = this.incorrectGuesses
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
             data-action="click->quiz-borders#selectSuggestion">${highlightedName}</div>`
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

    // Check if this country is a neighbour
    if (this.borders.includes(countryCode)) {
      // Check if already guessed
      if (this.guessedBorders.has(countryCode)) {
        // Already guessed - show feedback but don't count as incorrect
        this.searchInputTarget.style.borderColor = "#fbbf24"
        setTimeout(() => {
          this.searchInputTarget.style.borderColor = "#404040"
        }, 300)
        return
      }

      this.correctGuess(countryCode)
    } else {
      this.incorrectGuess(countryCode)
    }
  }

  correctGuess(countryCode) {
    this.correctGuesses++
    this.guessedBorders.add(countryCode)

    // Show green on the map
    this.updateMapLayers()

    // Update stats
    this.updateStats()

    // Visual feedback
    this.searchInputTarget.style.borderColor = "#4ade80"
    setTimeout(() => {
      this.searchInputTarget.style.borderColor = "#404040"
    }, 300)

    // Check if all borders found
    if (this.correctGuesses === this.borders.length) {
      this.endGame(true)
    }

    this.searchInputTarget.focus()
  }

  incorrectGuess(countryCode) {
    this.incorrectGuesses++

    // Update stats
    this.updateStats()

    // Visual feedback
    this.searchInputTarget.style.borderColor = "#ef4444"
    setTimeout(() => {
      this.searchInputTarget.style.borderColor = "#404040"
    }, 500)

    // Check if out of attempts
    if (this.incorrectGuesses >= this.maxAttempts) {
      this.endGame(false)
    }

    this.searchInputTarget.focus()
  }

  updateMapLayers() {
    const correctCountries = Array.from(this.guessedBorders)

    // Show all correctly guessed borders in green (fill and outline)
    this.map.setFilter("countries-green", ["in", "ADM0_A3", ...(correctCountries.length > 0 ? correctCountries : [""])])
    this.map.setFilter("countries-green-outline", ["in", "ADM0_A3", ...(correctCountries.length > 0 ? correctCountries : [""])])

    // Update country names to show target + correct guesses
    const visibleCountries = [this.currentCountry, ...correctCountries]
    this.map.setFilter("country-names", ["in", "ADM0_A3", ...(visibleCountries.length > 0 ? visibleCountries : [""])])
  }

  finish() {
    this.endGame(false)
  }

  endGame(wonGame) {
    this.isFinished = true
    this.endTime = Date.now()

    // Calculate elapsed time
    const elapsedMs = this.endTime - this.startTime
    const minutes = Math.floor(elapsedMs / 60000)
    const seconds = Math.floor((elapsedMs % 60000) / 1000)
    const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

    // Hide stats bar and search box
    this.statsBarTarget.style.display = "none"
    this.searchBoxTarget.style.display = "none"

    // Show finished banner
    this.finishedBannerTarget.style.display = "block"
    this.finalTimeTarget.textContent = timeString
    this.finalCorrectTarget.textContent = `${this.correctGuesses} / ${this.borders.length}`
    this.finalIncorrectTarget.textContent = this.incorrectGuesses

    // Calculate missed borders
    const missedBorders = this.borders.filter(code => !this.guessedBorders.has(code))
    const guessedBordersList = Array.from(this.guessedBorders)

    // Show guessed borders in green
    this.map.setFilter("countries-green", ["in", "ADM0_A3", ...(guessedBordersList.length > 0 ? guessedBordersList : [""])])
    this.map.setFilter("countries-green-outline", ["in", "ADM0_A3", ...(guessedBordersList.length > 0 ? guessedBordersList : [""])])

    // Show missed borders in red
    this.map.setFilter("countries-red", ["in", "ADM0_A3", ...(missedBorders.length > 0 ? missedBorders : [""])])
    this.map.setFilter("countries-red-outline", ["in", "ADM0_A3", ...(missedBorders.length > 0 ? missedBorders : [""])])

    // Show all country names
    const allCountries = [this.currentCountry, ...this.borders]
    this.map.setFilter("country-names", ["in", "ADM0_A3", ...allCountries])

    // Log missed borders
    if (!wonGame && missedBorders.length > 0) {
      console.log("Missed borders:", missedBorders.map(code => countriesMapping[code]?.display_name || code))
    }
  }

  restart() {
    // Reset state
    this.currentCountry = null
    this.borders = []
    this.guessedBorders = new Set()
    this.incorrectGuesses = 0
    this.correctGuesses = 0
    this.isFinished = false
    this.startTime = null
    this.endTime = null

    // Clear map filters
    this.map.setFilter("target-country", ["in", "ADM0_A3"])
    this.map.setFilter("target-country-border", ["in", "ADM0_A3"])
    this.map.setFilter("countries-green", ["in", "ADM0_A3"])
    this.map.setFilter("countries-green-outline", ["in", "ADM0_A3"])
    this.map.setFilter("countries-red", ["in", "ADM0_A3"])
    this.map.setFilter("countries-red-outline", ["in", "ADM0_A3"])
    this.map.setFilter("country-names", ["in", "ADM0_A3", ""])

    // Show the preview map again behind the start screen
    this.map.setFilter("countries-preview-fill", null)
    this.map.setFilter("countries-preview-outline", null)

    // Hide finished banner
    this.finishedBannerTarget.style.display = "none"

    // Reset map view
    this.map.flyTo({
      center: [0, 20],
      zoom: 1.5,
      duration: 1000
    })

    // Show start screen
    this.startScreenTarget.style.display = "block"

    // Hide scale and navigation controls
    const scaleElement = document.querySelector('.maplibregl-ctrl-scale')
    if (scaleElement) {
      scaleElement.style.display = 'none'
    }
    const navElement = document.querySelector('.maplibregl-ctrl-top-right')
    if (navElement) {
      navElement.style.display = 'none'
    }

    // Disable map interaction again for the start screen
    if (this.map) {
      this.map.boxZoom.disable()
      this.map.scrollZoom.disable()
      this.map.dragPan.disable()
      this.map.dragRotate.disable()
      this.map.keyboard.disable()
      this.map.doubleClickZoom.disable()
      this.map.touchZoomRotate.disable()
    }
  }
}
