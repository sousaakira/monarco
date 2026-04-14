<template>
  <div class="git-root">

    <!-- ── Toolbar global ── -->
    <div class="git-toolbar">
      <span class="git-toolbar-title">SOURCE CONTROL</span>
      <div class="git-toolbar-btns">
        <button class="git-tbtn" title="Atualizar todos os repos" :disabled="loading" @click="$emit('refresh')">
          <i class="gi gi-sync" :class="{'gi-spin': loading}"></i>
        </button>
      </div>
    </div>

    <!-- ── Sem workspace ── -->
    <div v-if="!repos || repos.length === 0" class="git-empty">
      <i class="gi gi-branch" style="font-size:28px;opacity:.18;display:block;margin-bottom:10px;"></i>
      <p>Nenhum workspace aberto.</p>
    </div>

    <!-- ── Corpo principal (multi-repo) ── -->
    <template v-else>
      <div class="git-body">

        <!-- Uma seção por repo -->
        <div v-for="repo in repos" :key="repo.path" class="git-repo-section">

          <!-- Cabeçalho do repo (colapsível) -->
          <div class="git-repo-hd" @click="toggleRepo(repo.path)">
            <i class="gi gi-chevron-right git-chevron" :class="{open: isRepoOpen(repo.path)}"></i>
            <span class="git-repo-name">{{ repo.name }}</span>
            <template v-if="repo.isRepo">
              <span class="git-branch-chip">
                <i class="gi gi-branch" style="width:10px;height:10px;margin-right:3px;"></i>{{ repo.branch || '—' }}
              </span>
              <div class="git-group-actions" @click.stop>
                <span v-if="totalChanges(repo) > 0" class="git-badge">{{ totalChanges(repo) }}</span>
                <button class="git-icon-btn" title="Pull" @click="$emit('pull', repo.path)"><i class="gi gi-pull"></i></button>
                <button class="git-icon-btn" title="Push" @click="$emit('push', repo.path)"><i class="gi gi-push"></i></button>
                <button class="git-icon-btn" title="Atualizar" @click="$emit('refresh', repo.path)"><i class="gi gi-sync"></i></button>
              </div>
            </template>
            <template v-else>
              <span class="git-no-repo-tag">não é git</span>
            </template>
          </div>

          <!-- Conteúdo do repo (colapsado) -->
          <div v-if="isRepoOpen(repo.path)">

            <!-- Não é repo git -->
            <div v-if="!repo.isRepo" class="git-not-repo">
              <p>Esta pasta não é um repositório Git.</p>
              <button class="git-action-btn" @click="$emit('initRepo', repo.path)">Inicializar Repositório</button>
            </div>

            <!-- É repo git -->
            <template v-else>

              <!-- Input de mensagem de commit -->
              <div class="git-input-row">
                <textarea
                  :value="repo.commitMessage"
                  @input="$emit('update:repoCommitMessage', repo.path, $event.target.value)"
                  class="git-msg-input"
                  :placeholder="`Mensagem (Ctrl+Enter para commitar)`"
                  rows="2"
                  @keydown.ctrl.enter.prevent="tryCommit(repo)"
                  @keydown.meta.enter.prevent="tryCommit(repo)"
                ></textarea>
              </div>

              <!-- Botões Commit + IA -->
              <div class="git-commit-row">
                <!-- Botão ✨ IA -->
                <button
                  class="git-ai-btn"
                  :class="{ 'git-ai-btn--loading': repo.loadingAI }"
                  :disabled="!stagedOf(repo).length || repo.loadingAI"
                  @click="$emit('generateMessage', repo.path)"
                  title="Gerar mensagem de commit com IA (✨)"
                >
                  <span v-if="repo.loadingAI" class="git-ai-spin">⟳</span>
                  <span v-else>✨</span>
                </button>
                <!-- Commit principal -->
                <button
                  class="git-commit-main"
                  :disabled="!stagedOf(repo).length || !repo.commitMessage?.trim()"
                  @click="tryCommit(repo)"
                >
                  <i class="gi gi-check"></i>
                  <span>Commit</span>
                  <kbd class="git-kbd">Ctrl+Enter</kbd>
                </button>
                <div class="git-commit-sep"></div>
                <button
                  class="git-commit-arrow"
                  :disabled="!stagedOf(repo).length || !repo.commitMessage?.trim()"
                  title="Mais opções"
                >
                  <i class="gi gi-chevron-down"></i>
                </button>
              </div>

              <!-- Staged Changes -->
              <div v-if="stagedOf(repo).length > 0" class="git-group">
                <div class="git-group-hd" @click="toggleSection(repo.path, 'staged')">
                  <i class="gi gi-chevron-right git-chevron" :class="{open: isSectionOpen(repo.path, 'staged')}"></i>
                  <span class="git-group-name">Staged Changes</span>
                  <span class="git-badge">{{ stagedOf(repo).length }}</span>
                  <div class="git-group-actions" @click.stop>
                    <button class="git-icon-btn" title="Remover tudo do stage" @click="$emit('unstageAll', repo.path)">
                      <i class="gi gi-minus"></i>
                    </button>
                  </div>
                </div>
                <div v-show="isSectionOpen(repo.path, 'staged')" class="git-file-list">
                  <div
                    v-for="f in stagedOf(repo)" :key="'s-'+f.path"
                    class="git-file-row"
                    @click="$emit('showDiff', f.path, true, repo.path)"
                  >
                    <div class="git-file-label">
                      <span class="git-file-name">{{ fileName(f.path) }}</span>
                      <span class="git-file-path">{{ fileDir(f.path) }}</span>
                    </div>
                    <span class="git-status" :class="'gs-'+f.status">{{ statusLetter(f.status) }}</span>
                    <div class="git-row-actions">
                      <button class="git-icon-btn" title="Abrir" @click.stop="$emit('openFile', f.path, repo.path)">
                        <i class="gi gi-open"></i>
                      </button>
                      <button class="git-icon-btn" title="Remover stage" @click.stop="$emit('unstage', f.path, repo.path)">
                        <i class="gi gi-minus"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Changes (unstaged) -->
              <div v-if="unstagedOf(repo).length > 0" class="git-group">
                <div class="git-group-hd" @click="toggleSection(repo.path, 'changes')">
                  <i class="gi gi-chevron-right git-chevron" :class="{open: isSectionOpen(repo.path, 'changes')}"></i>
                  <span class="git-group-name">Changes</span>
                  <span class="git-badge">{{ unstagedOf(repo).length }}</span>
                  <div class="git-group-actions" @click.stop>
                    <button class="git-icon-btn" title="Stage All" @click="$emit('stageAll', repo.path)">
                      <i class="gi gi-plus"></i>
                    </button>
                    <button class="git-icon-btn git-icon-btn--danger" title="Discard All" @click="$emit('discardAll', repo.path)">
                      <i class="gi gi-discard"></i>
                    </button>
                  </div>
                </div>
                <div v-show="isSectionOpen(repo.path, 'changes')" class="git-file-list">
                  <div
                    v-for="f in unstagedOf(repo)" :key="'u-'+f.path"
                    class="git-file-row"
                    @click="$emit('showDiff', f.path, false, repo.path)"
                  >
                    <div class="git-file-label">
                      <span class="git-file-name">{{ fileName(f.path) }}</span>
                      <span class="git-file-path">{{ fileDir(f.path) }}</span>
                    </div>
                    <span class="git-status" :class="'gs-'+f.status">{{ statusLetter(f.status) }}</span>
                    <div class="git-row-actions">
                      <button class="git-icon-btn" title="Abrir" @click.stop="$emit('openFile', f.path, repo.path)">
                        <i class="gi gi-open"></i>
                      </button>
                      <button class="git-icon-btn" title="Stage" @click.stop="$emit('stage', f.path, repo.path)">
                        <i class="gi gi-plus"></i>
                      </button>
                      <button class="git-icon-btn git-icon-btn--danger" title="Discard" @click.stop="$emit('discard', f.path, repo.path)">
                        <i class="gi gi-discard"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Sem alterações -->
              <div v-if="!stagedOf(repo).length && !unstagedOf(repo).length" class="git-clean">
                <i class="gi gi-check" style="margin-right:6px;opacity:.4"></i>
                <span>Sem alterações pendentes</span>
              </div>

            </template>
          </div>
        </div>
      </div><!-- /git-body -->

      <!-- ── Sash de redimensionamento ── -->
      <div
        class="git-commits-sash"
        :class="{ dragging }"
        @mousedown.prevent="startResize"
      ></div>

      <!-- ── Histórico de commits (rodapé fixo redimensionável) ── -->
      <div class="git-commits-panel" :style="{ height: commitsOpen ? commitsHeight + 'px' : '22px' }">
        <div class="git-group-hd" @click="toggleCommits">
          <i class="gi gi-chevron-right git-chevron" :class="{open: commitsOpen}"></i>
          <span class="git-group-name">Histórico de Commits</span>
          <div class="git-group-actions" @click.stop>
            <button class="git-icon-btn" :disabled="loadingCommits" title="Atualizar" @click="$emit('refreshCommits', activeRepoPath)">
              <i class="gi gi-sync" :class="{'gi-spin': loadingCommits}"></i>
            </button>
          </div>
        </div>
        <div v-show="commitsOpen" class="git-commits-list">
          <div v-if="loadingCommits && !commits.length" class="git-hint">Carregando...</div>
          <div v-else-if="!commits.length" class="git-hint">Nenhum commit</div>
          <div v-for="c in commits" :key="c.hash" class="git-commit-item">
            <div class="git-commit-meta">
              <code class="git-hash">{{ c.shortHash }}</code>
              <span class="git-cdate">{{ relDate(c.date) }}</span>
            </div>
            <div class="git-commit-subject">{{ c.subject }}</div>
            <div class="git-commit-author">{{ c.author }}</div>
          </div>
          <button v-if="commits.length >= 20" class="git-more-btn" :disabled="loadingCommits" @click="$emit('loadMoreCommits', activeRepoPath)">
            {{ loadingCommits ? 'Carregando...' : 'Carregar mais' }}
          </button>
        </div>
      </div>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  repos:         { type: Array,   default: () => [] },
  loading:       { type: Boolean, default: false },
  commits:       { type: Array,   default: () => [] },
  loadingCommits:{ type: Boolean, default: false },
})

