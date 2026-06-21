import { Controller } from "@hotwired/stimulus"
import { quizDb } from "db"
import { countriesMapping } from "country_names"
import { SETTINGS, getSetting, setSetting } from "settings"

export default class extends Controller {
  static targets = [
    "totalGuesses", "correctCount", "shakyCount", "incorrectCount",
    "normalCorrect", "normalShaky", "normalIncorrect",
    "hardCorrect", "hardShaky", "hardIncorrect",
    "nameAllCorrect", "nameAllRemaining", "nameAllIncorrect",
    "countryList", "searchInput", "sortSelect", "runsList",
    "worstList", "slowestList", "clearBtn", "clearConfirm", "settingsList"
  ]

  async connect() {
    this.allCountryStats = []
    this.filteredCountryStats = []
    this.quizRuns = []
    this.filteredQuizRuns = []
    this.runsFilter = 'all' // 'all', 'full', 'partial'
    this.worstCountries = []
    this.slowestCountries = []
    await quizDb.initialize()
    await this.loadStats()
    await this.loadNameAllStats()
    await this.loadQuizRuns()
    await this.loadWorstCountries()
    await this.loadSlowestCountries()
    this.renderSettings()
  }

  renderSettings() {
    if (!this.hasSettingsListTarget) return

    this.settingsListTarget.innerHTML = SETTINGS
      .map(setting => {
        // A two-option setting (e.g. off/on) renders as a light-switch toggle;
        // the second option is the "on"/checked state. Anything else falls back
        // to a dropdown.
        const isToggle = setting.options.length === 2
        const control = isToggle
          ? this.renderToggle(setting)
          : this.renderSelect(setting)

        return `
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">${this.escapeHtml(setting.label)}</div>
              ${setting.description ? `<div class="setting-description">${this.escapeHtml(setting.description)}</div>` : ""}
            </div>
            ${control}
          </div>
        `
      })
      .join("")
  }

  renderToggle(setting) {
    const onValue = setting.options[1]
    const checked = getSetting(setting.key) === onValue ? "checked" : ""
    return `
      <label class="setting-switch">
        <input type="checkbox" data-action="change->stats#changeSetting" data-setting-key="${setting.key}" ${checked}>
        <span class="setting-switch-slider"></span>
      </label>
    `
  }

  renderSelect(setting) {
    const current = getSetting(setting.key)
    const options = setting.options
      .map(opt => `<option value="${opt}" ${opt === current ? "selected" : ""}>${opt}</option>`)
      .join("")
    return `
      <select class="setting-select" data-action="change->stats#changeSetting" data-setting-key="${setting.key}">
        ${options}
      </select>
    `
  }

  changeSetting(event) {
    const control = event.currentTarget
    const key = control.dataset.settingKey
    const setting = SETTINGS.find(s => s.key === key)

    let value
    if (control.type === "checkbox") {
      // options = [offValue, onValue]
      value = control.checked ? setting.options[1] : setting.options[0]
    } else {
      value = control.value
    }

    setSetting(key, value)
  }

