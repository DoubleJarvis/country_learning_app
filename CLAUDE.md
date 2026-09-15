# Working on this repo

Static, no-build SPA (Stimulus + MapLibre, plain files). See [README.md](README.md)
for architecture, storage, and the service-worker caching rules.

**Bump `CACHE_VERSION` in [sw.js](sw.js) whenever you change or add a file**, and
add any new `js/` file to `PRECACHE_SHELL`. The worker is cache-first for
everything, so without a bump your edits are invisible on reload and shipped
clients keep the old code. This bites every single time — don't skip it.

To see a change working, use the `verify` skill (Playwright recipe, and the
rule about never touching ports 8800/8843).

## The control panel — keep it complete

**Esc** (or **Ctrl/Cmd+K**) opens a searchable panel listing every mode, setting
and action. Files: [js/command_palette.js](js/command_palette.js) (UI only),
[js/commands.js](js/commands.js) (the registry), [js/modes.js](js/modes.js)
(route catalog).

**The panel is meant to stay exhaustive.** When you add anything the player can
navigate to or switch on, it belongs there. Two of the three sources are
automatic, so usually there is nothing extra to do:

| You added | Where it goes | Panel work |
| --- | --- | --- |
| A game mode / route | `MODES` in `js/modes.js` | **none** — routing *and* the panel both read this list |
| A setting | `SETTINGS` in `js/settings.js` | **none** — becomes a row showing its current value, opening a submenu of the values |
| A Funbox setting | `SETTINGS` with `group: "Funbox"` | **none** — same, under a Funbox heading |
| Anything else (a one-off command) | `ACTIONS` in `js/commands.js` | add an entry |

So: a new mode is added to `MODES` and nowhere else — `js/app.js` builds its
route table and its controller overrides from that same list.

Two things `MODES` does *not* drive:

- **The right-hand nav** in `js/templates.js` is hand-written markup. A new mode
  needs a `NAV` entry there too if it should appear in the nav — a mode can be
  routable and in the panel without being in the nav.
- **The template itself** still goes in `templates.js` under the `template` key
  the mode names.

Every setting renders the same way in the panel — one row with its current value
on the right (`Debug    off`, `Funbox — Flash    500ms`) opening a submenu of its
values — regardless of group or how many values it has. On the Stats page a
`group` gets its own heading, two options render as a toggle and more as a
dropdown. A setting gaining a third value needs no code anywhere.

Notes for when you touch the panel:

- It mounts on `<body>`, not `#app` — every route change replaces `#app`'s
  innerHTML, which would tear it out mid-use.
- Its `keydown` listener is on `window` in the **capture** phase on purpose: it
  has to see the quiz autocomplete dropdown before the quiz controller's own
  keydown handler closes it, so Esc can be left to the dropdown when one is
  open. Escape is handled *only* there, in both directions — handling it on the
  panel's input too would close and reopen on a single press.
- Setting commands set `keepOpen` so several can be flipped in one visit;
  navigation and actions close the panel first.
- Submenus are a stack of levels, each holding a `build()` rather than a fixed
  array, so re-rendering after a toggle picks up the new state. Escape (and
  Backspace on an empty query) pops a level before it closes the panel.

## Funbox

Settings that change how a game *plays*, rather than what the UI shows. They live
in `SETTINGS` with `group: "Funbox"`, so the panel and Stats page pick them up
like any other setting; the behaviour lives in [js/funbox.js](js/funbox.js).

Today there is one: **Flash** (`off` / `100ms` / `500ms` / `1000ms`) — the country
you have to identify is shown for that long, then hidden.

Every game's score bar carries a `.stat.funbox` slot (`[data-funbox-indicator]`)
that `funbox.js` fills with the mods currently on, name over value, and hides
when none are. It needs no per-mod work: a new Funbox setting shows up there as
soon as it's in `SETTINGS`. A mod counts as on when its value differs from its
**first** option, so list the off state first.

A mode opts in to *Flash* by calling `presentQuestion(element)` **every time it
puts a new country on screen**, passing the element that holds it. Wired in Quiz Hard,
Flags, Practice (worst/slowest) and Learn → Flags. Three modes deliberately
don't call in:

- **Quiz Normal** highlights the country on the shared map rather than in an
  element of its own, so there is nothing to hide without map work.
- **Name All** never presents a single country.
- **Practice Mix-ups** needs its shapes clickable, and hiding is `visibility:
  hidden`, which would kill the clicks.

Hiding uses `visibility`, not `display`: Quiz Hard and Practice toggle `display`
themselves to swap between their overlay map and a local SVG, so hiding that way
would fight them — and `visibility` leaves MapLibre's canvas sizing alone.

`funbox.js` reads settings, so `settings.js` must not import it back. It
subscribes via `onSettingsApplied()` instead, which is how switching Flash off
mid-question reveals the country immediately.

### Funbox in the database

`guesses.funbox` and `quiz_runs.funbox` record which mods were on, as a JSON
object (`{"flash":"100ms"}`) — an object, not a flag, so any number of mods can
be recorded together without another migration. `''` means an ordinary run, which
is also what every pre-existing row backfills to.

Three rules when adding a mod:

1. **List the modes it affects** in `APPLIES_TO` in `js/funbox.js`, keyed by
   `quiz_type`. A run is only stamped with mods that actually changed *it* —
   Flash is wired into Quiz Hard and Flags, so a Name All run played while Flash
   is on is an ordinary run and must not be marked otherwise.
2. **The snapshot is taken at run start**, by `quizDb.setRunFunbox(snapshotFunbox(type))`
   in each recording controller's `selectRegion()`. Changing a setting mid-run
   must not relabel guesses already recorded. `app.js` clears it on every route
   change so a mode that forgets can't inherit the previous one's.
3. **Funboxed *guesses* are excluded from every display query** (`funbox = ''`):
   Summary, By Difficulty, By Country, and the Practice pools — a country you
   never really saw is not evidence about whether you know it. `exportData()` is
   deliberately unfiltered; `getGuessesForStats()` is the filtered read the Stats
   page uses. Funboxed *runs* stay in Recent Games and show a badge per mod.
