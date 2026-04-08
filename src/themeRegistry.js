const extensionManifests = import.meta.glob('./themes/**/extension/package.json', { query: '?raw', import: 'default', eager: true })
const themeFiles = import.meta.glob('./themes/**/extension/themes/*.{tmTheme,json}', { query: '?raw', import: 'default', eager: true })

function hexToRgb(hex) {
  const h = String(hex || '').trim().replace('#', '')
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return { r, g, b }
  }
  if (h.length !== 6) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return { r, g, b }
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) => n.toString(16).padStart(2, '0')
  return `#${toHex(Math.max(0, Math.min(255, r)))}${toHex(Math.max(0, Math.min(255, g)))}${toHex(Math.max(0, Math.min(255, b)))}`
}

function stableHash(input) {
  const s = String(input || '')
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
  }
  return (h >>> 0).toString(16)
}

function mixHex(a, b, t) {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  if (!ca || !cb) return a
  const tt = Math.max(0, Math.min(1, Number(t) || 0))
  return rgbToHex({
    r: Math.round(ca.r + (cb.r - ca.r) * tt),
    g: Math.round(ca.g + (cb.g - ca.g) * tt),
    b: Math.round(ca.b + (cb.b - ca.b) * tt)
  })
}

function parsePlistValue(node) {
  if (!node) return null
  const tag = node.tagName
  if (tag === 'string') return node.textContent ?? ''
  if (tag === 'integer') return Number(node.textContent ?? '0')
  if (tag === 'real') return Number(node.textContent ?? '0')
  if (tag === 'true') return true
  if (tag === 'false') return false
  if (tag === 'array') {
    const out = []
    for (const child of Array.from(node.children)) out.push(parsePlistValue(child))
    return out
  }
  if (tag === 'dict') {
    const out = {}
    const children = Array.from(node.children)
    for (let i = 0; i < children.length; i += 2) {
      const keyNode = children[i]
      const valueNode = children[i + 1]
      if (!keyNode || keyNode.tagName !== 'key') continue
      out[keyNode.textContent ?? ''] = parsePlistValue(valueNode)
    }
    return out
  }
  return null
}

function parseTmTheme(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(String(xmlText || ''), 'application/xml')
  const dict = doc.querySelector('plist > dict')
  const data = parsePlistValue(dict)
  return data && typeof data === 'object' ? data : null
}

function scopeToMonacoToken(scope) {
  const s = String(scope || '').toLowerCase()
  if (!s) return null
  if (s.includes('comment')) return 'comment'
  if (s.includes('string')) return 'string'
  if (s.includes('constant.numeric') || s.includes('number')) return 'number'
  if (s.includes('keyword') || s.includes('storage')) return 'keyword'
  if (s.includes('entity.name.function') || s.includes('support.function')) return 'function'
  if (s.includes('entity.name.type') || s.includes('support.type') || s.includes('support.class') || s.includes('type')) return 'type'
  if (s.includes('variable')) return 'variable'
  if (s.includes('constant')) return 'constant'
  return null
}

function normalizeHex(value) {
  const v = String(value || '').trim()
  if (!v) return ''
  if (v.startsWith('#')) return v
  return `#${v}`
}