const emit = defineEmits([
  'refresh', 'pull', 'push', 'initRepo',
  'commit', 'stage', 'unstage', 'stageAll', 'unstageAll',
  'discard', 'discardAll',
  'openFile', 'showDiff',
  'update:repoCommitMessage',
  'generateMessage',
  'refreshCommits', 'loadMoreCommits',
])

// ── Estado local de UI ───────────────────────────────────────

// Quais repos estão abertos (colapsado/expandido)
const openRepos = ref(new Set())
// Quais sub-seções estão abertas: 'path:staged' ou 'path:changes'
const openSections = ref(new Set())

// Inicializa: abre todos os repos por padrão
function toggleRepo(path) {
  if (openRepos.value.has(path)) {
    openRepos.value.delete(path)
  } else {
    openRepos.value.add(path)
  }
}

function isRepoOpen(path) {
  // Abre automaticamente na primeira vez
  if (!openRepos.value.has(path) && props.repos.length > 0) {
    openRepos.value.add(path)
  }
  return openRepos.value.has(path)
}

function toggleSection(repoPath, section) {
  const key = `${repoPath}:${section}`
  if (openSections.value.has(key)) {
    openSections.value.delete(key)
  } else {
    openSections.value.add(key)
  }
}

function isSectionOpen(repoPath, section) {
  const key = `${repoPath}:${section}`
  return openSections.value.has(key)
}

