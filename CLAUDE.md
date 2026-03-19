# Orchestra

## Project Overview

Orchestra is a local-first visual orchestration platform for Claude Code agents. Drag-and-drop canvas (React Flow) for creating agents, connecting skills, defining security policies, and running multi-agent discussions.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui, React Flow v12
- **Backend:** Fastify, Socket.IO, child_process.spawn (Claude Code CLI)
- **Database:** PostgreSQL 16 + Prisma ORM
- **Monorepo:** npm workspaces + Turborepo
- **Infra:** Docker Compose (PostgreSQL)

## Development

### Setup

```bash
npm run setup   # install deps + start docker + migrate DB + seed
```

### Running

```bash
npm run dev          # start all (turbo)
npm run dev:ui       # Next.js only (port 3000)
npm run dev:server   # Fastify only (port 3001)
```

### Database

```bash
npm run db:migrate   # run Prisma migrations
npm run db:seed      # seed sample data
npm run db:studio    # open Prisma Studio
npm run docker:up    # start PostgreSQL
npm run docker:down  # stop PostgreSQL
```

## Project Structure

```
orchestra/
├── packages/
│   ├── ui/              # Next.js 14 frontend
│   ├── server/          # Fastify backend + Socket.IO
│   │   ├── prisma/      # Prisma schema + migrations
│   │   └── src/
│   │       ├── index.ts         # Server entry
│   │       ├── routes/          # Fastify API routes
│   │       ├── engine/          # Spawner, ProcessManager, PolicyResolver
│   │       ├── discussion/      # Moderator engine, TurnRouter
│   │       ├── skills/          # Installer, validator, catalog
│   │       ├── socket/          # Socket.IO handlers
│   │       └── lib/             # Prisma client, errors, prerequisites
│   └── shared/          # TypeScript types + terminology
├── docker-compose.yml   # PostgreSQL
├── turbo.json           # Turborepo config
└── package.json         # Workspace root
```

## Conventions

- Follow immutable data patterns (readonly types, spread operator, no mutation)
- Handle errors explicitly with context
- Validate inputs at system boundaries (Zod schemas)
- Keep files under 800 lines, functions under 50 lines
- Use consistent API response envelope: `{ success, data?, error?, meta? }`
- User-facing terminology from `@orchestra/shared/terminology` (Agent→Assistant, etc.)
- Never use `shell: true` in child_process.spawn (security)
- Spawn Claude Code with `--output-format stream-json` for structured events
- Policy resolution: most restrictive wins (min for numbers, union for blocked lists)
- Dark mode as default theme