function buildThemeFromTmTheme(label, tmData) {
  const settings = Array.isArray(tmData?.settings) ? tmData.settings : []
  const baseItem = settings.find((s) => s && typeof s === 'object' && !s.scope) || null
  const base = baseItem?.settings && typeof baseItem.settings === 'object' ? baseItem.settings : {}

  const bg = normalizeHex(base.background) || '#1e1e1e'
  const fg = normalizeHex(base.foreground) || '#cccccc'
  const selection = normalizeHex(base.selection) || mixHex(bg, fg, 0.16)

  const tokenMap = new Map()
  for (const entry of settings) {
    if (!entry || typeof entry !== 'object' || !entry.scope || !entry.settings) continue
    const foreground = normalizeHex(entry.settings.foreground)
    if (!foreground) continue
    const scopes = Array.isArray(entry.scope) ? entry.scope : String(entry.scope).split(',').map((x) => x.trim())
    for (const sc of scopes) {
      const token = scopeToMonacoToken(sc)
      if (!token || tokenMap.has(token)) continue
      const fontStyle = String(entry.settings.fontStyle || '').trim()
      tokenMap.set(token, { token, foreground: foreground.replace('#', ''), fontStyle: fontStyle || undefined })
    }
  }

  const rules = Array.from(tokenMap.values())
  const colors = {
    'editor.background': bg,
    'editor.foreground': fg,
    'editor.selectionBackground': selection,
    'editorLineNumber.foreground': mixHex(fg, bg, 0.55),
    'editorLineNumber.activeForeground': mixHex(fg, bg, 0.25),
    'editorCursor.foreground': fg,
    'editorIndentGuide.background1': mixHex(fg, bg, 0.78),
    'editorIndentGuide.activeBackground1': mixHex(fg, bg, 0.6)
  }

  const ui = {
    '--bg': bg,
    '--mono-bg': bg,
    '--panel-2': mixHex(bg, fg, 0.06),
    '--panel': mixHex(bg, fg, 0.08),
    '--tab-active': bg,
    '--tab': mixHex(bg, fg, 0.08),
    '--border': mixHex(fg, bg, 0.75),
    '--text': fg,
    '--muted': mixHex(fg, bg, 0.55),
    '--accent': '#61afef',
    '--danger': '#e06c75',
    '--input-bg': mixHex(bg, fg, 0.10),
    '--hover': mixHex(bg, fg, 0.10),
    '--list-hover': mixHex(bg, fg, 0.10),
    '--list-active': mixHex('#61afef', bg, 0.78)
  }

  return { label, monaco: { base: 'vs-dark', inherit: true, rules, colors }, ui }
}

