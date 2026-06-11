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
  '#stats':              'stats',
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
  const controllerName = toControllerName(routeName)
  const container = document.getElementById('app')

  resetSharedMap()
  container.innerHTML = templates[routeName]()
  placeSharedMap()

  if (!registeredControllers.has(controllerName)) {
    const { default: ControllerClass } = await import(`./controllers/${routeName}_controller.js?v=${sessionVersion}`)
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

window.addEventListener('hashchange', render)
window.addEventListener('load', render)
