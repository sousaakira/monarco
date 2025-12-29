<template>
  <div class="ai-chat-sidebar" :class="{ 'ai-chat-sidebar-open': props.isOpen }">
    <div class="chat-header">
      <div class="chat-title">
        <span class="chat-icon icon-comment-dots"></span>
        <span>Assistente IA</span>
      </div>
      <div class="header-actions">
        <button title="Nova conversa" class="header-btn" @click="clearChat"><span class="icon-plus"></span></button>
        <button title="Configurações" class="header-btn"><span class="icon-gear"></span></button>
        <button title="Fechar" class="header-btn" @click="closeChat"><span class="icon-xmark"></span></button>
      </div>
    </div>
    <div class="chat-content">
      <div class="messages-container" ref="messagesContainer">
        <div 
          v-for="(msg, index) in messages" 
          :key="index" 
          :class="['message', msg.role]"
          v-show="msg.role !== 'system'"
        >
          <div class="message-header">
            <span class="sender-avatar" :class="msg.role === 'assistant' ? 'ai-avatar' : 'user-avatar'"></span>
            <span class="sender-name">{{ msg.role === 'assistant' ? 'IA' : 'Você' }}</span>
          </div>
          <div class="message-content" v-html="parseMessage(msg.content)"></div>
        </div>
        <div v-if="isLoading" class="message assistant loading">
          <div class="message-header">
            <span class="sender-avatar ai-avatar"></span>
            <span class="sender-name">IA</span>
          </div>
          <!-- Tool calls em execução -->
          <div v-if="currentToolCalls.length > 0" class="tool-calls-container">
            <div v-for="(tool, idx) in currentToolCalls" :key="idx" class="tool-call-item">
              <span class="tool-icon">⚙️</span>
              <span class="tool-name">{{ tool.name }}</span>
              <span class="tool-status" :class="tool.status">
                {{ tool.status === 'executing' ? 'executando...' : 'concluído' }}
              </span>
            </div>
          </div>
          <div v-else class="message-content typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
      
      <!-- Input Area estilo Qoder -->
      <div class="agentchat-container">
        <div class="agentchat-inner-container">
          <!-- Context Area -->
          <div class="agentchat-context-area" v-if="contextItems.length > 0">
            <div class="agentchat-add-context" @click="addContext">
              <span class="codicon codicon-add">+</span>
            </div>
            <div class="agent-chat-context-items">
              <div v-for="(item, idx) in contextItems" :key="idx" class="context-item">
                <span class="context-icon">{{ item.icon }}</span>
                <span class="context-label">{{ item.label }}</span>
                <button class="context-remove" @click="removeContext(idx)">×</button>
              </div>
            </div>
          </div>
          
          <!-- Input Container -->
          <div class="chat-mixed-input-container" :class="{ 'has-content': inputMessage.length > 0 }">
            <div class="chat-input-wrapper">
              <div 
                ref="inputRef"
                contenteditable="true" 
                class="chat-input-contenteditable"
                @input="updateInput"
                @keydown="handleKeydown"
                @paste="handlePaste"
                :data-placeholder="'Pergunte algo ou use @ para mencionar...'"
              ></div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="agentchat-footer">
            <div class="footer-selectors">
              <div class="select-component" @click="toggleModeMenu">
                <span class="select-text">{{ selectedMode }}</span>
                <span class="select-icon">▼</span>
              </div>
              <div class="select-component" @click="toggleModelMenu">
                <span class="select-text">{{ selectedModel }}</span>
                <span class="select-icon">▼</span>
              </div>
            </div>
            <div class="footer-actions-bar">
              <button class="footer-action-btn" title="Adicionar contexto" @click="addContext">
                <span class="codicon">+</span>
              </button>
              <button 
                class="footer-action-btn send-action" 
                :class="{ 'active': inputMessage.trim().length > 0 }"
                :disabled="!inputMessage.trim() || isLoading"
                @click="sendPrompt"
                title="Enviar mensagem"
              >
                <span class="send-icon">↑</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { marked } from 'marked'

