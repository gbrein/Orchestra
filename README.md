# Orchestra

Visual orchestration platform for Claude Code agents. Drag-and-drop canvas to create AI assistants, connect skills, define safety rules, and run multi-agent discussions — all without writing code.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## What is Orchestra?

Orchestra gives you a visual workspace (like Figma meets n8n) where you can:

- **Create AI Assistants** — describe what you want in plain language, or configure every detail manually
- **Connect Skills** — browse a marketplace of abilities and drag them onto your assistants
- **Set Safety Rules** — 3-layer policy engine (global, per-assistant, per-session) ensures assistants ask before risky actions
- **Run Team Discussions** — multiple assistants brainstorm, review, or debate a topic with a facilitator
- **Build Agent Chains** — connect assistants in sequence (DAG) so output flows from one to the next
- **Autonomous Loops** — let an assistant iterate until a task is done, with progress tracking
- **PRD Pipelines** — feed a product requirements doc and watch assistants work through each story

## Screenshots

> Coming soon — run `npm run dev` to see it live.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Docker Desktop](https://docker.com/products/docker-desktop) (for PostgreSQL)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (`claude` in PATH)

## Quick Start

```bash
# Clone
git clone https://github.com/gbrein/Orchestra.git
cd Orchestra

# Install, start database, run migrations, seed sample data
npm run setup

# Start the app (frontend + backend)
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Architecture

Orchestra is a monorepo with three packages:

```
Orchestra/
├── packages/
│   ├── ui/          → Next.js 14 frontend (port 3000)
│   ├── server/      → Fastify backend + Socket.IO (port 3001)
│   └── shared/      → TypeScript types, terminology, model recommendations
├── docker-compose.yml  → PostgreSQL 16
└── turbo.json          → Turborepo
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Canvas | React Flow v12 (@xyflow/react) |
| Backend | Fastify, Socket.IO |
| Database | PostgreSQL 16, Prisma ORM |
| AI | Claude Code CLI (stream-json bidirectional) |
| Monorepo | npm workspaces, Turborepo |

### How It Works

1. You create assistants on a visual canvas and configure their personality, skills, and safety rules
2. Orchestra spawns Claude Code processes via `child_process.spawn` with `--output-format stream-json`
3. Real-time streaming flows through Socket.IO to the chat panel
4. A 3-layer policy engine intercepts tool calls and can require approval before risky actions
5. Discussion tables orchestrate turn-based multi-agent conversations with a facilitator
6. Agent chains execute a DAG of assistants, passing output as input to the next

## Features

### Canvas Workspace
- Drag-and-drop assistant, skill, policy, and MCP nodes
- Custom edges: association (dashed) and flow (animated)
- Undo/redo with 50-entry history
- Keyboard shortcuts (press `?` to see all)
- Command palette (`Ctrl+K`)
- 4 built-in templates (Code Review Pipeline, Content Team, Research Assistant, Brainstorm Team)
- Dark mode by default

### Smart Model Selection
Orchestra recommends the right Claude model for each task:

| Label | Model | Best For | Cost |
|-------|-------|----------|------|
| Deep Thinker | Opus | Complex analysis, code review | ~$0.08/msg |
| All-Rounder | Sonnet | Writing, coding, general tasks | ~$0.02/msg |
| Quick Helper | Haiku | Simple chat, high-volume workers | ~$0.005/msg |

You always have the option to override.

### Safety & Approval
- **Global rules** — defaults that apply to every assistant
- **Per-assistant rules** — override or tighten per assistant
- **Per-session rules** — temporary adjustments for a session
- Most restrictive policy always wins
- Visual approval dialog with risk-level detection, command editing, and 5-minute timeout
- Browser notifications when an assistant needs approval

### Skills Marketplace
- 5 built-in skills (Code Review, Writing Assistant, Data Analysis, API Designer, Test Writer)
- Import custom skills from any Git repository
- Skill conflict detection warns about overlapping instructions
- Drag-to-reorder priority per assistant

### MCP Integration
- Register external MCP servers (GitHub, Slack, databases, etc.)
- Skills can also be MCP servers
- Namespace isolation prevents conflicts between skill MCP and external MCP
- Per-assistant MCP assignment

### Discussion Tables
- 3 formats: Brainstorm, Review, Deliberation
- Facilitator (moderator) controls turn order and decides when to synthesize
- Up to 5 rounds with configurable limits
- Timeline view with export to Markdown
- Cost estimation before starting

### Autonomous Loops
- 4 completion criteria: regex match, test passes, manual review, max iterations
- Fresh context per iteration (avoids degradation)
- Progress log tracks learnings across iterations
- Visual loop indicator on canvas nodes

### Agent Chains (DAG)
- Connect assistants with directional edges
- Topological execution order with cycle detection
- Parallel branches via `Promise.allSettled`
- Conditional edges with regex patterns
- Fan-in: multiple inputs concatenated with headers

### PRD Pipelines
- Create PRDs with prioritized user stories
- Acceptance criteria with automatic verification (shell commands)
- One retry on failure before marking a story as failed
- Progress journal carries learnings across stories

## Development

### Commands

```bash
npm run dev            # Start everything (Turborepo)
npm run dev:ui         # Next.js only
npm run dev:server     # Fastify only
npm run build          # Build all packages
npm run lint           # Lint all packages
npm run format         # Format with Prettier

npm run docker:up      # Start PostgreSQL
npm run docker:down    # Stop PostgreSQL
npm run db:migrate     # Run Prisma migrations
npm run db:seed        # Seed sample data
npm run db:studio      # Open Prisma Studio
```

### Environment Variables

```bash
# packages/server/.env
DATABASE_URL=postgresql://orchestra:orchestra_dev@localhost:5432/orchestra
PORT=3001
UI_ORIGIN=http://localhost:3000
```

### Project Structure

```
packages/server/src/
├── index.ts                 # Fastify + Socket.IO entry
├── routes/                  # REST API endpoints
│   ├── agents.ts            #   CRUD for assistants
│   ├── skills.ts            #   Skills + marketplace + git import
│   ├── policies.ts          #   Safety rules CRUD
│   ├── sessions.ts          #   Conversation history
│   ├── discussions.ts       #   Discussion tables + transcript
│   ├── canvas.ts            #   Workspace + canvas layout
│   ├── mcp-servers.ts       #   MCP server registry
│   ├── approvals.ts         #   Pending approval queue
│   └── loops.ts             #   Loops, chains, PRD pipelines
├── engine/                  # Core orchestration
│   ├── spawner.ts           #   Claude Code CLI wrapper (stream-json)
│   ├── process-manager.ts   #   Process pool + watchdog
│   ├── prompt-builder.ts    #   System prompt composition
│   ├── policy-resolver.ts   #   3-layer policy merge
│   ├── policy-checker.ts    #   Tool use interception
│   ├── approval-manager.ts  #   Approval queue with timeout
│   ├── mcp-config-builder.ts #  MCP config merge + conflicts
│   ├── loop-engine.ts       #   Autonomous iteration
│   ├── chain-executor.ts    #   DAG execution
│   ├── prd-pipeline.ts      #   PRD story processing
│   └── error-types.ts       #   Error taxonomy
├── discussion/              # Multi-agent discussions
│   ├── moderator.ts         #   8-state moderator engine
│   ├── turn-router.ts       #   Sequential agent spawning
│   └── prompts.ts           #   Discussion prompt templates
├── skills/                  # Skill management
│   ├── catalog.ts           #   Built-in skill catalog
│   ├── installer.ts         #   Install from marketplace/git
│   ├── validator.ts         #   SKILL.md validation
│   └── conflict-detector.ts #   Heuristic conflict detection
├── socket/
│   └── handlers.ts          # Socket.IO event routing
└── lib/
    ├── prisma.ts            # Prisma client singleton
    ├── errors.ts            # Error utilities
    └── prerequisites.ts     # Startup health checks

packages/ui/src/
├── app/
│   ├── page.tsx             # Main page (canvas + panels)
│   ├── layout.tsx           # Root layout (dark mode, fonts)
│   └── globals.css          # Theme variables + status colors
├── components/
│   ├── canvas/              # React Flow
│   │   ├── orchestra-canvas.tsx
│   │   ├── canvas-placeholder.tsx
│   │   ├── template-gallery.tsx
│   │   ├── loop-indicator.tsx
│   │   ├── nodes/           # AgentNode, SkillNode, PolicyNode, McpNode
│   │   └── edges/           # OrchestraEdge
│   ├── panels/              # Side panels and dialogs
│   │   ├── agent-drawer.tsx        # 6-tab assistant config
│   │   ├── agent-create-dialog.tsx # NL + advanced creation
│   │   ├── agent-chat.tsx          # Real-time chat
│   │   ├── agent-skills-tab.tsx    # Drag-to-reorder skills
│   │   ├── agent-mcp-tab.tsx       # MCP assignment
│   │   ├── model-selector.tsx      # Deep Thinker / All-Rounder / Quick Helper
│   │   ├── approval-dialog.tsx     # Command approval with risk detection
│   │   ├── skill-marketplace.tsx   # Browse / Installed / Import
│   │   ├── skill-detail.tsx        # Skill info + SKILL.md preview
│   │   ├── mcp-management.tsx      # MCP server registry
│   │   ├── discussion-wizard.tsx   # 3-step discussion creation
│   │   ├── discussion-timeline.tsx # Chronological turn view
│   │   ├── discussion-controls.tsx # Start/pause/stop/export
│   │   ├── discussion-panel.tsx    # Combined timeline + controls
│   │   ├── session-history.tsx     # Past conversations
│   │   ├── loop-config.tsx         # Autonomous loop settings
│   │   ├── chain-config.tsx        # DAG config + cycle detection
│   │   └── prd-editor.tsx          # PRD + stories editor
│   ├── shell/               # App shell
│   │   ├── top-bar.tsx             # Logo, workspace, tabs, notifications
│   │   ├── sidebar.tsx             # Collapsible node palette
│   │   ├── bottom-bar.tsx          # Status, cost, zoom
│   │   ├── command-palette.tsx     # Ctrl+K search
│   │   ├── shortcut-overlay.tsx    # ? key shortcut reference
│   │   └── notification-panel.tsx  # Bell dropdown
│   └── ui/                  # shadcn/ui primitives
├── hooks/
│   ├── use-socket.ts        # Socket.IO connection
│   ├── use-agent-stream.ts  # Chat streaming
│   ├── use-discussion.ts    # Discussion streaming
│   ├── use-notifications.ts # Notification queue + browser API
│   ├── use-approvals.ts     # Approval queue
│   ├── use-undo-redo.ts     # Canvas history
│   └── use-keyboard-shortcuts.ts
└── lib/
    ├── socket.ts            # Socket.IO client singleton
    ├── canvas-utils.ts      # Node factories + helpers
    └── canvas-templates.ts  # 4 pre-built templates

packages/shared/src/
├── agent.ts         # Agent types + loop criteria
├── skill.ts         # Skill + MCP config types
├── policy.ts        # Policy rules + resolved policy
├── session.ts       # Session + message + token usage
├── discussion.ts    # Discussion table types
├── canvas.ts        # Canvas layout + workspace
├── socket-events.ts # Typed client ↔ server events
├── models.ts        # Model recommendation engine
└── terminology.ts   # Internal → user-facing term mapping
```

## Security

- **No shell injection**: all Claude Code processes spawned with args array, never `shell: true`
- **Env isolation**: child processes only receive PATH, HOME, ANTHROPIC_API_KEY — never DATABASE_URL
- **Git clone safety**: `--no-checkout --config core.hooksPath=/dev/null`, only SKILL.md checked out
- **Path sanitization**: skill names restricted to `[a-zA-Z0-9_-]`, no `..` allowed
- **Policy enforcement**: most restrictive policy always wins, sessions can only tighten rules
- **Process watchdog**: detects crashed processes every 10s, cleans up zombies
- **Approval timeout**: unanswered approvals auto-reject after 5 minutes

## Non-Technical Users

Orchestra is designed to be accessible to people who have never coded:

- **Plain language**: "Assistants" not "Agents", "Safety Rules" not "Policies", "Connections" not "MCP Servers"
- **Wizard creation**: describe what you want in natural language, Orchestra generates the configuration
- **Smart defaults**: model, safety level, and capabilities are auto-configured based on purpose
- **Progressive disclosure**: Simple mode hides all technical options. Full Control mode reveals everything.
- **Templates**: start with a pre-built team instead of a blank canvas
- **Human error messages**: "This assistant stopped unexpectedly" not "SIGTERM exit code 143"

## Contributing

Contributions are welcome! This is an MIT-licensed open-source project.

```bash
# Fork, clone, then:
npm run setup
npm run dev
```

## License

[MIT](LICENSE)
