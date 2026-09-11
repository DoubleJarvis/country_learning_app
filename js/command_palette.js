// The control panel: Esc (or Ctrl/Cmd+K) brings up a searchable list of every
// mode, setting and action in the app. Commands come from commands.js — this
// file is only the UI and the key handling, so adding a command never means
// touching it.
//
// Mounted once on <body>, not inside #app: every route change replaces #app's
// innerHTML wholesale, which would otherwise tear the panel out mid-use.
import { buildCommands, rankCommands } from './commands.js'

let root = null
let input = null
let list = null
let crumb = null
let escHint = null
// Levels of the panel, innermost last. Each holds a `build()` rather than a
// fixed array so re-rendering after a toggle picks up the new state.
let stack = []
let visible = []
let highlighted = 0
let previouslyFocused = null

export function initCommandPalette() {
  if (root) return
  render()
  // Capture phase, deliberately: the autocomplete check below has to see the
  // dropdown as it was when the key went down, and the quiz controllers' own
  // keydown handler (on the input, i.e. the target phase) closes it first.
  window.addEventListener('keydown', onGlobalKeydown, true)
}

function render() {
  root = document.createElement('div')
  root.className = 'cmdk'
  root.hidden = true
  root.innerHTML = `
    <div class="cmdk-backdrop" data-cmdk-close></div>
    <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Control panel">
      <div class="cmdk-crumb" hidden></div>
      <input class="cmdk-input" type="text" placeholder="Search modes, settings, actions…"
             autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
      <div class="cmdk-list" role="listbox"></div>
      <div class="cmdk-footer"><span>↑↓ navigate</span><span>↵ select</span><span class="cmdk-esc-hint">esc close</span></div>
    </div>`
  document.body.appendChild(root)

  input = root.querySelector('.cmdk-input')
  list = root.querySelector('.cmdk-list')
  crumb = root.querySelector('.cmdk-crumb')
  escHint = root.querySelector('.cmdk-esc-hint')

  input.addEventListener('input', () => { highlighted = 0; renderList() })
  input.addEventListener('keydown', onInputKeydown)
  root.addEventListener('click', event => {
    if (event.target.closest('[data-cmdk-close]')) return close()
    const item = event.target.closest('.cmdk-item')
    if (item) run(Number(item.dataset.index))
  })
  // Pointer-driven highlight, so the mouse and the arrow keys agree on which
  // row Enter would run.
  list.addEventListener('mousemove', event => {
    const item = event.target.closest('.cmdk-item')
    if (!item || Number(item.dataset.index) === highlighted) return
    highlighted = Number(item.dataset.index)
    paintHighlight()
  })
}

function onGlobalKeydown(event) {
  if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    return isOpen() ? close() : open()
  }
  if (event.key !== 'Escape') return
  // Both directions live here rather than half here and half on the input:
  // the input's keydown bubbles to this listener, so closing there would let
  // this branch see an already-closed panel and reopen it on the same press.
  if (isOpen()) {
    event.preventDefault()
    // Inside a submenu Escape steps back out rather than dropping the panel -
    // closing outright would make a mis-click cost the whole visit.
    return stack.length > 1 ? popLevel() : close()
  }
  // Esc belongs to the autocomplete while it's up — the quiz modes use it to
  // dismiss their suggestion dropdown, and stealing that would be worse than
  // making the player press Esc twice to reach the panel.
  if (document.querySelector('.autocomplete-dropdown.show')) return
  event.preventDefault()
  open()
}

function onInputKeydown(event) {
  switch (event.key) {
    // Escape is deliberately absent — onGlobalKeydown owns it, in both
    // directions, so it can't be handled twice on one press.
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Enter':
      event.preventDefault()
      run(highlighted)
      break
    case 'Backspace':
      // Only on an empty query, so backspacing through a search never
      // surprises you by leaving the submenu.
      if (input.value === '' && stack.length > 1) {
        event.preventDefault()
        popLevel()
      }
      break
  }
}

function isOpen() {
  return root && !root.hidden
}

