# Orchestra — Design Document

> Plataforma local-first de orquestração visual de agentes Claude Code.
> Canvas drag-and-drop, skills marketplace, mesas de discussão com moderador, policy engine em camadas.

**Data:** 2026-03-19
**Status:** Validated — Ready for Implementation

---

## 1. Visão Geral

Orchestra é uma web app local que dá uma interface visual e amigável para orquestração de agentes Claude Code. Pessoas sem conhecimento técnico profundo conseguem criar agentes, conectar skills, definir regras de segurança e montar mesas de discussão — tudo num canvas drag-and-drop estilo Figma/n8n.

**Público:** Amigos, comunidade open-source, e futuramente times corporativos.

**Pré-requisito:** Claude Code instalado e autenticado (`claude` disponível no PATH).

### Decisões Arquiteturais

| Decisão | Escolha | Racional |
|---|---|---|
| Plataforma | Web app local (Next.js + Node) | UX moderna, migração cloud natural |
| Conexão Claude Code | Wrapper direto via CLI spawn | Preserva todo o poder do CC sem reimplementar |
| Modelo de agente | Persona + Skills + Tools + Memória + Escopo | Definição completa, enterprise-ready |
| Mesas de discussão | Assíncrono com moderador | Controle claro, evita loops infinitos |
| Skills | Marketplace curado + Git import | Onboarding fácil + flexibilidade total |
| Segurança | 3 camadas (global + agent + session) | Robusto, escalável pra compliance |
| Banco de dados | PostgreSQL + Prisma | Multi-user ready desde o início |
| UX | Canvas visual (React Flow) | Diferencial killer, acessível pra não-técnicos |
| Ambição | Open-source pessoal | Sem pressão, foco em qualidade e comunidade |

---

## 2. Arquitetura de Alto Nível

Três camadas:

### UI Layer (Next.js + React Flow)
Canvas visual onde agentes são nodes, skills e tools são conexões, e mesas de discussão são group nodes contendo múltiplos agentes. Toda interação acontece aqui: criar agentes, arrastar skills, configurar policies, acompanhar execuções em tempo real.

### Orchestration Layer (Node.js backend)
O cérebro. Responsável por:
- Gerenciar ciclo de vida dos agentes
- Spawnar processos Claude Code via CLI (`child_process.spawn`)
- Rotear mensagens nas mesas de discussão
- Aplicar policies de segurança
- Gerenciar approval workflow
- WebSockets pra streaming em tempo real

### Data Layer (PostgreSQL + Filesystem)
- Postgres: metadados (agentes, configs, políticas, histórico, memórias)
- Filesystem: skills instaladas (`~/.orchestra/skills/`), artefatos gerados
- Prisma como ORM

---

## 3. Modelo de Dados

### Agent
```
id              String    @id @default(uuid())
name            String
avatar          String?
description     String?
persona         String    // system prompt com tom, expertise, papel
scope           String[]  // array de paths permitidos
allowedTools    String[]  // ferramentas do CC habilitadas
memoryEnabled   Boolean   @default(false)
status          Enum      // idle, running, waiting_approval, error
createdAt       DateTime
updatedAt       DateTime

// Relations
skills          AgentSkill[]
policies        Policy[]
memories        Memory[]
sessions        Session[]
tables          TableParticipant[]
```

### Skill
```
id              String    @id @default(uuid())
name            String
description     String
source          Enum      // marketplace, git
gitUrl          String?
path            String    // path no filesystem local
version         String?
author          String?
category        String?
icon            String?
installedAt     DateTime

// Relations
agents          AgentSkill[]
```

### AgentSkill (many-to-many)
```
agentId         String
skillId         String
priority        Int       @default(0)  // ordem de prioridade
enabled         Boolean   @default(true)
```

### Policy
```
id              String    @id @default(uuid())
name            String
level           Enum      // global, agent, session
rules           Json      // { blockedCommands, requireApproval, maxFileSize, timeout, etc }
agentId         String?   // null = global
sessionId       String?   // null = persistent
createdAt       DateTime
```

### DiscussionTable
```
id              String    @id @default(uuid())
name            String
topic           String
format          Enum      // brainstorm, review, deliberation
moderatorId     String    // FK -> Agent
status          Enum      // draft, active, concluded
conclusion      String?   // síntese final do moderador
createdAt       DateTime
updatedAt       DateTime

// Relations
moderator       Agent
participants    TableParticipant[]
sessions        Session[]
```

### TableParticipant
```
tableId         String
agentId         String
role            Enum      // participant, observer, devil_advocate
```

### Session
```
id              String    @id @default(uuid())
agentId         String?
tableId         String?
messages        Json[]    // log completo de input/output
approvals       Json[]    // ações que pediram aprovação + decisão
startedAt       DateTime
endedAt         DateTime?
```

