/**
 * AI Tools - Ferramentas que a IA pode usar para interagir com o código
 * 
 * Cada tool tem:
 * - name: Nome único da tool
 * - description: Descrição para a IA entender quando usar
 * - parameters: Schema JSON dos parâmetros
 * - execute: Função que executa a tool
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Definição das tools no formato OpenAI Function Calling
 */
export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lê o conteúdo de um arquivo. Use para ver o código fonte de um arquivo específico.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Caminho do arquivo relativo ao workspace (ex: src/App.vue)'
          },
          start_line: {
            type: 'number',
            description: 'Linha inicial (opcional, começa em 1)'
          },
          end_line: {
            type: 'number',
            description: 'Linha final (opcional)'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'Lista arquivos e pastas de um diretório. Use para explorar a estrutura do projeto.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Caminho do diretório relativo ao workspace (ex: src/components). Use "." para raiz.'
          },
          recursive: {
            type: 'boolean',
            description: 'Se true, lista recursivamente. Default: false'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Busca arquivos por nome ou padrão glob. Use para encontrar arquivos específicos.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Padrão de busca (ex: "*.vue", "App*", "test")'
          },
          path: {
            type: 'string',
            description: 'Diretório para buscar (opcional, default: raiz do workspace)'
          }
        },
        required: ['pattern']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grep_code',
      description: 'Busca texto ou regex no código. Use para encontrar onde algo é usado ou definido.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Texto ou regex para buscar'
          },
          path: {
            type: 'string',
            description: 'Diretório para buscar (opcional, default: raiz)'
          },
          include: {
            type: 'string',
            description: 'Padrão de arquivos para incluir (ex: "*.ts", "*.vue")'
          },
          case_sensitive: {
            type: 'boolean',
            description: 'Se a busca é case-sensitive. Default: false'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_project_structure',
      description: 'Retorna a estrutura completa do projeto em formato de árvore. Use para ter uma visão geral.',
      parameters: {
        type: 'object',
        properties: {
          max_depth: {
            type: 'number',
            description: 'Profundidade máxima da árvore. Default: 3'
          },
          include_hidden: {
            type: 'boolean',
            description: 'Incluir arquivos/pastas ocultos. Default: false'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_file_info',
      description: 'Retorna informações sobre um arquivo (tamanho, tipo, linhas, etc).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Caminho do arquivo'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Cria um novo arquivo ou sobrescreve um arquivo existente com conteúdo fornecido.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Caminho do arquivo relativo ao workspace'
          },
          content: {
            type: 'string',
            description: 'Conteúdo completo a ser escrito no arquivo'
          }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'patch_file',
      description: 'Aplica modificações em um arquivo existente usando busca e substituição. Use para editar partes específicas de um arquivo.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Caminho do arquivo relativo ao workspace'
          },
          search: {
            type: 'string',
            description: 'Texto exato a ser encontrado (deve ser único no arquivo)'
          },
          replace: {
            type: 'string',
            description: 'Texto que substituirá o texto encontrado'
          }
        },
        required: ['path', 'search', 'replace']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'insert_at_line',
      description: 'Insere conteúdo em uma linha específica do arquivo. Use para adicionar código em posições precisas.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Caminho do arquivo relativo ao workspace'
          },
          line: {
            type: 'number',
            description: 'Número da linha onde inserir (1-based)'
          },
          content: {
            type: 'string',
            description: 'Conteúdo a ser inserido'
          },
          mode: {
            type: 'string',
            enum: ['before', 'after', 'replace'],
            description: 'Modo de inserção: before (antes da linha), after (depois), replace (substitui a linha). Default: before'
          }
        },
        required: ['path', 'line', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_codebase',
      description: 'Busca inteligente no código combinando múltiplas estratégias. Use para encontrar funções, classes, variáveis, ou qualquer código relacionado a um conceito.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termo de busca (ex: "autenticação", "getUserData", "class User")'
          },
          type: {
            type: 'string',
            enum: ['all', 'function', 'class', 'variable', 'import', 'component'],
            description: 'Tipo de código a buscar. Default: all'
          },
          file_pattern: {
            type: 'string',
            description: 'Padrão de arquivos para filtrar (ex: "*.vue", "*.js")'
          },
          max_results: {
            type: 'number',
            description: 'Número máximo de resultados. Default: 20'
          }
        },
        required: ['query']
      }
    }
  }
]