function open() {
  // Never record our own input: open() can be reached while the panel already
  // has focus, and restoring to it on close would strand focus in a hidden box.
  const focused = document.activeElement
  previouslyFocused = root.contains(focused) ? null : focused
  stack = [{ title: null, build: buildCommands }]
  highlighted = 0
  root.hidden = false
  input.value = ''
  renderList()
  input.focus()
}

function pushLevel(command) {
  stack.push({ title: command.title, build: command.children })
  highlighted = 0
  input.value = ''
  renderList()
  input.focus()
}

function popLevel() {
  stack.pop()
  highlighted = 0
  input.value = ''
  renderList()
  input.focus()
}

function close() {
  root.hidden = true
  // Hand focus back to whatever had it — usually a quiz's search input, which
  // is unusable until it gets focus again.
  if (previouslyFocused?.isConnected) previouslyFocused.focus()
  previouslyFocused = null
}

function move(delta) {
  if (visible.length === 0) return
  highlighted = (highlighted + delta + visible.length) % visible.length
  paintHighlight()
  list.querySelector('.cmdk-item.highlighted')?.scrollIntoView({ block: 'nearest' })
}

function run(index) {
  const command = visible[index]
  if (!command) return

  if (command.children) return pushLevel(command)

  if (command.keepOpen) {
    // The command changed the state its own `active` dot reflects; renderList
    // rebuilds from the level's build(), so the dot moves without closing.
    command.run()
    renderList()
    input.focus()
  } else {
    close()
    command.run()
  }
}

function renderList() {
  const level = stack[stack.length - 1]
  const nested = stack.length > 1
  crumb.textContent = level.title || ''
  crumb.hidden = !level.title
  input.placeholder = level.title ? `Search ${level.title}…` : 'Search modes, settings, actions…'
  // Escape steps out of a submenu rather than closing, so say so.
  escHint.textContent = nested ? 'esc back' : 'esc close'

  visible = rankCommands(level.build(), input.value.trim())
  if (highlighted >= visible.length) highlighted = Math.max(0, visible.length - 1)

  if (visible.length === 0) {
    list.innerHTML = '<div class="cmdk-empty">No matches</div>'
    return
  }

  let html = ''
  let section = null
  visible.forEach((command, index) => {
    // Section headings only make sense while the list is in declaration order;
    // once a query reorders by score they'd repeat and mislead, so drop them.
    // Inside a submenu a heading would just restate the breadcrumb.
    if (!nested && !input.value.trim() && command.section !== section) {
      section = command.section
      html += `<div class="cmdk-section">${escapeHtml(section)}</div>`
    }
    html += `
      <div class="cmdk-item${index === highlighted ? ' highlighted' : ''}" role="option" data-index="${index}">
        <span class="cmdk-dot${command.active ? ' on' : ''}"></span>
        <span class="cmdk-text">
          <span class="cmdk-title">${highlightTitle(command.title, command.matchedIndices)}</span>
          ${command.detail ? `<span class="cmdk-detail">${escapeHtml(command.detail)}</span>` : ''}
        </span>
        ${command.value ? `<span class="cmdk-value">${escapeHtml(command.value)}</span>` : ''}
        ${command.children ? '<span class="cmdk-chevron">›</span>' : ''}
      </div>`
  })
  list.innerHTML = html
}

function paintHighlight() {
  list.querySelectorAll('.cmdk-item').forEach((item, index) => {
    item.classList.toggle('highlighted', index === highlighted)
  })
}

// Marks the query's hits inside the title, the same way the country search bar
// marks its suggestions. Consecutive hits are wrapped as one run rather than one
// <mark> per letter.
function highlightTitle(title, matchedIndices) {
  if (!matchedIndices?.length) return escapeHtml(title)

  const marked = new Set(matchedIndices)
  let html = ''
  let run = ''
  let runIsMarked = false

  for (let index = 0; index <= title.length; index++) {
    const isMarked = marked.has(index)
    if (index === title.length || isMarked !== runIsMarked) {
      if (run) html += runIsMarked ? `<mark>${escapeHtml(run)}</mark>` : escapeHtml(run)
      run = ''
      runIsMarked = isMarked
    }
    run += title[index] ?? ''
  }
  return html
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ))
}