  async loadStats() {
    // Get all guesses
    const allGuesses = quizDb.exportData()

    if (!allGuesses || allGuesses.length === 0) {
      this.showEmptyState()
      return
    }

    // Calculate summary stats
    const summary = {
      total: allGuesses.length,
      correct: 0,
      shaky: 0,
      incorrect: 0
    }

    // Calculate quiz type stats
    const normalStats = { correct: 0, shaky: 0, incorrect: 0 }
    const hardStats = { correct: 0, shaky: 0, incorrect: 0 }

    // Calculate country stats
    const countryStatsMap = {}

    allGuesses.forEach(guess => {
      // Summary
      summary[guess.guess_type]++

      // Quiz type
      if (guess.quiz_type === "normal") {
        normalStats[guess.guess_type]++
      } else if (guess.quiz_type === "hard") {
        hardStats[guess.guess_type]++
      }

      // Country stats
      if (!countryStatsMap[guess.country_code]) {
        countryStatsMap[guess.country_code] = {
          code: guess.country_code,
          name: guess.country_display_name,
          normal: { correct: 0, shaky: 0, incorrect: 0, total: 0 },
          hard: { correct: 0, shaky: 0, incorrect: 0, total: 0 },
          overall: { correct: 0, shaky: 0, incorrect: 0, total: 0 }
        }
      }

      // Update quiz-specific stats (other quiz types only count toward overall)
      const quizType = guess.quiz_type
      if (countryStatsMap[guess.country_code][quizType]) {
        countryStatsMap[guess.country_code][quizType][guess.guess_type]++
        countryStatsMap[guess.country_code][quizType].total++
      }

      // Update overall stats
      countryStatsMap[guess.country_code].overall[guess.guess_type]++
      countryStatsMap[guess.country_code].overall.total++
    })

    // Update summary cards
    this.totalGuessesTarget.textContent = summary.total
    this.correctCountTarget.textContent = summary.correct
    this.shakyCountTarget.textContent = summary.shaky
    this.incorrectCountTarget.textContent = summary.incorrect

    // Update quiz type stats
    this.normalCorrectTarget.textContent = normalStats.correct
    this.normalShakyTarget.textContent = normalStats.shaky
    this.normalIncorrectTarget.textContent = normalStats.incorrect
    this.hardCorrectTarget.textContent = hardStats.correct
    this.hardShakyTarget.textContent = hardStats.shaky
    this.hardIncorrectTarget.textContent = hardStats.incorrect

    // Convert country stats to array and sort
    this.allCountryStats = Object.values(countryStatsMap)
    this.filteredCountryStats = [...this.allCountryStats]
    this.sortCountries()
  }