// Configura o marked para suportar quebras de linha e código
marked.setOptions({
  breaks: true,
  gfm: true
})

const props = defineProps({ 
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const messages = ref([
  { role: 'system', content: 'Você é um assistente de IA integrado ao Monarco IDE.' },
  { role: 'assistant', content: 'Olá! Sou seu assistente de código. Posso explorar seu projeto, ler arquivos e ajudá-lo a entender o código. Como posso ajudar?' }
])
const inputMessage = ref('')
const isLoading = ref(false)
const messagesContainer = ref(null)
const inputRef = ref()
let typingMessageIndex = -1

// Tool calls em progresso
const currentToolCalls = ref([])

// Cleanup function para listener
let cleanupToolCallListener = null

// Novas variáveis para o estilo Qoder
const contextItems = ref([])
const selectedMode = ref('Agent')
const selectedModel = ref('Qwen 3B')

const updateInput = () => {
  if (inputRef.value) {
    inputMessage.value = inputRef.value.innerHTML || ''
  }
}

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendPrompt()
  }
}

const handlePaste = (e) => {
  e.preventDefault()
  const text = e.clipboardData.getData('text/plain')
  document.execCommand('insertText', false, text)
}

const addContext = () => {
  // TODO: Implementar seleção de contexto
  console.log('Add context clicked')
}

const removeContext = (idx) => {
  contextItems.value.splice(idx, 1)
}

const toggleModeMenu = () => {
  // TODO: Implementar menu de modos
  console.log('Toggle mode menu')
}

const toggleModelMenu = () => {
  // TODO: Implementar menu de modelos
  console.log('Toggle model menu')
}

const sendPrompt = async () => {
  // Extrai texto puro do contenteditable
  const textContent = inputRef.value?.innerText?.trim() || ''
  if (!textContent || isLoading.value) return

  const userMessage = { role: 'user', content: textContent }
  messages.value.push(userMessage)
  inputMessage.value = ''
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.innerHTML = ''
      inputRef.value.focus()
    }
  })
  isLoading.value = true
  currentToolCalls.value = []
  typingMessageIndex = messages.value.length
  messages.value.push({ role: 'assistant', content: '' })
  scrollToBottom()

  try {
    // Usa a nova API de IA via IPC
    const result = await window.monarco.ai.chat(textContent)
    
    messages.value[typingMessageIndex] = { 
      role: 'assistant', 
      content: result.content || 'Desculpe, não consegui gerar uma resposta.',
      toolCalls: currentToolCalls.value.length > 0 ? [...currentToolCalls.value] : undefined
    }

    await nextTick()
    scrollToBottom()
  } catch (error) {
    console.error('Erro ao enviar mensagem para a IA:', error)
    messages.value[typingMessageIndex] = { 
      role: 'assistant', 
      content: `Erro ao comunicar com o assistente: ${error.message || 'Erro desconhecido'}` 
    }
  } finally {
    isLoading.value = false
    currentToolCalls.value = []
  }
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const clearChat = async () => {
  // Limpa histórico no backend
  try {
    await window.monarco.ai.clear()
  } catch (e) {
    console.error('Erro ao limpar histórico:', e)
  }
  
  const systemMessage = messages.value.find(m => m.role === 'system')
  messages.value = systemMessage ? [systemMessage] : []
  messages.value.push({ 
    role: 'assistant', 
    content: 'Conversa reiniciada. Como posso ajudá-lo com seu código?' 
  })
  currentToolCalls.value = []
  nextTick().then(scrollToBottom)
}

const closeChat = () => {
  emit('close')
}

