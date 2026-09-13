// The command registry behind the control panel (see command_palette.js).
//
// Commands come from three sources, two of which are automatic:
//
//   1. Modes      — derived from MODES in modes.js. Add a mode there and it
//                   appears here for free.
//   2. Settings   — derived from SETTINGS in settings.js, one command per
//                   (setting, value) pair. Add a setting there and it appears
//                   here for free, whatever its list of values.
//   3. Actions    — ACTIONS below, for one-offs that are neither of the above.
//                   THIS is the list to append to by hand.
//
// See CLAUDE.md. Keep commands cheap to build: buildCommands() runs every time
// the panel opens (and after every toggle) so `active` is always current.
//
// Command shape:
//   id        stable unique string
//   section   heading to group under in the panel
//   title     what the player reads
//   detail    optional dimmer line under the title
//   keywords  extra whole-word search terms, matched but never shown. Synonyms
//             for the row itself only ("drill" for Practice) — never the values
//             it contains, which would match with nothing on screen to explain
//             the hit. Matched as whole words, so a fragment can't fire one. Synonyms for the row
//             itself only ("drill" for Practice) — never the values it contains,
//             which would match with nothing on screen to explain the hit
//   value     current state, shown right-aligned (used by submenu rows)
//   active    true if this already describes the current state (shown as a dot)
//   keepOpen  leave the panel up after running (used by settings, so several
//             can be flipped in one visit)
//   run()     do the thing
//   children  () => commands — makes the row a submenu instead of an action.
//             Called fresh on every render, so `active` and `value` stay current.
import { MODES, modeTitle } from './modes.js'
import { SETTINGS, getSetting, setSetting } from 'settings'

// One-off commands. Append here; everything else is generated.
//
// Everything in this file is read by a player, not by us: titles and details are
// UI copy, so no internal vocabulary (the README, the service worker, module
// names) and nothing that only makes sense to someone working on the code. If an
// action can't be explained in player terms, it probably doesn't belong here.
const ACTIONS = [
  {
    id: 'action:fullscreen',
    title: 'Toggle fullscreen',
    keywords: 'full screen maximise maximize',
    run: () => {
      if (document.fullscreenElement) document.exitFullscreen()
      else document.documentElement.requestFullscreen?.()
    },
  },
]

function modeCommands() {
  return MODES.map(mode => ({
    id: `mode:${mode.hash}`,
    section: 'Go to',
    title: modeTitle(mode),
    keywords: `${mode.hash} ${mode.keywords || ''}`,
    active: location.hash === mode.hash || (!location.hash && mode.hash === '#quiz'),
    run: () => { location.hash = mode.hash },
  }))
}

// One command per possible value, rather than a toggle, so a setting that grows
// a third value some day needs no code here.
// The values inside a setting's submenu. Just the value as the title — the
// breadcrumb above already says which setting is being set.
function valueCommands(setting) {
  return setting.options.map(option => ({
    id: `setting:${setting.key}:${option}`,
    section: setting.group || 'Settings',
    title: option,
    active: getSetting(setting.key) === option,
    keepOpen: true,
    run: () => setSetting(setting.key, option),
  }))
}

// Every setting is one row showing its current value, opening a submenu of the
// values — whatever its group and however many values it has. Uniform on
// purpose: a two-value setting flattened to a row per value read as a different
// kind of thing from the rest, for the sake of one keystroke.
function settingRow(setting) {
  return {
    id: `setting:${setting.key}`,
    section: setting.group || 'Settings',
    title: setting.group ? `${setting.group} — ${setting.label}` : setting.label,
    detail: setting.description,
    // No keywords on purpose. A setting's values live one level down, so
    // matching them here would put rows on screen with nothing highlighted to
    // explain the hit — "off" would list every setting that happens to be off.
    // Keywords name the row itself, never what's inside it.
    value: getSetting(setting.key),
    children: () => valueCommands(setting),
  }
}

// Ungrouped settings first, then one run per group, so each section heading
// appears once instead of interleaving with SETTINGS' own declaration order.
function settingCommands() {
  const groups = [...new Set(SETTINGS.map(setting => setting.group).filter(Boolean))]
  return [
    ...SETTINGS.filter(setting => !setting.group),
    ...groups.flatMap(group => SETTINGS.filter(setting => setting.group === group)),
  ].map(settingRow)
}

function actionCommands() {
  return ACTIONS.map(action => ({ section: 'Actions', ...action }))
}

export function buildCommands() {
  return [...modeCommands(), ...settingCommands(), ...actionCommands()]
}

// Ranking. Every whitespace-separated term must match somewhere, so "quiz hard"
// narrows instead of widening; a command's score is the sum of its terms' best
// hits, which floats whole-word title matches above scattered subsequences.
//
// Each surviving command is returned with `matchedIndices`: the positions in its
// *title* that the query hit, for the panel to mark up. A term that only matched
// a keyword or the section heading contributes no indices — there is nothing
// visible to point at — so a row can legitimately come back with fewer marks
// than the query has letters.
export function rankCommands(commands, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return commands

  return commands
    .map(command => {
      const title = command.title.toLowerCase()
      // Section deliberately excluded: it's a generic heading, so "settings"
      // would sweep in every setting row with no highlight to explain why.
      const words = (command.keywords || '').toLowerCase().split(/\s+/).filter(Boolean)
      const matched = new Set()
      let total = 0
      for (const term of terms) {
        const score = termScore(term, title, words)
        if (score === null) return null
        total += score
        for (const index of titleMatchIndices(term, title)) matched.add(index)
      }
      return { command: { ...command, matchedIndices: [...matched] }, score: total }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map(hit => hit.command)
}

// Where a term landed in the title: the whole run for a substring hit, the
// individual letters for a subsequence one, nothing if it isn't in the title.
function titleMatchIndices(term, title) {
  const at = title.indexOf(term)
  if (at >= 0) return Array.from({ length: term.length }, (_, offset) => at + offset)

  const indices = []
  let index = -1
  for (const char of term) {
    index = title.indexOf(char, index + 1)
    if (index === -1) return []
    indices.push(index)
  }
  return indices
}

function termScore(term, title, words) {
  const inTitle = title.indexOf(term)
  if (inTitle === 0) return 1000
  if (inTitle > 0) return 800 - inTitle
  // Keywords match a whole word only, never a fragment of one. They're the one
  // thing that can put a row on screen with nothing highlighted, so they have to
  // fire on a word the player deliberately typed: matching inside them made
  // "on" pull up Mix-ups ("confused") and Learn ("options") out of nowhere.
  if (words.includes(term)) return 500
  // Subsequence only against the title, never the keywords. Scattered letters
  // across a long hidden keyword string match almost anything ("stat" landing
  // inside "...po-s-i-t-ion loc-at-ion..."), and the panel can't mark up a hit
  // the player can't see - an unexplainable row is worse than a missing one.
  return subsequenceScore(term, title)
}

// Letters in order but not adjacent ("nah" -> "Name All - Hard"). Scored below
// any substring hit, and penalised by how far apart the letters ended up.
function subsequenceScore(term, haystack) {
  let index = -1
  let spread = 0
  for (const char of term) {
    const next = haystack.indexOf(char, index + 1)
    if (next === -1) return null
    if (index >= 0) spread += next - index - 1
    index = next
  }
  return Math.max(1, 100 - spread)
}
