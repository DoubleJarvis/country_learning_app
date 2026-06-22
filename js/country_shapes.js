// Country silhouette shapes, served from local static SVGs (see
// icons/countries/, sourced from Mapsicon — MIT). The SVGs are used as CSS
// masks so the silhouette can be recolored with the surrounding text color
// (e.g. green/red on the "It was:" card). No runtime shape generation.
//
// Two usage patterns:
//   - applyCountryShape(el, code): for a controller target element
//   - countryShapeMarkup(code):    for shapes built inside HTML strings
// Both rely on the `.country-shape` rule in index.css, which reads `--shape`.

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
