# Orchestra

Visual orchestration platform for Claude Code agents. A drag-and-drop canvas where you create AI assistants, connect skills, define safety policies, and run multi-agent discussions — all from your browser, all running locally.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-18%2B-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)

---

## Table of Contents

- [What is Orchestra?](#what-is-orchestra)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Features](#features)
  - [Canvas Workspace](#canvas-workspace)
  - [Assistant Management](#assistant-management)
  - [Real-Time Chat](#real-time-chat)
  - [Safety and Approval Engine](#safety-and-approval-engine)
  - [Skills Marketplace](#skills-marketplace)
  - [MCP Integration](#mcp-integration)
  - [Discussion Tables](#discussion-tables)
  - [Autonomous Loops](#autonomous-loops)
  - [Agent Chains (DAG)](#agent-chains-dag)
  - [Maestro Orchestrator](#maestro-orchestrator)
  - [Workflow Advisor](#workflow-advisor)
  - [PRD Pipelines](#prd-pipelines)
  - [Workspace Resources](#workspace-resources)
  - [Authentication](#authentication)
- [Development](#development)
  - [Commands](#commands)
  - [Environment Variables](#environment-variables)
  - [Project Structure](#project-structure)
- [How It Works Under the Hood](#how-it-works-under-the-hood)
- [Security](#security)
- [Accessibility and Non-Technical Users](#accessibility-and-non-technical-users)
- [Contributing](#contributing)
- [License](#license)

---

## What is Orchestra?

Orchestra is a local-first platform that transforms Claude Code into a visual, multi-agent system. Think of it as Figma meets n8n for AI agents. Instead of writing YAML configs or shell scripts, you:

- **Create AI assistants** on a visual canvas — describe what you want in plain language, or configure every detail manually (persona, model, tools, safety rules)
- **Connect skills** — browse a built-in marketplace, import from Git repositories, drag skills onto your assistants
- **Set safety rules** — a 3-layer policy engine (global, per-assistant, per-session) ensures assistants ask before performing risky actions
- **Run team discussions** — multiple assistants brainstorm, review code, or debate a topic with an automated facilitator
- **Build agent chains** — connect assistants in a directed graph so output flows from one to the next
- **Enable autonomous loops** — let an assistant iterate on a task until it's done, with configurable completion criteria
- **Process PRDs** — feed a product requirements doc and watch assistants work through each user story

Everything runs on your machine. Claude Code processes are spawned locally via `child_process.spawn`, and all data lives in a local PostgreSQL database. Nothing is sent to third-party services beyond the Anthropic API calls that Claude Code itself makes.

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| [Node.js](https://nodejs.org/) | 18+ | Runtime for frontend and backend |
| [Docker Desktop](https://docker.com/products/docker-desktop) | Any recent | Runs PostgreSQL via Docker Compose |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Latest | The AI engine — must be installed and authenticated (`claude` available in PATH) |

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/gbrein/Orchestra.git
cd Orchestra

# 2. Run the automated setup
#    This installs dependencies, generates .env with a random auth secret,
#    starts PostgreSQL via Docker, runs database migrations, and seeds sample data.
npm run setup

# 3. Start the application
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The first time you access the app, you'll be prompted to create an account (email/password). This account is local to your Orchestra instance.

### What the Setup Does

The `npm run setup` command runs these steps automatically:

1. `npm install` — installs all dependencies across the monorepo
2. `node scripts/setup-env.js` — generates a `.env` file from `.env.example` with a cryptographically random `BETTER_AUTH_SECRET` (cross-platform, no bash required)
3. `docker-compose up -d` — starts PostgreSQL 16 in a container (port 5432)
4. `npm run db:migrate` — runs all Prisma migrations to create the database schema
5. `npm run db:seed` — seeds sample data (example assistants, skills, and policies)

---

## Architecture

Orchestra is a monorepo with three packages:

```
Orchestra/
├── packages/
│   ├── ui/             → Next.js 14 frontend (port 3000)
│   ├── server/         → Fastify backend + Socket.IO (port 3001)
│   └── shared/         → TypeScript types shared between frontend and backend
├── docker-compose.yml  → PostgreSQL 16
├── turbo.json          → Turborepo pipeline configuration
├── .env                → Environment variables (auto-generated by setup)
└── package.json        → Workspace root with scripts
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui | Server-side rendering, modern React patterns, utility-first styling |
| **Canvas** | React Flow v12 (@xyflow/react) | Production-grade node-based UI with built-in pan/zoom/selection |
| **Backend** | Fastify, Socket.IO | High-performance HTTP server with real-time bidirectional communication |
| **Database** | PostgreSQL 16, Prisma ORM | Relational data model with type-safe queries and migrations |
| **Authentication** | Better Auth | Email/password + OAuth (GitHub, Google) with session cookies |
| **AI Engine** | Claude Code CLI | Spawned as child processes with `--output-format stream-json` for structured streaming |
| **Monorepo** | npm workspaces, Turborepo | Shared dependencies, parallel builds, incremental caching |

### Data Flow

```
Browser (React)                    Server (Fastify)                   Claude Code CLI
     │                                  │                                  │
     │  ── Socket.IO ──────────────────►│                                  │
     │     agent:start                  │── child_process.spawn ──────────►│
     │                                  │   --output-format stream-json    │
     │                                  │                                  │
     │  ◄── agent:text (streaming) ─────│◄── stdout JSON events ──────────│
     │  ◄── agent:tool_use ─────────────│                                  │
     │  ◄── agent:tool_result ──────────│                                  │
     │                                  │                                  │
     │  ◄── agent:approval ─────────────│   (policy check intercepted)     │
     │  ── approval:respond ───────────►│── stdin approval ───────────────►│
     │                                  │                                  │
     │  ◄── agent:done ─────────────────│◄── exit ────────────────────────│
     │     { usage: tokens, cost }      │                                  │
```

---

## Features

### Canvas Workspace

The canvas is the heart of Orchestra. It's a React Flow-powered workspace where you visually arrange and connect your AI system.

- **Node types**: Assistant, Skill, Policy, MCP Server, Resource, and Sticky Note nodes
- **Edge types**: Association (dashed lines for configuration) and Flow (animated lines for data)
- **Drag and drop**: Drag nodes from the sidebar palette onto the canvas
- **Undo/redo**: 50-entry history stack, accessible via `Ctrl+Z` / `Ctrl+Shift+Z`
- **Keyboard shortcuts**: Press `?` to see all available shortcuts
- **Command palette**: `Ctrl+K` opens a searchable command menu
- **Templates**: 4 pre-built configurations to start from (Code Review Pipeline, Content Team, Research Assistant, Brainstorm Team)
- **Persistence**: Canvas layout is auto-saved to the database with 2-second debounce
- **Project-based workspaces**: Each workspace is tied to a project folder — select the folder when creating the workspace, and all resources, git, and agent execution happen in that directory
- **Multiple workspaces**: Create, rename, switch, and delete workspaces — each with its own canvas, resources, and git context
- **Dark mode**: Default theme with carefully chosen status colors

### Assistant Management

Assistants are the core building blocks. Each one wraps a Claude Code process with a specific personality, set of skills, and safety rules.

- **Natural language creation**: Describe what you want ("a code reviewer that focuses on security") and Orchestra generates the configuration
- **Advanced configuration**: 6-tab drawer with full control over persona, model, skills, MCP servers, memory, and loop settings
- **Model selection**: Three tiers with cost guidance:

| Tier | Model | Best For | Approx. Cost |
|------|-------|----------|-------------|
| Deep Thinker | Claude Opus | Complex analysis, architecture, code review | ~$0.08/msg |
| All-Rounder | Claude Sonnet | Writing, coding, general tasks | ~$0.02/msg |
| Quick Helper | Claude Haiku | Simple chat, quick answers, high-volume workers | ~$0.005/msg |

- **Favorites**: Pin frequently used assistants to the sidebar for quick access
- **Assistants list**: View all assistants with status, search, and bulk management

### Real-Time Chat

Each assistant has a full-featured chat panel that streams responses in real-time.

- **Streaming text**: Responses appear character-by-character as they're generated
- **Tool use visibility**: Expandable cards show which tools the assistant is using, with input and output details
- **File attachments**: Reference workspace files in your messages via the paperclip button
- **Mode toggle**: Switch between Default, Plan, and Review modes during a conversation
- **Token counter**: Shows input/output tokens and estimated cost after each response
- **Error recovery**: Classifies errors (timeout, rate limit, network, auth) with retry buttons for transient failures
- **Session persistence**: Chat history survives closing and reopening the panel (30-minute cache)
- **Bottom bar**: Live display of running assistant count and total session tokens

### Safety and Approval Engine

Orchestra implements a 3-layer policy system that ensures assistants operate within defined boundaries.

**Policy layers** (most restrictive wins):

1. **Global policies** — defaults that apply to every assistant in the workspace
2. **Per-assistant policies** — override or tighten rules for a specific assistant
3. **Per-session policies** — temporary adjustments for a single conversation

**Policy capabilities**:

- **Permission modes**: `default`, `plan-mode`, `full-auto`, or `approve-all`
- **Tool blocking**: Specify tools that should never be used (e.g., `rm`, `git push`)
- **Approval requirements**: Mark specific tools as requiring human approval before execution
- **Budget limits**: Set maximum spend per session in USD
- **File/directory restrictions**: Control which paths the assistant can read or write

**Approval flow**:

1. The policy checker intercepts a tool call that requires approval
2. The assistant pauses and a dialog appears in the browser with the command details
3. You can approve, reject, or edit the command before approving
4. Unanswered approvals auto-reject after 5 minutes
5. Browser notifications alert you when an assistant needs approval

### Skills Marketplace

Skills are reusable instruction sets (defined in `SKILL.md` files) that give assistants specialized capabilities.

- **Built-in catalog**: 5 ready-to-use skills (Code Review, Writing Assistant, Data Analysis, API Designer, Test Writer)
- **Git import**: Install skills from any public Git repository — Orchestra clones safely (no checkout hooks), validates the `SKILL.md`, and makes it available
- **Conflict detection**: When assigning multiple skills to an assistant, heuristic analysis warns about overlapping or contradictory instructions
- **Priority ordering**: Drag-to-reorder skills per assistant to control instruction precedence
- **Skill detail view**: Preview the full `SKILL.md` content, see metadata, and manage installations

### MCP Integration

Orchestra supports the Model Context Protocol (MCP) for connecting assistants to external tools and data sources.

- **Server registry**: Register MCP servers with name, command, arguments, and environment variables
- **Per-assistant assignment**: Choose which MCP servers each assistant can access
- **Namespace isolation**: Skill-provided MCP tools and external MCP servers are isolated to prevent conflicts
- **Configuration builder**: Automatically generates the MCP config that gets passed to Claude Code at spawn time

### Discussion Tables

Discussion tables enable multi-agent conversations where several assistants collaborate on a topic under the guidance of an automated facilitator.

- **3 formats**:
  - **Brainstorm** — open-ended idea generation, facilitator synthesizes themes
  - **Review** — structured critique of a document/code/proposal
  - **Deliberation** — debate toward a decision, facilitator tracks arguments and drives convergence
- **Facilitator engine**: An 8-state moderator that controls turn order, summarizes progress, and decides when to conclude
- **Configurable rounds**: Set maximum rounds (up to 5) to control discussion length
- **Timeline view**: Chronological display of all turns with speaker identification
- **Export**: Download the full discussion transcript as Markdown
- **Cost estimation**: See estimated token costs before starting a discussion

### Autonomous Loops

Loops let an assistant iterate on a task autonomously until a completion criterion is met.

- **4 completion criteria**:
  - **Regex match** — stop when output matches a pattern
  - **Test passes** — run a shell command and stop when it exits 0
  - **Manual review** — pause after each iteration for human review
  - **Max iterations** — hard cap on number of iterations
- **Fresh context**: Each iteration starts with a clean context to avoid degradation over long runs
- **Progress journal**: Learnings from each iteration are carried forward as context
- **Visual indicator**: Canvas nodes show a pulsing loop icon when an iteration is running

### Agent Chains (DAG) — Workflows

Chains allow you to connect assistants in a directed acyclic graph (DAG), where the output of one assistant becomes the input of the next.

- **Visual wiring**: Draw edges between assistant nodes on the canvas to define the flow
- **Topological execution**: Chains execute in dependency order with automatic cycle detection
- **Parallel branches**: Independent branches run concurrently via `Promise.allSettled`
- **Conditional edges**: Add regex patterns to edges so data only flows when the output matches
- **Fan-in support**: When multiple edges converge on one assistant, outputs are concatenated with headers
- **Workflow chat**: Dedicated chat panel shows real-time streaming, tool usage, and step completion with token costs
- **Step output**: Each step shows the full agent response — click to open the agent's individual chat with the workflow history
- **Node status**: Canvas nodes change status to "running" during execution and revert to "idle" on completion
- **Cost tracking**: Total workflow cost (tokens + USD) displayed on completion
- **Persistence**: Workflow runs are stored in the database (`ChainRun` + `ChainStepResult`) for history

### Maestro Orchestrator

Maestro is an intelligent supervisor that sits between workflow steps. Instead of passing raw output from one assistant to the next, Maestro evaluates each step's output and contextualizes the handoff.

- **Visual overlay**: Appears as a distinctive purple card on the canvas above the chain, showing real-time status (idle, evaluating, decided)
- **Contextualizes messages**: Wraps each assistant's output with clear instructions so the next assistant understands the full picture
- **Redirect (retry)**: If output quality is insufficient, Maestro can redirect back to the same step with improved instructions — first redirect is auto-approved, subsequent retries require user confirmation
- **Early conclusion**: Can conclude the workflow early if the objective is already met before all steps run
- **Criticism level**: Configurable rigor from 1 (Relaxed) to 5 (Demanding) via a slider in the Maestro settings drawer — controls how strict the evaluation is
- **Custom instructions**: Free-text instructions appended to the Maestro's system prompt for workflow-specific guidance
- **Language consistency**: Detects the language of agent output and ensures all subsequent agents respond in the same language
- **Learning**: Saves patterns observed across runs (e.g., "Code Writer tends to forget error handling") to the Memory table for future reference
- **Truncation handling**: Recognizes that truncated outputs (due to token limits) are normal and does not redirect for them
- **Max retries**: Limits redirects to 2 per step to prevent infinite loops
- **Settings drawer**: Click the Maestro overlay to open a panel with toggle, criticism slider, custom instructions, and usage guide

### Workflow Advisor

Advisor is a post-run analysis tool that evaluates a completed workflow and suggests actionable improvements.

- **Canvas FAB**: Floating action button in the bottom-left corner of the canvas, visible after the first completed workflow run
- **Configurable model**: Choose between Haiku (fast/cheap), Sonnet (balanced), or Opus (deepest analysis) via dropdown in the workflow chat
- **Suggestion categories**: Agent improvements (persona tweaks), skill recommendations (from the marketplace catalog), step order changes, and output quality assessment
- **One-click actions**: "Apply Skill" installs and attaches a skill to the agent; "Update Persona" updates the agent's persona directly — both with loading/success feedback
- **Inline results**: Analysis results render as a card in the workflow chat with category badges, severity indicators, and an objective-met assessment

### PRD Pipelines

PRD Pipelines let you feed a product requirements document and have assistants work through each user story.

- **PRD editor**: Create structured PRDs with prioritized user stories and acceptance criteria
- **Automated verification**: Each acceptance criterion can include a shell command that verifies the implementation
- **Retry logic**: One automatic retry on failure before marking a story as failed
- **Progress journal**: Learnings and outcomes carry forward across stories to maintain context

### Workspace Resources

Each workspace is tied to a project folder. Resources (files, links, notes, variables) live inside the project at `{project}/.orchestra/resources/`, making them visible in your file system and version-controllable (`.orchestra/` is auto-added to `.gitignore`).

- **Project folder**: Selected at workspace creation — all resources, agents, and git operations target this folder
- **File uploads**: Drag-and-drop or click-to-browse file upload, stored inside the project
- **Folder browser**: Built-in file system navigator to select project folders, with git repository detection
- **Links**: Save URLs with titles and descriptions
- **Notes**: Rich text notes that auto-save on blur
- **Variables**: Key-value pairs for configuration, with optional encryption for secrets (AES-256-GCM)
- **File injection**: Workspace files are in the agent's working directory — no separate `--add-dir` needed
- **Git integration**: Git panel automatically shows the status, branches, and log of the project folder

### Git Integration

The Git panel provides full git visibility and operations scoped to the workspace's project folder.

- **Scoped to project**: All git operations (status, log, branches, diff, stage, commit, push) run in the workspace's configured folder
- **Visual status**: See modified, staged, and untracked files with one-click stage/unstage
- **Commit & push**: Commit staged changes with a message and push directly from the panel
- **Branch view**: See all local branches with the current branch highlighted
- **Directory indicator**: Shows which folder git is operating on — no ambiguity

### Authentication

Orchestra uses Better Auth for user authentication, keeping everything local to your instance.

- **Email/password**: Create an account with email and password (min 8 characters)
- **OAuth providers**: Optionally enable GitHub and/or Google sign-in by providing client credentials in `.env`
- **Session management**: Cookie-based sessions with 5-minute cache for performance
- **Route protection**: All API routes (except auth endpoints) require a valid session

---

## Development

### Commands

```bash
# ── Running ──────────────────────────────────────────
npm run dev              # Start everything via Turborepo
npm run dev:ui           # Next.js frontend only (port 3000)
npm run dev:server       # Fastify backend only (port 3001)

# ── Building ─────────────────────────────────────────
npm run build            # Build all packages
npm run lint             # Lint all packages
npm run format           # Format with Prettier
npm run format:check     # Check formatting without writing

# ── Database ─────────────────────────────────────────
npm run docker:up        # Start PostgreSQL container
npm run docker:down      # Stop PostgreSQL container
npm run db:migrate       # Run Prisma migrations
npm run db:seed          # Seed sample data
npm run db:studio        # Open Prisma Studio (visual DB browser)

# ── Testing ──────────────────────────────────────────
npm run test             # Run all tests
npm run test:coverage    # Run tests with coverage report
```

### Environment Variables

A single `.env` file at the project root is used by all packages. The `npm run setup` command generates it automatically from `.env.example` with a random `BETTER_AUTH_SECRET`.

```env
# Required (auto-generated by setup)
DATABASE_URL=postgresql://orchestra:orchestra_dev@localhost:5432/orchestra
PORT=3001
UI_ORIGIN=http://localhost:3000
BETTER_AUTH_SECRET=<random-64-char-hex>
BETTER_AUTH_URL=http://localhost:3001

# Optional — OAuth providers (leave empty to disable)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

To enable GitHub or Google sign-in, create OAuth applications on the respective platforms and fill in the client ID and secret.

### Project Structure

```
packages/server/src/
├── index.ts                    # Fastify + Socket.IO entry point
├── auth/
│   ├── auth.ts                 # Better Auth configuration
│   └── middleware.ts           # Session validation middleware
├── routes/
│   ├── agents.ts               # CRUD for assistants
│   ├── skills.ts               # Skills + marketplace + git import
│   ├── policies.ts             # Safety policy CRUD
│   ├── sessions.ts             # Conversation history
│   ├── discussions.ts          # Discussion tables + transcripts
│   ├── canvas.ts               # Workspaces + canvas layout
│   ├── resources.ts            # File upload, links, notes, variables
│   ├── git.ts                  # Git operations (status, log, branches, commit, push)
│   ├── filesystem.ts           # Directory browser for folder picker
│   ├── mcp-servers.ts          # MCP server registry
│   ├── approvals.ts            # Pending approval queue
│   ├── loops.ts                # Loops, chains, PRD pipelines
│   ├── activity.ts             # Activity event log
│   ├── analytics.ts            # Token usage analytics
│   ├── memories.ts             # Assistant memory storage
│   └── auth.ts                 # Authentication routes (passthrough to Better Auth)
├── engine/
│   ├── spawner.ts              # Claude Code CLI wrapper (stream-json)
│   ├── process-manager.ts      # Process pool + watchdog
│   ├── prompt-builder.ts       # System prompt composition
│   ├── policy-resolver.ts      # 3-layer policy merge
│   ├── policy-checker.ts       # Tool use interception
│   ├── approval-manager.ts     # Approval queue with timeout
│   ├── mcp-config-builder.ts   # MCP config merge + conflict resolution
│   ├── loop-engine.ts          # Autonomous iteration engine
│   ├── chain-executor.ts       # DAG execution engine (linear + Maestro-driven)
│   ├── maestro.ts              # Maestro orchestrator (evaluate, contextualize, redirect)
│   ├── advisor.ts              # Workflow Advisor (post-run analysis + suggestions)
│   ├── prd-pipeline.ts         # PRD story processing
│   └── error-types.ts          # Error taxonomy and classification
├── discussion/
│   ├── moderator.ts            # 8-state facilitator engine
│   ├── turn-router.ts          # Sequential agent spawning per turn
│   └── prompts.ts              # Discussion prompt templates
├── skills/
│   ├── catalog.ts              # Built-in skill catalog (5 skills)
│   ├── installer.ts            # Install from marketplace or git
│   ├── validator.ts            # SKILL.md format validation
│   └── conflict-detector.ts    # Heuristic skill conflict detection
├── resources/
│   ├── file-storage.ts         # Project-based file storage ({project}/.orchestra/resources/)
│   ├── encryption.ts           # AES-256-GCM for secret variables
│   └── resource-injector.ts    # Inject workspace resources into assistant context
├── services/
│   └── activity.ts             # Activity event recording
├── socket/
│   └── handlers.ts             # Socket.IO event routing + Claude Code callbacks
└── lib/
    ├── prisma.ts               # Prisma client singleton
    ├── errors.ts               # Error response utilities
    └── prerequisites.ts        # Startup health checks (Node, Docker, Claude Code)

packages/ui/src/
├── app/
│   ├── page.tsx                # Main workspace page (canvas + all panels)
│   ├── login/page.tsx          # Login page
│   ├── register/page.tsx       # Registration page
│   ├── layout.tsx              # Root layout (dark mode, fonts, auth guard)
│   ├── globals.css             # Theme variables + status colors
│   ├── loading.tsx             # Loading skeleton
│   └── error.tsx               # Error boundary page
├── components/
│   ├── canvas/
│   │   ├── orchestra-canvas.tsx      # Main React Flow canvas
│   │   ├── canvas-placeholder.tsx    # Empty state with quick actions
│   │   ├── template-gallery.tsx      # Pre-built template selector
│   │   ├── loop-indicator.tsx        # Visual loop progress overlay
│   │   ├── maestro-overlay.tsx      # Maestro status card on canvas
│   │   ├── advisor-fab.tsx          # Advisor floating action button
│   │   ├── nodes/                    # AgentNode, SkillNode, PolicyNode, McpNode, ResourceNode, StickyNoteNode
│   │   └── edges/                    # OrchestraEdge (association + flow)
│   ├── panels/
│   │   ├── agent-chat.tsx            # Real-time streaming chat
│   │   ├── agent-create-dialog.tsx   # Natural language + advanced creation
│   │   ├── agent-drawer.tsx          # 6-tab assistant configuration
│   │   ├── agent-skills-tab.tsx      # Drag-to-reorder skill assignment
│   │   ├── agent-mcp-tab.tsx         # MCP server assignment
│   │   ├── agent-memory-tab.tsx      # Memory configuration
│   │   ├── approval-dialog.tsx       # Command approval with risk detection
│   │   ├── skill-marketplace.tsx     # Browse, install, import skills
│   │   ├── skill-detail.tsx          # Skill info + SKILL.md preview
│   │   ├── mcp-management.tsx        # MCP server CRUD
│   │   ├── resource-browser.tsx      # Files, links, notes, variables
│   │   ├── discussion-wizard.tsx     # 3-step discussion setup
│   │   ├── discussion-panel.tsx      # Timeline + controls
│   │   ├── discussion-timeline.tsx   # Chronological turn view
│   │   ├── discussion-controls.tsx   # Start/pause/stop/export
│   │   ├── discussions-list.tsx      # All discussions list
│   │   ├── assistants-list.tsx       # All assistants with status
│   │   ├── workflow-chat.tsx         # Workflow execution chat with streaming
│   │   ├── workflow-toolbar.tsx      # Canvas workflow controls (run/stop)
│   │   ├── maestro-drawer.tsx       # Maestro settings (toggle, rigor, instructions)
│   │   ├── advisor-card.tsx         # Advisor suggestion card with actions
│   │   ├── git-panel.tsx            # Git status, log, branches, commit, push
│   │   ├── workspace-switcher.tsx   # Create (with folder picker), rename, delete workspaces
│   │   ├── workspace-context-editor.tsx  # Workspace context document + working directory
│   │   ├── workspace-plan-editor.tsx     # Workspace plan document
│   │   ├── global-safety-panel.tsx   # Global policy editor
│   │   ├── settings-panel.tsx        # App settings (complexity, theme)
│   │   ├── model-selector.tsx        # Model tier selector
│   │   ├── mode-toggle.tsx           # Default/Plan/Review mode
│   │   ├── session-history.tsx       # Past conversation sessions
│   │   ├── chain-config.tsx          # DAG builder + cycle detection
│   │   ├── loop-config.tsx           # Loop criteria configuration
│   │   ├── prd-editor.tsx            # PRD + user stories editor
│   │   ├── cost-dashboard.tsx        # Token usage and cost tracking
│   │   ├── activity-feed.tsx         # Recent activity timeline
│   │   └── history-panel.tsx         # Historical sessions
│   ├── shell/
│   │   ├── top-bar.tsx               # Logo, workspace switcher, tabs, notifications
│   │   ├── sidebar.tsx               # Collapsible node palette + favorites
│   │   ├── bottom-bar.tsx            # Connection status, running agents, tokens, zoom
│   │   ├── command-palette.tsx       # Ctrl+K searchable command menu
│   │   ├── shortcut-overlay.tsx      # Keyboard shortcut reference
│   │   ├── notification-panel.tsx    # Bell dropdown with notification queue
│   │   ├── quick-run-bar.tsx         # Quick agent run (Ctrl+Shift+R)
│   │   ├── user-avatar.tsx           # User menu (settings, appearance, sign out)
│   │   └── favorites-section.tsx     # Pinned assistant shortcuts
│   ├── auth/
│   │   └── auth-guard.tsx            # Route protection component
│   ├── shared/
│   │   ├── tool-card.tsx             # Reusable expandable tool card
│   │   └── folder-picker.tsx         # Directory browser dialog
│   └── ui/                           # shadcn/ui primitives (Button, Dialog, Sheet, etc.)
├── hooks/
│   ├── use-socket.ts                 # Socket.IO auto-connection + status tracking
│   ├── use-git.ts                    # Git operations hook (workspace-scoped)
│   ├── use-agent-stream.ts           # Chat streaming with session-level cache
│   ├── use-agent-status.ts           # Global agent status + token tracking
│   ├── use-canvas-persistence.ts     # Workspace CRUD + canvas save/load
│   ├── use-resources.ts              # File upload + resource management
│   ├── use-discussion.ts             # Discussion streaming
│   ├── use-notifications.ts          # Notification queue + browser API
│   ├── use-approvals.ts              # Approval queue management
│   ├── use-auth.ts                   # Authentication state
│   ├── use-theme.ts                  # Theme management
│   ├── use-complexity.ts             # Simple/Full complexity toggle
│   ├── use-undo-redo.ts              # Canvas history stack
│   └── use-keyboard-shortcuts.ts     # Global keyboard shortcut bindings
└── lib/
    ├── api.ts                        # Typed API helpers (GET, POST, PATCH, DELETE, Upload)
    ├── auth.ts                       # Better Auth client
    ├── socket.ts                     # Socket.IO client singleton
    ├── canvas-utils.ts               # Node factories + canvas helpers
    └── canvas-templates.ts           # 4 pre-built team templates

packages/shared/src/
├── index.ts             # Barrel export
├── agent.ts             # Agent types, status, loop criteria, model tiers
├── skill.ts             # Skill metadata + MCP configuration types
├── policy.ts            # Policy rules, levels, and resolved policy
├── session.ts           # Session, message, and token usage types
├── discussion.ts        # Discussion table, participant, format types
├── canvas.ts            # Canvas layout and workspace types
├── resource.ts          # Workspace resource types
├── socket-events.ts     # Typed Socket.IO event contracts (client ↔ server)
├── models.ts            # Model recommendation engine with tier mapping
└── terminology.ts       # Internal → user-facing term mapping (Agent→Assistant, etc.)
```

---

## How It Works Under the Hood

### Spawning an Assistant

When you send a message to an assistant, Orchestra:

1. **Builds a system prompt** from the assistant's persona, assigned skills, workspace context document, and injected resources
2. **Resolves the effective policy** by merging global, per-assistant, and per-session policies (most restrictive wins)
3. **Creates a session record** in the database to track the conversation
4. **Spawns a Claude Code process** via `child_process.spawn` with `--output-format stream-json`, passing the model, permission mode, allowed tools, and budget limits as CLI arguments
5. **Streams events** from Claude Code's stdout through Socket.IO to the browser in real-time
6. **Intercepts tool calls** through the policy checker — blocked tools are rejected, approved tools proceed, and tools requiring approval pause the process until the user responds
7. **Records activity** for each start, completion, and error event with user attribution

### Process Management

- A **process pool** tracks all running Claude Code processes by agent ID
- A **watchdog** runs every 10 seconds to detect crashed processes and clean up zombies
- **Graceful shutdown** (SIGINT/SIGTERM) stops all running processes, loops, chains, and pipelines before exiting

### Real-Time Communication

- The frontend connects to the backend via **Socket.IO** (WebSocket with polling fallback)
- Socket connections are **authenticated** — the server validates the session cookie on connection
- Events are **typed end-to-end** using shared TypeScript interfaces (`ClientToServerEvents`, `ServerToClientEvents`)

### Database Schema

The Prisma schema defines 20+ models including:

- `Agent` — assistant configuration (persona, model, skills, status)
- `AgentSession` / `SessionMessage` — conversation history
- `Policy` — safety rules at global, agent, and session levels
- `Skill` / `AgentSkill` — skill catalog and per-assistant assignment
- `Workspace` / `CanvasLayout` — workspace management with project folder (`workingDirectory`) and canvas persistence
- `WorkspaceResource` — files, links, notes, variables per workspace
- `ChainRun` / `ChainStepResult` — workflow execution history with output, tokens, and cost per step
- `DiscussionTable` / `DiscussionParticipant` — multi-agent discussion state
- `McpServerConfig` — MCP server registry
- `ActivityEvent` — audit log of all assistant activity
- `AuthUser` / `AuthSession` / `AuthAccount` — Better Auth user management

---

## Security

Orchestra takes security seriously at every layer:

- **No shell injection**: All Claude Code processes are spawned with an args array — never `shell: true`
- **Environment isolation**: Child processes only receive `PATH`, `HOME`, `APPDATA`, and essential system variables — never `DATABASE_URL` or other server secrets
- **Git clone safety**: Skill imports use `--no-checkout --config core.hooksPath=/dev/null`, and only `SKILL.md` is checked out
- **Path sanitization**: Skill names are restricted to `[a-zA-Z0-9_-]` with no `..` allowed
- **File upload safety**: Uploaded filenames are replaced with UUIDs, path traversal is blocked, and file size is validated both during streaming and at the buffer level
- **Secret encryption**: Workspace variable values marked as secret are encrypted with AES-256-GCM before database storage and never sent to the frontend
- **Policy enforcement**: The most restrictive policy always wins — sessions can only tighten rules, never loosen them
- **Process watchdog**: Detects crashed processes every 10 seconds and cleans up zombie processes
- **Approval timeout**: Unanswered tool approval requests are automatically rejected after 5 minutes
- **CORS**: Both Fastify and Socket.IO enforce origin restrictions with credentials support
- **Authentication**: All API routes require a valid session cookie; Socket.IO connections validate the session on handshake

---

## Accessibility and Non-Technical Users

Orchestra is designed to be usable by people who have never written code:

- **Friendly terminology**: "Assistants" not "Agents", "Safety Rules" not "Policies", "Connections" not "MCP Servers"
- **Natural language creation**: Describe what you want in plain English — Orchestra generates the assistant configuration
- **Smart defaults**: Model, safety level, and capabilities are auto-selected based on the assistant's stated purpose
- **Progressive disclosure**: Simple mode hides all technical options; Full Control mode reveals everything
- **Templates**: Start with a pre-built team (Code Review, Content, Research, Brainstorm) instead of a blank canvas
- **Human error messages**: "This assistant stopped unexpectedly" instead of "SIGTERM exit code 143"
- **ARIA labels**: All interactive elements have accessible labels for screen reader compatibility
- **Keyboard navigation**: Full keyboard support with documented shortcuts

---

## Contributing

Contributions are welcome! This is an MIT-licensed open-source project.

```bash
# Fork and clone, then:
npm run setup
npm run dev

# Run tests before submitting a PR:
npm run test
npm run lint
```

### Code Conventions

- **Immutability**: Always create new objects, never mutate existing ones
- **Error handling**: Handle errors explicitly at every level with user-friendly messages
- **Validation**: All inputs validated at system boundaries with Zod schemas
- **File size**: Keep files under 800 lines and functions under 50 lines
- **API envelope**: Consistent `{ success, data?, error?, meta? }` response format
- **No console.log**: Use proper logging in production code

---

## License

[MIT](LICENSE)
