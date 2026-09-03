# Mobile layout

Outline for playing on a phone with the keyboard up. Design notes only — nothing
here is implemented yet.

## The budget

Target: Samsung S25, ~**360 × 780** CSS px. With the keyboard up, roughly half
remains: **360 × 400**. Every number below was measured at that viewport.

The key realisation is that the squeeze **only applies while playing**. The
budget changes per phase, and each phase should be designed for its own:

| Phase | Keyboard | Height | Notes |
|---|---|---|---|
| Region select | no | ~780 | Roomy. Today's card is 602 tall — fits, but should scroll on shorter phones. |
| **Playing** | **yes** | **~400** | The hard case. Everything below is about this. |
| Finished | no (input hidden) | ~780 | Roomy again — the results screen is *not* constrained. |

So: don't compromise the finish screen for the keyboard. Dismiss the input when
the game ends and the full height comes back.

## What's broken today (measured at 360 × 400)

| Element | Measured | Problem |
|---|---|---|
| `.nav-container` | **430 × 73** at x = **−90** | 70px **wider than the screen**; hangs off the left edge. Costs 18% of the height for something you don't use mid-game. |
| Quiz stats panel | **239 × 236** | **59% of the screen height**, and it sits on top of the nav. |
| Quiz Hard overlay | 162 × 180 at y = 160 | Overlaps the stats panel — **the silhouette, which *is* the question, is partly hidden**. |
| `fitBounds` padding | `{top:150, bottom:150, left:150, right:150}` | 300px of padding on a 360 × 400 viewport. Leaves ~60 × 100 for the country. |
| Name All stats | 334 × 51 | Already a horizontal row — closest to right. |
| Borders stats | 345 × 81 | Fits width, but stacks with the nav. |

Two conclusions drive the whole design:

1. **The panels are the problem, not the map.** Stats + nav = 309 of 400px,
   leaving ~90px of map. The game is played in the leftovers.
2. **The subject gets occluded.** In Quiz the highlighted country renders behind
   the panel; in Quiz Hard so does the silhouette. `fitBounds` centres on the
   *geometric* centre while the usable area is offset by the chrome.

## Principles

1. **One thing owns the content area** — the map, or the silhouette, or the
   list. Everything else is chrome, measured in tens of pixels.
2. **Nav is not gameplay.** You pick a mode once, and never mid-game on mobile.
   Hide it during play; it lives in the `☰` menu sheet with Finish and Restart.
3. **Labels cost more than they're worth.** `SECOND TRY: 0` in a bordered box is
   ~44px tall. A coloured `0` is 20px and reads the same once you've played once.
4. **Two things are always visible: the current country and the last one.**
   These are the priority — the subject you're guessing now, and the "It was:"
   reveal for the previous guess. Everything else (progress map, stats detail,
   nav) yields to them. When space is tight, these two win.
5. **Never occlude the subject.** Chrome may overlay the map, but the *answer
   area* and the reveal bar must stay clear — which means telling `fitBounds`
   about the chrome.
6. **Thumb reach.** Input and Skip sit directly above the keyboard. Nothing
   important goes in the top corners.

## The shared skeleton

Three rows. Every mode below is a variation on this.

