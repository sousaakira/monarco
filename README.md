# Monarco.

Monarco é um editor/IDE desktop (Electron + Vue + Monaco) focado em fluxo de trabalho com **agentes de IA via CLI** dentro do próprio editor.

Ele combina:
- editor de código (Monaco)
- explorer de arquivos (inclui múltiplas pastas/projetos no mesmo workspace)
- terminal integrado com perfis de ambiente para CLIs de IA (xterm + node-pty)
- chat/terminal de IA acoplados ao projeto
- loja de CLIs (catálogo em JSON no repositório)

## Para que serve

- Centralizar o trabalho com **CLIs de agentes** (ex.: OpenClaude) sem sair do editor.
- Alternar entre **sessões** de terminal/IA, com perfis e variáveis de ambiente.
- Trabalhar com **mais de um projeto** ao mesmo tempo (multi-root workspace) e iniciar a IA em diretórios diferentes.
- Atualizar automaticamente o editor/árvore quando um agente alterar/criar arquivos no disco.

## Principais recursos

- **Terminal IA com sessões**: crie várias sessões de terminal, feche individualmente e mantenha sessões ativas sem reiniciar ao trocar perfis.
- **Perfis de terminal**: gerencie `startupCommand` e `env` por perfil (ex.: OpenRouter ou modelos locais).
- **Retomar sessões de IA**: captura automaticamente comandos `--resume` emitidos por CLIs e permite retomar depois.
- **Loja de CLIs**:
  - catálogo público em JSON: [cli-store.json](file:///home/akira/Documents/Desenvolvimentos/AkiraProjects/monarco/cli-store.json)
  - busca catálogo remoto em `https://raw.githubusercontent.com/sousaakira/monarco/main/cli-store.json`
  - instala/remova pacotes via npm (global ou local em `~/.monarco/cli`)
- **Multi-root workspace**:
  - adicione/remova pastas no workspace
  - escolha projeto ao iniciar um agente/CLI (modal quando houver múltiplas pastas)
- **Hot reload do editor**: quando um arquivo muda no disco e a aba não está “dirty”, o conteúdo é recarregado automaticamente.

## Configuração

O Monarco guarda configurações em:
- Linux/macOS: `~/.monarco/settings.json`

Esse arquivo é criado automaticamente apenas quando não existe. O editor faz escrita atômica para evitar corrupção do arquivo.

## Loja de CLIs (catálogo comunitário)

A loja é alimentada por um arquivo JSON no próprio repositório:
- [cli-store.json](file:///home/akira/Documents/Desenvolvimentos/AkiraProjects/monarco/cli-store.json)

Qualquer pessoa pode adicionar um novo app CLI abrindo um PR.

Exemplo (OpenClaude):
- pacote npm: `@gitlawb/openclaude`
- instalação: `npm i -g @gitlawb/openclaude` (ou local, dependendo do modo selecionado na loja)

## Desenvolvimento

Pré-requisitos:
- Node.js (recomendado usar a mesma major da sua máquina)

Rodar em modo desenvolvimento:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Empacotar:

```bash
npm run build:linux
npm run build:win
npm run build:mac
```

Lint:

```bash
npm run lint
```

## Contribuindo

- PRs são bem-vindos para:
  - melhorias no editor/terminal/IA
  - novos apps no catálogo da loja (`cli-store.json`)
  - ajustes de UX e performance

Se for adicionar um app CLI no catálogo, inclua no mínimo:
- `id`, `name`, `description`
- `package` (npm)
- `bin` (comando esperado)
- `tags`