// Inicializa seções como abertas quando repos mudam
watch(() => props.repos, (newRepos) => {
  if (!newRepos || newRepos.length === 0) return
  for (const repo of newRepos) {
    // Abre staged
    const stagedKey = `${repo.path}:staged`
    if (!openSections.value.has(stagedKey)) {
      openSections.value.add(stagedKey)
    }
    // Abre changes
    const changesKey = `${repo.path}:changes`
    if (!openSections.value.has(changesKey)) {
      openSections.value.add(changesKey)
    }
  }
}, { immediate: true, deep: true })

// Commits panel
const commitsOpen   = ref(false)
const commitsHeight = ref(200)
const dragging      = ref(false)
let _startY = 0, _startH = 0

const activeRepoPath = computed(() => props.repos[0]?.path ?? null)

function startResize(e) {
  if (!commitsOpen.value) {
    commitsOpen.value = true
    emit('refreshCommits', activeRepoPath.value)
  }
  dragging.value = true
  _startY = e.clientY
  _startH = commitsHeight.value
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
}

function onResize(e) {
  const delta = _startY - e.clientY
  commitsHeight.value = Math.max(60, Math.min(700, _startH + delta))
}

function stopResize() {
  dragging.value = false
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
}

function toggleCommits() {
  commitsOpen.value = !commitsOpen.value
  if (commitsOpen.value && !props.commits.length) {
    emit('refreshCommits', activeRepoPath.value)
  }
}