const parseMessage = (text) => {
  if (!text) return ''
  try {
    // Converte markdown para HTML
    let html = marked.parse(text)
    
    // Detecta blocos de código com linguagem e adiciona botão de aplicar
    html = html.replace(
      /<pre><code class="language-(\w+)">(.*?)<\/code><\/pre>/gs,
      (match, lang, code) => {
        // Decodifica HTML entities
        const decodedCode = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
        
        // Detecta se é um arquivo específico nos comentários
        const fileMatch = decodedCode.match(/\/\/ File: (.+)/) || decodedCode.match(/# File: (.+)/)
        
        if (fileMatch) {
          const filePath = fileMatch[1].trim()
          return `
            <div class="code-block-with-actions">
              <div class="code-header">
                <span class="code-language">${lang}</span>
                <span class="code-file">${filePath}</span>
                <button class="apply-code-btn" onclick="window.applyCode('${filePath.replace(/'/g, "\\'")}')">✓ Aplicar</button>
              </div>
              <pre><code class="language-${lang}">${code}</code></pre>
            </div>
          `
        }
        
        return match
      }
    )
    
    return html
  } catch (e) {
    console.error('Erro ao parsear markdown:', e)
    return text
  }
}

const getSenderLabel = (role) => {
  if (role === 'assistant') {
    return '<span class="icon-comment-dots"></span> AI';
  }
  return 'Você';
}

onMounted(() => {
  if (messagesContainer.value) {
    scrollToBottom()
  }
  
  // Função global para aplicar código
  window.applyCode = async (filePath) => {
    try {
      // Encontra o bloco de código correspondente no último assistente
      const lastAssistantMsg = [...messages.value].reverse().find(m => m.role === 'assistant')
      if (!lastAssistantMsg) return
      
      // Extrai código do markdown
      const codeRegex = new RegExp(`\`\`\`\\w+\\s*\\/\\/\\s*File:\\s*${filePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*([\\s\\S]*?)\`\`\``, 'i')
      const match = lastAssistantMsg.content.match(codeRegex)
      
      if (!match) {
        alert('Não foi possível extrair o código')
        return
      }
      
      const code = match[1].trim()
      
      // Usa a tool write_file para aplicar
      await window.monarco.ai.executeTool('write_file', {
        path: filePath,
        content: code
      })
      
      // Feedback visual
      messages.value.push({
        role: 'assistant',
        content: `✅ **Arquivo atualizado:** \`${filePath}\``
      })
      
      await nextTick()
      scrollToBottom()
    } catch (error) {
      console.error('Erro ao aplicar código:', error)
      alert(`Erro ao aplicar: ${error.message}`)
    }
  }
  
  // Configura listener para tool calls
  if (window.monarco?.ai?.onToolCall) {
    cleanupToolCallListener = window.monarco.ai.onToolCall((toolInfo) => {
      // Atualiza lista de tool calls em progresso
      const existingIndex = currentToolCalls.value.findIndex(t => t.name === toolInfo.name)
      if (existingIndex >= 0) {
        currentToolCalls.value[existingIndex] = toolInfo
      } else {
        currentToolCalls.value.push(toolInfo)
      }
    })
  }
})

onUnmounted(() => {
  // Limpa listener de tool calls
  if (cleanupToolCallListener) {
    cleanupToolCallListener()
    cleanupToolCallListener = null
  }
})

watch(() => props.isOpen, (newVal) => {
  if (!newVal) {
    closeChat()
  }
})

watch(inputMessage, (newVal) => {
  if (inputRef.value && inputRef.value.innerHTML !== newVal) {
    inputRef.value.innerHTML = newVal
  }
})
</script>

<style scoped>
.ai-chat-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel);
  border-left: 1px solid var(--border);
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-2);
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.chat-icon {
  font-size: 16px;
  color: var(--accent);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--text);
  opacity: 0.7;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s ease;
}

.header-btn:hover {
  background: rgba(255,255,255,0.1);
  opacity: 1;
}

.chat-tab {
  display: flex;
  height: 34px;
  min-width: 0;
  max-width: 160px;
  cursor: pointer;
  user-select: none;
  align-items: center;
  gap: 1.5px;
  padding: 3px 10px;
  border-right: 1px solid var(--codeium-tab-border, var(--border));
  background: var(--ide-tab-active-background-color, var(--panel-2));
  position: relative;
  white-space: nowrap;
}

.chat-tab.active .tab-indicator {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 1px;
  background: var(--codeium-focus-border, var(--accent));
}

