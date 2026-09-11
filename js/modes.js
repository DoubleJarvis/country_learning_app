// Every route the app can show, in one list.
//
// This is the single source of truth for hash -> template wiring: app.js builds
// its route table and its controller overrides from it, and the command palette
// builds its "Go to" section from it. Adding a mode here is therefore enough to
// make it both routable AND reachable from the palette — see CLAUDE.md.
//
// (The right-hand nav in templates.js is still hand-written markup, so a new
// mode also needs a NAV entry there if it should appear in the nav - a mode can
// be routable and in the control panel without being in the nav.)
//
//   hash       location.hash that selects this mode
//   template   key in templates.js
//   controller controller basename, only when it differs from `template`
//              (practice_worst/practice_slowest share the "practice" controller)
//   group      mode family, as shown in the nav ("Quiz", "Name All", …)
//   label      variant within the family ("Normal", "Hard", …); omit if the
//              group has only one entry and the group name says it all
//   keywords   extra search terms for the palette; never shown, only matched
export const MODES = [
  { hash: '#stats',               template: 'stats',
    group: 'Stats',    keywords: 'statistics history runs settings export data' },

  { hash: '#quiz',                template: 'quiz',
    group: 'Quiz',     label: 'Normal',         keywords: 'map outline silhouette shape' },
  { hash: '#quiz_hard',           template: 'quiz_hard',
    group: 'Quiz',     label: 'Hard',           keywords: 'map outline silhouette shape no help' },

  { hash: '#flags',               template: 'flags',
    group: 'Flags',    label: 'Normal',         keywords: 'flag identify type' },

  { hash: '#quiz_name_all_easy',  template: 'quiz_name_all_easy',
    group: 'Name All', label: 'Easy',           keywords: 'every country outlines shown' },
  { hash: '#quiz_name_all',       template: 'quiz_name_all',
    group: 'Name All', label: 'Normal',         keywords: 'every country' },
  { hash: '#quiz_name_all_hard',  template: 'quiz_name_all_hard',
    group: 'Name All', label: 'Hard',           keywords: 'every country no map feedback' },

  { hash: '#practice_worst',      template: 'practice_worst',      controller: 'practice',
    group: 'Practice', label: 'Worst guesses',  keywords: 'weak drill wrong' },
  { hash: '#practice_slowest',    template: 'practice_slowest',    controller: 'practice',
    group: 'Practice', label: 'Slowest guesses', keywords: 'drill time slow' },
  { hash: '#practice_pairs',      template: 'practice_pairs',
    group: 'Practice', label: 'Mix-ups',        keywords: 'pairs confused drill' },

  { hash: '#learn_flags',         template: 'learn_flags',
    group: 'Learn',    label: 'Flags',          keywords: 'flag multiple choice two options easy' },
]

// What the palette (and anything else needing a human label) calls a mode.
export function modeTitle(mode) {
  return mode.label ? `${mode.group} — ${mode.label}` : mode.group
}

// Hash -> template name, plus the empty hash that a bare URL lands on.
export const routes = {
  '': 'quiz',
  ...Object.fromEntries(MODES.map(mode => [mode.hash, mode.template])),
}

// Template name -> controller basename, only for the modes that share one.
export const controllerOverrides = Object.fromEntries(
  MODES.filter(mode => mode.controller).map(mode => [mode.template, mode.controller])
)
