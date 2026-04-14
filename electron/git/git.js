/**
 * Core Git class for Monarco IDE
 * Adapted from Void/VSCode extensions/git/src/git.ts
 * 
 * Wraps the git CLI binary and provides methods for all git operations.
 * All operations respect workspace boundaries through path validation.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { isDescendant, pathEquals, filterFilesToWorkspace } from './util.js'

const execAsync = promisify(exec)

// Git error codes for better error handling
export const GitErrorCodes = {
  RepositoryIsLocked: 'RepositoryIsLocked',
  AuthenticationFailed: 'AuthenticationFailed',
  NotAGitRepository: 'NotAGitRepository',
  BadConfigFile: 'BadConfigFile',
  RepositoryNotFound: 'RepositoryNotFound',
  CantAccessRemote: 'CantAccessRemote',
  BranchNotFullyMerged: 'BranchNotFullyMerged',
  NoRemoteReference: 'NoRemoteReference',
  BranchAlreadyExists: 'BranchAlreadyExists',
  InvalidBranchName: 'InvalidBranchName',
  DirtyWorkTree: 'DirtyWorkTree'
}

/**
 * Git error class with additional context.
 */
export class GitError extends Error {
  constructor(data = {}) {
    super(data.message || 'Git error')
    this.name = 'GitError'
    this.error = data.error
    this.stdout = data.stdout
    this.stderr = data.stderr
    this.exitCode = data.exitCode
    this.gitErrorCode = data.gitErrorCode
    this.gitCommand = data.gitCommand
    this.gitArgs = data.gitArgs
  }
}

/**
 * Parse git status output into structured format.
 */
export function parseGitStatus(status) {
  const X = status[0]
  const Y = status[1]

  if (X === '?' && Y === '?') return 'untracked'
  if (X === 'A') return 'added'
  if (X === 'M' || Y === 'M') return 'modified'
  if (X === 'D' || Y === 'D') return 'deleted'
  if (X === 'R') return 'renamed'
  if (X === 'C') return 'copied'
  if (X === 'U' || Y === 'U') return 'conflict'
  return 'unknown'
}

/**
 * Get status letter for display.
 */
export function getStatusLetter(status) {
  return {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    renamed: 'R',
    untracked: 'U',
    conflict: 'C'
  }[status] || '?'
}

/**
 * Parse porcelain status output into file array.
 */
export function parseStatusOutput(stdout) {
  const files = []
  for (const line of stdout.trim().split('\n').filter(Boolean)) {
    const status = line.substring(0, 2)
    const filePath = line.substring(3)
    const parsedStatus = parseGitStatus(status)
    const X = status[0]
    const Y = status[1]
    files.push({
      path: filePath,
      status: parsedStatus,
      staged: X !== ' ' && X !== '?',
      unstaged: Y !== ' ' || parsedStatus === 'untracked'
    })
  }
  return files
}

/**
 * Core Git class - wraps git CLI.
 * Mirrors Void's Git class in extensions/git/src/git.ts.
 */
export class Git {
  constructor() {
    this.path = 'git'
    this.version = null
  }

  /**
   * Get git version.
   */
  async getVersion() {
    if (this.version) return this.version
    try {
      const { stdout } = await execAsync('git --version')
      this.version = stdout.replace(/^git version /, '').trim()
      return this.version
    } catch (e) {
      throw new GitError({
        message: 'Git not found. Please install git and add it to PATH.',
        gitErrorCode: GitErrorCodes.NotAGitRepository
      })
    }
  }