/**
 * Implementação das tools
 */
class ToolExecutor {
  constructor(workspacePath) {
    this.workspacePath = workspacePath
  }

  setWorkspace(workspacePath) {
    this.workspacePath = workspacePath
  }

  resolvePath(relativePath) {
    if (!this.workspacePath) {
      throw new Error('Workspace não selecionado')
    }
    const resolved = path.resolve(this.workspacePath, relativePath)
    // Segurança: garantir que está dentro do workspace
    if (!resolved.startsWith(this.workspacePath)) {
      throw new Error('Caminho fora do workspace')
    }
    return resolved
  }

  async execute(toolName, params) {
    const method = this[toolName]
    if (!method) {
      throw new Error(`Tool desconhecida: ${toolName}`)
    }
    return await method.call(this, params)
  }

  /**
   * Lê conteúdo de um arquivo
   */
  async read_file({ path: filePath, start_line, end_line }) {
    let resolved
    
    try {
      resolved = this.resolvePath(filePath)
      await fs.access(resolved)
    } catch {
      // Arquivo não encontrado, tenta buscar pelo nome
      const fileName = path.basename(filePath)
      const searchResult = await this.search_files({ pattern: fileName })
      
      if (searchResult.matches && searchResult.matches.length > 0) {
        // Usa o primeiro resultado encontrado
        const foundPath = searchResult.matches[0].path
        resolved = this.resolvePath(foundPath)
        filePath = foundPath // Atualiza o caminho para exibição
      } else {
        throw new Error(`Arquivo não encontrado: ${filePath}`)
      }
    }
    
    const content = await fs.readFile(resolved, 'utf8')
    
    if (start_line || end_line) {
      const lines = content.split('\n')
      const start = (start_line || 1) - 1
      const end = end_line || lines.length
      const sliced = lines.slice(start, end)
      
      return {
        path: filePath,
        content: sliced.join('\n'),
        start_line: start + 1,
        end_line: Math.min(end, lines.length),
        total_lines: lines.length,
        lines: sliced.length
      }
    }
    
    return {
      path: filePath,
      content,
      total_lines: content.split('\n').length,
      lines: content.split('\n').length
    }
  }

  /**
   * Lista conteúdo de um diretório
   */
  async list_directory({ path: dirPath, recursive = false }) {
    const resolved = this.resolvePath(dirPath || '.')
    
    const listDir = async (dir, depth = 0) => {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const result = []
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue // Ignora ocultos
        
        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(this.workspacePath, fullPath)
        
        if (entry.isDirectory()) {
          const item = { name: entry.name, path: relativePath, type: 'directory' }
          if (recursive && depth < 5) {
            item.children = await listDir(fullPath, depth + 1)
          }
          result.push(item)
        } else {
          result.push({ name: entry.name, path: relativePath, type: 'file' })
        }
      }
      
      // Ordena: pastas primeiro, depois arquivos, ambos alfabeticamente
      return result.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    }
    
