import { createApp } from 'vue'
import './styles.css'

// Modo terminal desanexado — monta componente leve sem Monaco
const _urlParams = new URLSearchParams(window.location.search)
const _detachedId = _urlParams.get('terminalDetached')

if (_detachedId) {
  const { default: TerminalDetached } = await import('./TerminalDetached.vue')
  createApp(TerminalDetached, {
    terminalId: _detachedId,
    name: decodeURIComponent(_urlParams.get('name') || 'Terminal'),
    controlsPos: _urlParams.get('controlsPos') || 'left'
  }).mount('#root')
} else {
  // App completo com Monaco
  const { default: App } = await import('./App.vue')
  const { default: loader } = await import('@monaco-editor/loader')

  console.log('🚀 [Vue] Iniciando aplicação Monarco')

  const EditorWorker = (await import('monaco-editor/esm/vs/editor/editor.worker?worker')).default
  const JsonWorker = (await import('monaco-editor/esm/vs/language/json/json.worker?worker')).default
  const CssWorker = (await import('monaco-editor/esm/vs/language/css/css.worker?worker')).default
  const HtmlWorker = (await import('monaco-editor/esm/vs/language/html/html.worker?worker')).default
  const TsWorker = (await import('monaco-editor/esm/vs/language/typescript/ts.worker?worker')).default

  console.log('📦 [Vue] Workers do Monaco importados')

  self.MonacoEnvironment = {
    getWorker(_, label) {
      console.log('🔧 [Monaco] Solicitando worker para:', label)
      if (label === 'json') return new JsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
      if (label === 'typescript' || label === 'javascript') return new TsWorker()
      return new EditorWorker()
    }
  }
  console.log('✅ [Monaco] MonacoEnvironment configurado')

  loader.config({ monaco: () => import('monaco-editor') })
  console.log('✅ [Monaco] Loader configurado')

  try {
    const app = createApp(App)
    console.log('✅ [Vue] Aplicação Vue criada')
    app.mount('#root')
    console.log('✅ [Vue] Aplicação montada em #root')
  } catch (err) {
    console.error('❌ [Vue] Erro ao montar aplicação:', err)
    console.error('Stack:', err.stack)
  }
}
