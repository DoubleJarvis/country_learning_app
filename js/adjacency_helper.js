// Helper utility to work with adjacency data
// Handles the mapping between ISO 3166-1 alpha-3 codes and adjacency.json codes

import { countriesMapping } from "country_names"

// Cache for adjacency data
let adjacencyData = null

// Load adjacency data
async function loadAdjacencyData() {
  if (adjacencyData) return adjacencyData

  try {
    const response = await fetch('./adjacency.json')
    adjacencyData = await response.json()
    return adjacencyData
  } catch (error) {
    console.error('Failed to load adjacency data:', error)
    return {}
  }
}

// Map ISO codes to adjacency codes (handles the #1, #2 suffix issue)
// For most countries, the adjacency code is ISO_CODE#1
// Some countries have multiple regions (e.g., AGO#1, AGO#2)
function isoToAdjacencyCode(isoCode) {
  // Special cases where ISO code differs from adjacency code
  const specialCases = {
    'FRA': 'FXX',  // France
    'PRT': 'PRX',  // Portugal
  }

  const baseCode = specialCases[isoCode] || isoCode
  return `${baseCode}#1`
}

// Map adjacency code back to ISO code
function adjacencyToIsoCode(adjCode) {
  // Remove the #N suffix
  const baseCode = adjCode.replace(/#\d+$/, '')

  // Special cases (reverse mapping)
  const specialCases = {
    'FXX': 'FRA',  // France
    'PRX': 'PRT',  // Portugal
  }

  return specialCases[baseCode] || baseCode
}

// Get borders for a country by ISO code
// Returns an array of ISO codes
export async function getBorders(isoCode) {
  const data = await loadAdjacencyData()
  const adjCode = isoToAdjacencyCode(isoCode)
  const borders = data[adjCode] || []

  // Convert adjacency codes back to ISO codes
  return borders.map(adjacencyToIsoCode)
}

// Get all countries that have borders (are in the adjacency data)
// Returns an array of ISO codes
export async function getCountriesWithBorders() {
  const data = await loadAdjacencyData()
  const countriesWithBorders = new Set()

  // Iterate through adjacency data
  for (const [adjCode, borders] of Object.entries(data)) {
    // Skip region codes (AAA, ABB, etc.) - they're all uppercase and not in countriesMapping
    const isoCode = adjacencyToIsoCode(adjCode)

    // Only include if it's a valid country in our mapping and has borders
    if (countriesMapping[isoCode] && borders.length > 0) {
      countriesWithBorders.add(isoCode)
    }
  }

  return Array.from(countriesWithBorders)
}

// Get a random country that has borders
export async function getRandomCountryWithBorders() {
  const countries = await getCountriesWithBorders()
  return countries[Math.floor(Math.random() * countries.length)]
}

// Get countries with borders for a specific region
// Returns an array of ISO codes for countries that have borders in the given region
export async function getCountriesWithBordersForRegion(regionCodes) {
  const data = await loadAdjacencyData()
  const countriesWithBorders = new Set()

  // Iterate through adjacency data
  for (const [adjCode, borders] of Object.entries(data)) {
    const isoCode = adjacencyToIsoCode(adjCode)

    // Only include if it's in the region, is a valid country, and has borders
    if (regionCodes.includes(isoCode) && countriesMapping[isoCode] && borders.length > 0) {
      countriesWithBorders.add(isoCode)
    }
  }

  return Array.from(countriesWithBorders)
}

// Get a random country with borders from a specific region
export async function getRandomCountryWithBordersFromRegion(regionCodes) {
  const countries = await getCountriesWithBordersForRegion(regionCodes)
  if (countries.length === 0) {
    return null
  }
  return countries[Math.floor(Math.random() * countries.length)]
}