.tab-close-btn {
  margin-left: auto;
  background: transparent;
  border: none;
  opacity: 0;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
}

.chat-tab:hover .tab-close-btn {
  opacity: 0.8;
}

.tab-actions {
  display: flex;
  gap: 2px;
  align-items: center;
  padding-left: 2px;
}

.tab-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  opacity: 0.7;
  color: var(--text);
  cursor: pointer;
  padding: 0;
}

.tab-action-btn:hover {
  opacity: 1;
  background: rgba(255,255,255,0.1);
}

.chat-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 0; /* Importante para flexbox permitir scroll */
}

.messages-container {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0; /* Importante para flexbox permitir scroll */
  
  /* Scrollbar estilo VS Code */
  scrollbar-width: thin;
  scrollbar-color: rgba(121, 121, 121, 0.4) transparent;
}

/* Scrollbar WebKit (Chrome, Edge, Safari) */
.messages-container::-webkit-scrollbar {
  width: 10px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: rgba(121, 121, 121, 0.4);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: rgba(121, 121, 121, 0.7);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.messages-container::-webkit-scrollbar-corner {
  background: transparent;
}

.timeline-indicator {
  position: absolute;
  left: 0;
  top: 4px;
  z-index: 50;
  transition: transform 0.3s;
  transform: translateX(-100%);
  padding: 1px 2px;
  opacity: 0.5;
}

.ai-chat-sidebar-open .timeline-indicator:hover {
  transform: translateX(0);
  opacity: 1;
}

.timeline-marks {
  display: flex;
  max-height: 12rem;
  flex-direction: column;
  overflow-y: auto;
  scrollbar-width: none;
}

.timeline-mark {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin: 4px 0;
  opacity: 0.3;
  transition: opacity 0.2s;
  cursor: pointer;
}

.timeline-mark:hover,
.timeline-mark.active {
  opacity: 1;
}

.timeline-line {
  height: 1px;
  width: 2rem;
  background: var(--ide-editor-color, var(--text));
  margin: 2px 0;
}

.timeline-label {
  font-size: 10px;
  margin-right: 4px;
}

.message {
  max-width: 90%;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: message-fade-in 0.3s ease;
  flex-shrink: 0; /* Não permite que as mensagens encolham */
}

@keyframes message-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.user {
  background: rgba(79, 140, 255, 0.08);
  border: 1px solid rgba(79, 140, 255, 0.15);
  align-self: flex-end;
  border-radius: 8px 8px 2px 8px;
  margin-left: auto;
}

.message.assistant {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  align-self: flex-start;
  border-radius: 8px 8px 8px 2px;
  margin-right: auto;
}

.message.loading {
  opacity: 0.7;
}

.message.system {
  display: none;
}

.message-header {
  padding: 8px 12px 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sender-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-avatar {
  background: rgba(79, 140, 255, 0.2);
  color: var(--accent);
}

.ai-avatar {
  background: rgba(255, 255, 255, 0.1);
  color: var(--muted);
}

.sender-avatar:before {
  font-size: 12px;
}

.user-avatar:before {
  content: 'U';
}

.ai-avatar:before {
  content: 'AI';
  font-size: 10px;
}

.sender-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.message-content {
  padding: 4px 12px 12px;
  color: var(--text);
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: var(--muted);
  border-radius: 50%;
  display: inline-block;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: 0s; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-5px); }
}

.ai-chat-input {
  border: 1px solid var(--border);
  background: var(--panel);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
  overflow: hidden;
  border-radius: 12px;
  padding: 6px;
  color: var(--text);
  display: flex;
  flex-direction: column;
}

.agentchat-container {
  border-top: 1px solid var(--border);
  background: var(--panel-2);
  flex-shrink: 0;
}

.agentchat-inner-container {
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 10px;
}

.agentchat-context-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--panel);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.agentchat-add-context {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--muted);
  transition: all 0.15s ease;
}

.agentchat-add-context:hover {
  background: rgba(255,255,255,0.08);
  color: var(--text);
}

.agent-chat-context-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.context-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text);
}

