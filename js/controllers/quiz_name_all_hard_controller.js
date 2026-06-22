import { Controller } from "@hotwired/stimulus"
import maplibregl from "maplibre-gl"
import { allCountryNames, nameToCode, countriesMapping, getCountriesForRegion } from "country_names"
import { quizDb } from "db"
import { getSharedMap, whenMapReady } from "shared_map"
import { countryShapeMarkup } from "country_shapes"

export default class extends Controller {
  static targets = ["container", "searchInput", "dropdown", "regionSelection", "statsBar",
                    "remainingCount", "correctCount", "incorrectCount", "timerDisplay",
                    "finishBtn", "finishedBanner", "finalCorrect", "finalRemaining", "finalIncorrect",
                    "navButtons", "finalTime", "searchBox", "gameUI", "guessedList"]

  connect() {
    this.highlightedIndex = -1
    this.suggestions = []
    this.suggestionMatches = []
    this.currentRegion = null
    this.regionCountries = []
    this.correctCountries = []
    this.incorrectCountries = []
    this.correctCountryNames = []
    this.incorrectCountryNames = []
    this.guessedCodes = new Set()
    this.stats = { correct: 0, incorrect: 0 }
    this.isFinished = false
    this.startTime = null
    this.endTime = null
    this.timerInterval = null

    this.initializeMap()
    this.initializeDatabase()
  }

  async initializeDatabase() {
    await quizDb.initialize()
  }

  disconnect() {
    if (this.map) {
      this.map.removeControl(this.scaleControl)
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
    }
  }

