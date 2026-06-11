import { Application } from "@hotwired/stimulus"
import { templates } from "./templates.js"

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

function toControllerName(routeName) {
  return routeName.replace(/_/g, '-')
}

async function render() {
  const hash = location.hash
  const routeName = routes[hash] ?? 'quiz'
  const controllerName = toControllerName(routeName)
  const container = document.getElementById('app')

  container.innerHTML = templates[routeName]()

  if (!registeredControllers.has(controllerName)) {
    const { default: ControllerClass } = await import(`./controllers/${routeName}_controller.js`)
    stimulusApp.register(controllerName, ControllerClass)
    registeredControllers.add(controllerName)
  }
}

window.addEventListener('hashchange', render)
window.addEventListener('load', render)
