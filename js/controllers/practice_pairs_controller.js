import { Controller } from "@hotwired/stimulus"
import { countriesMapping, countryBounds } from "country_names"
import { quizDb } from "db"
import { loadCountrySvg, shapeScaleBar } from "country_shapes"

// Mix-ups practice: pairs of countries the player has confused with each other
// (recorded as real country + wrong guess on every incorrect quiz answer) are
// shown as two silhouettes side by side, with only ONE name given as the
// prompt. The player taps the shape they think matches that name; whichever
// shape they pick, both get labelled with their true name so the difference
// is learned visually either way. No map in this mode — just the local SVG
// silhouettes, each with its own scale bar. Endless rounds until Finish;
// nothing is ever recorded to the database.
export default class extends Controller {
  static targets = ["startScreen", "startBtn", "statsBar", "correctCount", "incorrectCount",
                    "actionBtn", "pairPanel", "pairHint", "promptName",
                    "feedback", "nextBtn", "shapesArea", "shapeCard", "finishedBanner",
                    "finalCorrect", "finalIncorrect", "finalTime"]

  connect() {
    this.pool = []
    this.deck = []
    this.currentPair = null   // [promptCode, otherCode] - index 0 is always the named prompt
    this.shapeOrder = null    // same two codes in display order of the shape cards
    this.phase = "idle"       // "idle" | "assign" | "feedback"
    this.stats = { correct: 0, incorrect: 0 }
    this.isFinished = false
    this.startTime = null

    this.initializeDatabase()
  }

  async initializeDatabase() {
    await quizDb.initialize()
    this.updateStartButton()
  }

  // Confused pairs, restricted to codes the app fully knows: a display name
  // (never show a raw db code to the player) and bounds (for the scale bars).
  // Anything else — legacy or malformed records — is silently ignored.
  loadPool() {
    return quizDb.getConfusedPairs(30)
      .filter(pair => [pair.code_a, pair.code_b].every(code => countriesMapping[code] && countryBounds[code]))
      .map(pair => [pair.code_a, pair.code_b])
  }