  initializeMap() {
    this.map = getSharedMap()

    this.scaleControl = new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    })
    this.map.addControl(this.scaleControl, 'bottom-right')

    // Hide scale control initially
    const scaleElement = document.querySelector('.maplibregl-ctrl-scale')
    if (scaleElement) {
      scaleElement.style.display = 'none'
    }

    whenMapReady(() => {
      this.setupLayers()
    })
  }

  setupLayers() {
    // Base layer - all countries in dark gray (shown after finishing)
    this.map.addLayer({
      id: "countries-base",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#2a2a2a",
        "fill-opacity": 0.8
      }
    })

    // Remaining countries layer (red) - shown after finishing
    this.map.addLayer({
      id: "countries-remaining",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#ef4444",
        "fill-opacity": 0.7
      },
      filter: ["in", "ADM0_A3"]
    })

    // Correct countries layer (green) - shown after finishing
    this.map.addLayer({
      id: "countries-correct",
      type: "fill",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "fill-color": "#4ade80",
        "fill-opacity": 0.7
      },
      filter: ["in", "ADM0_A3"]
    })

    // Country outline layer - shown for all countries after finish
    this.map.addLayer({
      id: "countries-outline",
      type: "line",
      source: "countries",
      "source-layer": "countries",
      paint: {
        "line-color": "#555555",
        "line-width": 1
      }
    })

    this.map.addLayer({
      id: "country-names",
      type: "symbol",
      source: "countries",
      "source-layer": "countries",
      layout: {
        "text-field": ["get", "NAME"],
        "text-size": 12,
        "text-letter-spacing": 0.05
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1
      },
      filter: ["in", "ADM0_A3"]
    })
  }

  selectRegion(event) {
    this.currentRegion = event.currentTarget.dataset.region
    this.regionCountries = getCountriesForRegion(this.currentRegion)

    this.regionSelectionTarget.style.display = 'none'
    this.gameUITarget.style.display = 'flex'
    this.statsBarTarget.style.display = 'flex'
    this.guessedListTarget.style.display = 'block'

    // Hide the shared preview map; this mode manages its own layers
    this.map.setFilter("countries-preview-fill", ["in", "ADM0_A3"])
    this.map.setFilter("countries-preview-outline", ["in", "ADM0_A3"])

    // Hide map during gameplay
    this.map.setFilter("countries-base", ["in", "ADM0_A3"])
    this.map.setFilter("countries-outline", ["in", "ADM0_A3"])

    this.updateStats()
    this.startTimer()
    this.zoomToRegion()

    this.searchInputTarget.focus()
  }

  zoomToRegion() {
    const regionZooms = {
      world: { center: [0, 20], zoom: 1.5 },
      africa: { center: [20, 0], zoom: 2.5 },
      asia: { center: [100, 30], zoom: 2.2 },
      europe: { center: [15, 52], zoom: 3 },
      north_america: { center: [-100, 45], zoom: 2.5 },
      south_america: { center: [-60, -15], zoom: 2.5 },
      oceania: { center: [135, -25], zoom: 3 }
    }

    const zoom = regionZooms[this.currentRegion] || { center: [0, 20], zoom: 1.5 }
    this.map.flyTo({
      center: zoom.center,
      zoom: zoom.zoom,
      duration: 1000
    })
  }

  startTimer() {
    this.startTime = Date.now()
    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay()
    }, 1000)
  }

  updateTimerDisplay() {
    if (!this.startTime) return

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    this.timerDisplayTarget.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  updateStats() {
    const remaining = this.regionCountries.length - this.correctCountries.length
    this.remainingCountTarget.textContent = remaining
    this.correctCountTarget.textContent = this.correctCountries.length
    this.incorrectCountTarget.textContent = this.incorrectCountries.length
  }

  updateGuessedList() {
    // While playing, show correctly guessed countries (map hides names in Hard mode).
    // Once finished, show only incorrect guesses; correct ones are omitted.
    const allGuesses = this.isFinished
      ? this.incorrectCountryNames.map((name, i) => ({
          name,
          correct: false,
          code: this.incorrectCountries[i]
        }))
      : this.correctCountryNames.map((name, i) => ({
          name,
          correct: true,
          code: this.correctCountries[i]
        }))

    this.guessedListTarget.innerHTML = `
      <div class="guessed-grid">
        ${allGuesses.map(guess => `
          <div class="guessed-country ${guess.correct ? 'correct' : 'incorrect'}">
            ${countryShapeMarkup(guess.code)}
            <div class="country-name">${guess.name}</div>
          </div>`).join('')}
      </div>
    `
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

  showDropdown() {
    this.dropdownTarget.innerHTML = this.suggestions
      .map((name, index) => {
        const highlightedName = this.highlightMatchedLetters(name, this.suggestionMatches[index])
        return `<div class="autocomplete-item ${index === this.highlightedIndex ? "highlighted" : ""}"
                     data-index="${index}"
                     data-action="click->quiz-name-all#selectSuggestion">${highlightedName}</div>`
      })
      .join("")

    this.dropdownTarget.classList.add("show")
  }

  hideDropdown() {
    this.dropdownTarget.classList.remove("show")
    this.dropdownTarget.innerHTML = ""
    this.suggestions = []
    this.suggestionMatches = []
    this.highlightedIndex = -1
  }

  handleKeydown(event) {
    if (this.suggestions.length === 0) {
      if (event.key === 'Enter') {
        event.preventDefault()
        this.submitGuess()
      }
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.suggestions.length - 1)
        this.showDropdown()
        break
      case 'ArrowUp':
        event.preventDefault()
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0)
        this.showDropdown()
        break
      case 'Enter':
        event.preventDefault()
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.suggestions.length) {
          this.selectSuggestionByIndex(this.highlightedIndex)
        }
        break
      case 'Escape':
        event.preventDefault()
        this.hideDropdown()
        break
    }
  }

  selectSuggestion(event) {
    const index = parseInt(event.currentTarget.dataset.index)
    this.selectSuggestionByIndex(index)
  }

  selectSuggestionByIndex(index) {
    if (index >= 0 && index < this.suggestions.length) {
      const countryName = this.suggestions[index]
      this.searchInputTarget.value = countryName
      this.hideDropdown()
      this.submitGuess()
    }
  }

  submitGuess() {
    const guess = this.searchInputTarget.value.trim()
    if (!guess) return

    const countryCode = nameToCode[guess.toLowerCase()]

    if (!countryCode) {
      this.searchInputTarget.value = ''
      this.hideDropdown()
      return
    }

    if (this.guessedCodes.has(countryCode)) {
      this.searchInputTarget.value = ''
      this.hideDropdown()
      return
    }

    this.guessedCodes.add(countryCode)

    // Get the properly formatted country name
    const countryName = countriesMapping[countryCode].display_name

    if (this.regionCountries.includes(countryCode)) {
      this.correctCountries.push(countryCode)
      this.correctCountryNames.push(countryName)
      this.stats.correct++
      this.flashFeedback(true)
    } else {
      this.incorrectCountries.push(countryCode)
      this.incorrectCountryNames.push(countryName)
      this.stats.incorrect++
      this.flashFeedback(false)
    }

    this.searchInputTarget.value = ''
    this.hideDropdown()
    this.updateStats()
    this.updateGuessedList()

    if (this.correctCountries.length === this.regionCountries.length) {
      this.finish()
    }
  }

  flashFeedback(isCorrect) {
    const input = this.searchInputTarget
    const originalBorder = input.style.borderColor
    input.style.borderColor = isCorrect ? '#4ade80' : '#ef4444'
    setTimeout(() => {
      input.style.borderColor = originalBorder
    }, 300)
  }

  finish() {
    if (this.isFinished) return

    this.isFinished = true
    this.endTime = Date.now()

    if (this.timerInterval) {
      clearInterval(this.timerInterval)
    }

    const totalTime = this.endTime - this.startTime
    const remaining = this.regionCountries.length - this.correctCountries.length

    this.recordToDatabase(totalTime, remaining === 0)

    this.gameUITarget.style.display = 'none'
    this.statsBarTarget.style.display = 'none'
    this.guessedListTarget.style.display = 'none'
    this.finishedBannerTarget.style.display = 'block'

    // Enable map interaction for results viewing
    if (this.map) {
      this.map.boxZoom.enable()
      this.map.scrollZoom.enable()
      this.map.dragPan.enable()
      this.map.dragRotate.enable()
      this.map.keyboard.enable()
      this.map.doubleClickZoom.enable()
      this.map.touchZoomRotate.enable()
    }

    const minutes = Math.floor(totalTime / 60000)
    const seconds = Math.floor((totalTime % 60000) / 1000)
    const centiseconds = Math.floor((totalTime % 1000) / 10) // Show centiseconds (2 digits)
    this.finalTimeTarget.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`

    this.finalCorrectTarget.textContent = this.correctCountries.length
    this.finalRemainingTarget.textContent = remaining
    this.finalIncorrectTarget.textContent = this.incorrectCountries.length

    this.showResultsOnMap()
  }

  showResultsOnMap() {
    const remaining = this.regionCountries.filter(code => !this.correctCountries.includes(code))

    // Get all world country codes
    const allWorldCountries = Object.keys(countriesMapping)

    // Show all world countries in base layer (dark gray)
    this.map.setFilter("countries-base", ["in", "ADM0_A3", ...allWorldCountries])

    // Show remaining countries (red fill) - these will be on top of base layer
    this.map.setFilter("countries-remaining", ["in", "ADM0_A3", ...remaining])

    // Show correct countries (green fill) - these will be on top of base and remaining layers
    this.map.setFilter("countries-correct", ["in", "ADM0_A3", ...this.correctCountries])

    // Show outlines for all world countries
    this.map.setFilter("countries-outline", ["in", "ADM0_A3", ...allWorldCountries])

    // Show names only for region countries
    this.map.setFilter("country-names", ["in", "ADM0_A3", ...this.regionCountries])
  }

  recordToDatabase(timeMs, completedFully) {
    const correctCount = this.correctCountries.length
    const incorrectCount = this.incorrectCountries.length
    const remainingCount = this.regionCountries.length - correctCount

    quizDb.recordQuizRun(
      'name_all_hard',
      this.currentRegion,
      correctCount,
      remainingCount,
      incorrectCount,
      timeMs,
      completedFully ? 1 : 0
    )
  }

  restart() {
    window.location.reload()
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async debugFill() {
    if (this.isFinished) {
      return
    }

    // Disable the button while running
    const button = document.querySelector('.debug-fill-btn')
    if (button) {
      button.disabled = true
      button.textContent = 'Debug: Running...'
    }

    // Get all countries that haven't been guessed yet
    const remainingCodes = this.regionCountries.filter(code => !this.guessedCodes.has(code))

    // Process each country one by one
    for (const countryCode of remainingCodes) {
      if (this.isFinished) break

      const countryData = countriesMapping[countryCode]
      if (!countryData) {
        console.error(`No data found for country code: ${countryCode}`)
        continue
      }

      // Use display_name for the quiz
      const countryName = countryData.display_name

      // Simulate typing the country name
      this.searchInputTarget.value = countryName
      this.searchInputTarget.dispatchEvent(new Event('input'))

      // Wait a bit for the autocomplete to show
      await this.sleep(100)

      // Submit the guess
      this.submitGuess()

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
    if (this.isFinished) {
      return
    }

    // Instantly name every remaining country correctly
    const remainingCodes = this.regionCountries.filter(code => !this.guessedCodes.has(code))
    for (const countryCode of remainingCodes) {
      this.guessedCodes.add(countryCode)
      this.correctCountries.push(countryCode)
      this.correctCountryNames.push(countriesMapping[countryCode].display_name)
      this.stats.correct++
    }

    this.updateStats()
    this.finish()
  }

  debugRealisticFill() {
    if (this.isFinished) {
      return
    }

    // Name a random ~2/3 of remaining countries, leaving the rest unguessed
    const remainingCodes = this.regionCountries.filter(code => !this.guessedCodes.has(code))
    for (const countryCode of remainingCodes) {
      if (Math.random() < 2/3) {
        this.guessedCodes.add(countryCode)
        this.correctCountries.push(countryCode)
        this.correctCountryNames.push(countriesMapping[countryCode].display_name)
        this.stats.correct++
      }
    }

    this.updateStats()
    this.finish()
  }
}
