'use client'

import { GitCommit } from 'lucide-react'
import type { GitLogEntry } from '@orchestra/shared'

interface GitLogTabProps {
  readonly entries: readonly GitLogEntry[]
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function GitLogTab({ entries }: GitLogTabProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <GitCommit className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No commits yet</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-0.5" role="list" aria-label="Commit history">
      {entries.map((entry) => (
        <li
          key={entry.hash}
          className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
        >
          <GitCommit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs">{entry.message}</p>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-mono">{entry.shortHash}</span>
              <span>{entry.author}</span>
              <span>{formatRelativeDate(entry.date)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