  updateStartButton() {
    // The async db init may resolve after navigating away
    if (!this.hasStartBtnTarget) return

    const count = this.loadPool().length
    if (count === 0) {
      this.startBtnTarget.textContent = "No mix-ups recorded yet — play some quizzes first"
      this.startBtnTarget.disabled = true
    } else {
      this.startBtnTarget.textContent = `Start practice (${count} ${count === 1 ? "pair" : "pairs"})`
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
    this.pairPanelTarget.style.display = ""
    this.shapesAreaTarget.style.display = ""
    this.updateStats()

    this.nextPair()
  }

  updateStats() {
    this.correctCountTarget.textContent = this.stats.correct
    this.incorrectCountTarget.textContent = this.stats.incorrect
  }

  pairKey(pair) {
    return pair ? [...pair].sort().join("|") : null
  }

  nextPair() {
    // Endless, in rounds: draw from a shuffled copy of the pool without
    // replacement; reshuffle when it empties, avoiding an immediate repeat.
    if (this.deck.length === 0) {
      this.deck = [...this.pool].sort(() => Math.random() - 0.5)
      if (this.deck.length > 1 && this.pairKey(this.deck[0]) === this.pairKey(this.currentPair)) {
        this.deck.push(this.deck.shift())
      }
    }

    // currentPair[0] is the prompt; the shuffle picks which of the two codes
    // that is, so it varies round to round. Shape cards are shuffled
    // independently, so their left/right position never gives it away.
    this.currentPair = [...this.deck.shift()].sort(() => Math.random() - 0.5)
    this.shapeOrder = [...this.currentPair].sort(() => Math.random() - 0.5)
    this.phase = "assign"

    this.renderPrompt()
    this.renderShapes()
    this.feedbackTarget.style.display = "none"
    this.nextBtnTarget.style.display = "none"
    this.pairHintTarget.style.display = ""
  }

  displayName(code) {
    return countriesMapping[code]?.display_name || code
  }

  renderPrompt() {
    this.promptNameTarget.textContent = this.displayName(this.currentPair[0])
    this.promptNameTarget.classList.remove("correct", "incorrect")
  }

  async renderShapes() {
    const round = this.currentPair

    let svgs
    try {
      svgs = await Promise.all(this.shapeOrder.map(code => loadCountrySvg(code)))
    } catch (error) {
      // A pair we can't render (missing/broken icon) is dropped for the rest
      // of the session rather than shown wrong or blank.
      console.warn("Skipping unrenderable pair", round, error)
      if (this.currentPair !== round) return
      const key = this.pairKey(round)
      this.pool = this.pool.filter(pair => this.pairKey(pair) !== key)
      this.deck = this.deck.filter(pair => this.pairKey(pair) !== key)
      if (this.pool.length === 0) {
        this.finish()
      } else {
        this.nextPair()
      }
      return
    }

    if (this.currentPair !== round) return // user advanced while the fetch ran

    this.shapeCardTargets.forEach((card, index) => {
      const code = this.shapeOrder[index]
      card.dataset.code = code
      card.classList.remove("correct", "incorrect")
      card.disabled = false
      card.querySelector(".pair-shape-svg").innerHTML = svgs[index]
      card.querySelector(".pair-shape-name").textContent = ""
      // Wait for layout so the silhouette's rendered size can be measured
      requestAnimationFrame(() => this.updateShapeScale(card, code))
    })
  }

  updateShapeScale(card, code) {
    // Measure the wrapping <g> so multi-path silhouettes (islands) are fully covered
    const shape = card.querySelector(".pair-shape-svg")?.querySelector("g, path")
    const scale = shape && shapeScaleBar(shape.getBoundingClientRect().width, countryBounds[code])
    const scaleEl = card.querySelector(".pair-shape-scale")

    if (!scale) {
      scaleEl.style.display = "none"
      return
    }

    scaleEl.textContent = scale.label
    scaleEl.style.width = `${scale.barPx}px`
    scaleEl.style.display = "block"
  }

  selectShape(event) {
    if (this.phase !== "assign") return

    const clickedCode = event.currentTarget.dataset.code
    if (!this.currentPair.includes(clickedCode)) return

    this.resolveRound(clickedCode)
  }

  resolveRound(clickedCode) {
    this.phase = "feedback"

    const promptCode = this.currentPair[0]
    const wasCorrect = clickedCode === promptCode

    if (wasCorrect) {
      this.stats.correct++
    } else {
      this.stats.incorrect++
    }
    this.updateStats()

    this.promptNameTarget.classList.add(wasCorrect ? "correct" : "incorrect")

    // Reveal each shape's true name on its card
    this.shapeCardTargets.forEach(card => {
      card.classList.add(wasCorrect ? "correct" : "incorrect")
      card.disabled = true
      card.querySelector(".pair-shape-name").textContent = this.displayName(card.dataset.code)
    })

    this.feedbackTarget.textContent = wasCorrect
      ? "✓ Correct!"
      : `✗ Not quite — you tapped ${this.displayName(clickedCode)}. The shapes are now labelled.`
    this.feedbackTarget.classList.toggle("correct", wasCorrect)
    this.feedbackTarget.classList.toggle("incorrect", !wasCorrect)
    this.feedbackTarget.style.display = ""
    this.pairHintTarget.style.display = "none"
    this.nextBtnTarget.style.display = ""
    this.nextBtnTarget.focus()
  }

  next() {
    if (this.phase !== "feedback" || this.isFinished) return
    this.nextPair()
  }

  finish() {
    this.isFinished = true
    this.phase = "idle"

    const elapsedMs = Date.now() - this.startTime
    const totalSeconds = Math.floor(elapsedMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const centiseconds = Math.floor((elapsedMs % 1000) / 10)
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`

    this.finalCorrectTarget.textContent = this.stats.correct
    this.finalIncorrectTarget.textContent = this.stats.incorrect
    this.finalTimeTarget.textContent = `Time: ${timeString}`

    this.statsBarTarget.style.display = "none"
    this.pairPanelTarget.style.display = "none"
    this.shapesAreaTarget.style.display = "none"

    this.finishedBannerTarget.style.display = "flex"
  }

  restart() {
    this.isFinished = false
    this.currentPair = null
    this.shapeOrder = null
    this.stats = { correct: 0, incorrect: 0 }
    this.startTime = null

    this.finishedBannerTarget.style.display = "none"
    // Clear the inline style so the stylesheet's flex layout applies again
    this.startScreenTarget.style.display = ""

    this.updateStartButton()
  }
}
