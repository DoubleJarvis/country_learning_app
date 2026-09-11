import { Application } from "@hotwired/stimulus"
import { templates } from "./templates.js"
import { getSharedMap, getExistingSharedMap, getSharedMapElement, resetSharedMap, preloadCountryTiles } from "shared_map"
import { initSettings, applySettings, setSetting } from "settings"
import { routes, controllerOverrides } from "./modes.js"
import { initCommandPalette } from "./command_palette.js"
import { initFunbox } from "funbox"

const stimulusApp = Application.start()

// Route table and controller overrides both come from the MODES catalog in
// modes.js, so a new mode is added in exactly one place (and shows up in the
// control panel automatically) - see CLAUDE.md.

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
    // Re-parenting can change the container's size (e.g. coming back from a
    // route that hides the map via CSS, which collapses it to 0x0 and zeroes
    // MapLibre's canvas/transform). MapLibre's own ResizeObserver eventually
    // catches this, but not reliably in the same tick as this synchronous
    // DOM rebuild, leaving the base layers blank until the next pan/zoom.
    resizeSharedMapSoon()
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
// Full-screen "Loading assets" overlay shown while the tiles archive downloads.
// Blocks the game UI (which isn't rendered until the download finishes anyway).
function showAssetLoader() {
  const loader = document.createElement('div')
  loader.id = 'asset-loader'
  loader.className = 'asset-loader'
  loader.innerHTML = `
    <div class="asset-loader-label">Loading assets…</div>
    <div class="asset-loader-track"><div class="asset-loader-bar indeterminate" id="asset-loader-bar"></div></div>`
  document.body.appendChild(loader)
}

function setAssetLoaderProgress(received, total) {
  const bar = document.getElementById('asset-loader-bar')
  if (!bar) return
  if (total > 0) {
    bar.classList.remove('indeterminate')
    bar.style.width = `${Math.min(100, Math.round((received / total) * 100))}%`
  }
}

function removeAssetLoader() {
  document.getElementById('asset-loader')?.remove()
}

// Ask the browser not to evict our storage. The stats database is the only
// thing here that can't be re-downloaded, and script-writable storage is fair
// game for eviction under pressure otherwise. Installed apps are typically
// granted this without a prompt; a refusal is not fatal, so never block on it.
async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return
  try {
    if (await navigator.storage.persisted()) return
    await navigator.storage.persist()
  } catch (error) {
    console.error('Persistent storage request failed:', error)
  }
}

async function init() {
  requestPersistentStorage()
  await initSettings()
  // Before the first render(): render() calls applySettings(), which is what
  // paints the funbox indicator, so the subscription has to exist by then.
  initFunbox()
  // Pull the whole tiles archive into memory before the first map is built so
  // every map resolves tiles locally (no HTTP Range requests). Show a loader
  // while it downloads, then render once it's ready.
  initCommandPalette()
  showAssetLoader()
  await preloadCountryTiles(setAssetLoaderProgress)
  await render()
  removeAssetLoader()
}

window.addEventListener('hashchange', render)
window.addEventListener('load', init)

// --- Mobile shell plumbing ---------------------------------------------------

// The mobile layout pins the app to the space above the on-screen keyboard.
// 100dvh isn't enough on its own: iOS Safari doesn't shrink the layout viewport
// for the keyboard (it overlays it), so we drive an explicit --app-height from
// the visualViewport height, which *is* the space above the keyboard on both
// platforms. The CSS falls back to 100dvh until this runs.
function syncViewportHeight() {
  const vv = window.visualViewport
  const height = vv ? vv.height : window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`)
  // The shared map's canvas must follow the content area or the projection
  // (and every fitBounds) is computed against stale dimensions.
  resizeSharedMapSoon()
}

let resizePending = false
function resizeSharedMapSoon() {
  if (resizePending) return
  resizePending = true
  requestAnimationFrame(() => {
    resizePending = false
    // Deliberately not getSharedMap(): this can fire (via the 'load' listeners
    // below) before init()'s first render() has placed the map element in the
    // DOM. Constructing it against that still-detached, 0x0 element permanently
    // seeds MapLibre's transform at a fallback size - it only self-corrects
    // once its internal ResizeObserver happens to notice the real size later,
    // leaving the base layers blank until the next pan/zoom.
    getExistingSharedMap()?.resize()
  })
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncViewportHeight)
  window.visualViewport.addEventListener('scroll', syncViewportHeight)
}
window.addEventListener('resize', syncViewportHeight)
window.addEventListener('load', syncViewportHeight)

// Mobile menu: a single delegated handler toggles `.menu-open` on the current
// page's `.quiz-container`, so no per-controller code is needed. The nav lives
// in every template already; on mobile CSS renders it as a sheet when open.
document.addEventListener('click', event => {
  if (event.target.closest('[data-menu-toggle]')) {
    event.target.closest('.quiz-container')?.classList.toggle('menu-open')
    return
  }
  // Backdrop, or following a nav link, closes it.
  if (event.target.closest('[data-menu-close]') || event.target.closest('.nav-container a')) {
    document.querySelector('.quiz-container.menu-open')?.classList.remove('menu-open')
  }
})

// Register the service worker that caches the app shell + assets for offline
// play. Non-blocking; failures are logged but never break the page.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.error('Service worker registration failed:', error)
    })
  })
}
