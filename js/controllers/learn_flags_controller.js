import { Controller } from "@hotwired/stimulus"
import { countriesMapping, getCountriesForRegion } from "country_names"
import { flagUrl } from "flags"
import { presentQuestion } from "funbox"

// Learn → Flags. The gentle, no-typing counterpart to the Flags quiz, and the
// mirror image of Mix-ups practice (practice_pairs): there the player gets one
// name and two shapes, here they get one flag and two names. A wrong pick costs
// nothing — the flag is simply labelled with its real owner — so the mode
// teaches by exposure rather than testing.
//
// Every country is in the pool (all 171 have a flag SVG); the distractor is
// drawn at random from the rest. No map, and nothing is written to the
// database: a 50/50 pick isn't a meaningful stat and would pollute the quiz
// history the Practice modes are built from.
export default class extends Controller {
  static targets = ["startScreen", "startBtn", "statsBar", "correctCount", "incorrectCount",
                    "actionBtn", "flagStage", "flagImage", "panel", "status", "option",
                    "lastGuess", "lastGuessCard", "lastGuessShape", "lastGuessName",
                    "finishedBanner", "finalCorrect", "finalIncorrect", "finalTime"]

  // How long the resolved round stays up before the next flag appears. A wrong
  // pick gets longer — a beat to look at the flag with the right name attached —
  // but not by much: the country stays available afterwards in the "It was:"
  // card, so neither delay has to be long enough to memorize from.
  static ADVANCE_MS = { correct: 900, incorrect: 1400 }

  connect() {
    this.pool = getCountriesForRegion("world").filter(code => countriesMapping[code])
    this.deck = []
    this.currentCode = null   // the country whose flag is shown
    this.optionCodes = []     // the two names, in left-to-right display order
    this.phase = "idle"       // "idle" | "choose" | "feedback"
    this.stats = { correct: 0, incorrect: 0 }
    this.isFinished = false
    this.startTime = null
    // Warmed <img>s for the next round's flag, so it paints without a flash.
    this.preloadedFlags = []
    this.advanceTimer = null
  }

  disconnect() {
    this.cancelAdvance()
  }

  startLearning() {
    if (this.pool.length < 2) return

    this.deck = []
    this.startTime = Date.now()

    this.startScreenTarget.style.display = "none"
    this.statsBarTarget.style.display = "flex"
    this.flagStageTarget.style.display = ""
    this.panelTarget.style.display = ""
    this.updateStats()

    this.nextRound()
  }

  updateStats() {
    this.correctCountTarget.textContent = this.stats.correct
    this.incorrectCountTarget.textContent = this.stats.incorrect
  }

  displayName(code) {
    return countriesMapping[code]?.display_name || code
  }

  nextRound() {
    // Endless, in rounds: draw from a shuffled copy of the pool without
    // replacement so every country comes up once before any repeats, then
    // reshuffle — avoiding an immediate repeat across the seam.
    if (this.deck.length === 0) {
      this.deck = [...this.pool].sort(() => Math.random() - 0.5)
      if (this.deck.length > 1 && this.deck[0] === this.currentCode) {
        this.deck.push(this.deck.shift())
      }
    }

    this.currentCode = this.deck.shift()
    // The distractor comes from the whole pool (not the remaining deck), so
    // recently-seen countries can still appear as a wrong answer.
    const distractor = this.randomOtherCountry(this.currentCode)
    this.optionCodes = [this.currentCode, distractor].sort(() => Math.random() - 0.5)
    this.phase = "choose"

    this.flagImageTarget.src = flagUrl(this.currentCode)
    presentQuestion(this.flagStageTarget)
    this.preloadFlag(this.deck[0])

    this.optionTargets.forEach((option, index) => {
      option.dataset.code = this.optionCodes[index]
      option.classList.remove("correct", "incorrect")
      option.disabled = false
      option.querySelector(".learn-option-name").textContent = this.displayName(this.optionCodes[index])
    })

    this.statusTarget.textContent = "Which country is this?"
    this.statusTarget.classList.remove("correct", "incorrect")
  }

