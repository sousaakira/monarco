/**
 * AI Agent - Orquestra as chamadas ao LLM e execução das tools
 * 
 * O agente recebe uma mensagem do usuário e:
 * 1. Envia para o LLM com as tools disponíveis
 * 2. Se o LLM pedir para executar uma tool, executa e retorna o resultado
 * 3. Repete até o LLM dar uma resposta final
 */

import { toolDefinitions, toolExecutor } from './tools.js'

const MAX_TOOL_ITERATIONS = 20 // Limite de iterações para evitar loops infinitos
const MAX_HISTORY_MESSAGES = 15 // Limite de mensagens no histórico
const MAX_TOOL_RESULT_LENGTH = 3000 // Limite de caracteres para resultado de tools

/**
 * Sistema prompt para o agente (compacto para economizar tokens)
 */
const SYSTEM_PROMPT = `Você é um assistente de código do Monarco IDE.

FERRAMENTAS DISPONÍVEIS:

LEITURA:
- read_file: Lê arquivo {"path": "caminho"}
- list_directory: Lista diretório {"path": "caminho"}
- search_files: Busca arquivos {"pattern": "*.js"}
- grep_code: Busca texto {"query": "texto"}
- get_project_structure: Estrutura do projeto {}
- get_file_info: Info do arquivo {"path": "caminho"}

ESCRITA:
- write_file: Cria/sobrescreve arquivo {"path": "caminho", "content": "código"}
- patch_file: Edita arquivo {"path": "caminho", "search": "texto_a_buscar", "replace": "novo_texto"}
- insert_at_line: Insere em linha {"path": "caminho", "line": 10, "content": "código", "mode": "before"}

BUSCA:
- search_codebase: Busca inteligente {"query": "termo", "type": "function|class|all"}

REGRAS IMPORTANTES:
1. Para ver arquivos/código, USE as ferramentas - NUNCA invente conteúdo
2. Caminhos são SEMPRE relativos ao workspace (ex: "teste.js", "src/App.vue")
3. NUNCA use caminhos absolutos como "/home/user/..." 
4. Para patch_file: use texto CURTO e ÚNICO (ex: nome da função)
5. Para criar código completo, mostre com comentário "// File: caminho/arquivo.js" no início
6. Para usar ferramenta, responda APENAS:
\`\`\`tool
{"name": "ferramenta", "arguments": {}}
\`\`\`
7. Não adicione texto antes/depois do bloco tool`

/**
 * Classe do Agente de IA
 */
export class AIAgent {
  constructor(settings = {}) {
    this.settings = {
      endpoint: settings.endpoint || 'http://192.168.1.18:8000/v1/chat/completions',
      model: settings.model || 'Qwen/Qwen2.5-Coder-3B-Instruct',
      temperature: settings.temperature || 0.2,
      maxTokens: settings.maxTokens || 4096,
      ...settings
    }
    this.conversationHistory = []
    this.onToolCall = null // Callback para notificar frontend sobre tool calls
    this.onChunk = null // Callback para streaming (futuro)
  }

  /**
   * Configura o workspace para as tools
   */
  setWorkspace(workspacePath) {
    toolExecutor.setWorkspace(workspacePath)
  }

