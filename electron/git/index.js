/**
 * Git module entry point for Monarco IDE
 * 
 * Exports the Git module classes and utilities.
 */

export { Git, Repository, parseGitStatus, parseStatusOutput, getStatusLetter, GitError, GitErrorCodes } from './git.js'
export { GitModel } from './model.js'
export {
  isDescendant,
  pathEquals,
  relativePath,
  isFileInsideWorkspace,
  filterFilesToWorkspace,
  sanitizeFileName
} from './util.js'
