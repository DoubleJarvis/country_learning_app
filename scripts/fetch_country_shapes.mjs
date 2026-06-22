// One-off build script: downloads country silhouette SVGs and stores them
// locally, named by ISO 3166-1 alpha-3 code (e.g. icons/countries/FRA.svg), so
// the app can serve static shapes with no runtime generation.
//
// Source: Mapsicon (https://github.com/djaiss/mapsicon), MIT licensed.
// alpha-3 -> alpha-2 mapping: ISO-3166 data from
// https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes
//
// Usage:  node scripts/fetch_country_shapes.mjs
// Requires Node 18+ (global fetch). Re-runnable; overwrites existing files.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const outDir = join(root, 'icons', 'countries')
const ISO_URL = 'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json'
const MAPSICON = (a2) => `https://raw.githubusercontent.com/djaiss/mapsicon/master/all/${a2}/vector.svg`

// alpha-3 codes the app actually uses (the keys of countriesMapping)
function appCodes() {
  const src = readFileSync(join(root, 'js', 'country_names.js'), 'utf8')
  return [...src.matchAll(/"([A-Z]{3})":\s*\{/g)].map(m => m[1])
}

// Codes not present (or not standard) in the ISO list, mapped by hand.
const OVERRIDES = {
  XKX: 'xk', // Kosovo (no official ISO alpha-2; Mapsicon uses "xk")
}

async function main() {
  mkdirSync(outDir, { recursive: true })

  const iso = await (await fetch(ISO_URL)).json()
  const a3toa2 = Object.fromEntries(iso.map(c => [c['alpha-3'], c['alpha-2'].toLowerCase()]))

  const codes = [...new Set(appCodes())].sort()
  const missing = []
  let ok = 0

  for (const code of codes) {
    const a2 = OVERRIDES[code] || a3toa2[code]
    if (!a2) { missing.push(`${code} (no alpha-2 mapping)`); continue }

    const res = await fetch(MAPSICON(a2))
    if (!res.ok) { missing.push(`${code} -> ${a2} (HTTP ${res.status})`); continue }

    const svg = await res.text()
    writeFileSync(join(outDir, `${code}.svg`), svg)
    ok++
    process.stdout.write('.')
  }

  console.log(`\nDownloaded ${ok}/${codes.length} shapes into icons/countries/`)
  if (missing.length) console.log(`Missing (${missing.length}):\n  ${missing.join('\n  ')}`)
}

main().catch(err => { console.error(err); process.exit(1) })