  /**
   * Atualiza configurações
   */
  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings }
  }

  /**
   * Limpa histórico de conversa
   */
  clearHistory() {
    this.conversationHistory = []
  }

  /**
   * Envia mensagem e processa resposta (com loop de tools)
   */
  async chat(userMessage, options = {}) {
    // Adiciona mensagem do usuário ao histórico
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    })

    // Limita o tamanho do histórico
    this.trimHistory()

    let iterations = 0
    let finalResponse = null

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++

      // Monta mensagens para o LLM (usando histórico limitado)
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...this.getRecentHistory()
      ]

      // Chama o LLM
      const response = await this.callLLM(messages, options.useTools !== false)

      // Verifica se o LLM quer usar uma tool
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Processa cada tool call
        for (const toolCall of response.tool_calls) {
          const toolName = toolCall.function.name
          let toolArgs = {}
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments)
          } catch (e) {
            console.error('Erro ao parsear argumentos da tool:', e)
          }

          // Notifica frontend (se callback configurado)
          if (this.onToolCall) {
            this.onToolCall({
              name: toolName,
              arguments: toolArgs,
              status: 'executing'
            })
          }

          // Executa a tool
          let toolResult
          try {
            toolResult = await toolExecutor.execute(toolName, toolArgs)
          } catch (error) {
            toolResult = { error: error.message }
          }

          // Notifica conclusão
          if (this.onToolCall) {
            this.onToolCall({
              name: toolName,
              arguments: toolArgs,
              status: 'completed',
              result: toolResult
            })
          }

          // Adiciona resultado ao histórico (truncado)
          const resultStr = this.truncateResult(JSON.stringify(toolResult, null, 2))
          this.conversationHistory.push({
            role: 'assistant',
            content: null,
            tool_calls: [toolCall]
          })

          this.conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultStr
          })
        }
      } else {
        // LLM deu resposta final
        finalResponse = response.content || ''
        
        // Verifica se o modelo quis usar uma tool mas não usou o formato correto
        const extractedToolCall = this.extractToolCallFromText(finalResponse)
        
        if (extractedToolCall) {
          // Executa a tool extraída do texto
          const { name: toolName, arguments: toolArgs } = extractedToolCall
          
          // Notifica frontend
          if (this.onToolCall) {
            this.onToolCall({
              name: toolName,
              arguments: toolArgs,
              status: 'executing'
            })
          }
          
          // Executa a tool
          let toolResult
          try {
            toolResult = await toolExecutor.execute(toolName, toolArgs)
          } catch (error) {
            toolResult = { error: error.message }
          }
          
          // Notifica conclusão
          if (this.onToolCall) {
            this.onToolCall({
              name: toolName,
              arguments: toolArgs,
              status: 'completed',
              result: toolResult
            })
          }
          
          // Formata o resultado para exibir diretamente ao usuário
          const resultStr = this.truncateResult(JSON.stringify(toolResult, null, 2))
          const formattedResult = this.formatToolResult(toolName, toolArgs, toolResult)
          
          // Adiciona ao histórico
          this.conversationHistory.push({
            role: 'assistant',
            content: formattedResult
          })
          
          // Retorna o resultado formatado diretamente
          finalResponse = formattedResult
          break
        }
        
        // Adiciona ao histórico
        this.conversationHistory.push({
          role: 'assistant',
          content: finalResponse
        })

        break
      }
    }

    if (!finalResponse && iterations >= MAX_TOOL_ITERATIONS) {
      finalResponse = 'Desculpe, atingi o limite de operações. Por favor, reformule sua pergunta.'
      this.conversationHistory.push({
        role: 'assistant',
        content: finalResponse
      })
    }

    return {
      content: finalResponse,
      iterations
    }
  }

  /**
   * Chama o LLM (compatível com API OpenAI)
   */
  async callLLM(messages, useTools = true) {
    const body = {
      model: this.settings.model,
      messages: messages,
      temperature: this.settings.temperature,
      max_tokens: this.settings.maxTokens
    }

    // Adiciona tools se habilitado
    if (useTools) {
      body.tools = toolDefinitions
      body.tool_choice = 'auto'
    }

    try {
      const response = await fetch(this.settings.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erro na API: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const choice = data.choices?.[0]

      if (!choice) {
        throw new Error('Resposta inválida do LLM')
      }

      return {
        content: choice.message?.content || null,
        tool_calls: choice.message?.tool_calls || null,
        finish_reason: choice.finish_reason
      }
    } catch (error) {
      console.error('Erro ao chamar LLM:', error)
      throw error
    }
  }

  /**
   * Processa uma pergunta simples (sem tools)
   */
  async simpleChat(userMessage) {
    return await this.chat(userMessage, { useTools: false })
  }

  /**
   * Limita o tamanho do histórico para evitar estouro de contexto
   */
  trimHistory() {
    if (this.conversationHistory.length > MAX_HISTORY_MESSAGES * 2) {
      // Mantém apenas as últimas N mensagens
      this.conversationHistory = this.conversationHistory.slice(-MAX_HISTORY_MESSAGES * 2)
    }
  }

  /**
   * Retorna histórico recente para enviar ao LLM
   */
  getRecentHistory() {
    // Retorna as últimas mensagens, limitando o tamanho
    const recent = this.conversationHistory.slice(-MAX_HISTORY_MESSAGES)
    return recent
  }

  /**
   * Trunca resultado de tool se for muito grande
   */
  truncateResult(resultStr) {
    if (resultStr.length > MAX_TOOL_RESULT_LENGTH) {
      return resultStr.substring(0, MAX_TOOL_RESULT_LENGTH) + '\n... [truncado - resultado muito longo]'
    }
    return resultStr
  }

  /**
   * Formata resultado de tool para exibição ao usuário
   */
  formatToolResult(toolName, toolArgs, result) {
    if (result.error) {
      return `**Erro ao executar ${toolName}:** ${result.error}`
    }
    
    switch (toolName) {
      case 'read_file':
        const content = result.content || ''
        const lines = result.lines || 0
        const ext = toolArgs.path.split('.').pop()
        return `**Arquivo:** \`${toolArgs.path}\` (${lines} linhas)

\`\`\`${ext}
${content}
\`\`\``
      
      case 'get_project_structure':
        const tree = result.structure || JSON.stringify(result, null, 2)
        return `**Estrutura do projeto:**

\`\`\`
${tree}
\`\`\``
      
      case 'list_directory':
        const files = result.entries || result.files || []
        if (Array.isArray(files) && files.length > 0) {
          const fileList = files.map(f => {
            const icon = f.type === 'directory' ? '📁' : '📄'
            return `${icon} ${f.name}`
          }).join('\n')
          return `**Conteúdo de \`${toolArgs.path || '.'}\`:**\n\n${fileList}`
        }
        return `**Diretório \`${toolArgs.path || '.'}\` está vazio.**`
      
      case 'search_files':
        const found = result.matches || result.files || []
        if (Array.isArray(found) && found.length > 0) {
          const foundList = found.map(f => `- \`${f.path || f.name || f}\``).join('\n')
          return `**Arquivos encontrados (padrão: \`${toolArgs.pattern}\`):**

${foundList}

*Total: ${found.length} arquivo(s)*`
        }
        return `**Nenhum arquivo encontrado com o padrão \`${toolArgs.pattern}\`**`
      
      case 'grep_code':
        const matches = result.results || result.matches || []
        if (Array.isArray(matches) && matches.length > 0) {
          const matchList = matches.map(m => {
            const filePath = m.path || ''
            const fileMatches = m.matches || []
            if (fileMatches.length === 0) return ''
            
            const lines = fileMatches.slice(0, 5).map(match => 
              `  Linha ${match.line}: \`${match.content}\``
            ).join('\n')
            const moreText = fileMatches.length > 5 ? `\n  *(+${fileMatches.length - 5} ocorrência(s))*` : ''
            
            return `**${filePath}**\n${lines}${moreText}`
          }).filter(Boolean).join('\n\n')
          
          const totalMatches = matches.reduce((sum, m) => sum + (m.matches?.length || 0), 0)
          return `**Busca por \`${toolArgs.query}\`:**

${matchList}

*Total: ${totalMatches} ocorrência(s) em ${matches.length} arquivo(s)*`
        }
        return `**Nenhum resultado para \`${toolArgs.query}\`**`
      
      case 'get_file_info':
        return `**Arquivo:** \`${toolArgs.path}\`
- **Nome:** ${result.name || 'N/A'}
- **Tamanho:** ${result.size_readable || result.size_bytes + ' bytes' || 'N/A'}
- **Linhas:** ${result.lines || 'N/A'}
- **Linguagem:** ${result.language || result.extension || 'N/A'}
- **Modificado:** ${result.modified ? new Date(result.modified).toLocaleString('pt-BR') : 'N/A'}`
      
      case 'write_file':
        return `✅ **Arquivo escrito com sucesso!**

- **Arquivo:** \`${result.path}\`
- **Linhas:** ${result.lines}
- **Bytes:** ${result.bytes}
- **Ação:** ${result.action === 'written' ? 'Criado/Sobrescrito' : result.action}`
      
      case 'patch_file':
        const lineDiff = result.new_lines - result.old_lines
        const diffStr = lineDiff > 0 ? `+${lineDiff}` : lineDiff < 0 ? `${lineDiff}` : '0'
        const matchInfo = result.matched ? `\n- **Texto encontrado:** \`${result.matched}\`` : ''
        return `✅ **Arquivo modificado com sucesso!**

- **Arquivo:** \`${result.path}\`
- **Linhas antes:** ${result.old_lines}
- **Linhas depois:** ${result.new_lines} (${diffStr})${matchInfo}
- **Ação:** Patch aplicado`
      
      case 'insert_at_line':
        return `✅ **Conteúdo inserido com sucesso!**

- **Arquivo:** \`${result.path}\`
- **Linha:** ${result.line}
- **Modo:** ${result.action.replace('inserted_', '')}
- **Total de linhas:** ${result.new_total_lines}`
      
      case 'search_codebase':
        const searchResults = result.results || []
        if (searchResults.length === 0) {
          return `**Busca por \`${result.query}\`:** Nenhum resultado encontrado.`
        }
        
        // Agrupa por arquivo
        const byFile = {}
        searchResults.forEach(r => {
          if (!byFile[r.file]) byFile[r.file] = []
          byFile[r.file].push(r)
        })
        
        let output = `**🔍 Busca por \`${result.query}\`** (${result.total} resultado(s))\n\n`
        
        Object.entries(byFile).slice(0, 10).forEach(([file, matches]) => {
          output += `**📄 ${file}**\n`
          matches.slice(0, 3).forEach(m => {
            const typeIcon = {
              'function': '⚡',
              'class': '🏛️',
              'variable': '📊',
              'import': '📦',
              'component': '🧩',
              'text': '📝'
            }[m.type] || '📝'
            
            output += `  ${typeIcon} Linha ${m.line}: \`${m.match}\`\n`
          })
          if (matches.length > 3) {
            output += `  *+${matches.length - 3} resultado(s)...*\n`
          }
          output += '\n'
        })
        
        if (Object.keys(byFile).length > 10) {
          output += `*+${Object.keys(byFile).length - 10} arquivo(s)...*\n`
        }
        
        return output
      
      default:
        return `**Resultado:**

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\``
    }
  }

  /**
   * Retorna histórico formatado
   */
  getHistory() {
    return this.conversationHistory.filter(m => 
      m.role === 'user' || (m.role === 'assistant' && m.content)
    )
  }

  /**
   * Extrai chamada de tool do texto quando o modelo não usa o formato correto
   * Detecta padrões como: ```tool {"name": "tool_name", "arguments": {...}} ```
   */
  extractToolCallFromText(text) {
    if (!text) return null
    
    // Lista de nomes de tools válidas
    const validTools = [
      'read_file', 'list_directory', 'search_files', 'grep_code', 
      'get_project_structure', 'get_file_info',
      'write_file', 'patch_file', 'insert_at_line',
      'search_codebase'
    ]
    
    // Padrões para detectar chamadas de tool
    const patterns = [
      // Formato preferido: ```tool {...} ```
      /```tool\s*\n?([\s\S]*?)```/,
      // Formato alternativo: ```json {...} ```
      /```json\s*\n?([\s\S]*?)```/,
      // Formato simples: ``` {...} ```
      /```\s*\n?(\{[\s\S]*?\})\s*```/,
      // JSON solto com name e arguments
      /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/,
      // JSON com path, search, replace (patch_file)
      /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"search"\s*:\s*"([^"]*?)"\s*,\s*"replace"\s*:\s*"([^"]*?)"\s*\}/,
      // JSON com path e content (write_file)
      /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([\s\S]*?)"\s*\}/
    ]
    
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        try {
          // Caso especial: patch_file com path, search, replace diretos
          if (match.length === 4 && match[0].includes('"search"')) {
            console.log('[AI Agent] Tool patch_file detectada (formato direto)')
            return {
              name: 'patch_file',
              arguments: {
                path: match[1],
                search: match[2],
                replace: match[3]
              }
            }
          }
          
          // Caso especial: write_file com path e content diretos
          if (match.length === 3 && match[0].includes('"content"')) {
            console.log('[AI Agent] Tool write_file detectada (formato direto)')
            return {
              name: 'write_file',
              arguments: {
                path: match[1],
                content: match[2]
              }
            }
          }
          
          let jsonStr = match[1]
          
          // Se o padrão já capturou name e arguments separados
          if (match[2]) {
            const toolName = match[1]
            if (validTools.includes(toolName)) {
              const args = JSON.parse(match[2])
              console.log(`[AI Agent] Tool detectada via regex: ${toolName}`, args)
              return { name: toolName, arguments: args }
            }
            continue
          }
          
          // Limpa o JSON
          jsonStr = jsonStr.trim()
          
          // Tenta parsear
          const parsed = JSON.parse(jsonStr)
          
          if (parsed.name && validTools.includes(parsed.name)) {
            console.log(`[AI Agent] Tool detectada: ${parsed.name}`, parsed.arguments)
            return { 
              name: parsed.name, 
              arguments: parsed.arguments || {} 
            }
          }
        } catch (e) {
          console.log('[AI Agent] Erro ao parsear JSON:', e.message)
          // Continua tentando outros padrões
        }
      }
    }
    
    // Tenta encontrar qualquer JSON com "name" de uma tool válida
    for (const toolName of validTools) {
      const simplePattern = new RegExp(`"name"\\s*:\\s*"${toolName}"`, 'i')
      if (simplePattern.test(text)) {
        // Tenta extrair o JSON completo
        const jsonMatch = text.match(/\{[\s\S]*?"name"[\s\S]*?"arguments"[\s\S]*?\{[\s\S]*?\}[\s\S]*?\}/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0])
            if (parsed.name && parsed.arguments) {
              console.log(`[AI Agent] Tool detectada via busca: ${parsed.name}`, parsed.arguments)
              return { name: parsed.name, arguments: parsed.arguments }
            }
          } catch (e) {
            // Continua
          }
        }
      }
    }
    
    return null
  }
}

// Exporta instância singleton
export const aiAgent = new AIAgent()

export default AIAgent