function buildThemeFromVsCodeJson(label, json) {
  const colors = json?.colors && typeof json.colors === 'object' ? json.colors : {}
  const bg = String(colors['editor.background'] || '#1e1e1e')
  const fg = String(colors['editor.foreground'] || '#cccccc')
  const selection = String(colors['editor.selectionBackground'] || mixHex(bg, fg, 0.16))

  const tokenColors = Array.isArray(json?.tokenColors) ? json.tokenColors : []
  const tokenMap = new Map()
  for (const entry of tokenColors) {
    if (!entry || typeof entry !== 'object' || !entry.settings) continue
    const foreground = normalizeHex(entry.settings.foreground)
    if (!foreground) continue
    const scopesRaw = entry.scope
    const scopes = Array.isArray(scopesRaw)
      ? scopesRaw
      : String(scopesRaw || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
    for (const sc of scopes) {
      const token = scopeToMonacoToken(sc)
      if (!token || tokenMap.has(token)) continue
      const fontStyle = String(entry.settings.fontStyle || '').trim()
      tokenMap.set(token, { token, foreground: foreground.replace('#', ''), fontStyle: fontStyle || undefined })
    }
  }

  const monacoColors = {
    'editor.background': bg,
    'editor.foreground': fg,
    'editor.selectionBackground': selection
  }

  const ui = {
    '--bg': bg,
    '--mono-bg': bg,
    '--panel-2': String(colors['sideBar.background'] || mixHex(bg, fg, 0.06)),
    '--panel': String(colors['activityBar.background'] || mixHex(bg, fg, 0.08)),
    '--tab-active': String(colors['editorGroupHeader.tabsBackground'] || bg),
    '--tab': String(colors['tab.inactiveBackground'] || mixHex(bg, fg, 0.08)),
    '--border': String(colors['contrastBorder'] || mixHex(fg, bg, 0.75)),
    '--text': fg,
    '--muted': mixHex(fg, bg, 0.55),
    '--accent': String(colors['focusBorder'] || '#61afef'),
    '--danger': '#e06c75',
    '--input-bg': String(colors['input.background'] || mixHex(bg, fg, 0.10)),
    '--hover': String(colors['list.hoverBackground'] || mixHex(bg, fg, 0.10)),
    '--list-hover': String(colors['list.hoverBackground'] || mixHex(bg, fg, 0.10)),
    '--list-active': String(colors['list.activeSelectionBackground'] || mixHex('#61afef', bg, 0.78))
  }

  return {
    label,
    monaco: { base: 'vs-dark', inherit: true, rules: Array.from(tokenMap.values()), colors: monacoColors },
    ui
  }
}

function buildRegistry() {
  const themes = new Map()
  themes.set('dark', { label: 'Monarco (Dark)', builtin: true })

  for (const [manifestPath, raw] of Object.entries(extensionManifests)) {
    try {
      const pkg = JSON.parse(String(raw || ''))
      const contributes = pkg?.contributes?.themes
      if (!Array.isArray(contributes)) continue
      for (const t of contributes) {
        const label = String(t?.label || '').trim()
        const relPath = String(t?.path || '').replace(/^\.\//, '')
        if (!label || !relPath) continue
        const baseDir = manifestPath.replace(/\/extension\/package\.json$/, '/extension/')
        const fullPathKey = `${baseDir}${relPath}`.replace(/\/\.\//g, '/')
        const rawTheme = themeFiles[fullPathKey]
        if (!rawTheme) continue
        const id = `${String(pkg.publisher || '').trim()}.${String(pkg.name || '').trim()}:${label}`
        if (fullPathKey.endsWith('.tmTheme')) {
          const tm = parseTmTheme(rawTheme)
          if (!tm) continue
          themes.set(id, buildThemeFromTmTheme(label, tm))
        } else if (fullPathKey.endsWith('.json')) {
          const json = JSON.parse(String(rawTheme || ''))
          themes.set(id, buildThemeFromVsCodeJson(label, json))
        }
      }
    } catch {}
  }

  return themes
}

const registry = buildRegistry()

export function getThemeOptions() {
  return Array.from(registry.entries()).map(([id, t]) => ({ id, label: t.label || id }))
}

export function applyThemeToUi(themeId, { setVar, resetVar, initialVars }) {
  const t = registry.get(themeId)
  if (!t || t.builtin) {
    for (const [k, v] of Object.entries(initialVars)) resetVar(k, v)
    return
  }
  for (const [k, v] of Object.entries(initialVars)) resetVar(k, v)
  const ui = t.ui || {}
  for (const [k, v] of Object.entries(ui)) setVar(k, v)
}

export function applyThemeToMonaco(monaco, themeId) {
  const t = registry.get(themeId)
  if (!monaco?.editor) {
    console.warn('[ThemeRegistry] Monaco não está disponível para aplicar tema')
    return
  }
  
  console.log('[ThemeRegistry] Aplicando tema ao Monaco:', themeId, t)
  
  if (!t || t.builtin) {
    console.log('[ThemeRegistry] Tema builtin, usando vs-dark')
    monaco.editor.setTheme('vs-dark')
    return
  }
  let mon = t.monaco || null
  if (mon && (!Array.isArray(mon.rules) || mon.rules.length === 0)) {
    const label = String(t.label || '').toLowerCase()
    const isAtomOneDark = label.includes('atom one dark') || label.includes('one dark')
    if (isAtomOneDark) {
      mon = {
        base: 'vs-dark',
        inherit: false,
        rules: [
          { token: 'comment', foreground: '5c6370' },
          { token: 'string', foreground: '98c379' },
          { token: 'number', foreground: 'd19a66' },
          { token: 'keyword', foreground: 'c678dd' },
          { token: 'function', foreground: '61afef' },
          { token: 'type', foreground: 'e5c07b' },
          { token: 'variable', foreground: 'e06c75' },
        ],
        colors: {
          'editor.background': '#282c34',
          'editor.foreground': '#abb2bf',
          'editor.selectionBackground': '#3E4451',
          'editorLineNumber.foreground': '#5c6370',
          'editorCursor.foreground': '#abb2bf',
        }
      }
    }
  }
  if (!mon) {
    console.warn('[ThemeRegistry] Tema sem configuração Monaco, usando vs-dark')
    monaco.editor.setTheme('vs-dark')
    return
  }
  
  // Gera um nome válido para o tema
  // Monaco só permite letras, números e hífens (regex: /^[a-z0-9\-]+$/i)
  // Underscores (_) NÃO são permitidos!
  const safeThemeId = String(themeId || '')
    .replace(/[^a-zA-Z0-9]/g, '-')  // Substitui tudo que não é alfanumérico por hífen
    .replace(/-+/g, '-')             // Remove hífens duplicados
    .replace(/^-|-$/g, '')           // Remove hífens no início/fim
    .toLowerCase()
    .substring(0, 50)
  
  const name = `monarco-${safeThemeId}`
  
  try {
    monaco.editor.defineTheme(name, mon)
    monaco.editor.setTheme(name)
  } catch (e) {
    console.error('[ThemeRegistry] Erro ao aplicar tema:', e)
    monaco.editor.setTheme('vs-dark')
  }
}
