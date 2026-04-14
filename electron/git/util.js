/**
 * Git utility functions for Monarco IDE
 * Adapted from Void/VSCode extensions/git/src/util.ts
 * 
 * Critical: provides workspace boundary validation to prevent
 * git from reading files outside the workspace.
 */

import path from 'node:path'

export const isWindows = process.platform === 'win32'
export const isMacintosh = process.platform === 'darwin'
export const isLinux = process.platform === 'linux'

/**
 * Normalize a path for case-insensitive comparison.
 * Linux is case-sensitive; Windows/macOS are case-insensitive.
 */
function normalizePath(p) {
  if (isWindows || isMacintosh) {
    return p.toLowerCase()
  }
  return p
}

/**
 * Check if `descendant` is inside `parent` (or equal to it).
 * This is the CRITICAL function for workspace boundary enforcement.
 * Mirrors VS Code's isDescendant in extensions/git/src/util.ts.
 */
export function isDescendant(parent, descendant) {
  if (parent === descendant) {
    return true
  }

  if (parent.charAt(parent.length - 1) !== path.sep) {
    parent += path.sep
  }

  return normalizePath(descendant).startsWith(normalizePath(parent))
}

/**
 * Check if two paths are equivalent.
 */
export function pathEquals(a, b) {
  return normalizePath(a) === normalizePath(b)
}

/**
 * Get relative path from `from` to `to`.
 */
export function relativePath(from, to) {
  if (from.charAt(from.length - 1) !== path.sep) {
    from += path.sep
  }

  if (isDescendant(from, to) && from.length < to.length) {
    return to.substring(from.length)
  }

  return path.relative(from, to)
}

/**
 * Check if a file path is inside any of the workspace folders.
 * Returns true if the file is safely inside the workspace.
 */
export function isFileInsideWorkspace(filePath, workspaceFolders) {
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return false
  }

  const resolvedFile = path.resolve(filePath)

  return workspaceFolders.some((root) => {
    const resolvedWorkspace = path.resolve(root)
    const wsWithSep = resolvedWorkspace.endsWith(path.sep)
      ? resolvedWorkspace
      : resolvedWorkspace + path.sep
    return (
      pathEquals(resolvedFile, resolvedWorkspace) ||
      normalizePath(resolvedFile).startsWith(normalizePath(wsWithSep))
    )
  })
}

/**
 * Filter git status files to only include those inside the workspace.
 * This is the KEY function that prevents reading files outside workspace.
 */
export function filterFilesToWorkspace(files, workspaceFolders) {
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return []
  }

  return files.filter((file) => {
    // file.path from git status is relative to repo root
    // We need to check if it's inside any workspace folder
    for (const folder of workspaceFolders) {
      const resolvedFolder = path.resolve(folder)
      const resolvedFile = path.join(resolvedFolder, file.path)
      if (isFileInsideWorkspace(resolvedFile, workspaceFolders)) {
        return true
      }
    }
    return false
  })
}

/**
 * Sanitize a filename for safe file operations.
 */
export function sanitizeFileName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Group array items by a key function.
 */
export function groupBy(arr, fn) {
  return arr.reduce((result, el) => {
    const key = fn(el)
    result[key] = [...(result[key] || []), el]
    return result
  }, Object.create(null))
}

/**
 * Unique filter by key function.
 */
export function uniqueFilter(keyFn) {
  const seen = Object.create(null)
  return (element) => {
    const key = keyFn(element)
    if (seen[key]) {
      return false
    }
    seen[key] = true
    return true
  }
}

/**
 * Disposable interface for cleanup.
 */
export function toDisposable(dispose) {
  return { dispose }
}

export function dispose(disposables) {
  disposables.forEach((d) => d.dispose())
  return []
}