.context-icon {
  font-size: 14px;
}

.context-label {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-remove {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0 2px;
  font-size: 14px;
  line-height: 1;
}

.context-remove:hover {
  color: var(--danger);
}

/* Input Container estilo Qoder */
.chat-mixed-input-container {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
  transition: border-color 0.2s ease;
  overflow: hidden;
}

.chat-mixed-input-container:focus-within,
.chat-mixed-input-container.has-content {
  border-color: var(--accent);
}

.chat-input-wrapper {
  padding: 0;
}

.chat-input-contenteditable {
  min-height: 44px;
  max-height: 180px;
  padding: 12px 14px;
  outline: none;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-wrap;
}

.chat-input-contenteditable:empty:before {
  content: attr(data-placeholder);
  color: var(--muted);
  pointer-events: none;
}

/* Footer estilo Qoder */
.agentchat-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
}

.footer-selectors {
  display: flex;
  gap: 8px;
}

.select-component {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: var(--muted);
  transition: all 0.15s ease;
}

.select-component:hover {
  border-color: var(--accent);
  color: var(--text);
}

.select-text {
  font-weight: 500;
}

.select-icon {
  font-size: 8px;
  opacity: 0.7;
}

.footer-actions-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
}

.footer-action-btn:hover {
  background: rgba(255,255,255,0.06);
  border-color: var(--accent);
  color: var(--text);
}

.footer-action-btn.send-action {
  background: var(--panel);
}

.footer-action-btn.send-action.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.footer-action-btn.send-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-icon {
  font-weight: bold;
  font-size: 16px;
}

.chat-input-area {
  display: flex;
  padding: 12px 16px;
  gap: 10px;
  border-top: 1px solid var(--border);
  background: var(--panel-2);
}

.chat-input-container {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 20px;
  position: relative;
  background: var(--panel);
  transition: all 0.2s ease;
}

.chat-input-container.expanded {
  border-color: var(--accent);
}

.chat-input {
  width: 100%;
  min-height: 36px;
  max-height: 120px;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  resize: none;
  padding: 8px 16px;
  overflow-y: auto;
  direction: ltr;
  text-align: left;
}


.codicon {
  font-family: codicon;
  font-size: 16px;
  font-style: normal;
  display: inline-block;
}

.icon-comment-dots:before { content: '💬'; }
.icon-xmark:before { content: '✕'; }
.icon-gear:before { content: '⚙️'; }
.icon-plus:before { content: '+'; }
.icon-trash:before { content: '🗑️'; }
.icon-paperclip:before { content: '📎'; }
.icon-paper-plane:before { content: '➤'; }
.icon-chevron-down:before { content: '▼'; }

.chat-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--panel);
  border-top: 1px solid var(--border);
}

.model-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--panel-2);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--border);
}

.model-name {
  font-size: 12px;
  color: var(--muted);
}

.model-toggle {
  background: transparent;
  border: none;
  color: var(--muted);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--muted);
  opacity: 0.7;
  cursor: pointer;
  transition: all 0.2s ease;
}

.footer-btn:hover {
  background: rgba(255,255,255,0.1);
  opacity: 1;
}

.component-tooltip {
  display: inline-block;
}

.select2-component-icon {
  margin-left: 8px;
  font-size: 12px;
}

.chat-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
}

.action-btn.send-btn {
  background: var(--panel);
  border: 1px solid var(--border);
}

.action-btn.send-btn.active {
  background: var(--accent);
  color: white;
  border-color: transparent;
}

.action-btn.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.actions-container {
  display: flex;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.action-item {
  display: flex;
  align-items: center;
}

.prompt-enhance-button, .action-label {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--accent);
  text-decoration: none;
  width: 28px;
  height: 28px;
  transition: background-color 0.2s ease;
}

.prompt-enhance-button:hover, .action-label:hover {
  background: rgba(79, 140, 255, 0.1);
}

.action-label[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
  color: var(--muted);
}

.action-item {
  display: flex;
  align-items: center;
}

