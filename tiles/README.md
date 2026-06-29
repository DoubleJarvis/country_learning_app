# Map tiles

The app's basemap is a single **PMTiles** archive of Natural Earth's
1:10m Admin-0 country polygons, served from this directory as
`countries.pmtiles` and read by MapLibre via the `pmtiles://` protocol
(registered in `js/map.js`).

It replaces MapLibre's low-resolution public demo tiles. The build keeps the
same vector layer name (`countries`) and `ADM0_A3` property the app filters on,
so no other code changes are needed.

`countries.pmtiles` is **not generated automatically** — produce it with the
steps below and drop it in this folder.

## Regenerating `countries.pmtiles`

Requires [tippecanoe](https://github.com/felt/tippecanoe) (Apple-Silicon native
via Homebrew):

```sh
brew install tippecanoe

# 1. Get the Natural Earth 1:10m countries as GeoJSON (already has ADM0_A3)
curl -L -o ne_10m_admin_0_countries.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson

# 2. Build the PMTiles archive
#    -l countries        -> source-layer name the app expects
#    --include=ADM0_A3    -> keep only the property we use (small tiles)
#    -Z0 -z8              -> zoom range (full detail at z8; MapLibre overzooms past it)
#    --no-feature-limit / --no-tile-size-limit -> never drop a country
tippecanoe -o countries.pmtiles \
  -l countries \
  --include=ADM0_A3 \
  -Z0 -z8 \
  --no-feature-limit \
  --no-tile-size-limit \
  --force \
  ne_10m_admin_0_countries.geojson
```

Then place `countries.pmtiles` in this `tiles/` directory.

## Notes

- The app downloads this whole archive once at startup and serves it to MapLibre
  from memory (see `preloadCountryTiles` in `js/map.js`), so it works on any
  static server — no HTTP Range support required (plain `python -m http.server`
  is fine).
- The file is a few MB. Commit it if you want the repo self-contained, or keep
  it out of git and regenerate as needed.
- Country label fonts (glyphs) still come from MapLibre's demo font endpoint
  (see `GLYPHS_URL` in `js/map.js`); only the polygon tiles are self-hosted.
- Natural Earth's `ADM0_A3` matches the codes in `js/country_names.js`. The 10m
  set includes a few more small territories than the demo tiles; extra features
  are simply unstyled.
