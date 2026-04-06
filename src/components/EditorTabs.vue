<template>
  <div class="tabs">
    <div
      v-for="tab in tabs"
      :key="tab.path"
      class="tab"
      :class="{ active: tab.path === activePath }"
      @click="$emit('select', tab.path)"
    >
      <span v-if="tab.dirty" class="dirty" />
      <span class="file-icon" :style="{ backgroundImage: `url(${getIconPath(tab.name)})` }"></span>
      <span class="label">{{ tab.name }}</span>
      <button class="close" @click.stop="$emit('close', tab.path)">×</button>
    </div>
  </div>
</template>

<script setup>
const FILE_ICON_MAP = {
  js: 'file_type_js', cjs: 'file_type_js', mjs: 'file_type_js',
  ts: 'file_type_typescript', tsx: 'file_type_typescript',
  html: 'file_type_html', css: 'file_type_css', scss: 'file_type_scss',
  json: 'file_type_json', vue: 'file_type_vue', md: 'file_type_markdown',
  py: 'file_type_python', go: 'file_type_go', java: 'file_type_java',
  cpp: 'file_type_cpp', c: 'file_type_c', h: 'file_type_cheader',
  cs: 'file_type_csharp', php: 'file_type_php', rb: 'file_type_ruby',
  xml: 'file_type_xml', yaml: 'file_type_yaml', yml: 'file_type_yaml',
  sql: 'file_type_db', svg: 'file_type_svg',
  png: 'file_type_image', jpg: 'file_type_image', jpeg: 'file_type_image',
  gif: 'file_type_image', webp: 'file_type_image',
  pdf: 'file_type_pdf', zip: 'file_type_zip', rar: 'file_type_zip'
}

function getIconPath(fileName) {
  const ext = String(fileName || '').split('.').pop()?.toLowerCase() || ''
  const iconName = `${FILE_ICON_MAP[ext] || 'default_file'}.svg`
  return `./icons/${iconName}`
}

defineProps({
  tabs: {
    type: Array,
    default: () => []
  },
  activePath: {
    type: String,
    default: null
  }
})

defineEmits(['select', 'close'])
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 0;
  overflow-x: auto;
  background: var(--panel-2);
  border-bottom: 1px solid var(--border);
  min-height: 36px;
  flex-shrink: 0;
  
  /* Ocultar scrollbar */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  height: 36px;
  background: var(--tab-inactive-bg, var(--monaco-tab-inactive-bg, #2d2d2d));
  color: var(--tab-inactive-fg, var(--monaco-tab-inactive-fg, rgba(255, 255, 255, 0.5)));
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  border-right: 1px solid var(--border);
  transition: background 0.15s ease;
  user-select: none;
}

.tab:hover {
  background: var(--list-hover);
}

.tab.active {
  background: var(--tab-active-bg, var(--monaco-tab-active-bg, var(--panel)));
  color: var(--tab-active-fg, var(--monaco-tab-active-fg, #fff));
  border-bottom: 2px solid var(--accent);
  height: 35px;
  padding-bottom: 1px;
}

.tab .dirty {
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
  flex-shrink: 0;
}

.tab .file-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.95;
}

.tab .label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab .close {
  width: 18px;
  height: 18px;
  padding: 0;
  margin-left: 4px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  line-height: 1;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.1s ease, background 0.1s ease;
}

.tab:hover .close {
  opacity: 1;
}

.tab .close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}

.tab.active .close {
  opacity: 1;
}
</style>