.prompt-enhance-button, .action-label {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--accent);
  text-decoration: none;
  width: 28px;
  height: 28px;
  transition: background-color 0.2s ease;
}

.prompt-enhance-button:hover, .action-label:hover {
  background: rgba(79, 140, 255, 0.1);
}

.action-label[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
  color: var(--muted);
}

.ai-chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-2);
  border-radius: 8px 8px 0 0;
}

.ai-chat-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}

.codicon {
  font-size: 14px;
}

.component-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.codicon-add-line {
  width: 16px;
  height: 16px;
}

.contenteditable {
  min-height: 2rem;
  max-height: 300px;
  overflow-y: auto;
  outline: none;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
  z-index: 1;
  position: relative;
  cursor: text;
}

.placeholder {
  pointer-events: none;
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  opacity: 0.5;
  font-size: 13px;
  padding: 0;
}

.hidden {
  opacity: 0;
}

.send-button {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
  transition: opacity 0.2s;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message-content pre {
  background: var(--panel);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
  border: 1px solid var(--border);
  position: relative;
}

.message-content pre:before {
  content: attr(data-language);
  position: absolute;
  top: 0;
  right: 0;
  font-size: 10px;
  color: var(--muted);
  background: var(--panel-2);
  padding: 2px 6px;
  border-radius: 0 0 0 4px;
}

.message-content code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text);
}

/* Tool Calls */
.tool-calls-container {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-call-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
}

.tool-icon {
  font-size: 14px;
}

.tool-name {
  font-weight: 500;
  color: var(--accent);
  font-family: 'Monaco', 'Menlo', monospace;
}

.tool-status {
  margin-left: auto;
  font-size: 11px;
  color: var(--muted);
}

.tool-status.executing {
  color: var(--accent);
  animation: pulse 1.5s infinite;
}

.tool-status.completed {
  color: #4caf50;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Markdown Styles */
.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3),
.message-content :deep(h4) {
  margin: 12px 0 8px 0;
  font-weight: 600;
  color: var(--text);
}

.message-content :deep(h1) { font-size: 1.4em; }
.message-content :deep(h2) { font-size: 1.2em; }
.message-content :deep(h3) { font-size: 1.1em; }
.message-content :deep(h4) { font-size: 1em; }

.message-content :deep(p) {
  margin: 8px 0;
  line-height: 1.6;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.message-content :deep(li) {
  margin: 4px 0;
  line-height: 1.5;
}

.message-content :deep(blockquote) {
  margin: 8px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--accent);
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
}

.message-content :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.message-content :deep(a:hover) {
  text-decoration: underline;
}

.message-content :deep(code) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #e06c75;
}

.message-content :deep(pre) {
  margin: 12px 0;
  padding: 12px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow-x: auto;
}

.message-content :deep(pre code) {
  padding: 0;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  line-height: 1.5;
}

.message-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 13px;
}

.message-content :deep(th),
.message-content :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--border);
  text-align: left;
}

.message-content :deep(th) {
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
}

.message-content :deep(hr) {
  margin: 16px 0;
  border: none;
  border-top: 1px solid var(--border);
}

.message-content :deep(strong) {
  font-weight: 600;
  color: var(--text);
}

.message-content :deep(em) {
  font-style: italic;
}

/* Code Block with Apply Button */
.message-content :deep(.code-block-with-actions) {
  margin: 12px 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.message-content :deep(.code-header) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--border);
}

.message-content :deep(.code-language) {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--accent);
  font-family: 'Monaco', 'Menlo', monospace;
}

.message-content :deep(.code-file) {
  flex: 1;
  font-size: 12px;
  color: var(--muted);
  font-family: 'Monaco', 'Menlo', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-content :deep(.apply-code-btn) {
  padding: 4px 12px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.message-content :deep(.apply-code-btn:hover) {
  background: var(--accent-hover, #4fa9ff);
  transform: translateY(-1px);
}

.message-content :deep(.apply-code-btn:active) {
  transform: translateY(0);
}

.message-content :deep(.code-block-with-actions pre) {
  margin: 0;
  border: none;
  border-radius: 0;
}
</style>