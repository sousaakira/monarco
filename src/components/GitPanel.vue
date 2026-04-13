<template>
  <div class="git-root">

    <!-- Toolbar topo -->
    <div class="git-toolbar">
      <span class="git-toolbar-title">SOURCE CONTROL</span>
      <div class="git-toolbar-btns">
        <button class="git-tbtn" title="Pull" :disabled="loading" @click="$emit('pull')">
          <i class="gi gi-pull"></i>
        </button>
        <button class="git-tbtn" title="Push" :disabled="loading" @click="$emit('push')">
          <i class="gi gi-push"></i>
        </button>
        <button class="git-tbtn" title="Sincronizar" :disabled="loading" @click="$emit('refresh')" :class="{ 'gi-spin': loading }">
          <i class="gi gi-sync" :class="{ 'gi-spin': loading }"></i>
        </button>
        <button class="git-tbtn" title="Mais ações">
          <i class="gi gi-more"></i>
        </button>
      </div>
    </div>

    <!-- Sem repositório -->
    <div v-if="!isGitRepo && !loading" class="git-empty">
      <i class="gi gi-branch" style="font-size:28px;opacity:.18;display:block;margin-bottom:10px;"></i>
      <p>Nenhum repositório Git encontrado.</p>
      <button class="git-action-btn" @click="$emit('initRepo')">Inicializar Repositório</button>
    </div>

    <div v-else-if="loading && !stagedFiles.length && !unstagedFiles.length" class="git-empty">
      <i class="gi gi-sync gi-spin" style="font-size:20px;opacity:.3;display:block;margin-bottom:8px;"></i>
      <span style="font-size:11px;opacity:.5">Atualizando...</span>
    </div>

    <template v-else>
      <!-- ── Input de commit ── -->
      <div class="git-input-row">
        <textarea
          :value="commitMessage"
          @input="$emit('update:commitMessage', $event.target.value)"
          class="git-msg-input"
          :placeholder="`Mensagem (Ctrl+Enter para commitar em &quot;${branch}&quot;)`"
          rows="1"
          @keydown.ctrl.enter.prevent="tryCommit"
          @keydown.meta.enter.prevent="tryCommit"
          @input.native="autoGrow"
          ref="msgRef"
        ></textarea>
      </div>

      <!-- ── Botão commit split-style ── -->
      <div class="git-commit-row">
        <button
          class="git-commit-main"
          :disabled="!stagedFiles.length || !commitMessage.trim()"
          @click="tryCommit"
        >
          <i class="gi gi-check"></i>
          <span>Commit</span>
          <kbd class="git-kbd">Ctrl+Enter</kbd>
        </button>
        <div class="git-commit-sep"></div>
        <button class="git-commit-arrow" :disabled="!stagedFiles.length || !commitMessage.trim()" title="Mais opções de commit">
          <i class="gi gi-chevron-down"></i>
        </button>
      </div>

      <!-- ── Staged Changes ── -->
      <div v-if="stagedFiles.length > 0" class="git-group">
        <div class="git-group-hd" @click="stagedOpen = !stagedOpen">
          <i class="gi gi-chevron-right git-chevron" :class="{ open: stagedOpen }"></i>
          <span class="git-group-name">Staged Changes</span>
          <span class="git-badge">{{ stagedFiles.length }}</span>
          <div class="git-group-actions" @click.stop>
            <button class="git-icon-btn" title="Remover tudo do stage" @click="$emit('unstageAll')">
              <i class="gi gi-minus"></i>
            </button>
          </div>
        </div>
        <transition name="git-slide">
          <div v-show="stagedOpen" class="git-file-list">
            <div
              v-for="f in stagedFiles"
              :key="'s-'+f.path"
              class="git-file-row"
              @click="$emit('showDiff', f.path, true)"
            >
              <div class="git-file-label">
                <span class="git-file-name">{{ fileName(f.path) }}</span>
                <span class="git-file-path">{{ fileDir(f.path) }}</span>
              </div>
              <span class="git-status" :class="'gs-'+f.status">{{ statusLetter(f.status) }}</span>
              <div class="git-row-actions">
                <button class="git-icon-btn" title="Abrir arquivo" @click.stop="$emit('openFile', f.path)">
                  <i class="gi gi-open"></i>
                </button>
                <button class="git-icon-btn" title="Remover do stage" @click.stop="$emit('unstage', f.path)">
                  <i class="gi gi-minus"></i>
                </button>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- ── Changes ── -->
      <div v-if="unstagedFiles.length > 0" class="git-group">
        <div class="git-group-hd" @click="changesOpen = !changesOpen">
          <i class="gi gi-chevron-right git-chevron" :class="{ open: changesOpen }"></i>
          <span class="git-group-name">Changes</span>
          <span class="git-badge">{{ unstagedFiles.length }}</span>
          <div class="git-group-actions" @click.stop>
            <button class="git-icon-btn" title="Stage All" @click="$emit('stageAll')">
              <i class="gi gi-plus"></i>
            </button>
            <button class="git-icon-btn git-icon-btn--danger" title="Discard All" @click="$emit('discardAll')">
              <i class="gi gi-discard"></i>
            </button>
          </div>
        </div>
        <transition name="git-slide">
          <div v-show="changesOpen" class="git-file-list">
            <div
              v-for="f in unstagedFiles"
              :key="'u-'+f.path"
              class="git-file-row"
              @click="$emit('showDiff', f.path, false)"
            >
              <div class="git-file-label">
                <span class="git-file-name">{{ fileName(f.path) }}</span>
                <span class="git-file-path">{{ fileDir(f.path) }}</span>
              </div>
              <span class="git-status" :class="'gs-'+f.status">{{ statusLetter(f.status) }}</span>
              <div class="git-row-actions">
                <button class="git-icon-btn" title="Abrir arquivo" @click.stop="$emit('openFile', f.path)">
                  <i class="gi gi-open"></i>
                </button>
                <button class="git-icon-btn" title="Stage" @click.stop="$emit('stage', f.path)">
                  <i class="gi gi-plus"></i>
                </button>
                <button class="git-icon-btn git-icon-btn--danger" title="Discard" @click.stop="$emit('discard', f.path)">
                  <i class="gi gi-discard"></i>
                </button>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Sem alterações -->
      <div v-if="!stagedFiles.length && !unstagedFiles.length" class="git-clean">
        <i class="gi gi-check" style="margin-right:6px;opacity:.4"></i>
        <span>Sem alterações pendentes</span>
      </div>

      <!-- ── Histórico ── -->
      <div class="git-group git-group--commits">
        <div class="git-group-hd" @click="commitsOpen = !commitsOpen">
          <i class="gi gi-chevron-right git-chevron" :class="{ open: commitsOpen }"></i>
          <span class="git-group-name">Histórico de Commits</span>
          <div class="git-group-actions" @click.stop>
            <button class="git-icon-btn" :disabled="loadingCommits" title="Atualizar" @click="$emit('refreshCommits')">
              <i class="gi gi-sync" :class="{ 'gi-spin': loadingCommits }"></i>
            </button>
          </div>
        </div>
        <transition name="git-slide">
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
            <button v-if="commits.length >= 20" class="git-more-btn" :disabled="loadingCommits" @click="$emit('loadMoreCommits')">
              {{ loadingCommits ? 'Carregando...' : 'Carregar mais' }}
            </button>
          </div>
        </transition>
      </div>

    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  isGitRepo:      { type: Boolean, default: false },
  loading:        { type: Boolean, default: false },
  loadingCommits: { type: Boolean, default: false },
  stagedFiles:    { type: Array,   default: () => [] },
  unstagedFiles:  { type: Array,   default: () => [] },
  commits:        { type: Array,   default: () => [] },
  commitMessage:  { type: String,  default: '' },
  branch:         { type: String,  default: '' },
})