// ── Helpers ──────────────────────────────────────────────────

function stagedOf(repo) {
  return repo.files?.filter(f => f.staged) ?? []
}

function unstagedOf(repo) {
  return repo.files?.filter(f => f.unstaged && !f.staged) ?? []
}

function totalChanges(repo) {
  return (repo.files?.length ?? 0)
}

function tryCommit(repo) {
  if (!stagedOf(repo).length || !repo.commitMessage?.trim()) return
  emit('commit', repo.path)
}

function statusLetter(s) {
  return { modified:'M', added:'A', deleted:'D', renamed:'R', untracked:'U', conflict:'C' }[s] ?? '?'
}

function fileName(p) { return p.split('/').pop() }
function fileDir(p) {
  const parts = p.split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') : ''
}

function relDate(d) {
  if (!d) return ''
  const dt = new Date(d), now = new Date(), diff = now - dt
  if (isNaN(dt)) return d
  if (diff < 60000)     return 'agora'
  if (diff < 3600000)   return `${Math.floor(diff/60000)}min`
  if (diff < 86400000)  return `${Math.floor(diff/3600000)}h`
  if (diff < 604800000) return `${Math.floor(diff/86400000)}d`
  return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })
}
</script>

<style scoped>
/* ── Layout raiz ─────────────────────────────────────────── */
.git-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  font-size: 13px;
  color: var(--text, #ccc);
  background: var(--panel, #1e1e1e);
  user-select: none;
}

.git-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.git-commits-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid var(--border, #3c3c3c);
  transition: height 0s;
}

.git-commits-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* ── Sash ────────────────────────────────────────────────── */
.git-commits-sash {
  height: 5px;
  flex-shrink: 0;
  cursor: ns-resize;
  background: transparent;
  position: relative;
  z-index: 1;
}

.git-commits-sash::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 1px;
  background: var(--border, #3c3c3c);
  transition: background .15s, height .15s;
}

.git-commits-sash:hover::after,
.git-commits-sash.dragging::after {
  height: 2px;
  background: var(--accent, #007acc);
}

.git-commits-sash:hover,
.git-commits-sash.dragging {
  background: rgba(0,122,204,.07);
}

/* ── Icons ───────────────────────────────────────────────── */
.gi {
  display: inline-block;
  width: 14px; height: 14px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: invert(.75);
  flex-shrink: 0;
  vertical-align: middle;
}
.gi-pull    { background-image: url('../assets/fonts/solid/cloud-arrow-down.svg'); }
.gi-push    { background-image: url('../assets/fonts/solid/cloud-arrow-up.svg'); }
.gi-sync    { background-image: url('../assets/fonts/solid/arrows-rotate.svg'); }
.gi-more    { background-image: url('../assets/fonts/solid/ellipsis.svg'); }
.gi-check   { background-image: url('../assets/fonts/solid/check.svg'); }
.gi-plus    { background-image: url('../assets/fonts/solid/plus.svg'); }
.gi-minus   { background-image: url('../assets/fonts/solid/minus.svg'); }
.gi-open    { background-image: url('../assets/fonts/solid/arrow-up-right-from-square.svg'); }
.gi-discard { background-image: url('../assets/fonts/solid/rotate-left.svg'); }
.gi-branch  { background-image: url('../assets/fonts/solid/code-branch.svg'); }
.gi-chevron-right { background-image: url('../assets/fonts/solid/chevron-right.svg'); }
.gi-chevron-down  { background-image: url('../assets/fonts/solid/chevron-down.svg'); }

@keyframes gi-spin-anim { to { transform: rotate(360deg); } }
.gi-spin { animation: gi-spin-anim 1s linear infinite; }

/* ── Toolbar ─────────────────────────────────────────────── */
.git-toolbar {
  display: flex;
  align-items: center;
  padding: 0 8px 0 12px;
  height: 35px;
  border-bottom: 1px solid var(--border, #3c3c3c);
  flex-shrink: 0;
}
.git-toolbar-title {
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  color: var(--muted, #888); flex: 1;
}
.git-toolbar-btns { display: flex; gap: 1px; }
.git-tbtn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: none;
  background: transparent; border-radius: 4px; cursor: pointer;
  transition: background .1s;
}
.git-tbtn:hover    { background: var(--hover, rgba(255,255,255,.08)); }
.git-tbtn:disabled { opacity: .35; cursor: default; }

/* ── Repo section ────────────────────────────────────────── */
.git-repo-section {
  border-bottom: 1px solid var(--border, rgba(255,255,255,.05));
}

.git-repo-hd {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px 0 4px;
  cursor: pointer;
  background: var(--panel-darker, rgba(0,0,0,.2));
  border-bottom: 1px solid var(--border, #3c3c3c);
}
.git-repo-hd:hover { background: var(--list-hover, rgba(255,255,255,.05)); }

.git-repo-name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .06em;
  color: var(--text, #ccc);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.git-branch-chip {
  display: flex;
  align-items: center;
  font-size: 10px;
  color: var(--muted, #888);
  background: var(--badge-bg, rgba(255,255,255,.08));
  padding: 1px 6px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.git-no-repo-tag {
  font-size: 10px;
  color: var(--muted, #666);
  font-style: italic;
}

.git-not-repo {
  padding: 16px;
  text-align: center;
  color: var(--muted, #888);
  font-size: 12px;
}
.git-not-repo p { margin: 0 0 10px; }

/* ── Input ───────────────────────────────────────────────── */
.git-input-row { padding: 8px 8px 4px; }
.git-msg-input {
  width: 100%; box-sizing: border-box;
  background: var(--input-bg, #2d2d2d);
  border: 1px solid var(--border, #444);
  border-radius: 4px;
  color: var(--text, #ccc);
  font-size: 13px; font-family: inherit;
  padding: 6px 8px; resize: vertical;
  min-height: 48px; outline: none; line-height: 1.4;
}
.git-msg-input:focus { border-color: var(--accent, #007acc); }

/* ── Commit row ──────────────────────────────────────────── */
.git-commit-row {
  display: flex; align-items: stretch;
  margin: 0 8px 8px;
  border-radius: 4px; overflow: hidden;
  gap: 1px;
}

/* ✨ Botão IA */
.git-ai-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; flex-shrink: 0;
  background: var(--input-bg, #2d2d2d);
  border: 1px solid var(--border, #444);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background .12s, border-color .12s;
}
.git-ai-btn:hover:not(:disabled) {
  background: rgba(255, 215, 0, .12);
  border-color: rgba(255, 215, 0, .4);
}
.git-ai-btn:disabled { opacity: .35; cursor: default; }
.git-ai-btn--loading { animation: ai-pulse 1s ease-in-out infinite; }
@keyframes ai-pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
.git-ai-spin { font-size: 16px; display: inline-block; animation: gi-spin-anim 1s linear infinite; }

.git-commit-main {
  flex: 1; display: flex; align-items: center;
  justify-content: center; gap: 6px;
  padding: 7px 10px;
  background: var(--accent, #007acc); color: #fff;
  border: none; font-size: 13px; font-family: inherit;
  font-weight: 500; cursor: pointer; transition: background .12s;
}
.git-commit-main:hover:not(:disabled) { background: #0089e0; }
.git-commit-main:disabled { opacity: .4; cursor: default; }
.git-kbd {
  font-size: 10px; font-family: inherit;
  background: rgba(255,255,255,.15);
  border-radius: 3px; padding: 1px 5px; letter-spacing: .02em;
}
.git-commit-sep  { width: 1px; background: rgba(255,255,255,.2); flex-shrink: 0; }
.git-commit-arrow {
  display: flex; align-items: center; justify-content: center;
  width: 28px; background: var(--accent, #007acc); color: #fff;
  border: none; cursor: pointer; transition: background .12s; flex-shrink: 0;
}
.git-commit-arrow:hover:not(:disabled) { background: #0089e0; }
.git-commit-arrow:disabled { opacity: .4; cursor: default; }
.git-commit-arrow .gi { width: 11px; height: 11px; filter: invert(1); }

/* ── Groups ──────────────────────────────────────────────── */
.git-group { flex-shrink: 0; }
.git-group-hd {
  display: flex; align-items: center; gap: 3px;
  height: 22px; padding: 0 8px 0 4px; cursor: pointer;
}
.git-group-hd:hover { background: var(--list-hover, rgba(255,255,255,.05)); }

.git-chevron {
  width: 12px; height: 12px; transition: transform .13s ease; flex-shrink: 0;
}
.git-chevron.open { transform: rotate(90deg); }

.git-group-name {
  font-size: 11px; font-weight: 600; letter-spacing: .05em;
  color: var(--text, #ccc); flex: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.git-badge {
  font-size: 10px; min-width: 16px; padding: 0 5px;
  height: 16px; line-height: 16px; text-align: center;
  border-radius: 8px;
  background: var(--badge-bg, rgba(255,255,255,.15));
  color: var(--badge-fg, #fff); flex-shrink: 0;
}
.git-group-actions {
  display: flex; gap: 1px; align-items: center;
  opacity: 0; transition: opacity .1s; flex-shrink: 0;
}
.git-group-hd:hover .git-group-actions,
.git-repo-hd:hover .git-group-actions { opacity: 1; }

/* ── Icon buttons ────────────────────────────────────────── */
.git-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none;
  background: transparent; border-radius: 3px; cursor: pointer;
  transition: background .08s;
}
.git-icon-btn:hover { background: rgba(255,255,255,.1); }
.git-icon-btn .gi  { width: 12px; height: 12px; }
.git-icon-btn--danger:hover { background: rgba(241,76,76,.15); }
.git-icon-btn--danger .gi   { filter: invert(.5) sepia(1) saturate(4) hue-rotate(310deg); }

/* ── File rows ───────────────────────────────────────────── */
.git-file-list { padding: 0; }
.git-file-row {
  display: flex; align-items: center; gap: 4px;
  height: 22px; padding: 0 6px 0 22px;
  cursor: pointer; transition: background .07s;
}
.git-file-row:hover { background: var(--list-hover, rgba(255,255,255,.06)); }
.git-file-label {
  flex: 1; display: flex; align-items: baseline; gap: 5px;
  overflow: hidden; min-width: 0;
}
.git-file-name {
  font-size: 13px; color: var(--text, #ccc);
  white-space: nowrap; flex-shrink: 0;
  max-width: 140px; overflow: hidden; text-overflow: ellipsis;
}
.git-file-path {
  font-size: 11px; color: var(--muted, #888);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1; min-width: 0;
}
.git-status {
  font-size: 11px; font-weight: 700;
  width: 13px; text-align: center; flex-shrink: 0;
}
.gs-modified  { color: #e2c08d; }
.gs-added     { color: #73c991; }
.gs-deleted   { color: #f14c4c; }
.gs-renamed   { color: #73c991; }
.gs-untracked { color: #73c991; }
.gs-conflict  { color: #e55;    }

.git-row-actions {
  display: flex; gap: 1px;
  opacity: 0; flex-shrink: 0; transition: opacity .08s;
}
.git-file-row:hover .git-row-actions { opacity: 1; }

/* ── Commits list ────────────────────────────────────────── */
.git-commit-item {
  padding: 5px 10px 5px 22px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,.04));
  transition: background .07s;
}
.git-commit-item:hover { background: var(--list-hover, rgba(255,255,255,.04)); }
.git-commit-meta {
  display: flex; align-items: center;
  gap: 6px; margin-bottom: 2px;
}
.git-hash {
  font-family: ui-monospace, monospace; font-size: 10px;
  color: var(--accent, #4db5ff);
  background: rgba(77,181,255,.1);
  padding: 1px 5px; border-radius: 3px;
}
.git-cdate   { font-size: 10px; color: var(--muted, #888); }
.git-commit-subject {
  font-size: 12px; color: var(--text, #ccc);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.git-commit-author { font-size: 10px; color: var(--muted, #888); margin-top: 1px; }
.git-hint { padding: 8px 22px; font-size: 11px; color: var(--muted, #888); }

.git-more-btn {
  width: 100%; padding: 6px;
  background: transparent; border: none;
  border-top: 1px solid var(--border, #3c3c3c);
  color: var(--muted, #888); font-size: 11px; cursor: pointer;
  transition: background .1s;
}
.git-more-btn:hover:not(:disabled) { background: rgba(255,255,255,.04); color: var(--text,#ccc); }
.git-more-btn:disabled { opacity: .4; }

/* ── Empty states ────────────────────────────────────────── */
.git-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 28px 16px; text-align: center;
  color: var(--muted, #888); font-size: 12px;
}
.git-empty p { margin: 0 0 12px; }
.git-clean {
  display: flex; align-items: center;
  padding: 8px 12px; font-size: 12px; color: var(--muted, #888);
}
.git-action-btn {
  padding: 6px 16px; background: var(--accent, #007acc);
  color: #fff; border: none; border-radius: 4px;
  font-size: 12px; cursor: pointer; transition: background .15s;
}
.git-action-btn:hover { background: #0089e0; }
</style>