    const entries = await listDir(resolved)
    return { path: dirPath || '.', entries }
  }

  /**
   * Busca arquivos por padrão
   */
  async search_files({ pattern, path: searchPath }) {
    const startDir = this.resolvePath(searchPath || '.')
    const results = []
    const patternLower = pattern.toLowerCase()
    const isGlob = pattern.includes('*')
    
    const search = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        
        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(this.workspacePath, fullPath)
        
        if (entry.isDirectory()) {
          await search(fullPath)
        } else {
          let matches = false
          if (isGlob) {
            // Simples glob matching
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
            matches = regex.test(entry.name)
          } else {
            matches = entry.name.toLowerCase().includes(patternLower)
          }
          
          if (matches) {
            results.push({ name: entry.name, path: relativePath })
          }
        }
        
        if (results.length >= 50) return // Limite de resultados
      }
    }
    
    await search(startDir)
    return { pattern, matches: results, count: results.length }
  }

  /**
   * Busca texto no código (grep)
   */
  async grep_code({ query, path: searchPath, include, case_sensitive = false }) {
    const startDir = this.resolvePath(searchPath || '.')
    const results = []
    const flags = case_sensitive ? 'g' : 'gi'
    const regex = new RegExp(query, flags)
    
    const searchFile = async (filePath) => {
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const lines = content.split('\n')
        const matches = []
        
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            matches.push({
              line: index + 1,
              content: line.trim().substring(0, 200) // Limita tamanho
            })
          }
          regex.lastIndex = 0 // Reset regex state
        })
        
        if (matches.length > 0) {
          const relativePath = path.relative(this.workspacePath, filePath)
          results.push({ path: relativePath, matches })
        }
      } catch {
        // Ignora arquivos que não podem ser lidos
      }
    }
    
    const search = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          await search(fullPath)
        } else {
          // Verifica extensão se include foi especificado
          if (include) {
            const ext = path.extname(entry.name)
            const includeExts = include.replace(/\*/g, '').split(',').map(e => e.trim())
            if (!includeExts.some(ie => ext === ie || entry.name.endsWith(ie))) {
              continue
            }
          }
          
          // Só busca em arquivos de texto comuns
          const textExts = ['.js', '.ts', '.vue', '.jsx', '.tsx', '.json', '.md', '.css', '.scss', '.html', '.xml', '.yaml', '.yml', '.txt', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h']
          if (textExts.includes(path.extname(entry.name).toLowerCase())) {
            await searchFile(fullPath)
          }
        }
        
        if (results.length >= 30) return // Limite de arquivos com matches
      }
    }
    
    await search(startDir)
    return { query, results, total_files: results.length }
  }

  /**
   * Retorna estrutura do projeto
   */
  async get_project_structure({ max_depth = 3, include_hidden = false }) {
    const buildTree = async (dir, depth = 0, prefix = '') => {
      if (depth > max_depth) return ''
      
      let output = ''
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      const filtered = entries.filter(e => {
        if (!include_hidden && e.name.startsWith('.')) return false
        if (e.name === 'node_modules') return false
        return true
      }).sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
      
      for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i]
        const isLast = i === filtered.length - 1
        const connector = isLast ? '└── ' : '├── '
        const childPrefix = prefix + (isLast ? '    ' : '│   ')
        
        if (entry.isDirectory()) {
          output += prefix + connector + entry.name + '/\n'
          output += await buildTree(path.join(dir, entry.name), depth + 1, childPrefix)
        } else {
          output += prefix + connector + entry.name + '\n'
        }
      }
      
      return output
    }
    
    const rootName = path.basename(this.workspacePath)
    let tree = rootName + '/\n'
    tree += await buildTree(this.workspacePath)
    
    return { structure: tree }
  }

  /**
   * Informações sobre um arquivo
   */
  async get_file_info({ path: filePath }) {
    const resolved = this.resolvePath(filePath)
    const stat = await fs.stat(resolved)
    const content = await fs.readFile(resolved, 'utf8')
    const lines = content.split('\n')
    const ext = path.extname(filePath)
    
    // Detecta linguagem
    const langMap = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.vue': 'Vue',
      '.jsx': 'React JSX',
      '.tsx': 'React TSX',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.html': 'HTML',
      '.py': 'Python',
      '.go': 'Go',
      '.rs': 'Rust'
    }
    
    return {
      path: filePath,
      name: path.basename(filePath),
      extension: ext,
      language: langMap[ext] || 'Unknown',
      size_bytes: stat.size,
      size_readable: formatBytes(stat.size),
      lines: lines.length,
      modified: stat.mtime.toISOString()
    }
  }

  /**
   * Escreve conteúdo em um arquivo (criar ou sobrescrever)
   */
  async write_file({ path: filePath, content }) {
    const resolved = this.resolvePath(filePath)
    
    // Cria diretório se não existir
    const dir = path.dirname(resolved)
    await fs.mkdir(dir, { recursive: true })
    
    // Escreve o arquivo
    await fs.writeFile(resolved, content, 'utf8')
    
    const lines = content.split('\n').length
    return {
      path: filePath,
      action: 'written',
      lines: lines,
      bytes: content.length
    }
  }

  /**
   * Aplica patch em arquivo (busca e substituição)
   */
  async patch_file({ path: filePath, search, replace }) {
    const resolved = this.resolvePath(filePath)
    const content = await fs.readFile(resolved, 'utf8')
    
    // Tenta encontrar o texto exato primeiro
    let foundText = search
    let occurrences = content.split(search).length - 1
    
    // Se não encontrou exato, tenta case-insensitive
    if (occurrences === 0) {
      const searchLower = search.toLowerCase()
      const lines = content.split('\n')
      
      for (const line of lines) {
        if (line.toLowerCase().includes(searchLower)) {
          // Encontra a substring que match
          const idx = line.toLowerCase().indexOf(searchLower)
          foundText = line.substring(idx, idx + search.length)
          occurrences = 1
          break
        }
      }
    }
    
    // Verifica se o texto de busca existe
    if (occurrences === 0) {
      throw new Error(`Texto não encontrado no arquivo. Buscando por: "${search}"`)
    }
    
    // Verifica se é único (apenas para matches exatos)
    if (occurrences > 1 && foundText === search) {
      throw new Error(`Texto encontrado ${occurrences} vezes. Deve ser único para segurança. Use um texto mais específico.`)
    }
    
    // Aplica substituição
    const newContent = content.replace(foundText, replace)
    await fs.writeFile(resolved, newContent, 'utf8')
    
    return {
      path: filePath,
      action: 'patched',
      old_lines: content.split('\n').length,
      new_lines: newContent.split('\n').length,
      matched: foundText
    }
  }

  /**
   * Insere conteúdo em linha específica
   */
  async insert_at_line({ path: filePath, line, content, mode = 'before' }) {
    const resolved = this.resolvePath(filePath)
    const fileContent = await fs.readFile(resolved, 'utf8')
    const lines = fileContent.split('\n')
    
    // Valida linha
    if (line < 1 || line > lines.length + 1) {
      throw new Error(`Linha ${line} inválida. O arquivo tem ${lines.length} linhas.`)
    }
    
    const lineIndex = line - 1
    
    // Aplica a inserção baseado no modo
    switch (mode) {
      case 'before':
        lines.splice(lineIndex, 0, content)
        break
      case 'after':
        lines.splice(lineIndex + 1, 0, content)
        break
      case 'replace':
        lines[lineIndex] = content
        break
      default:
        throw new Error(`Modo inválido: ${mode}. Use 'before', 'after' ou 'replace'.`)
    }
    
    const newContent = lines.join('\n')
    await fs.writeFile(resolved, newContent, 'utf8')
    
    return {
      path: filePath,
      action: `inserted_${mode}`,
      line: line,
      new_total_lines: lines.length
    }
  }

  /**
   * Busca inteligente no codebase
   */
  async search_codebase({ query, type = 'all', file_pattern, max_results = 20 }) {
    const results = []
    const queryLower = query.toLowerCase()
    
    // Padrões de busca por tipo
    const patterns = {
      function: [
        /(?:function|async function)\s+(\w+)\s*\(/g,
        /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
        /(\w+)\s*:\s*(?:async\s*)?function/g,
        /(\w+)\s*\([^)]*\)\s*\{/g // Métodos
      ],
      class: [
        /class\s+(\w+)/g,
        /interface\s+(\w+)/g,
        /type\s+(\w+)\s*=/g
      ],
      variable: [
        /(?:const|let|var)\s+(\w+)\s*=/g,
        /export\s+(?:const|let|var)\s+(\w+)/g
      ],
      import: [
        /import\s+.*?from\s+['"]([^'"]+)['"]/g,
        /import\s+['"]([^'"]+)['"]/g,
        /require\s*\(['"]([^'"]+)['"]\)/g
      ],
      component: [
        /<([A-Z]\w+)/g, // Vue/React components
        /export\s+default\s+\{/g
      ]
    }
    
    // Determina quais padrões usar
    const searchPatterns = type === 'all' 
      ? Object.values(patterns).flat()
      : patterns[type] || []
    
    // Função para buscar em um arquivo
    const searchInFile = async (filePath) => {
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const lines = content.split('\n')
        const fileResults = []
        
        // Busca por padrões específicos
        if (searchPatterns.length > 0) {
          for (const pattern of searchPatterns) {
            let match
            const regex = new RegExp(pattern.source, pattern.flags)
            
            while ((match = regex.exec(content)) !== null) {
              const matchedText = match[1] || match[0]
              
              // Verifica se match contém a query
              if (matchedText.toLowerCase().includes(queryLower) || 
                  content.substring(Math.max(0, match.index - 50), match.index + 100)
                    .toLowerCase().includes(queryLower)) {
                
                // Encontra o número da linha
                const beforeMatch = content.substring(0, match.index)
                const lineNum = beforeMatch.split('\n').length
                
                // Pega contexto (2 linhas antes e depois)
                const startLine = Math.max(0, lineNum - 2)
                const endLine = Math.min(lines.length, lineNum + 2)
                const contextLines = lines.slice(startLine, endLine)
                
                fileResults.push({
                  file: path.relative(this.workspacePath, filePath),
                  line: lineNum,
                  match: matchedText,
                  context: contextLines.join('\n'),
                  type: type === 'all' ? this.detectType(match[0]) : type
                })
              }
            }
          }
        }
        
        // Busca textual simples
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(queryLower)) {
            // Evita duplicatas
            const alreadyFound = fileResults.some(r => r.line === idx + 1)
            if (!alreadyFound) {
              const startLine = Math.max(0, idx - 1)
              const endLine = Math.min(lines.length, idx + 3)
              const contextLines = lines.slice(startLine, endLine)
              
              fileResults.push({
                file: path.relative(this.workspacePath, filePath),
                line: idx + 1,
                match: line.trim(),
                context: contextLines.join('\n'),
                type: 'text'
              })
            }
          }
        })
        
        return fileResults
      } catch (e) {
        return []
      }
    }
    
    // Busca recursiva em diretórios
    const searchDir = async (dir) => {
      if (results.length >= max_results) return
      
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (results.length >= max_results) break
        
        // Ignora node_modules e pastas ocultas
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          await searchDir(fullPath)
        } else if (entry.isFile()) {
          // Filtra por padrão se especificado (simples glob)
          if (file_pattern) {
            const pattern = file_pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
            const regex = new RegExp(`^${pattern}$`, 'i')
            if (!regex.test(entry.name)) continue
          }
          
          // Apenas arquivos de código
          const codeExts = ['.js', '.ts', '.vue', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.css', '.scss', '.html']
          const ext = path.extname(entry.name).toLowerCase()
          
          if (codeExts.includes(ext)) {
            const fileResults = await searchInFile(fullPath)
            results.push(...fileResults.slice(0, max_results - results.length))
          }
        }
      }
    }
    
    await searchDir(this.workspacePath)
    
    // Ordena por relevância (matches exatos primeiro)
    results.sort((a, b) => {
      const aExact = a.match.toLowerCase() === queryLower
      const bExact = b.match.toLowerCase() === queryLower
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    })
    
    return {
      query,
      total: results.length,
      results: results.slice(0, max_results)
    }
  }
  
  /**
   * Detecta o tipo de código baseado no match
   */
  detectType(match) {
    if (/^(function|async function)/.test(match)) return 'function'
    if (/^class/.test(match)) return 'class'
    if (/^(const|let|var)/.test(match)) return 'variable'
    if (/^import/.test(match)) return 'import'
    if (/^<[A-Z]/.test(match)) return 'component'
    return 'code'
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Instância singleton
export const toolExecutor = new ToolExecutor(null)

export default { toolDefinitions, toolExecutor }