  /**
   * Execute a git command.
   */
  async exec(cwd, args, options = {}) {
    // Properly quote arguments for shell execution
    const quotedArgs = args.map((arg) => {
      // Quote arguments that contain spaces
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
        // Escape internal quotes and wrap in quotes
        return `"${arg.replace(/"/g, '\\"')}"`
      }
      return arg
    })
    const cmd = `git ${quotedArgs.join(' ')}`
    try {
      const result = await execAsync(cmd, {
        cwd,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        ...options
      })
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0
      }
    } catch (e) {
      const errorCode = this.getGitErrorCode(e.stderr || '')
      throw new GitError({
        message: e.message || 'Git command failed',
        stdout: e.stdout,
        stderr: e.stderr,
        exitCode: e.code,
        gitErrorCode: errorCode,
        gitCommand: args[0],
        gitArgs: args
      })
    }
  }

  /**
   * Parse git error code from stderr.
   */
  getGitErrorCode(stderr) {
    if (/Another git process seems to be running/.test(stderr)) {
      return GitErrorCodes.RepositoryIsLocked
    }
    if (/Authentication failed/i.test(stderr)) {
      return GitErrorCodes.AuthenticationFailed
    }
    if (/Not a git repository/i.test(stderr)) {
      return GitErrorCodes.NotAGitRepository
    }
    if (/bad config file/.test(stderr)) {
      return GitErrorCodes.BadConfigFile
    }
    if (/Repository not found/.test(stderr)) {
      return GitErrorCodes.RepositoryNotFound
    }
    if (/unable to access/.test(stderr)) {
      return GitErrorCodes.CantAccessRemote
    }
    if (/branch '.+' is not fully merged/.test(stderr)) {
      return GitErrorCodes.BranchNotFullyMerged
    }
    if (/Couldn't find remote ref/.test(stderr)) {
      return GitErrorCodes.NoRemoteReference
    }
    if (/A branch named '.+' already exists/.test(stderr)) {
      return GitErrorCodes.BranchAlreadyExists
    }
    if (/'.+' is not a valid branch name/.test(stderr)) {
      return GitErrorCodes.InvalidBranchName
    }
    if (/Please,? commit your changes or stash them/.test(stderr)) {
      return GitErrorCodes.DirtyWorkTree
    }
    return undefined
  }

  /**
   * Check if path is a git repository.
   */
  async isRepository(repoPath) {
    try {
      await this.exec(repoPath, ['rev-parse', '--git-dir'])
      return true
    } catch {
      return false
    }
  }

  /**
   * Get repository root from a path inside it.
   */
  async getRepositoryRoot(pathInsideRepo) {
    try {
      const result = await this.exec(pathInsideRepo, ['rev-parse', '--show-toplevel'])
      return path.normalize(result.stdout.trim().replace(/[\r\n]+$/, ''))
    } catch (e) {
      throw new GitError({
        message: `Not a git repository: ${pathInsideRepo}`,
        gitErrorCode: GitErrorCodes.NotAGitRepository
      })
    }
  }

  /**
   * Get git status for a repository.
   * IMPORTANT: filters files to workspace boundary.
   */
  async getStatus(repoPath, workspaceFolders) {
    const result = await this.exec(repoPath, ['status', '--porcelain'])
    const allFiles = parseStatusOutput(result.stdout)

    // CRITICAL: filter files to only include those inside workspace
    if (workspaceFolders && workspaceFolders.length > 0) {
      return filterFilesToWorkspace(allFiles, workspaceFolders)
    }

    return allFiles
  }

  /**
   * Get current branch name.
   */
  async getCurrentBranch(repoPath) {
    try {
      const result = await this.exec(repoPath, ['branch', '--show-current'])
      return result.stdout.trim() || 'HEAD'
    } catch {
      return 'HEAD'
    }
  }

  /**
   * Stage a file.
   */
  async stage(repoPath, filePath) {
    await this.exec(repoPath, ['add', '--', filePath])
  }

  /**
   * Stage all files.
   */
  async stageAll(repoPath) {
    await this.exec(repoPath, ['add', '-A'])
  }

  /**
   * Unstage a file.
   */
  async unstage(repoPath, filePath) {
    await this.exec(repoPath, ['reset', 'HEAD', '--', filePath])
  }

  /**
   * Unstage all files.
   */
  async unstageAll(repoPath) {
    await this.exec(repoPath, ['reset'])
  }

  /**
   * Discard changes in a file.
   */
  async discard(repoPath, filePath) {
    await this.exec(repoPath, ['checkout', '--', filePath])
  }

  /**
   * Discard all changes.
   */
  async discardAll(repoPath) {
    await this.exec(repoPath, ['checkout', '--', '.'])
  }

  /**
   * Commit staged changes.
   */
  async commit(repoPath, message) {
    // Check if git is configured
    try {
      await this.exec(repoPath, ['config', 'user.name'])
      await this.exec(repoPath, ['config', 'user.email'])
    } catch {
      throw new GitError({
        message: 'Git not configured. Please run:\n  git config --global user.name "Your Name"\n  git config --global user.email "your@email.com"'
      })
    }

    // Check if there are staged files
    const statusResult = await this.exec(repoPath, ['status', '--porcelain'])
    const hasStaged = statusResult.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .some((line) => {
        const X = line[0]
        return X !== ' ' && X !== '?'
      })

    if (!hasStaged) {
      throw new GitError({
        message: 'No staged files. Please stage files before committing.'
      })
    }

    await this.exec(repoPath, ['commit', '-m', message])
  }

  /**
   * Pull from remote.
   */
  async pull(repoPath) {
    const result = await this.exec(repoPath, ['pull'])
    return { success: true, message: result.stdout || result.stderr }
  }

  /**
   * Push to remote.
   */
  async push(repoPath) {
    const result = await this.exec(repoPath, ['push'])
    return { success: true, message: result.stdout || result.stderr }
  }

  /**
   * Fetch from remote.
   */
  async fetch(repoPath) {
    const result = await this.exec(repoPath, ['fetch'])
    return { success: true, message: result.stdout || result.stderr }
  }

  /**
   * List all branches.
   */
  async getBranches(repoPath) {
    const result = await this.exec(repoPath, ['branch', '-a'])
    return result.stdout
      .trim()
      .split('\n')
      .map((line) => {
        const isCurrent = line.startsWith('*')
        const name = line.replace(/^\*?\s+/, '').trim()
        const isRemote = name.startsWith('remotes/')
        return {
          name: name.replace('remotes/', ''),
          current: isCurrent,
          remote: isRemote
        }
      })
      .filter((b) => b.name && b.name !== 'HEAD')
  }

  /**
   * Create a new branch.
   */
  async createBranch(repoPath, branchName) {
    await this.exec(repoPath, ['branch', branchName])
  }

  /**
   * Checkout a branch.
   */
  async checkout(repoPath, branchName) {
    await this.exec(repoPath, ['checkout', branchName])
  }

  /**
   * Delete a branch.
   */
  async deleteBranch(repoPath, branchName) {
    await this.exec(repoPath, ['branch', '-d', branchName])
  }

  /**
   * Get commit log.
   */
  async getLog(repoPath, options = {}) {
    const limit = options.limit || 50
    const skip = options.skip || 0
    const format = '%H|%an|%ae|%ai|%s'
    const result = await this.exec(repoPath, [
      'log',
      `--format=${format}`,
      `--max-count=${limit}`,
      `--skip=${skip}`
    ])

    if (!result.stdout.trim()) return []

    return result.stdout
      .trim()
      .split('\n')
      .map((line) => {
        const [hash, author, email, date, subject] = line.split('|')
        return {
          hash: hash.trim(),
          shortHash: hash.trim().substring(0, 7),
          author: author.trim(),
          email: email.trim(),
          date: date.trim(),
          subject: subject.trim()
        }
      })
  }

  /**
   * Get diff for a file.
   */
  async getDiff(repoPath, filePath, staged = false) {
    const flag = staged ? '--cached' : ''
    const result = await this.exec(repoPath, ['diff', flag, '--', filePath])
    return result.stdout.trim() || null
  }

  /**
   * Initialize a git repository.
   */
  async init(repoPath) {
    await this.exec(repoPath, ['init'])
  }

  /**
   * Get git diff between two commits.
   */
  async getDiffBetweenCommits(repoPath, commit1, commit2) {
    const result = await this.exec(repoPath, ['diff', `${commit1}..${commit2}`])
    return result.stdout
  }

  /**
   * Get staged files count.
   */
  async getStagedFilesCount(repoPath) {
    const result = await this.exec(repoPath, ['diff', '--cached', '--name-only'])
    return result.stdout.trim().split('\n').filter(Boolean).length
  }

  /**
   * Get git configuration.
   */
  async getConfig(repoPath, key) {
    try {
      const result = await this.exec(repoPath, ['config', key])
      return result.stdout.trim()
    } catch {
      return null
    }
  }

  /**
   * Set git configuration.
   */
  async setConfig(repoPath, key, value) {
    await this.exec(repoPath, ['config', key, value])
  }

  /**
   * Get diff stat for staged files.
   */
  async getDiffStat(repoPath) {
    try {
      const result = await this.exec(repoPath, ['diff', '--stat', '--staged'])
      return result.stdout.trim()
    } catch {
      return ''
    }
  }

  /**
   * Get staged file names.
   */
  async getStagedFileNames(repoPath) {
    try {
      const result = await this.exec(repoPath, ['diff', '--staged', '--name-only'])
      return result.stdout.trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }
}

