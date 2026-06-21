// User-toggleable settings.
//
// Values are persisted in the SQLite db (see db.js, `settings` table) and
// cached in memory so they can be read synchronously while rendering. To add a
// new setting, append an entry to SETTINGS below and apply its effect in
// applySettings(); it will automatically show up on the Stats page.
import { quizDb } from "db"

export const SETTINGS = [
  {
    key: "debug",
    label: "Debug",
    description: "Show debug search/fill controls in the quizzes",
    options: ["off", "on"],
    default: "off",
  },
  {
    key: "lastGuess",
    label: "Last guess display",
    description: "Show the last-guess card on Quiz Normal and Hard",
    options: ["off", "on"],
    default: "on",
  },
]

// In-memory copy of every setting's current value, populated by initSettings().
const cache = {}

// Loads stored values into the cache, falling back to each setting's default.
// Must be awaited (it initializes the db) before getSetting() is reliable.
export async function initSettings() {
  await quizDb.initialize()
  for (const setting of SETTINGS) {
    const stored = quizDb.getSetting(setting.key)
    cache[setting.key] = stored ?? setting.default
  }
}

export function getSetting(key) {
  if (key in cache) return cache[key]
  const setting = SETTINGS.find(s => s.key === key)
  return setting ? setting.default : null
}

export function setSetting(key, value) {
  cache[key] = value
  quizDb.setSetting(key, value)
  applySettings()
}

// Re-applies every setting's effect to the current DOM. Called on each render
// (mode switches rebuild the DOM) and whenever a setting changes.
export function applySettings() {
  applyDebugVisibility()
  applyLastGuessVisibility()
}

function applyDebugVisibility() {
  const enabled = getSetting("debug") === "on"
  document.querySelectorAll(".debug-search-box, .debug-fill-box").forEach(el => {
    // Clearing the inline style lets the stylesheet decide (flex for the fill box)
    el.style.display = enabled ? "" : "none"
  })
}

// The Quiz Normal/Hard controllers re-show the "It was" card on every guess by
// setting an inline display, so we hide it via a body class + !important rule
// (see index.css) rather than touching the element directly.
function applyLastGuessVisibility() {
  const enabled = getSetting("lastGuess") === "on"
  document.body.classList.toggle("setting-hide-last-guess", !enabled)
}
