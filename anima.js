/*
  Clue Anima: leave comments on an animation, pinned to a moment and to a component, then copy them
  all for a coding agent in one go.

  Option+Shift+A   comment mode on or off (Esc also leaves)
  1. Pick a window  on a page of several scenes, hover one (pink outline) and click it
  2. Click          the animation stops (Esc plays on)
  3. Point, click   the component under the pointer is marked, as in Clue; W goes up a layer, S down;
                    a click opens a note on it; Cancel or Save plays on
  Comments list       the list of notes; pick one to stop on its moment with the note open, its
                   component marked and a pink dot where you clicked
  Copy             every note from every scene on the page, ready to paste to an agent

  Time: a page that draws itself from `window.draw(t)` (a scene loop) is paused by holding t;
  otherwise every CSS or Web Animation on the page is paused through document.getAnimations().
  Inert with ?still in the URL, so renderers that screenshot the page never see it.
  A preview page and the scenes in its iframes all load this script: the page shows the menu and
  the window outline, each scene takes the clicks and keeps its own notes. Notes survive a reload;
  closing comment mode (Esc, the Esc button, Option+Shift+A) deletes them all, so copy first.
*/
(() => {
  if (window.clueAnima || new URLSearchParams(location.search).has('still')) return
  const framed = window.parent !== window
  const KEY = `clue-anima:${location.pathname}${location.search}`
  const page = decodeURIComponent(location.pathname.replace(/^.*\/(?=[^/]+\/[^/]+$)/, '')) + location.search

  // ---- Time ----------------------------------------------------------------------------------
  let draw = null, now = 0, paused = false, held = 0
  const wrapped = t => {
    if (!paused) now = t
    return draw?.(paused ? held : t)
  }
  // Catch window.draw whenever the scene assigns it, before or after this script runs.
  if (typeof window.draw === 'function') draw = window.draw
  Object.defineProperty(window, 'draw', { configurable: true, get: () => draw && wrapped, set: fn => { draw = fn } })
  const animates = () => Boolean(draw) || document.getAnimations().length > 0
  const duration = () => window.DURATION || Math.max(0, ...document.getAnimations().map(a => a.effect?.getComputedTiming().endTime || 0)) / 1000 || 0
  const time = () => (draw ? (paused ? held : now) : (document.getAnimations()[0]?.currentTime || 0) / 1000)
  function pause(at = time()) {
    paused = true
    held = Math.max(0, at)
    if (draw) draw(held)
    else for (const a of document.getAnimations()) { a.pause(); a.currentTime = held * 1000 }
  }
  function play() {
    paused = false
    if (!draw) for (const a of document.getAnimations()) a.play()
  }

  // ---- State ---------------------------------------------------------------------------------
  let mode = false        // comment mode: the menu is up
  let armed = false       // this scene takes the pointer (the chosen window, or a page on its own)
  let choosing = false    // the page is waiting for a window to be picked
  let chosen = null       // the picked iframe
  let hovered = null      // the iframe under the pointer while choosing
  let listOpen = false    // the Comments dropdown
  let base = null, level = 0   // the element under the pointer, and how many layers up W has gone
  let editing = null, status = '', statusTimer
  let parentHasAnima = false
  const frames = new Map()   // iframe window -> { page, loop, notes }

  let comments = []
  try { comments = JSON.parse(localStorage.getItem(KEY)) || [] } catch {}
  const report = () => ({ page, loop: duration(), notes: comments.map(({ t, element, text, x, y, note }) => ({ t, element, text, x, y, note })) })
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(comments)) } catch {}
    toParent({ clueAnima: true, ...report() })
    render()
  }

  // ---- Messages between the page and its scenes ----------------------------------------------
  // A preview page and its scenes talk only over a real origin (served, e.g. by serve.cjs), and only
  // to their own frames and own parent on that same origin. On file:// every page reports "null",
  // so nothing can be told apart: there each scene simply works on its own.
  const linked = location.protocol !== 'file:' && location.origin !== 'null'
  const sameOrigin = event => linked && event.origin === location.origin
  const toParent = message => { if (linked && framed) window.parent.postMessage(message, location.origin) }
  function trustedChild(event) {
    return sameOrigin(event) && [...document.querySelectorAll('iframe')].some(item => item.contentWindow === event.source)
  }
  const str = (value, max) => typeof value === 'string' ? value.slice(0, max) : ''
  // Single-line fields stay on one line in the paste, so a value cannot fake a new note or header.
  const line = (value, max) => str(value, max).replace(/[\s\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').trim()
  const num = value => Number.isFinite(value) ? value : 0
  const cleanReport = data => ({
    page: line(data.page, 200), loop: num(data.loop),
    notes: (Array.isArray(data.notes) ? data.notes.slice(0, 100) : []).map(n => ({
      t: num(n?.t), element: line(n?.element, 200), text: line(n?.text, 80), x: num(n?.x), y: num(n?.y), note: str(n?.note, 4000),
    })).filter(n => n.note),
  })
  // Notes kept in this browser go through the same checks as notes from a scene.
  comments = (Array.isArray(comments) ? comments : []).filter(c => c && typeof c.note === 'string' && c.note).slice(0, 100).map(c => ({
    t: num(c.t), fx: num(c.fx), fy: num(c.fy), x: num(c.x), y: num(c.y),
    element: line(c.element, 200), text: line(c.text, 80), note: str(c.note, 4000),
    path: Array.isArray(c.path) ? c.path.filter(Number.isInteger).slice(0, 64) : [],
  }))
  const toFrames = message => { for (const win of frames.keys()) win.postMessage(message, location.origin) }
  addEventListener('load', event => {
    if (event.target.tagName !== 'IFRAME') return
    frames.delete(event.target.contentWindow)
    if (linked) event.target.contentWindow?.postMessage({ clueAnimaHello: true }, location.origin)
    render()
  }, true)
  addEventListener('message', event => {
    const data = event.data || {}
    if (framed && event.source === window.parent && sameOrigin(event)) {
      if (data.clueAnimaHere) parentHasAnima = true
      if ('clueAnimaMode' in data) { mode = Boolean(data.clueAnimaMode); if (!mode) disarm() }
      if ('clueAnimaArm' in data) { if (data.clueAnimaArm) armed = true; else disarm() }
      if (data.clueAnimaClear) { comments = []; save() }
      if (data.clueAnimaHello) save()
      if (Number.isInteger(data.clueAnimaOpen) && comments[data.clueAnimaOpen]) openEditor(comments[data.clueAnimaOpen], false)
      render()
      return
    }
    if (!trustedChild(event)) return
    if (data.clueAnimaKey === 'toggle' || data.clueAnimaKey === 'escape') return handleKey(data.clueAnimaKey)
    if (!data.clueAnima) return
    if (!frames.has(event.source)) event.source.postMessage({ clueAnimaHere: true, clueAnimaMode: mode }, location.origin)
    frames.set(event.source, cleanReport(data))
    render()
  })

  // ---- Elements ------------------------------------------------------------------------------
  const stage = () => document.getElementById('stage') || document.documentElement
  const stageRect = () => stage().getBoundingClientRect()

  /** A short, findable name for the element: tag#id.class, its nearest named ancestor, its text. */
  function describe(el) {
    const name = node => node.tagName.toLowerCase() + (node.id ? `#${node.id}` : '')
      + [...node.classList].slice(0, 2).map(c => `.${c}`).join('')
    const path = []
    for (let node = el; node && node !== document.body && path.length < 3; node = node.parentElement) {
      path.unshift(name(node))
      if (node.id) break
    }
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
    return { element: path.join(' > '), text: text.length && text.length <= 60 ? text : '' }
  }
  // Where the element sits in the page, as child indices from <body>, to find it again later.
  const pathOf = el => { const path = []; for (let n = el; n && n !== document.body; n = n.parentElement) path.unshift([...n.parentElement.children].indexOf(n)); return path }
  const atPath = path => path?.reduce((node, i) => node?.children[i], document.body) || null
  // The layer W and S move through: the element under the pointer, or one of its ancestors.
  const layer = () => {
    let el = base
    for (let i = 0; i < level && el?.parentElement && el.parentElement !== document.body && el !== stage(); i++) el = el.parentElement
    return el
  }

  // Overlays in a scene (a highlight, a label) often ignore the pointer; for this lookup they count.
  const reach = document.createElement('style')
  reach.textContent = '* { pointer-events: auto !important; }'
  function elementAt(x, y) {
    host.style.display = 'none'
    document.head.appendChild(reach)
    const el = document.elementFromPoint(x, y)
    reach.remove()
    host.style.display = ''
    return el
  }

  // ---- Notes ---------------------------------------------------------------------------------
  /** Every note on the page, numbered across scenes: [{ number, owner, index, page, note }]. */
  function allNotes() {
    const list = [], groups = []
    const add = (owner, data) => {
      if (!data.notes.length) return
      const group = { page: data.page, loop: data.loop, items: [] }
      data.notes.forEach((note, index) => { const item = { number: list.length + 1, owner, index, page: data.page, ...note }; list.push(item); group.items.push(item) })
      groups.push(group)
    }
    add(null, cleanReport(report()))
    for (const frame of document.querySelectorAll('iframe')) if (frames.has(frame.contentWindow)) add(frame, frames.get(frame.contentWindow))
    return { list, groups }
  }

  function copyAll() {
    const { list, groups } = allNotes()
    if (!list.length) return
    const text = 'Animation comments (Clue Anima). Times are seconds into the loop; points are stage pixels.\n\n'
      + groups.map(group => [`${line(group.page, 200)}${group.loop ? ` (loop ${group.loop.toFixed(2)}s)` : ''}`, ...group.items.map(c => {
        const where = [`at ${num(c.t).toFixed(2)}s`, `on ${line(c.element, 200)}`]
        if (c.text) where.push(`text "${line(c.text, 80).replace(/"/g, '\\"')}"`)
        where.push(`point ${Math.round(num(c.x))}, ${Math.round(num(c.y))}`)
        // The note may span lines; each is indented, so none can pass for a note or a header.
        return `[${c.number}] ${where.join(' \u00B7 ')}\n    ${str(c.note, 4000).split(/\r\n|[\r\n\u2028\u2029]/).join('\n    ')}`
      })].join('\n')).join('\n\n')
    const done = () => { status = `Copied ${list.length} comment${list.length > 1 ? 's' : ''}`; clearTimeout(statusTimer); statusTimer = setTimeout(() => { status = ''; render() }, 1600); render() }
    navigator.clipboard?.writeText(text).then(done, () => fallbackCopy(text, done)) ?? fallbackCopy(text, done)
  }
  function fallbackCopy(text, done) {
    const area = document.createElement('textarea')
    area.value = text
    root.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); done()
  }
  function clearAll() {
    toFrames({ clueAnimaClear: true })   // the scenes clear and report back empty
    comments = []
    listOpen = false
    for (const [win, data] of frames) frames.set(win, { ...data, notes: [] })
    save()
  }
  /** From the Comments list: go to that scene, stop on the note's moment with it open. */
  function openNote(item) {
    listOpen = false
    if (!item.owner) { if (mode) armed = true; openEditor(comments[item.index], false); return }
    choose(item.owner)
    item.owner.contentWindow.postMessage({ clueAnimaOpen: item.index }, location.origin)
    render()
  }

  // ---- Interface (shadow DOM, styled like Clue) ----------------------------------------------
  const host = document.createElement('clue-anima')
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }   /* .bar sets display: flex, which would beat the attribute */
    .ui {
      --pink: #ff4fc8;   /* highlighter pink: Clue Anima's colour, Clue's is yellow */ --ink: #0f1011; --ink-2: #191a1b; --line: #2a2b2e; --muted: #8a8f98; --white: #fff;
      --tint: color-mix(in srgb, var(--pink) 35%, transparent);
      --font: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
      position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
      font: 400 12px/1.3 var(--font); -webkit-font-smoothing: antialiased;
    }
    .catcher { position: absolute; inset: 0; pointer-events: auto; cursor: crosshair; }
    .catcher.pick { cursor: pointer; }
    .outline { position: absolute; border: 3px solid var(--pink); pointer-events: none; }
    /* The component a note is on: Clue's tint, with its name on a sticky. */
    .target { position: absolute; background: var(--tint); pointer-events: none; }
    .target span { position: absolute; left: 0; bottom: 100%; padding: 2px 6px; background: var(--pink); color: var(--ink); white-space: nowrap; }
    .dot { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border: 2px solid var(--ink); border-radius: 50%; background: var(--pink); pointer-events: none; }
    .editor { position: absolute; width: 280px; padding: 8px; border: 1px solid var(--line); background: var(--ink); pointer-events: auto; }
    .editor .meta { margin-bottom: 6px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    textarea { display: block; width: 100%; min-height: 64px; padding: 6px; border: 1px solid var(--line); background: var(--ink-2);
      color: var(--white); font: 13px/1.4 var(--font); resize: vertical; outline: none; }
    textarea:focus { border-color: var(--pink); }
    .row { display: flex; gap: 6px; justify-content: flex-end; margin-top: 6px; }
    button { padding: 3px 8px; border: 0; background: var(--line); color: var(--white); font: 510 12px/1.3 var(--font); cursor: pointer; }
    button.primary { background: var(--pink); color: var(--ink); }
    .menu { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); pointer-events: auto; }
    .bar { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border: 1px solid var(--line); background: var(--ink); color: var(--muted); white-space: nowrap; }
    .bar b { color: var(--white); font-weight: 510; }
    .bar .logo { display: block; width: 16px; height: 16px; }
    .bar kbd { padding: 0 4px; background: var(--line); color: var(--white); font: inherit; font-weight: 510; }
    .bar.sticky { border-color: var(--pink); background: var(--pink); color: var(--ink); }
    .bar.sticky b { color: var(--ink); }
    .list { margin-top: 4px; max-height: 50vh; overflow: auto; border: 1px solid var(--line); background: var(--ink); }
    .list button { display: block; width: 100%; padding: 8px 10px; background: none; color: var(--white); font-weight: 400; text-align: left; }
    .list button:hover { background: var(--ink-2); }
    .list .where { display: block; color: var(--muted); }
    .list .what { display: block; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  </style>
  <div class="ui"><div class="catcher" hidden></div><div class="outline" hidden></div><div class="target" hidden><span></span></div><div class="dot" hidden></div>
    <div class="editor" hidden></div><div class="menu" hidden><div class="bar"></div><div class="list" hidden></div></div></div>`
  // Clue's mark on a pink sticky, turned a quarter clockwise: the arrow points up.
  const LOGO = '<svg class="logo" viewBox="0 0 128 128" aria-hidden="true"><rect width="128" height="128" fill="var(--pink)"/>'
    + '<path transform="rotate(90 64 64)" d="M80 22 87 37 42 66 35 52ZM43 67 87 93 79 106 36 79Z" fill="var(--ink)"/></svg>'
  const $ = selector => root.querySelector(selector)
  const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  // Rewrite only on change, so a button is not replaced between mouse down and click.
  const setHtml = (el, html) => { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html } }
  const attach = () => document.body.appendChild(host)
  if (document.body) attach(); else addEventListener('DOMContentLoaded', attach)
  const sceneFrames = () => [...document.querySelectorAll('iframe')].filter(frame => frames.has(frame.contentWindow))
  const frameAt = (x, y) => sceneFrames().find(frame => {
    const r = frame.getBoundingClientRect()
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  })

  // ---- Editor --------------------------------------------------------------------------------
  function openEditor(comment, isNew) {
    pause(comment.t)
    editing = { comment, isNew }
    const r = stageRect(), x = r.left + comment.fx * r.width, y = r.top + comment.fy * r.height
    const editor = $('.editor')
    editor.hidden = false
    editor.innerHTML = `<div class="meta">${comment.t.toFixed(2)}s \u00B7 ${esc(comment.element)}</div><textarea placeholder="What should change here?"></textarea>
      <div class="row">${isNew ? '' : '<button class="delete">Delete</button>'}<button class="cancel">Cancel</button><button class="primary save">Save</button></div>`
    const area = editor.querySelector('textarea')
    area.value = comment.note || ''
    editor.style.left = `${Math.max(8, Math.min(x + 16, innerWidth - 296))}px`
    editor.style.top = `${Math.max(8, Math.min(y + 16, innerHeight - 150))}px`
    editor.querySelector('.save').onclick = commit
    editor.querySelector('.cancel').onclick = cancelEdit
    if (!isNew) editor.querySelector('.delete').onclick = () => { comments = comments.filter(c => c !== comment); closeEditor(); save() }
    area.onkeydown = event => {
      event.stopPropagation()
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commit() }
      if (event.key === 'Escape') cancelEdit()
    }
    setTimeout(() => area.focus())
    render()
  }
  function commit() {
    const note = $('.editor textarea').value.trim()
    const { comment, isNew } = editing
    if (note) { comment.note = note; if (isNew) comments.push(comment) }
    closeEditor()
    save()
  }
  /** Cancel and Save both close the note and let the animation play on. */
  function cancelEdit() { if (editing) closeEditor() }
  function closeEditor() { editing = null; $('.editor').hidden = true; resume() }
  /** Back to playing: after a note is saved or dropped, or Esc on a stopped frame. */
  function resume() { play(); base = null; level = 0; render() }
  function disarm() { armed = false; base = null; level = 0; cancelEdit() }

  // ---- Pointer and keys ----------------------------------------------------------------------
  const catcher = $('.catcher')
  catcher.addEventListener('mousemove', event => {
    if (choosing) {
      const frame = frameAt(event.clientX, event.clientY) || null
      if (frame !== hovered) { hovered = frame; render() }
      return
    }
    // Components are picked on a stopped frame only; while it plays the pointer just waits.
    if (editing || !paused) return
    const el = elementAt(event.clientX, event.clientY)
    if (el !== base) { base = el; level = 0; render() }
  })
  catcher.addEventListener('mouseleave', () => { if (!editing) { base = null; render() } })
  catcher.addEventListener('click', event => {
    listOpen = false
    if (choosing) {
      const frame = frameAt(event.clientX, event.clientY)
      if (frame) choose(frame)
      return
    }
    if (editing) return cancelEdit()
    // First click stops the animation; the next one picks the component and opens the note.
    if (!paused) { pause(); base = elementAt(event.clientX, event.clientY); level = 0; return render() }
    base = base || elementAt(event.clientX, event.clientY)
    const target = layer()
    if (!target) return
    const r = stageRect(), s = stage(), t = time()
    const scale = s.offsetWidth ? s.offsetWidth / r.width : 1
    openEditor({
      t: +t.toFixed(3), fx: (event.clientX - r.left) / r.width, fy: (event.clientY - r.top) / r.height,
      x: Math.round((event.clientX - r.left) * scale), y: Math.round((event.clientY - r.top) * scale),
      ...describe(target), path: pathOf(target), note: '',
    }, true)
  })
  root.addEventListener('click', event => {
    const target = event.target
    if (target.closest?.('.copy')) return copyAll()
    if (target.closest?.('.clear')) return clearAll()
    if (target.closest?.('.change')) { listOpen = false; return startChoosing() }
    if (target.closest?.('.exit')) return setMode(false)
    if (target.closest?.('.toggle-list')) { listOpen = !listOpen; return render() }
    const item = target.closest?.('[data-note]')
    if (item) openNote(allNotes().list[item.dataset.note])
  })

  function choose(frame) {
    choosing = false
    chosen = frame
    hovered = null
    toFrames({ clueAnimaArm: false })
    frame.contentWindow.postMessage({ clueAnimaArm: true }, location.origin)
    frame.focus()
    render()
  }
  function startChoosing() {
    const scenes = sceneFrames()
    if (scenes.length === 1) return choose(scenes[0])
    choosing = true
    chosen = null
    toFrames({ clueAnimaArm: false })
    render()
  }
  function setMode(on) {
    mode = on
    listOpen = false
    if (frames.size) {
      toFrames({ clueAnimaMode: on })
      if (on) startChoosing()
      else { choosing = false; chosen = null; hovered = null }
    } else if (on) armed = animates()
    if (!on) disarm()
    // Closing comment mode is the end of a review round: every note goes, here and in every scene.
    // Copy them first; a reload while the mode is open keeps them.
    if (!on) clearAll()
    render()
  }
  function handleKey(key) {
    if (key === 'toggle') setMode(!mode)
    if (key === 'escape' && mode) setMode(false)
  }
  addEventListener('keydown', event => {
    if (editing) return
    // W and S move the mark up and down the layers, by key position (works on any layout).
    if (armed && mode && paused && base && (event.code === 'KeyW' || event.code === 'KeyS') && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      const before = layer()
      level = Math.max(0, level + (event.code === 'KeyW' ? 1 : -1))
      if (event.code === 'KeyW' && layer() === before) level--
      return render()
    }
    const toggle = event.altKey && event.shiftKey && event.code === 'KeyA'
    const escape = event.key === 'Escape'
    // Esc on a stopped frame plays on; Esc while playing leaves comment mode.
    if (escape && armed && mode && paused) return resume()
    if (!toggle && !escape) return
    if (toggle) event.preventDefault()
    // In a scene on a preview page, the page above runs the mode.
    if (framed && parentHasAnima) return toParent({ clueAnimaKey: toggle ? 'toggle' : 'escape' })
    handleKey(toggle ? 'toggle' : 'escape')
  }, true)

  // ---- Drawing -------------------------------------------------------------------------------
  const place = (el, b) => Object.assign(el.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` })
  function render() {
    if (!$('.ui')) return
    catcher.hidden = !(choosing || (armed && mode))
    catcher.classList.toggle('pick', choosing)

    // The window outline: the one under the pointer while choosing, then the chosen one.
    const outlined = choosing ? hovered : mode ? chosen : null
    $('.outline').hidden = !outlined
    if (outlined) { const b = outlined.getBoundingClientRect(); place($('.outline'), { left: b.left - 3, top: b.top - 3, width: b.width + 6, height: b.height + 6 }) }

    // The component: under the pointer while pointing, or the open note's, with a dot where it was clicked.
    const markEl = editing ? atPath(editing.comment.path) : armed && mode && paused ? layer() : null
    const target = $('.target')
    target.hidden = !markEl
    if (markEl) {
      place(target, markEl.getBoundingClientRect())
      const name = editing ? editing.comment.element.split(' > ').pop() : describe(markEl).element.split(' > ').pop()
      if (target.firstChild.textContent !== name) target.firstChild.textContent = name
    }
    const dot = $('.dot')
    dot.hidden = !editing
    if (editing) { const r = stageRect(); Object.assign(dot.style, { left: `${r.left + editing.comment.fx * r.width}px`, top: `${r.top + editing.comment.fy * r.height}px` }) }

    // The menu, on the page that runs the mode (the preview page, or a scene on its own).
    const runsMode = !(framed && parentHasAnima)
    const menu = $('.menu'), bar = $('.bar')
    menu.hidden = !runsMode || (!mode && !status)
    bar.classList.toggle('sticky', Boolean(status))
    const { list } = allNotes()
    const step = choosing ? '<span>Pick a window</span>' : '<span><kbd>Click</kbd> pause, then pick</span><span><kbd>W</kbd><kbd>S</kbd> layer</span>'
    setHtml(bar, status ? `<b>${status}</b>`
      : `${LOGO}<b>Anima</b>${step}`
        + (list.length ? `<button class="toggle-list">Comments ${list.length} \u25BE</button>` : '')
        + (sceneFrames().length > 1 && !choosing ? '<button class="change">Change window</button>' : '')
        + (list.length ? '<button class="copy primary">Copy</button><button class="clear">Clear</button>' : '')
        + '<button class="exit">Esc</button>')
    const listEl = $('.list')
    listEl.hidden = !listOpen || !list.length || Boolean(status)
    setHtml(listEl, list.map((c, i) => `<button data-note="${i}"><span class="where">Comment ${c.number} \u00B7 ${esc(c.page)} \u00B7 ${c.t.toFixed(2)}s</span><span class="what">${esc(c.note)}</span></button>`).join(''))
  }
  addEventListener('resize', render)
  addEventListener('scroll', render, true)

  window.clueAnima = { comments: () => comments, copy: copyAll, editing: () => Boolean(editing) }
  if (framed) save()
  render()
})()
