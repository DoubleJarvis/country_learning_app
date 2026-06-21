import { Application } from "@hotwired/stimulus"
import { templates } from "./templates.js"
import { getSharedMap, getSharedMapElement, resetSharedMap } from "shared_map"
import { initSettings, applySettings, setSetting } from "settings"

const stimulusApp = Application.start()

const routes = {
  '':                    'quiz',
  '#quiz':               'quiz',
  '#quiz_hard':          'quiz_hard',
  '#quiz_borders':       'quiz_borders',
  '#quiz_borders_hard':  'quiz_borders_hard',
  '#quiz_name_all_easy': 'quiz_name_all_easy',
  '#quiz_name_all':      'quiz_name_all',
  '#quiz_name_all_hard': 'quiz_name_all_hard',
  '#quiz_place':         'quiz_place',
  '#practice_worst':     'practice_worst',
  '#practice_slowest':   'practice_slowest',
  '#stats':              'stats',
}

// Routes that share a controller: both practice templates use the "practice"
// controller and differ only in their data-practice-source-value attribute.
const controllerOverrides = {
  practice_worst:   'practice',
  practice_slowest: 'practice',
}

const registeredControllers = new Set()

// Cache-buster for dynamic controller imports: hard reloads don't bypass the
// HTTP cache for imports that happen after page load, which kept serving
// stale controllers after code changes.
const sessionVersion = Date.now()

function toControllerName(routeName) {
  return routeName.replace(/_/g, '-')
}

async function render() {
  const hash = location.hash
  const routeName = routes[hash] ?? 'quiz'
  const controllerRoute = controllerOverrides[routeName] ?? routeName
  const controllerName = toControllerName(controllerRoute)
  const container = document.getElementById('app')

  resetSharedMap()
  container.innerHTML = templates[routeName]()
  placeSharedMap()
  applySettings()

  if (!registeredControllers.has(controllerName)) {
    const { default: ControllerClass } = await import(`./controllers/${controllerRoute}_controller.js?v=${sessionVersion}`)
    stimulusApp.register(controllerName, ControllerClass)
    registeredControllers.add(controllerName)
  }
}

// Moves the persistent map element into the current page's map slot, or parks
// it hidden on the body for pages without a map (stats).
function placeSharedMap() {
  const element = getSharedMapElement()
  const slot = document.querySelector('[data-map-slot]')

  if (slot) {
    element.style.display = 'block'
    slot.appendChild(element)
    getSharedMap()
  } else {
    element.style.display = 'none'
    document.body.appendChild(element)
  }
}

// Debug is now a managed setting (see settings.js) toggleable from the Stats
// page. These console helpers are kept as a convenience and route through the
// same setting, which persists in the db and re-applies on every render.
window.enableDebug = () => {
  setSetting('debug', 'on')
  return 'Debug controls enabled'
}

window.disableDebug = () => {
  setSetting('debug', 'off')
  return 'Debug controls disabled'
}

// Load settings (initializes the db) before the first render so applySettings()
// reads real values; later renders reuse the in-memory cache synchronously.
async function init() {
  await initSettings()
  render()
}

window.addEventListener('hashchange', render)
window.addEventListener('load', init)
