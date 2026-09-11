import { Controller } from "@hotwired/stimulus"
import { allCountryNames, nameToCode, countriesMapping, getCountriesForRegion } from "country_names"
import { quizDb } from "db"
import { flagUrl } from "flags"
import { presentQuestion } from "funbox"

// Flags mode (difficulty: Normal). Mirrors Quiz Hard, but the country is
// presented by its flag alone instead of its silhouette. Two guesses per
// country, the same green / yellow / red tally and the "It was:" reveal card.
//
// No map: the flag is the whole question, so this mode never touches the shared
// map (app.js parks it hidden while there's no [data-map-slot] on the page).
//
// Guesses are recorded with quiz_type "flags" so the shape-based Practice modes
// (worst / slowest / mix-ups) never pull a flags result — see db.js, which
// filters quiz_type != 'flags' out of those pools.
export default class extends Controller {
  static targets = ["flagOverlay", "flagImage",
                    "searchInput", "searchBox", "dropdown",
                    "regionSelection", "statsBar", "remainingCount", "greenCount",
                    "yellowCount", "redCount", "actionBtn", "finishedBanner",
                    "finalTime", "finalGreen", "finalYellow", "finalRed",
                    "debugSearchInput", "debugDropdown",
                    "navButtons", "timerDisplay", "resultsList",
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

    // Warm the browser cache so the next flag paints without a flash.
    this.preloadNextFlags = []

    this.initializeDatabase()
  }

  async initializeDatabase() {
    await quizDb.initialize()
  }

  disconnect() {
    this.stopTimer()
  }

  selectRegion(event) {
    const region = event.currentTarget.dataset.region
    this.currentRegion = region
    this.remainingCountries = [...getCountriesForRegion(region)]
    this.remainingCountries.sort(() => Math.random() - 0.5)

    this.startTime = Date.now()
    this.startTimer()

    this.regionSelectionTarget.style.display = "none"
    this.statsBarTarget.style.display = "flex"
    this.searchBoxTarget.style.display = "flex"
    this.updateStats()

    this.element.classList.add("quiz-active")

    this.startQuiz()
  }

  startQuiz() {
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
      this.endQuiz(true)
      return
    }

    this.currentCountry = this.remainingCountries[0]
    this.attemptCount = 0
    this.countryStartTime = Date.now()
    this.searchInputTarget.value = ""

