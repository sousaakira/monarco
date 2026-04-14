/**
 * Model class for Monarco IDE Git module
 * Adapted from Void/VSCode extensions/git/src/model.ts
 * 
 * Manages multiple repositories within the workspace.
 * Discovers, tracks, and provides access to all git repos.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { Git, Repository } from './git.js'
import { isDescendant, isFileInsideWorkspace } from './util.js'

/**
 * Model class - manages all repositories in workspace.
 * Mirrors Void's Model class in extensions/git/src/model.ts.
 */
export class GitModel {
  constructor() {
    this.git = new Git()
    this.repositories = new Map() // path -> Repository
    this.workspaceFolders = []
    this._onDidChange = null // Event emitter placeholder
  }

  /**
   * Set workspace folders and discover repositories.
   */
  async setWorkspaceFolders(folders) {
    this.workspaceFolders = folders || []
    await this.discoverRepositories()
  }

  /**
   * Discover all git repositories in workspace folders.
   * Only searches within workspace boundaries (depth 2 like VS Code).
   */
  async discoverRepositories() {
    const newRepos = new Map()

    for (const folder of this.workspaceFolders) {
      const repos = await this.findReposInFolder(folder, 0, 2)
      for (const repo of repos) {
        newRepos.set(repo.rootPath, repo)
      }
    }

    // Close removed repositories
    for (const [oldPath, oldRepo] of this.repositories) {
      if (!newRepos.has(oldPath)) {
        // Repository was removed from workspace
        oldRepo.files = []
      }
    }

    this.repositories = newRepos
    return newRepos
  }

  /**
   * Find all git repositories in a folder (up to maxDepth).
   * CRITICAL: Only returns repos that are INSIDE workspace folders.
   */
  async findReposInFolder(folderPath, currentDepth, maxDepth) {
    const repos = []

    // Check if this folder itself is a git root
    if (await this.isGitRoot(folderPath)) {
      // CRITICAL: Validate that repo is inside workspace
      const isInsideWorkspace = this.workspaceFolders.some(
        (workspaceFolder) => isDescendant(path.resolve(workspaceFolder), path.resolve(folderPath)) ||
          path.resolve(workspaceFolder) === path.resolve(folderPath)
      )

      if (isInsideWorkspace) {
        const repo = new Repository(this.git, folderPath, this.workspaceFolders)
        try {
          await repo.refresh()
          repos.push(repo)
        } catch {
          // Failed to refresh, but it's still a repo
          repo.isRepo = true
          repos.push(repo)
        }
      }
      // Return immediately - this folder is a git root, don't search deeper
      return repos
    }

    // If we haven't reached max depth, search subdirectories
    if (currentDepth < maxDepth) {
      try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true })
        const subdirs = entries.filter(
          (e) => e.isDirectory() && !e.name.startsWith('.')
        )

        const subRepos = await Promise.all(
          subdirs.map(async (entry) => {
            const subPath = path.join(folderPath, entry.name)
            return this.findReposInFolder(subPath, currentDepth + 1, maxDepth)
          })
        )

        for (const subRepoList of subRepos) {
          repos.push(...subRepoList)
        }
      } catch {
        // Ignore permission errors, etc.
      }
    }

    return repos
  }

  /**
   * Check if a folder is a git root (has .git inside it).
   */
  async isGitRoot(folderPath) {
    try {
      const gitDir = path.join(folderPath, '.git')
      const stat = await fs.stat(gitDir)
      return stat.isDirectory() || stat.isFile() // .git can be a file (worktrees/submodules)
    } catch {
      return false
    }
  }

  /**
   * Get repository by path.
   */
  getRepository(repoPath) {
    if (!repoPath) return null

    const resolvedPath = path.resolve(repoPath)

    // Check for exact match
    if (this.repositories.has(resolvedPath)) {
      return this.repositories.get(resolvedPath)
    }

    // Check if path is inside any known repository
    for (const [repoRootPath, repo] of this.repositories) {
      if (isDescendant(repoRootPath, resolvedPath)) {
        return repo
      }
    }

    return null
  }

  /**
   * Get all repositories.
   */
  getAllRepositories() {
    return Array.from(this.repositories.values())
  }

  /**
   * Get repository state for UI (multi-repo view).
   */
  async getRepositoryStates() {
    const states = []

    for (const [repoPath, repo] of this.repositories) {
      states.push({
        path: repo.rootPath,
        name: repo.name,
        branch: repo.branch,
        files: repo.files,
        isRepo: repo.isRepo,
        commitMessage: '',
        loadingAI: false
      })
    }

    // If no repos found but we have workspace folders, return placeholder
    if (states.length === 0 && this.workspaceFolders.length > 0) {
      for (const folder of this.workspaceFolders) {
        states.push({
          path: folder,
          name: path.basename(folder),
          branch: '',
          files: [],
          isRepo: false,
          commitMessage: '',
          loadingAI: false
        })
      }
    }

    return states
  }

  /**
   * Check if a path is inside the workspace.
   */
  isPathInsideWorkspace(filePath) {
    return isFileInsideWorkspace(filePath, this.workspaceFolders)
  }

  /**
   * Refresh all repositories.
   */
  async refreshAll() {
    const refreshes = []

    for (const [repoPath, repo] of this.repositories) {
      refreshes.push(repo.refresh())
    }

    await Promise.allSettled(refreshes)
  }

  /**
   * Refresh a single repository.
   */
  async refreshRepo(repoPath) {
    const repo = this.getRepository(repoPath)
    if (repo) {
      return await repo.refresh()
    }
    return null
  }
}
