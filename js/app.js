import { Application } from "@hotwired/stimulus"
import { templates } from "./templates.js"
import { getSharedMap, getSharedMapElement, resetSharedMap } from "shared_map"

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
  applyDebugVisibility()

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

// Debug controls are hidden by default; toggle from the console with
// enableDebug() / disableDebug(). The choice persists in localStorage and is
// re-applied on every render (mode switches rebuild the DOM).
const DEBUG_STORAGE_KEY = 'debugEnabled'

function applyDebugVisibility() {
  const enabled = localStorage.getItem(DEBUG_STORAGE_KEY) === '1'
  document.querySelectorAll('.debug-search-box, .debug-fill-box').forEach(el => {
    // Clearing the inline style lets the stylesheet decide (flex for the fill box)
    el.style.display = enabled ? '' : 'none'
  })
}

window.enableDebug = () => {
  localStorage.setItem(DEBUG_STORAGE_KEY, '1')
  applyDebugVisibility()
  return 'Debug controls enabled'
}

window.disableDebug = () => {
  localStorage.removeItem(DEBUG_STORAGE_KEY)
  applyDebugVisibility()
  return 'Debug controls disabled'
}

window.addEventListener('hashchange', render)
window.addEventListener('load', render)