    this.showFlag(this.currentCountry)
    this.preloadFlag(this.remainingCountries[1])
  }

  showFlag(countryCode) {
    this.flagImageTarget.src = flagUrl(countryCode)
    this.flagOverlayTarget.style.display = "block"
    presentQuestion(this.flagOverlayTarget)
  }

  // Kick the next flag into the browser cache so it paints instantly.
  preloadFlag(countryCode) {
    if (!countryCode) return
    const img = new Image()
    img.src = flagUrl(countryCode)
    this.preloadNextFlags.push(img)
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
             data-action="click->flags#selectSuggestion">${highlightedName}</div>`
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

    if (countryCode === this.currentCountry) {
      this.correctGuess(countryCode, countryName)
    } else {
      this.incorrectGuess(countryCode, countryName)
    }
  }

  correctGuess(guessedCode, guessedName) {
    this.attemptCount++

    const timeMs = Date.now() - this.countryStartTime

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

    const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry
    quizDb.recordGuess(this.currentCountry, displayName, "flags", guessType, guessedCode, guessedName, timeMs)

    this.showLastGuess(this.currentCountry, displayName, true)

    this.guessedCountries.push({ code: this.currentCountry, color })

    this.remainingCountries.shift()
    this.updateStats()
    this.nextCountry()
  }

  incorrectGuess(guessedCode, guessedName) {
    this.attemptCount++

    const timeMs = Date.now() - this.countryStartTime
    const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry

    if (this.attemptCount >= 2) {
      this.stats.red++
      this.guessedCountries.push({ code: this.currentCountry, color: "red" })
      this.showLastGuess(this.currentCountry, displayName, false)

      quizDb.recordGuess(this.currentCountry, displayName, "flags", "incorrect", guessedCode, guessedName, timeMs)

      this.remainingCountries.shift()
      this.updateStats()
      this.nextCountry()
    } else {
      quizDb.recordGuess(this.currentCountry, displayName, "flags", "incorrect", guessedCode, guessedName, timeMs)

      this.searchInputTarget.style.borderColor = "#ef4444"
      setTimeout(() => {
        this.searchInputTarget.style.borderColor = "#404040"
      }, 500)
    }

    this.searchInputTarget.value = ""
  }

  // Last-guess "It was:" card. The reveal media is a full-colour flag <img>
  // (lastGuessShape target), not the recolourable silhouette other modes show.
  showLastGuess(countryCode, displayName, wasCorrect) {
    this.lastGuessNameTarget.textContent = displayName
    this.lastGuessShapeTarget.src = flagUrl(countryCode)

    this.lastGuessCardTarget.classList.toggle("correct", wasCorrect)
    this.lastGuessCardTarget.classList.toggle("incorrect", !wasCorrect)
    this.lastGuessTarget.style.display = ""
  }

  skip() {
    if (this.currentCountry && !this.isFinished) {
      const displayName = countriesMapping[this.currentCountry]?.display_name || this.currentCountry
      this.showLastGuess(this.currentCountry, displayName, false)

      const timeMs = Date.now() - this.countryStartTime

      this.stats.red++
      this.guessedCountries.push({ code: this.currentCountry, color: "red" })

      quizDb.recordGuess(this.currentCountry, displayName, "flags", "incorrect", null, null, timeMs)

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
    this.endQuiz(false)
  }

  restart() {
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

    this.statsBarTarget.style.display = "none"
    this.searchBoxTarget.style.display = "none"
    this.finishedBannerTarget.style.display = "none"
    this.actionBtnTarget.style.display = ""
    this.lastGuessTarget.style.display = "none"
    this.resultsListTarget.style.display = "none"
    this.resultsListTarget.innerHTML = ""
    this.flagOverlayTarget.style.display = "none"

    this.regionSelectionTarget.style.display = "block"
    this.element.classList.remove("quiz-active")
  }

  endQuiz(completedFully = true) {
    this.isFinished = true

    this.stopTimer()
    this.endTime = Date.now()
    const elapsedMs = this.endTime - this.startTime

    quizDb.recordQuizRun(
      "flags",
      this.currentRegion,
      this.stats.green,
      this.stats.yellow,
      this.stats.red,
      elapsedMs,
      completedFully ? 1 : 0
    )

    this.finalTimeTarget.textContent = this.timerDisplayTarget.textContent
    this.finalGreenTarget.textContent = this.stats.green
    this.finalYellowTarget.textContent = this.stats.yellow
    this.finalRedTarget.textContent = this.stats.red

    this.searchBoxTarget.style.display = "none"
    this.statsBarTarget.style.display = "none"
    this.lastGuessTarget.style.display = "none"
    this.flagOverlayTarget.style.display = "none"
    this.finishedBannerTarget.style.display = "flex"

    this.renderResultsList()
  }

  // Missed countries under the Game Complete card: incorrect (red) first, then
  // shaky (yellow). Each entry is the country's flag + name.
  renderResultsList() {
    const colorToClass = { red: "incorrect", yellow: "shaky" }
    const order = { red: 0, yellow: 1 }

    const items = this.guessedCountries
      .filter(c => c.color === "red" || c.color === "yellow")
      .sort((a, b) => order[a.color] - order[b.color])

    if (items.length === 0) {
      this.resultsListTarget.style.display = "none"
      this.resultsListTarget.innerHTML = ""
      return
    }

    this.resultsListTarget.innerHTML = items.map(({ code, color }) => {
      const name = countriesMapping[code]?.display_name || code
      return `<div class="result-item ${colorToClass[color]}">
        <img class="country-flag" src="${flagUrl(code)}" alt="" />
        <span class="result-name">${name}</span>
      </div>`
    }).join("")

    this.resultsListTarget.style.display = "flex"
  }

  // --- Debug helpers (gated by the debug setting, same as Quiz Hard) ---------
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
             data-action="click->flags#selectDebugSuggestion">${highlightedName}</div>`
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
    this.debugSearchInputTarget.value = ""
    this.hideDebugDropdown()

    const countryCode = nameToCode[countryName.toLowerCase()]
    if (!countryCode) return

    this.currentCountry = countryCode
    this.attemptCount = 0
    this.searchInputTarget.value = ""
    this.showFlag(this.currentCountry)
  }

  async debugFill() {
    if (this.isFinished || this.remainingCountries.length === 0) return

    const button = document.querySelector('.debug-fill-btn')
    if (button) {
      button.disabled = true
      button.textContent = 'Debug: Running...'
    }

    while (this.remainingCountries.length > 0 && !this.isFinished) {
      const countryData = countriesMapping[this.currentCountry]
      if (!countryData) break

      const countryName = countryData.display_name
      this.searchInputTarget.value = countryName
      this.searchInputTarget.dispatchEvent(new Event('input'))
      await this.sleep(80)
      this.selectCountry(countryName)
      await this.sleep(200)
    }

    if (button) {
      button.disabled = false
      button.textContent = 'Debug: Fill'
    }
  }

  debugFastFill() {
    if (this.isFinished || this.remainingCountries.length === 0) return

    while (this.remainingCountries.length > 0) {
      const countryCode = this.remainingCountries[0]
      this.stats.green++
      this.guessedCountries.push({ code: countryCode, color: "green" })

      const displayName = countriesMapping[countryCode]?.display_name || countryCode
      quizDb.recordGuess(countryCode, displayName, "flags", "correct")

      this.remainingCountries.shift()
    }

    this.updateStats()
    this.endQuiz(true)
  }

  debugRealisticFill() {
    if (this.isFinished || this.remainingCountries.length === 0) return

    while (this.remainingCountries.length > 0) {
      const countryCode = this.remainingCountries[0]
      const random = Math.random()

      let color, guessType
      if (random < 1 / 3) {
        color = "green"
        guessType = "correct"
        this.stats.green++
      } else if (random < 2 / 3) {
        color = "yellow"
        guessType = "shaky"
        this.stats.yellow++
      } else {
        color = "red"
        guessType = "incorrect"
        this.stats.red++
      }

      this.guessedCountries.push({ code: countryCode, color })

      const displayName = countriesMapping[countryCode]?.display_name || countryCode
      quizDb.recordGuess(countryCode, displayName, "flags", guessType)

      this.remainingCountries.shift()
    }

    this.updateStats()
    this.endQuiz(true)
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