### Memory
```
id              String    @id @default(uuid())
agentId         String
key             String
value           String
createdAt       DateTime
updatedAt       DateTime
```

---

## 4. Canvas Visual (UX)

### Tipos de Nodes

**Agent Node** — Card com avatar, nome, status (indicador colorido). Handles nas laterais pra conectar. Click abre drawer lateral com configs.
- Verde: idle
- Azul: running
- Amarelo: waiting_approval
- Vermelho: error

**Skill Node** — Node menor estilo pill. Arrasta do Skill Marketplace sidebar pro canvas. Edge até um Agent = instala a skill nele.

**Discussion Table Node** — Group node container. Arrastar agentes pra dentro adiciona como participantes. Badge indica moderador. Abre timeline da discussão.

**Policy Node** — Ícone de escudo. Conecta em agentes ou fica solto (global). Azul = global, Amarelo = agent-level.

### Interações Principais
- Drag-and-drop do sidebar pra criar agentes/skills
- Edges entre nodes pra estabelecer relações
- Double-click num agent node abre chat/terminal
- Right-click pra ações contextuais (duplicar, deletar, ver logs)
- Mini-map no canto inferior
- Canvas é single source of truth visual — reflete e persiste no Postgres

### Biblioteca
@xyflow/react (React Flow v12) — nodes, edges, drag-and-drop, zoom, mini-map, group nodes.

---

## 5. Orchestration Engine

### Spawning de Agentes
1. Carrega config do agente (persona, skills, memórias, policies)
2. Monta system prompt composto: persona + memórias + skills + policies
3. Spawna `claude --system-prompt "..." --allowedTools "..." -p "mensagem"` via `child_process.spawn`
4. Captura stdout/stderr em streaming via WebSocket
5. Atualiza status do agent node no canvas em tempo real

### Approval Workflow
1. Claude Code gera uma ação (ex: `bash: rm -rf ./dist`)
2. Engine compara contra `rules` da policy ativa
3. Se requer aprovação → pausa processo, evento WebSocket pro frontend
4. Agent node fica amarelo, toast/modal: "Agente X quer executar `rm -rf ./dist`"
5. Opções: Aprovar / Rejeitar / Editar comando
6. Usuário decide → engine resume ou cancela

### Mesas de Discussão — Orquestração
1. Usuário inicia mesa com tópico
2. Moderador recebe tópico + lista de participantes e personas
3. Moderador decide ordem dos turnos e formula perguntas
4. Cada agente roda como spawn independente com contexto acumulado
5. Após cada rodada, moderador avalia: mais rodadas ou sintetizar?
6. Conclusão salva na mesa

### Real-time
Socket.IO conecta backend ↔ frontend. Agent nodes "pulsam" enquanto rodam. Output em tempo real no painel de chat do node.

---

## 6. Skills Marketplace

### Marketplace (Catálogo Curado)
- Painel lateral no canvas com cards de skills por categoria
- Categorias: Apresentações, Análise, Código, Dados, Escrita, etc
- Cada card: nome, descrição, autor, rating, botão "Instalar"
- Instalação baixa pra `~/.orchestra/skills/{skill-name}/`
- Skill aparece como Skill Node disponível no canvas

### Import via Git
- Botão "Import Custom Skill" aceita URL de repo Git
- Plataforma faz `git clone`, valida existência de `SKILL.md`
- Opção de auto-update (pull periódico) ou fixar em tag/versão

### Anatomia de uma Skill
```
skill-name/
├── SKILL.md          # Obrigatório — contrato do Claude Code
└── orchestra.json    # Opcional — metadata pro marketplace
```

`orchestra.json`:
```json
{
  "name": "Presentation Studio",
  "description": "End-to-end pipeline for executive presentations",
  "category": "Apresentações",
  "icon": "presentation",
  "author": "gbrein",
  "version": "1.0.0",
  "tags": ["pptx", "slides", "consulting"]
}
```

Sem `orchestra.json`, plataforma extrai do frontmatter do `SKILL.md`.

### Gestão no Agent Node
- Aba "Skills" no drawer do agente
- Reordenar prioridade, desabilitar temporariamente, preview do SKILL.md

---

## 7. Segurança e Governança

### Camada 1 — Global Policies (plataforma)
Pré-configuradas com defaults seguros:
- Confirmar antes de `rm`, `git push`, `docker rm`, `DROP TABLE`
- Bloquear acesso fora do home do usuário
- Timeout de execução: 5 min padrão
- Rate limiting: máximo de spawns simultâneos
- Log obrigatório de toda ação (audit trail)