  sortCountries() {
    const sortBy = this.sortSelectTarget.value

    this.filteredCountryStats.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name)
        case "total-desc":
          return b.overall.total - a.overall.total
        case "total-asc":
          return a.overall.total - b.overall.total
        case "correct-desc":
          return b.overall.correct - a.overall.correct
        case "incorrect-desc":
          return b.overall.incorrect - a.overall.incorrect
        default:
          return 0
      }
    })

    this.renderCountryList()
  }

  filterCountries() {
    const query = this.searchInputTarget.value.toLowerCase().trim()

    if (!query) {
      this.filteredCountryStats = [...this.allCountryStats]
    } else {
      this.filteredCountryStats = this.allCountryStats.filter(country =>
        country.name.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query)
      )
    }

    this.sortCountries()
  }

  renderCountryList() {
    if (this.filteredCountryStats.length === 0) {
      this.countryListTarget.innerHTML = '<div class="empty-state">No countries match your search.</div>'
      return
    }

    this.countryListTarget.innerHTML = this.filteredCountryStats
      .map(country => {
        const hasNormal = country.normal.total > 0
        const hasHard = country.hard.total > 0

        return `
          <div class="country-item">
            <div class="country-header">
              <div class="country-name">${this.escapeHtml(country.name)}</div>
              <div class="country-overall-stats">
                <div class="country-stat">
                  <span class="country-stat-label">Total:</span>
                  <span class="country-stat-value">${country.overall.total}</span>
                </div>
                <div class="country-stat green">
                  <span class="country-stat-label">✓:</span>
                  <span class="country-stat-value">${country.overall.correct}</span>
                </div>
                <div class="country-stat yellow">
                  <span class="country-stat-label">~:</span>
                  <span class="country-stat-value">${country.overall.shaky}</span>
                </div>
                <div class="country-stat red">
                  <span class="country-stat-label">✗:</span>
                  <span class="country-stat-value">${country.overall.incorrect}</span>
                </div>
              </div>
            </div>
            ${hasNormal || hasHard ? `
              <div class="country-quiz-breakdown">
                ${hasNormal ? `
                  <div class="quiz-breakdown-item">
                    <div class="quiz-type-label">Normal:</div>
                    <div class="quiz-breakdown-stats">
                      <span class="breakdown-stat green">✓ ${country.normal.correct}</span>
                      <span class="breakdown-stat yellow">~ ${country.normal.shaky}</span>
                      <span class="breakdown-stat red">✗ ${country.normal.incorrect}</span>
                    </div>
                  </div>
                ` : ''}
                ${hasHard ? `
                  <div class="quiz-breakdown-item">
                    <div class="quiz-type-label">Hard:</div>
                    <div class="quiz-breakdown-stats">
                      <span class="breakdown-stat green">✓ ${country.hard.correct}</span>
                      <span class="breakdown-stat yellow">~ ${country.hard.shaky}</span>
                      <span class="breakdown-stat red">✗ ${country.hard.incorrect}</span>
                    </div>
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `
      })
      .join("")
  }

  async loadNameAllStats() {
    // Get Name All quiz runs from the quiz_runs table
    const allRuns = quizDb.getAllQuizRuns(1000)
    const nameAllRuns = allRuns.filter(run => run.quiz_type === 'name_all')

    let totalCorrect = 0
    let totalRemaining = 0
    let totalIncorrect = 0

    nameAllRuns.forEach(run => {
      totalCorrect += run.correct_count
      totalRemaining += run.shaky_count  // In Name All mode, shaky_count stores remaining count
      totalIncorrect += run.incorrect_count
    })

    // Update Name All stats if targets exist
    if (this.hasNameAllCorrectTarget) {
      this.nameAllCorrectTarget.textContent = totalCorrect
      this.nameAllRemainingTarget.textContent = totalRemaining
      this.nameAllIncorrectTarget.textContent = totalIncorrect
    }
  }

  showEmptyState() {
    this.totalGuessesTarget.textContent = "0"
    this.correctCountTarget.textContent = "0"
    this.shakyCountTarget.textContent = "0"
    this.incorrectCountTarget.textContent = "0"

    this.normalCorrectTarget.textContent = "0"
    this.normalShakyTarget.textContent = "0"
    this.normalIncorrectTarget.textContent = "0"
    this.hardCorrectTarget.textContent = "0"
    this.hardShakyTarget.textContent = "0"
    this.hardIncorrectTarget.textContent = "0"

    if (this.hasNameAllCorrectTarget) {
      this.nameAllCorrectTarget.textContent = "0"
      this.nameAllRemainingTarget.textContent = "0"
      this.nameAllIncorrectTarget.textContent = "0"
    }

    this.countryListTarget.innerHTML = '<div class="empty-state">No statistics yet. Play some games to see your progress.</div>'
  }

  exportData() {
    const data = quizDb.exportData()
    if (!data || data.length === 0) {
      alert("No data to export")
      return
    }

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `game-stats-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  clearData() {
    // Swap the button for an inline confirmation instead of a browser popup
    this.clearBtnTarget.style.display = "none"
    this.clearConfirmTarget.style.display = "flex"
  }

  cancelClear() {
    this.clearConfirmTarget.style.display = "none"
    this.clearBtnTarget.style.display = ""
  }

  async confirmClear() {
    this.cancelClear()

    quizDb.clearAllData()
    this.allCountryStats = []
    this.filteredCountryStats = []
    this.showEmptyState()

    // Refresh the remaining sections so no stale data lingers
    await this.loadQuizRuns()
    await this.loadWorstCountries()
    await this.loadSlowestCountries()
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  async loadQuizRuns() {
    this.quizRuns = quizDb.getAllQuizRuns(50)
    this.filterRuns()
  }

  filterRuns(event) {
    // Get filter from event or default to 'all'
    const filter = event?.currentTarget?.dataset?.filter || 'all'
    this.runsFilter = filter

    // Update active tab styling
    if (event?.currentTarget) {
      document.querySelectorAll('.runs-tab').forEach(tab => tab.classList.remove('active'))
      event.currentTarget.classList.add('active')
    }

    if (filter === 'all') {
      this.filteredQuizRuns = this.quizRuns
    } else if (filter === 'full') {
      this.filteredQuizRuns = this.quizRuns.filter(run => run.completed_fully)
    } else if (filter === 'partial') {
      this.filteredQuizRuns = this.quizRuns.filter(run => !run.completed_fully)
    }

    this.renderRunsList()
  }

  renderRunsList() {
    if (!this.hasRunsListTarget) {
      return
    }

    if (this.quizRuns.length === 0) {
      this.runsListTarget.innerHTML = '<div class="empty-state">No games played yet. Play a game to see your history.</div>'
      return
    }

    if (this.filteredQuizRuns.length === 0) {
      this.runsListTarget.innerHTML = '<div class="empty-state">No runs match this filter.</div>'
      return
    }

    this.runsListTarget.innerHTML = this.filteredQuizRuns
      .map(run => {
        const date = new Date(run.timestamp)
        const dateStr = date.toLocaleDateString()
        const timeStr = date.toLocaleTimeString()

        const totalSeconds = Math.floor(run.time_ms / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        const centiseconds = Math.floor((run.time_ms % 1000) / 10)
        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`

        const total = run.correct_count + run.shaky_count + run.incorrect_count
        const quizTypeLabel = run.quiz_type === "normal" ? "Normal" :
                              run.quiz_type === "hard" ? "Hard" :
                              run.quiz_type === "name_all" ? "Name All" :
                              run.quiz_type === "place" ? "Place" : "Unknown"
        const regionLabel = this.formatRegionName(run.region)

        // For Name All mode, shaky_count stores remaining count
        const isNameAll = run.quiz_type === "name_all"
        const middleStatLabel = isNameAll ? "Remaining:" : "~:"
        const middleStatClass = isNameAll ? "red" : "yellow"

        return `
          <div class="run-item">
            <div class="run-header">
              <div class="run-info">
                <span class="run-quiz-type ${run.quiz_type}">${quizTypeLabel}</span>
                <span class="run-region">${regionLabel}</span>
                <span class="run-date">${dateStr} ${timeStr}</span>
              </div>
              <div class="run-time">${durationStr}</div>
            </div>
            <div class="run-stats">
              <div class="run-stat-item">
                <span class="run-stat-label">Total:</span>
                <span class="run-stat-value">${total}</span>
              </div>
              <div class="run-stat-item green">
                <span class="run-stat-label">✓:</span>
                <span class="run-stat-value">${run.correct_count}</span>
              </div>
              <div class="run-stat-item ${middleStatClass}">
                <span class="run-stat-label">${middleStatLabel}</span>
                <span class="run-stat-value">${run.shaky_count}</span>
              </div>
              <div class="run-stat-item ${isNameAll ? 'incorrect' : 'red'}">
                <span class="run-stat-label">${isNameAll ? 'Wrong:' : '✗:'}</span>
                <span class="run-stat-value">${run.incorrect_count}</span>
              </div>
            </div>
          </div>
        `
      })
      .join("")
  }

  formatRegionName(region) {
    const regionNames = {
      world: "World",
      africa: "Africa",
      asia: "Asia",
      europe: "Europe",
      north_america: "North America",
      south_america: "South America",
      oceania: "Oceania"
    }
    return regionNames[region] || region
  }

  async loadWorstCountries() {
    this.worstCountries = quizDb.getWorstCountries(20)
    this.renderWorstCountries()
  }

  renderWorstCountries() {
    if (!this.hasWorstListTarget) return

    if (this.worstCountries.length === 0) {
      this.worstListTarget.innerHTML = '<div class="empty-state">No incorrect guesses yet.</div>'
      return
    }

    this.worstListTarget.innerHTML = this.worstCountries
      .map((country, index) => {
        return `
          <div class="worst-item">
            <div class="worst-rank">${index + 1}</div>
            <div class="worst-info">
              <div class="worst-name">${this.escapeHtml(country.country_display_name)}</div>
              <div class="worst-stats">
                <span class="worst-stat red">✗ ${country.incorrect_count}</span>
                <span class="worst-stat yellow">~ ${country.shaky_count}</span>
                <span class="worst-stat green">✓ ${country.correct_count}</span>
              </div>
            </div>
          </div>
        `
      })
      .join("")
  }

  async loadSlowestCountries() {
    this.slowestCountries = quizDb.getSlowestCountries(20)
    this.renderSlowestCountries()
  }

  renderSlowestCountries() {
    if (!this.hasSlowestListTarget) return

    if (this.slowestCountries.length === 0) {
      this.slowestListTarget.innerHTML = '<div class="empty-state">Not enough data yet.</div>'
      return
    }

    this.slowestListTarget.innerHTML = this.slowestCountries
      .map((country, index) => {
        const avgSeconds = (country.avg_time_ms / 1000).toFixed(1)
        return `
          <div class="slowest-item">
            <div class="slowest-rank">${index + 1}</div>
            <div class="slowest-info">
              <div class="slowest-name">${this.escapeHtml(country.country_display_name)}</div>
              <div class="slowest-stats">
                <span class="slowest-time">${avgSeconds}s avg</span>
                <span class="slowest-count">(${country.guess_count} guesses)</span>
              </div>
            </div>
          </div>
        `
      })
      .join("")
  }
}
