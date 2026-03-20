'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, Bot, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActivityEvent {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly detail?: string
  readonly agentId?: string
  readonly workspaceId?: string
  readonly createdAt: string
}

interface ActivityFeedProps {
  readonly workspaceId?: string | null
}

// ─── Event icon ─────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<string, React.ElementType> = {
  agent_started: Bot,
  agent_completed: CheckCircle2,
  agent_error: AlertCircle,
}

function EventIcon({ type }: { readonly type: string }) {
  const Icon = EVENT_ICONS[type] ?? Activity
  return <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
}

// ─── Date grouping ──────────────────────────────────────────────────────────

function formatGroupDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ActivityFeed({ workspaceId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (workspaceId) params.set('workspaceId', workspaceId)

      const data = await apiGet<ActivityEvent[]>(`/api/activity?${params}`)
      setEvents(data)
    } catch {
      // Best effort
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Activity className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
        <p className="text-xs text-muted-foreground/70">
          Run an agent to see events here.
        </p>
      </div>
    )
  }

  // Group by date
  const grouped = new Map<string, ActivityEvent[]>()
  for (const event of events) {
    const key = formatGroupDate(event.createdAt)
    const group = grouped.get(key) ?? []
    group.push(event)
    grouped.set(key, group)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {Array.from(grouped.entries()).map(([date, group]) => (
        <div key={date}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {date}
          </p>
          <div className="flex flex-col gap-1">
            {group.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <EventIcon type={event.type} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs">{event.title}</p>
                  {event.detail && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {event.detail}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatTime(event.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