### Camada 2 — Agent Policies (por agente)
- Override ou restrição adicional sobre a global
- Ex: agente "Estagiário" com `requireApproval: ALL`
- Ex: agente "DevOps Senior" com aprovação só pra destrutivos
- Configurável via drawer > aba "Security" (toggles + JSON editor)

### Camada 3 — Session Policies (temporárias)
- Apertar ou relaxar restrições por sessão
- Ex: "nessa sessão, pode rodar npm publish sem aprovação"
- Expiram ao encerrar sessão

### Resolução de Conflitos
A policy mais restritiva sempre vence. Global bloqueia > agent permite = bloqueado. Agent mais restritiva que global = agent vale.

### UX de Segurança
- Dashboard de audit log com timeline e filtros
- Borda vermelha no canvas se policy violada
- Export de logs pra compliance (futuro enterprise)

---

## 8. Tech Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | React 18 + TypeScript |
| Canvas | @xyflow/react (React Flow v12) |
| Styling | Tailwind CSS + shadcn/ui |
| Real-time | Socket.IO (client + server) |
| Backend | Next.js API Routes + custom server (Socket.IO) |
| ORM | Prisma |
| Banco | PostgreSQL |
| Process | child_process.spawn (Claude Code CLI) |
| Infra | Docker Compose (Postgres) |

---

## 9. Estrutura de Pastas

```
orchestra/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Canvas principal
│   │   ├── layout.tsx
│   │   └── api/                # API Routes
│   │       ├── agents/
│   │       ├── skills/
│   │       ├── policies/
│   │       ├── discussions/
│   │       └── sessions/
│   ├── components/
│   │   ├── canvas/             # React Flow nodes, edges, canvas wrapper
│   │   │   ├── AgentNode.tsx
│   │   │   ├── SkillNode.tsx
│   │   │   ├── TableNode.tsx
│   │   │   ├── PolicyNode.tsx
│   │   │   └── CanvasWrapper.tsx
│   │   ├── panels/             # Drawers, sidebars, modals
│   │   │   ├── AgentDrawer.tsx
│   │   │   ├── SkillMarketplace.tsx
│   │   │   ├── PolicyEditor.tsx
│   │   │   ├── DiscussionTimeline.tsx
│   │   │   └── ApprovalModal.tsx
│   │   ├── chat/               # Chat/terminal por agente
│   │   │   └── AgentChat.tsx
│   │   └── ui/                 # shadcn/ui components
│   ├── server/
│   │   ├── engine/             # Orchestration core
│   │   │   ├── spawner.ts      # Spawna Claude Code processes
│   │   │   ├── policyChecker.ts
│   │   │   └── approvalManager.ts
│   │   ├── discussion/         # Mesa de discussão
│   │   │   ├── moderator.ts    # Moderator loop + turn management
│   │   │   └── turnRouter.ts
│   │   └── socket/             # WebSocket event handlers
│   │       └── socketServer.ts
│   ├── lib/
│   │   ├── prisma/             # Schema, client, seed
│   │   │   └── client.ts
│   │   ├── skills/             # Skill management
│   │   │   ├── installer.ts    # Download + git clone
│   │   │   ├── marketplace.ts  # Catálogo curado
│   │   │   └── validator.ts    # Valida SKILL.md
│   │   └── claude/             # Claude Code CLI wrapper
│   │       └── cli.ts          # Build commands, parse output
│   └── types/                  # TypeScript types
│       ├── agent.ts
│       ├── skill.ts
│       ├── policy.ts
│       ├── discussion.ts
│       └── session.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/
│   └── icons/                  # Skill/agent icons
├── skills/                     # Skills instaladas (filesystem)
├── docker-compose.yml          # PostgreSQL
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

---

## 10. Escopo MVP vs v2

### MVP (v1)
- [ ] Canvas com agent nodes: criar, configurar persona/escopo, conectar skills
- [ ] Spawnar agente e chat em tempo real (WebSocket streaming)
- [ ] Skill marketplace local com 3-5 skills pré-carregadas + import via Git
- [ ] Policy engine com global defaults + agent-level overrides
- [ ] Approval workflow básico (toast com aprovar/rejeitar)
- [ ] Uma mesa de discussão funcional com moderador e 2-3 agentes

### v2 (Futuro)
- [ ] Memory persistente cross-session
- [ ] Audit log dashboard completo
- [ ] Marketplace com rating e comunidade
- [ ] Templates de agentes pré-configurados ("Dev Frontend", "Analista de Dados", etc)
- [ ] Export/import de canvas inteiros (compartilhar setups)
- [ ] Auth multi-user + roles (admin, editor, viewer)
- [ ] Dark mode
- [ ] i18n (pt-BR, en)
- [ ] Plugin system pra estender a plataforma
