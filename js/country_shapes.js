// Country silhouette shapes, served from local static SVGs (see
// icons/countries/, sourced from Mapsicon — MIT). The SVGs are used as CSS
// masks so the silhouette can be recolored with the surrounding text color
// (e.g. green/red on the "It was:" card). No runtime shape generation.
//
// Two usage patterns:
//   - applyCountryShape(el, code): for a controller target element
//   - countryShapeMarkup(code):    for shapes built inside HTML strings
// Both rely on the `.country-shape` rule in index.css, which reads `--shape`.

// Entities so small they render as indistinguishable blobs on the MapLibre
// overlay map. For these we show the detailed local SVG silhouette instead.
// (max bounding-box side under ~100 km — see icons/countries/.)
export const SHAPE_ONLY_COUNTRIES = new Set([
  "AND", "BHR", "HKG", "LIE", "LUX", "MAC", "MCO", "SGP", "SMR", "SXM"
])

export function isShapeOnlyCountry(code) {
  return SHAPE_ONLY_COUNTRIES.has(code)
}

export function countryShapeUrl(code) {
  return `./icons/countries/${code}.svg`
}

export function applyCountryShape(el, code) {
  el.style.setProperty('--shape', `url("${countryShapeUrl(code)}")`)
}

export function countryShapeMarkup(code, extraClass = '') {
  const cls = extraClass ? `country-shape ${extraClass}` : 'country-shape'
  return `<div class="${cls}" style="--shape: url('${countryShapeUrl(code)}')"></div>`
}

// Fetches the raw SVG markup so it can be injected inline (rather than used as a
// mask), letting us style fill/stroke and measure the rendered silhouette.
const svgTextCache = new Map()
export async function loadCountrySvg(code) {
  if (svgTextCache.has(code)) return svgTextCache.get(code)
  const text = await (await fetch(countryShapeUrl(code))).text()
  svgTextCache.set(code, text)
  return text
}

// Computes a horizontal scale bar for a silhouette: given the rendered E-W
// width of the shape in CSS px and the country's [w, s, e, n] bounds, returns
// the bar length in px and a rounded "N km" label. Returns null if unknown.
export function shapeScaleBar(renderedWidthPx, bounds, targetPx = 110) {
  if (!bounds || !(renderedWidthPx > 0)) return null
  const [w, s, e, n] = bounds
  const midLat = (s + n) / 2
  const widthKm = (e - w) * 111.320 * Math.cos((midLat * Math.PI) / 180)
  if (!(widthKm > 0)) return null

  const pxPerKm = renderedWidthPx / widthKm
  const niceKm = niceRound(targetPx / pxPerKm)
  // +toFixed avoids float artifacts (e.g. 0.30000000000000004)
  return { barPx: niceKm * pxPerKm, label: `${+niceKm.toFixed(3)} km` }
}

// Rounds down to a "nice" 1 / 2 / 3 / 5 x 10^n value, like map scale bars.
function niceRound(value) {
  const pow = Math.pow(10, Math.floor(Math.log10(value)))
  const f = value / pow
  const nice = f >= 5 ? 5 : f >= 3 ? 3 : f >= 2 ? 2 : 1
  return nice * pow
}
