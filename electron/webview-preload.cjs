const { ipcRenderer } = require('electron')

if (!ipcRenderer || typeof ipcRenderer.sendToHost !== 'function') {
  throw new Error('ipcRenderer.sendToHost not available in webview preload')
}

let active = false
let lastPayload = null

function sendToHost(channel, payload) {
  try {
    ipcRenderer.sendToHost(channel, payload)
  } catch {}
}

function cssPath(el) {
  if (!el) return ''
  const parts = []
  while (el && el.nodeType === 1 && parts.length < 8) {
    let sel = el.nodeName.toLowerCase()
    if (el.id) {
      sel += `#${el.id}`
      parts.unshift(sel)
      break
    }
    const cls = Array.from(el.classList || [])
    if (cls.length) sel += `.${cls.join('.')}`
    parts.unshift(sel)
    el = el.parentElement
  }
  return parts.join(' > ')
}

function ensureUi() {
  if (window.__monarcoInspectorInstalled) return
  window.__monarcoInspectorInstalled = true

  const UI_MARK = 'data-monarco-ui'

  const box = document.createElement('div')
  box.setAttribute(UI_MARK, 'true')
  box.style.cssText =
    'position:fixed;border:2px solid #00d1b2;background:rgba(0,209,178,0.12);pointer-events:none;z-index:2147483646;display:none;'

  const label = document.createElement('div')
  label.setAttribute(UI_MARK, 'true')
  label.style.cssText =
    'position:fixed;padding:2px 6px;border-radius:6px;background:#00d1b2;color:#111;font:12px sans-serif;pointer-events:none;z-index:2147483647;display:none;'

  const addBtn = document.createElement('button')
  addBtn.setAttribute(UI_MARK, 'true')
  addBtn.type = 'button'
  addBtn.textContent = '✦ Add to Chat'
  addBtn.style.cssText =
    'position:fixed;display:none;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(20, 27, 34, 0.92);color:#e6edf3;font:12px sans-serif;cursor:pointer;pointer-events:auto;z-index:2147483647;'

  document.documentElement.appendChild(box)
  document.documentElement.appendChild(label)
  document.documentElement.appendChild(addBtn)

  function hide() {
    box.style.display = 'none'
    label.style.display = 'none'
    addBtn.style.display = 'none'
  }

  function show() {
    box.style.display = 'block'
    label.style.display = 'block'
  }

  function getTargetFromPoint(x, y) {
    const list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)]
    for (const el of list) {
      if (!el) continue
      if (el === addBtn || el === box || el === label) continue
      if (el.closest && el.closest(`[${UI_MARK}]`)) continue
      return el
    }
    return null
  }

  function onMove(ev) {
    if (!active) return
    const el = getTargetFromPoint(ev.clientX, ev.clientY)
    if (!el) return hide()
    const r = el.getBoundingClientRect()
    box.style.left = `${r.left}px`
    box.style.top = `${r.top}px`
    box.style.width = `${r.width}px`
    box.style.height = `${r.height}px`

    const tag = el.tagName.toLowerCase()
    const cls = el.classList && el.classList.length ? `.${Array.from(el.classList).join('.')}` : ''
    label.textContent = `${tag}${cls}`
    label.style.left = `${r.left + 6}px`
    label.style.top = `${Math.max(0, r.top - 22)}px`
    show()
  }

  function onClick(ev) {
    if (!active) return
    if (ev.target && ev.target.closest && ev.target.closest(`[${UI_MARK}]`)) return
    ev.preventDefault()
    ev.stopPropagation()
    const el = getTargetFromPoint(ev.clientX, ev.clientY)
    if (!el) return
    const r = el.getBoundingClientRect()
    lastPayload = {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: Array.from(el.classList || []),
      rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      cssPath: cssPath(el)
    }

    addBtn.style.display = 'inline-flex'
    addBtn.style.left = `${r.left + 6}px`
    addBtn.style.top = `${r.bottom + 8}px`

    sendToHost('monarco-selected', lastPayload)
  }

  addBtn.addEventListener(
    'click',
    (ev) => {
      if (!active) return
      ev.preventDefault()
      ev.stopPropagation()
      if (!lastPayload) return
      sendToHost('monarco-add', lastPayload)
      addBtn.style.display = 'none'
    },
    true
  )

  document.addEventListener('mousemove', onMove, true)
  document.addEventListener('click', onClick, true)

  window.__monarcoSetSelectMode = (val) => {
    active = !!val
    document.documentElement.style.cursor = active ? 'default' : ''
    if (!active) {
      lastPayload = null
      hide()
    }
  }
}

function enable() {
  try {
    ensureUi()
    window.__monarcoSetSelectMode?.(true)
  } catch (e) {
    sendToHost('monarco-error', { message: e?.message || String(e) })
  }
}

function disable() {
  try {
    window.__monarcoSetSelectMode?.(false)
  } catch {}
}

ipcRenderer.on('monarco-select-mode', (_evt, enabled) => {
  if (enabled) enable()
  else disable()
})

ipcRenderer.on('monarco-ping', () => {
  sendToHost('monarco-pong', { ok: true })
})
