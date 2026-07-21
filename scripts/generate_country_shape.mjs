// Repair tool: regenerates a country silhouette SVG from the local Natural
// Earth geojson (tiles/ne_10m_admin_0_countries.geojson), for icons the
// Mapsicon source got wrong. Known upstream errors:
//   - RWA: Mapsicon's all/rw/vector.svg is byte-identical to Saudi Arabia's
//   - SDN: Mapsicon's Sudan predates the 2011 South Sudan secession
//
// Output matches how the app consumes the Mapsicon files: a single filled
// <path> inside a plain <svg viewBox>, styleable via CSS (`svg path` rules)
// and usable as a CSS mask. Equirectangular projection with cos(mid-lat)
// horizontal correction, same convention as the in-app scale bars.
//
// Usage:  node scripts/generate_country_shape.mjs RWA SDN
// Requires Node 18+. Overwrites icons/countries/<code>.svg.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const GEOJSON = join(root, 'tiles', 'ne_10m_admin_0_countries.geojson')
const outDir = join(root, 'icons', 'countries')

const SIZE = 1024   // longest side of the viewBox, like the Mapsicon files
const PAD = 0.02    // margin so non-scaling strokes aren't clipped at the edge

const codes = process.argv.slice(2)
if (codes.length === 0) {
  console.error('Usage: node scripts/generate_country_shape.mjs <ADM0_A3> [...]')
  process.exit(1)
}

const geo = JSON.parse(readFileSync(GEOJSON, 'utf8'))
const geomByCode = {}
for (const feature of geo.features) {
  geomByCode[feature.properties.ADM0_A3] = feature.geometry
}

for (const code of codes) {
  const geometry = geomByCode[code]
  if (!geometry) {
    console.error(`${code}: no feature with that ADM0_A3 in ${GEOJSON}`)
    process.exitCode = 1
    continue
  }

  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates

  let minLat = Infinity, maxLat = -Infinity
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [, lat] of ring) {
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
      }
    }
  }
  const latScale = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180)

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const projected = polygons.map(polygon => polygon.map(ring => ring.map(([lng, lat]) => {
    const x = lng * latScale
    const y = -lat
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    return [x, y]
  })))

  const scale = SIZE * (1 - 2 * PAD) / Math.max(maxX - minX, maxY - minY)
  const width = (maxX - minX) * scale
  const height = (maxY - minY) * scale
  const pad = SIZE * PAD

  const px = v => ((v - minX) * scale + pad).toFixed(1)
  const py = v => ((v - minY) * scale + pad).toFixed(1)
  const d = projected
    .map(polygon => polygon
      .map(ring => 'M' + ring.map(([x, y]) => `${px(x)} ${py(y)}`).join('L') + 'Z')
      .join(''))
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.0" viewBox="0 0 ${(width + 2 * pad).toFixed(1)} ${(height + 2 * pad).toFixed(1)}">
<path d="${d}" fill="#000000" fill-rule="evenodd" stroke="none"/>
</svg>
`
  writeFileSync(join(outDir, `${code}.svg`), svg)
  console.log(`${code}.svg regenerated from Natural Earth geometry`)
}