```
┌──────────────────────────────────────┐ 360
│ ☰   47 · 12 · 3 · 1        0:31      │  status strip   40px
├──────────────────────────────────────┤
│                                      │
│                                      │
│             CONTENT                  │  flex: 1       ~304px
│        (map / shape / list)          │
│                                      │
│   ╭──────────────────────────────╮   │
│   │ It was:  ◆ Angola            │   │  reveal, floats over content
│   ╰──────────────────────────────╯   │
├──────────────────────────────────────┤
│  🎯 │ Enter country name…  │  Skip   │  action row     56px
└──────────────────────────────────────┘
▓▓▓▓▓▓▓▓▓▓▓▓ keyboard ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

**Status strip (40px)** — replaces the 236px panel and the 73px nav. `☰` on the
left opens the menu sheet (below); then the stats as bare colour-coded numbers
(remaining · green · yellow · red) with the time right-aligned. No labels, no
boxes, no borders.

**Menu (`☰` sheet)** — everything that isn't moment-to-moment gameplay lives
here, off the strip: the mode nav (mode-switching mid-game doesn't happen on
mobile, so it doesn't need to be on screen), **Finish**, Restart, and a colour
legend for the stat numbers. A small button opening a full sheet, not a crammed
strip.

**Content (flex: 1)** — the only thing that grows.

**Action row (56px)** — input plus Skip. `Skip` must be a real button on mobile:
the desktop binding is Shift+Enter, which a phone keyboard doesn't have. `🎯`
recenter only where the map is the subject.

**Reveal** — the "It was:" card can't be a persistent 220px column. It becomes a
compact bar floating over the bottom of the content area: shape chip + name,
colour-coded, replaced on each guess. It **persists after the game ends** so the
last country is still readable.

---

## Quiz — Normal

Content = **the map**. The highlighted country is the question, so the framing
rule matters more here than anywhere.

```
┌──────────────────────────────────────┐
│ ☰   47 · 12 · 3 · 1        0:31      │
├──────────────────────────────────────┤
│                                      │
│        ╭────╮      map               │  country framed in the
│        │ ▓▓ │  ← highlighted         │  *visible* area, not the
│        ╰────╯                        │  geometric centre
│                                      │
│   ╭──────────────────────────────╮   │
│   │ It was:  ◆ Angola            │   │
│   ╰──────────────────────────────╯   │
├──────────────────────────────────────┤
│  🎯 │ Enter country name…  │  Skip   │
└──────────────────────────────────────┘
```

- `fitBounds` padding drops from 150 to ~24, **asymmetric**: top pad clears the
  status strip, bottom pad clears the reveal bar. Otherwise the country is
  framed behind the chrome.
- `maxZoom: 4` is a desktop number. A country that fills a 1280px window is a
  speck at 360 — mobile wants a higher cap.

## Quiz — Hard

Content = **the silhouette**. This is the mode the current layout hurts most:
the question itself is behind the panel.

The progress map is *feedback*, not the question. On a phone it doesn't earn
space during play — drop it, and give the whole content area to the shape.

```
┌──────────────────────────────────────┐
│ ☰   47 · 12 · 3 · 1        0:31      │
├──────────────────────────────────────┤
│                                      │
│            ╭──────────╮              │
│            │   ▓▓▓▓   │  ← the shape │  fills the content area,
│            │  ▓▓▓▓▓▓  │     is the   │  scale bar beneath
│            ╰──────────╯     question │
│                 500 km               │
│   ╭──────────────────────────────╮   │
│   │ It was:  ◆ Namibia           │   │
│   ╰──────────────────────────────╯   │
├──────────────────────────────────────┤
│      │ Enter country name…  │  Skip  │  no recenter — no map
└──────────────────────────────────────┘
```

On finish (keyboard gone, full height): content becomes the progress map with
the results list as a scrollable sheet over it — the desktop end state, which
already works, just at full height.

## Name All — Easy / Normal

Content = **the map**. Easy shows outlines, Normal starts blank; both colour in
as you guess. Identical layout, and the simplest fit — the stats are already a
row today.

```
┌──────────────────────────────────────┐
│ ☰   Remaining 37 · 5 · 0   0:07      │
├──────────────────────────────────────┤
│                                      │
│      ▓▓▓  ← guessed, coloured        │
│    ▓▓▓▓▓▓    + labelled              │  whole region in view;
│      ▓▓                              │  no per-guess zoom
│                                      │
├──────────────────────────────────────┤
│        │ Type country name…          │  no Skip: nothing to skip
└──────────────────────────────────────┘
```

- No reveal bar — the map *is* the feedback.
- No Skip. There's no current country.
- The guessed list stays a finish-screen thing (as today), shown at full height.

## Name All — Hard

The one mode where the content is **not** the map. By design there's no map
feedback — "guesses only appear in a list". So the list *is* the content, and it
finally has room to be.

```
┌──────────────────────────────────────┐
│ ☰   Remaining 40 · 2 · 0   0:03      │
├──────────────────────────────────────┤
│  ╭────────────────────────────────╮  │
│  │ ◆ Mali                         │  │  newest first, so the last
│  ├────────────────────────────────┤  │  guess is always in view
│  │ ◆ Kenya                        │  │  without scrolling
│  ├────────────────────────────────┤  │
│  │ ◆ Angola                       │  │  scrolls
│  ╰────────────────────────────────╯  │
├──────────────────────────────────────┤
│        │ Type country name…          │
└──────────────────────────────────────┘
```

- Newest-first is a change from desktop, and deliberate: with ~300px you see
  ~4 rows, and the one you just typed is the one you want to confirm.
- Map hidden during play (it shows nothing anyway). On finish it returns at full
  height with the green/red reveal.

## Cross-cutting mechanics

**Knowing the keyboard height.** This is the whole premise, and `100vh` won't do
it — the layout viewport doesn't shrink when the keyboard opens, so `100vh` stays
full height and the bottom of the app sits *behind* the keyboard.

- Android/Chrome: add `interactive-widget=resizes-content` to the viewport meta.
  The layout viewport then shrinks to the space above the keyboard and a normal
  flex column just works. Cheapest possible fix.
- iOS/Safari: doesn't support that key — it overlays the keyboard instead. Needs
  the `visualViewport` API (`resize` + `offsetTop`) to drive the shell height.
- Either way the shell is `height: 100dvh` + flex column, not absolute panels.

**The map must be told it resized.** The shared MapLibre instance needs
`map.resize()` whenever the content area changes, or the canvas keeps its old
size and the projection is wrong — every `fitBounds` frames against stale
dimensions.

**Panels → flow.** Today's chrome is `position: absolute` at fixed offsets
(`top: 15px; left: 15px`), which is why everything collides at 360px. The mobile
shell should be a flex column that *reserves* the strip and action row; only the
reveal bar overlays.

**Breakpoint.** Width-based, around `max-width: 700px` — it's the width that
breaks the nav (430px of chrome), and it keeps a landscape phone or small window
on the same path. Desktop layout stays exactly as-is above it.

**Touch targets.** Region buttons and Skip want ~44px minimum. The `E N H`
difficulty splits in the nav are ~28px today — fine with a mouse, fiddly with a
thumb, which is why the nav becomes full-size rows in the menu sheet rather than
a shrunk-down strip.

## Decisions

Settled — these were open and are now fixed:

- **Menu:** a single small `☰` button opening a mobile menu sheet. No mid-game
  mode-switching on mobile, so the nav never needs to be on screen; it, plus
  Finish and Restart, all live in the sheet.
- **Quiz Hard progress map: dropped on mobile.** During play the two things that
  must show are the *current* silhouette and the *last* guessed country ("It
  was:"); the progress map is neither, so it doesn't compete for the space. The
  Remaining count in the strip carries the "how much is left" sense. The map
  still returns on the full-height finish screen.
- **Reveal bar persists** until the next guess (never auto-fades), and stays
  after the game ends. Seeing the last country is one of the two priorities, so
  it's never traded back for a moment of extra map.
- **Landscape: out of scope.** With the keyboard up there's ~150px left, which no
  layout saves.

The one thing every mode obeys: **show the current country and the last one.**
Everything else is negotiable against the pixel budget; those two are not.