const emit = defineEmits([
  'pull', 'push', 'refresh', 'initRepo',
  'update:commitMessage', 'commit',
  'stage', 'unstage', 'stageAll', 'unstageAll',
  'discard', 'discardAll',
  'openFile', 'showDiff',
  'refreshCommits', 'loadMoreCommits',
])

const stagedOpen  = ref(true)
const changesOpen = ref(true)
const commitsOpen = ref(false)
const msgRef      = ref(null)

function tryCommit() {
  if (!props.stagedFiles.length || !props.commitMessage.trim()) return
  emit('commit')
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
  if (diff < 60000)    return 'agora'
  if (diff < 3600000)  return `${Math.floor(diff/60000)}min`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h`
  if (diff < 604800000) return `${Math.floor(diff/86400000)}d`
  return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })
}
</script>

<style scoped>
/* ── Variables ───────────────────────────────────────────── */
.git-root {
  --gi-size: 14px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  font-size: 13px;
  color: var(--text, #ccc);
  background: var(--panel, #1e1e1e);
  user-select: none;
}

/* ── Icon system (SVG bg) ────────────────────────────────── */
.gi {
  display: inline-block;
  width: var(--gi-size);
  height: var(--gi-size);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: invert(0.75);
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
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  color: var(--muted, #888);
  flex: 1;
}

.git-toolbar-btns {
  display: flex;
  gap: 1px;
}

.git-tbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: background .1s;
}
.git-tbtn:hover  { background: var(--hover, rgba(255,255,255,.08)); }
.git-tbtn:disabled { opacity: .35; cursor: default; }

/* ── Input ───────────────────────────────────────────────── */
.git-input-row {
  padding: 8px 8px 4px;
  flex-shrink: 0;
}

.git-msg-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--input-bg, #2d2d2d);
  border: 1px solid var(--border, #444);
  border-radius: 4px;
  color: var(--text, #ccc);
  font-size: 13px;
  font-family: inherit;
  padding: 6px 8px;
  resize: none;
  min-height: 28px;
  max-height: 120px;
  outline: none;
  line-height: 1.4;
  overflow-y: auto;
}
.git-msg-input:focus { border-color: var(--accent, #007acc); }

/* ── Commit split-button ─────────────────────────────────── */
.git-commit-row {
  display: flex;
  align-items: stretch;
  margin: 0 8px 8px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.git-commit-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 10px;
  background: var(--accent, #007acc);
  color: #fff;
  border: none;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background .12s;
}
.git-commit-main:hover:not(:disabled) { background: #0089e0; }
.git-commit-main:disabled { opacity: .4; cursor: default; }

.git-kbd {
  font-size: 10px;
  font-family: inherit;
  background: rgba(255,255,255,.15);
  border-radius: 3px;
  padding: 1px 5px;
  letter-spacing: .02em;
}

.git-commit-sep {
  width: 1px;
  background: rgba(255,255,255,.2);
  flex-shrink: 0;
}

.git-commit-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  background: var(--accent, #007acc);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: background .12s;
  flex-shrink: 0;
}
.git-commit-arrow:hover:not(:disabled) { background: #0089e0; }
.git-commit-arrow:disabled { opacity: .4; cursor: default; }
.git-commit-arrow .gi { --gi-size: 11px; filter: invert(1); }

/* ── Group headers ───────────────────────────────────────── */
.git-group { flex-shrink: 0; }

.git-group-hd {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 8px 0 4px;
  cursor: pointer;
}
.git-group-hd:hover { background: var(--list-hover, rgba(255,255,255,.05)); }

.git-chevron {
  --gi-size: 12px;
  transition: transform .13s ease;
  flex-shrink: 0;
}
.git-chevron.open { transform: rotate(90deg); }

.git-group-name {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .05em;
  color: var(--text, #ccc);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.git-badge {
  font-size: 10px;
  min-width: 16px;
  padding: 0 5px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  background: var(--badge-bg, rgba(255,255,255,.15));
  color: var(--badge-fg, #fff);
  flex-shrink: 0;
}

.git-group-actions {
  display: flex;
  gap: 1px;
  opacity: 0;
  transition: opacity .1s;
  flex-shrink: 0;
}
.git-group-hd:hover .git-group-actions { opacity: 1; }

/* ── Icon buttons ────────────────────────────────────────── */
.git-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  border-radius: 3px;
  cursor: pointer;
  transition: background .08s;
  color: var(--text, #ccc);
}
.git-icon-btn:hover { background: rgba(255,255,255,.1); }
.git-icon-btn .gi { --gi-size: 12px; }

.git-icon-btn--danger:hover { background: rgba(241,76,76,.15); }
.git-icon-btn--danger .gi  { filter: invert(.5) sepia(1) saturate(4) hue-rotate(310deg); }

/* ── File rows ───────────────────────────────────────────── */
.git-file-list { padding: 0; }

.git-file-row {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 6px 0 22px;
  cursor: pointer;
  transition: background .07s;
}
.git-file-row:hover { background: var(--list-hover, rgba(255,255,255,.06)); }

.git-file-label {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 5px;
  overflow: hidden;
  min-width: 0;
}

.git-file-name {
  font-size: 13px;
  color: var(--text, #ccc);
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.git-file-path {
  font-size: 11px;
  color: var(--muted, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.git-status {
  font-size: 11px;
  font-weight: 700;
  width: 13px;
  text-align: center;
  flex-shrink: 0;
}
/* Status colors */
.gs-modified  { color: #e2c08d; }
.gs-added     { color: #73c991; }
.gs-deleted   { color: #f14c4c; }
.gs-renamed   { color: #73c991; }
.gs-untracked { color: #73c991; }
.gs-conflict  { color: #e55; }

.git-row-actions {
  display: flex;
  gap: 1px;
  opacity: 0;
  flex-shrink: 0;
  transition: opacity .08s;
}
.git-file-row:hover .git-row-actions { opacity: 1; }

/* ── Empty states ────────────────────────────────────────── */
.git-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 16px;
  text-align: center;
  color: var(--muted, #888);
  font-size: 12px;
}
.git-empty p { margin: 0 0 12px; }

.git-clean {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--muted, #888);
}

.git-hint {
  padding: 8px 22px;
  font-size: 11px;
  color: var(--muted, #888);
}

/* ── Commits ─────────────────────────────────────────────── */
.git-group--commits { border-top: 1px solid var(--border, #3c3c3c); margin-top: 4px; }

.git-commits-list {
  overflow-y: auto;
  max-height: 300px;
}

.git-commit-item {
  padding: 5px 10px 5px 22px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,.04));
  transition: background .07s;
}
.git-commit-item:hover { background: var(--list-hover, rgba(255,255,255,.04)); }

.git-commit-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.git-hash {
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: var(--accent, #4db5ff);
  background: rgba(77,181,255,.1);
  padding: 1px 5px;
  border-radius: 3px;
}

.git-cdate {
  font-size: 10px;
  color: var(--muted, #888);
}

.git-commit-subject {
  font-size: 12px;
  color: var(--text, #ccc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.git-commit-author {
  font-size: 10px;
  color: var(--muted, #888);
  margin-top: 1px;
}

.git-more-btn {
  width: 100%;
  padding: 6px;
  background: transparent;
  border: none;
  border-top: 1px solid var(--border, #3c3c3c);
  color: var(--muted, #888);
  font-size: 11px;
  cursor: pointer;
  transition: background .1s;
}
.git-more-btn:hover:not(:disabled) { background: rgba(255,255,255,.04); color: var(--text, #ccc); }
.git-more-btn:disabled { opacity: .4; }

/* ── Action buttons ──────────────────────────────────────── */
.git-action-btn {
  padding: 6px 16px;
  background: var(--accent, #007acc);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background .15s;
}
.git-action-btn:hover { background: #0089e0; }

/* ── Slide animation ─────────────────────────────────────── */
.git-slide-enter-active,
.git-slide-leave-active { transition: all .13s ease; overflow: hidden; }
.git-slide-enter-from,
.git-slide-leave-to { opacity: 0; max-height: 0; }
.git-slide-enter-to,
.git-slide-leave-from { opacity: 1; max-height: 800px; }
</style>
