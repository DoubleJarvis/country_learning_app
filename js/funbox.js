// Funbox: settings that change how a game plays, rather than what the UI shows.
// Currently one — "Flash", which shows the country you have to identify for a
// moment and then hides it, so you answer from memory.
//
// Modes opt in by calling presentQuestion() with the element that holds the
// country, every time they put a new one on screen. A mode that shows nothing
// to hide (Name All), highlights it on the shared map rather than in an element
// of its own (Quiz Normal), or needs it to stay clickable (Practice Mix-ups)
// simply doesn't call in — see CLAUDE.md.
import { SETTINGS, getSetting, onSettingsApplied } from "settings"

// visibility, not display: the modes toggle `display` themselves to swap
// between their overlay map and their local SVG, so hiding that way would fight
// them. visibility also leaves layout (and MapLibre's canvas size) alone.
const HIDDEN_CLASS = "funbox-hidden"

let hideTimer = null
let hiddenElement = null

// Milliseconds to show the country for, or 0 when the funbox is off.
// Option values are the labels themselves ("500ms"), so parse rather than map.
function flashDelayMs() {
  const value = getSetting("flash")
  return value === "off" ? 0 : parseInt(value, 10)
}

// Call whenever a new country goes on screen. Reveals `element` (it may still
// be hidden from the previous question) and, if Flash is on, hides it again
// after the configured delay.
export function presentQuestion(element) {
  clearTimeout(hideTimer)
  hideTimer = null
  reveal()

  if (!element) return
  const delay = flashDelayMs()
  if (!delay) return

  hideTimer = setTimeout(() => {
    hideTimer = null
    hiddenElement = element
    element.classList.add(HIDDEN_CLASS)
  }, delay)
}

function reveal() {
  hiddenElement?.classList.remove(HIDDEN_CLASS)
  hiddenElement = null
}

// Which recorded quiz types each mod actually changes. A run is only stamped
// with the mods that affected IT — Flash is wired into Quiz Hard and Flags, so a
// Name All run played while Flash is on is an ordinary run and must not be
// marked otherwise. Extend this when a mod starts affecting another mode; the
// keys are quiz_type values as recorded in the database.
const APPLIES_TO = {
  flash: ["hard", "flags"],
}

// The mods that were on for a run, as stored in `guesses.funbox` /
// `quiz_runs.funbox`: a JSON object of key -> value, or "" for an ordinary run.
// Keys are sorted so the same set always serializes identically (handy for
// grouping later), and the format is an object rather than a list precisely so
// several mods can be recorded on one run without the schema changing.
export function snapshotFunbox(quizType) {
  const active = enabledMods()
    .filter(setting => APPLIES_TO[setting.key]?.includes(quizType))
    .sort((a, b) => a.key.localeCompare(b.key))

  if (active.length === 0) return ""
  return JSON.stringify(Object.fromEntries(active.map(s => [s.key, getSetting(s.key)])))
}

// Stored funbox -> [{ key, label, value }] for display. Labels are resolved from
// SETTINGS at read time and fall back to the stored key, so a run recorded under
// a mod that has since been removed still renders something meaningful rather
// than disappearing (same approach as the Place badge in stats_controller).
export function parseFunbox(stored) {
  if (!stored) return []
  let parsed
  try {
    parsed = JSON.parse(stored)
  } catch (error) {
    console.error("Unreadable funbox record:", stored, error)
    return []
  }
  return Object.entries(parsed).map(([key, value]) => ({
    key,
    label: SETTINGS.find(setting => setting.key === key)?.label || key,
    value,
  }))
}

// Every Funbox setting's first option is its off state, by convention.
function enabledMods() {
  return SETTINGS.filter(setting =>
    setting.group === "Funbox" && getSetting(setting.key) !== setting.options[0]
  )
}

// Fills the `.stat.funbox` slot each game's score bar carries, listing the mods
// that are on as name-over-value, like every other stat. Hidden when none are.
// The slot lives inside the score bar, which the modes only show once a game is
// running, so the indicator appears and disappears with the game for free.
function renderIndicators() {
  const mods = enabledMods()

  for (const slot of document.querySelectorAll("[data-funbox-indicator]")) {
    slot.replaceChildren(...mods.flatMap(setting => {
      const label = document.createElement("span")
      label.className = "stat-label"
      label.textContent = setting.label

      const value = document.createElement("span")
      value.className = "stat-value"
      value.textContent = getSetting(setting.key)

      return [label, value]
    }))
    slot.hidden = mods.length === 0
  }
}

// Must be called once at startup, from app.js — NOT left to run as a side effect
// of a controller importing this module. Controllers are imported lazily, after
// the render that needs them has already called applySettings(), so registering
// there meant the first funbox mode you opened drew its score bar with no
// listener subscribed and no indicator, and only later navigations picked it up.
export function initFunbox() {
  // Runs on every render (mode switches rebuild the DOM) and on every change, so
  // both the indicator and the reveal stay in step with the settings.
  onSettingsApplied(onSettingsChanged)
}

function onSettingsChanged() {
  renderIndicators()

  // Turning Flash off mid-question should bring the country back right away
  // rather than at the next one.
  if (flashDelayMs() !== 0) return
  clearTimeout(hideTimer)
  hideTimer = null
  reveal()
  // Belt and braces: a mode switch can strip the element we were tracking, so
  // sweep any stragglers still carrying the class.
  document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach(el => el.classList.remove(HIDDEN_CLASS))
}