  randomOtherCountry(excludeCode) {
    let code
    do {
      code = this.pool[Math.floor(Math.random() * this.pool.length)]
    } while (code === excludeCode)
    return code
  }

  // Kick the next flag into the browser cache so it paints instantly.
  preloadFlag(code) {
    if (!code) return
    const img = new Image()
    img.src = flagUrl(code)
    this.preloadedFlags.push(img)
  }

  selectOption(event) {
    this.choose(event.currentTarget.dataset.code)
  }

  // Left/Right pick the corresponding card outright — the whole point of the
  // mode is that a choice needs no confirmation. Bound at the window so the
  // keys work without the player having to focus anything first.
  selectLeft(event) {
    this.chooseSide(event, 0)
  }

  selectRight(event) {
    this.chooseSide(event, 1)
  }

  chooseSide(event, index) {
    if (this.phase !== "choose") return
    event.preventDefault()
    this.choose(this.optionCodes[index])
  }

  choose(pickedCode) {
    if (this.phase !== "choose") return
    if (!this.optionCodes.includes(pickedCode)) return

    this.phase = "feedback"

    const wasCorrect = pickedCode === this.currentCode
    if (wasCorrect) {
      this.stats.correct++
    } else {
      this.stats.incorrect++
    }
    this.updateStats()

    // The answer always goes green, so a wrong pick still teaches which name the
    // flag belongs to. Red is reserved for a name the player actually got wrong;
    // on a correct pick the other card just stays neutral.
    this.optionTargets.forEach(option => {
      if (option.dataset.code === this.currentCode) {
        option.classList.add("correct")
      } else if (option.dataset.code === pickedCode) {
        option.classList.add("incorrect")
      }
      option.disabled = true
    })

    // Deliberately doesn't name what the player picked: with only two options
    // they already know, and reading their own wrong answer back to them buries
    // the one thing that matters — whose flag this actually is.
    this.statusTarget.textContent = wasCorrect
      ? "✓ Correct!"
      : `✗ It's ${this.displayName(this.currentCode)}`
    this.statusTarget.classList.toggle("correct", wasCorrect)
    this.statusTarget.classList.toggle("incorrect", !wasCorrect)

    this.showLastGuess(this.currentCode, wasCorrect)

    // No Next button: the round resolves itself. The delay is the only thing
    // holding the answer on screen, so it has to survive Finish and navigation
    // (see cancelAdvance) or it would fire into a torn-down page.
    const delay = this.constructor.ADVANCE_MS[wasCorrect ? "correct" : "incorrect"]
    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null
      if (this.isFinished) return
      this.nextRound()
    }, delay)
  }

  cancelAdvance() {
    clearTimeout(this.advanceTimer)
    this.advanceTimer = null
  }

  // "It was:" card, the same reveal Quiz Hard and Flags show. It's the reason
  // the auto-advance can be quick: once the next flag is up, the one just
  // answered is still on screen here rather than gone for good.
  showLastGuess(code, wasCorrect) {
    this.lastGuessNameTarget.textContent = this.displayName(code)
    this.lastGuessShapeTarget.src = flagUrl(code)
    this.lastGuessCardTarget.classList.toggle("correct", wasCorrect)
    this.lastGuessCardTarget.classList.toggle("incorrect", !wasCorrect)
    this.lastGuessTarget.style.display = ""
  }

  finish() {
    this.isFinished = true
    this.phase = "idle"
    this.cancelAdvance()

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
    this.flagStageTarget.style.display = "none"
    this.panelTarget.style.display = "none"

    this.finishedBannerTarget.style.display = "flex"
  }

  restart() {
    this.isFinished = false
    this.currentCode = null
    this.optionCodes = []
    this.stats = { correct: 0, incorrect: 0 }
    this.startTime = null

    this.finishedBannerTarget.style.display = "none"
    this.lastGuessTarget.style.display = "none"
    // Clear the inline style so the stylesheet's flex layout applies again
    this.startScreenTarget.style.display = ""
  }
}
