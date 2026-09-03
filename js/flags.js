// Full-colour country flags, served from local static SVGs (see icons/flags/,
// sourced from flag-icons — MIT, 4x3 aspect). Unlike the silhouettes in
// country_shapes.js these are shown as real <img> elements, not CSS masks:
// the colours are the whole point, so they can't be recoloured with the
// surrounding text colour.
//
// Two usage patterns, mirroring country_shapes.js:
//   - applyFlag(imgEl, code): for a controller <img> target element
//   - flagMarkup(code):       for flags built inside HTML strings

export function flagUrl(code) {
  return `./icons/flags/${code}.svg`
}

export function applyFlag(imgEl, code) {
  imgEl.src = flagUrl(code)
}

export function flagMarkup(code, extraClass = '') {
  const cls = extraClass ? `country-flag ${extraClass}` : 'country-flag'
  return `<img class="${cls}" src="${flagUrl(code)}" alt="" />`
}
