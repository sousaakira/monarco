<template>
  <div class="tabs">
    <div
      v-for="tab in tabs"
      :key="tab.path"
      class="tab"
      :class="{ active: tab.path === activePath }"
      :title="tab.path"
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  min-height: 36px;
  flex-shrink: 0;

  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.tabs::-webkit-scrollbar {
  height: 4px;
}

.tabs::-webkit-scrollbar-track {
  background: transparent;
}

.tabs::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 999px;
}

.tabs:hover {
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.tabs:hover::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 36px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  font-size: 12.5px;
  font-weight: 400;
  letter-spacing: 0.01em;
  cursor: pointer;
  white-space: nowrap;
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  position: relative;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
}

.tab.active {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: -1px;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 80%, white));
  border-radius: 1px 1px 0 0;
}

.tab .dirty {
  width: 7px;
  height: 7px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.tab.active .dirty {
  background: var(--accent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 50%, transparent);
}

.tab .file-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.tab:hover .file-icon,
.tab.active .file-icon {
  opacity: 1;
}

.tab .label {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.tab .close {
  width: 18px;
  height: 18px;
  padding: 0;
  margin-left: 2px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 15px;
  font-weight: 300;
  line-height: 1;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.15s ease;
}

.tab:hover .close {
  opacity: 0.6;
}

.tab .close:hover {
  background: rgba(255, 77, 77, 0.15);
  color: #ff6b6b;
  opacity: 1;
}

.tab.active .close {
  opacity: 0.7;
}

.tab.active .close:hover {
  background: rgba(255, 77, 77, 0.2);
  color: #ff6b6b;
  opacity: 1;
}
</style>
