'use client'

import { Star, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FavoriteAgent {
  readonly id: string
  readonly name: string
  readonly avatar?: string | null
  readonly status: string
}

interface FavoritesSectionProps {
  readonly agents: readonly FavoriteAgent[]
  readonly onSelect: (agentId: string) => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FavoritesSection({ agents, onSelect }: FavoritesSectionProps) {
  if (agents.length === 0) return null

  return (
    <div className="border-b border-border pb-2">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Favorites
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted',
            )}
            onClick={() => onSelect(agent.id)}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {agent.avatar ? (
                <img src={agent.avatar} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                agent.name.charAt(0).toUpperCase()
              )}
            </div>
            <span className="truncate">{agent.name}</span>
            <span
              className={cn(
                'ml-auto h-1.5 w-1.5 rounded-full',
                agent.status === 'running'
                  ? 'bg-blue-400 animate-pulse'
                  : agent.status === 'error'
                    ? 'bg-red-400'
                    : 'bg-green-400',
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  )
}
