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
| A setting | `SETTINGS` in `js/settings.js` | **none** — one command per value is generated, any number of values |
| Anything else (a one-off command) | `ACTIONS` in `js/commands.js` | add an entry |

So: a new mode is added to `MODES` and nowhere else — `js/app.js` builds its
route table and its controller overrides from that same list.

Two things `MODES` does *not* drive:

- **The right-hand nav** in `js/templates.js` is hand-written markup. A new mode
  needs a `NAV` entry there too if it should appear in the nav — a mode can be
  routable and in the panel without being in the nav.
- **The template itself** still goes in `templates.js` under the `template` key
  the mode names.

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
