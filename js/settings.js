// User-toggleable settings.
//
// Values are persisted in the SQLite db (see db.js, `settings` table) and
// cached in memory so they can be read synchronously while rendering. To add a
// new setting, append an entry to SETTINGS below and apply its effect in
// applySettings(); it will automatically show up on the Stats page and in the
// control panel (see CLAUDE.md).
//
// An optional `group` collects a setting into a named family ("Funbox" — the
// ones that change how a game plays, rather than what the UI shows). Grouped
// settings get their own heading on the Stats page and a submenu in the control
// panel instead of a flat row.
//
// Settings with exactly two options render as a toggle, anything more as a
// dropdown; nothing extra is needed for a setting to gain a third value.
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
    key: "flash",
    group: "Funbox",
    label: "Flash",
    description: "Show the country for a moment, then hide it — answer from memory",
    options: ["off", "100ms", "500ms", "1000ms"],
    default: "off",
  },
  {
    key: "timer",
    label: "Timer",
    description: "Show the elapsed-time counter during games",
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

// Modules that own a setting's effect subscribe here rather than being imported
// by this file — funbox.js reads settings, so importing it back would be a cycle.
const listeners = []

export function onSettingsApplied(listener) {
  listeners.push(listener)
}

// Re-applies every setting's effect to the current DOM. Called on each render
// (mode switches rebuild the DOM) and whenever a setting changes.
export function applySettings() {
  applyDebugVisibility()
  applyTimerVisibility()
  for (const listener of listeners) listener()
}

function applyDebugVisibility() {
  const enabled = getSetting("debug") === "on"
  document.querySelectorAll(".debug-search-box, .debug-fill-box").forEach(el => {
    // Clearing the inline style lets the stylesheet decide (flex for the fill box)
    el.style.display = enabled ? "" : "none"
  })
}

// The controllers only update the timer's inner value (never the .stat.timer
// wrapper's display), so we can toggle the wrapper inline like the debug box.
// (Done in JS rather than CSS because index.css isn't cache-busted.)
function applyTimerVisibility() {
  const enabled = getSetting("timer") === "on"
  document.querySelectorAll(".stat.timer").forEach(el => {
    el.style.display = enabled ? "" : "none"
  })
}