/**
 * Repository class - represents a single git repository.
 * Mirrors Void's Repository class in extensions/git/src/repository.ts.
 */
export class Repository {
  constructor(git, rootPath, workspaceFolders) {
    this.git = git
    this.rootPath = rootPath
    this.workspaceFolders = workspaceFolders
    this.name = path.basename(rootPath)
    this.branch = null
    this.files = []
    this.isRepo = true
  }

  /**
   * Refresh repository state (status + branch).
   */
  async refresh() {
    const [status, branch] = await Promise.all([
      this.git.getStatus(this.rootPath, this.workspaceFolders),
      this.git.getCurrentBranch(this.rootPath)
    ])

    this.files = status
    this.branch = branch
    return { files: this.files, branch: this.branch }
  }

  /**
   * Check if file is inside this repository.
   */
  isFileInRepo(filePath) {
    // If filePath is relative (not absolute), join it with repo root first
    const resolvedFile = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(this.rootPath, filePath)
    const resolvedRoot = path.resolve(this.rootPath)
    return isDescendant(resolvedRoot, resolvedFile) || pathEquals(resolvedRoot, resolvedFile)
  }

  /**
   * Stage a file (validates workspace boundary first).
   */
  async stageFile(filePath) {
    if (!this.isFileInRepo(filePath)) {
      throw new Error(`File ${filePath} is outside repository at ${this.rootPath}`)
    }
    await this.git.stage(this.rootPath, filePath)
  }

  /**
   * Get staged files.
   */
  getStagedFiles() {
    return this.files.filter((f) => f.staged)
  }

  /**
   * Get unstaged files.
   */
  getUnstagedFiles() {
    return this.files.filter((f) => f.unstaged && !f.staged)
  }

  /**
   * Get total changes count.
   */
  getChangesCount() {
    return this.files.length
  }
}
