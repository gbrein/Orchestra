'use client'

import { MessageSquare, Plus, Calendar } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DiscussionTable } from '@orchestra/shared'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DiscussionsListProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly discussions: readonly DiscussionTable[]
  readonly onSelectDiscussion: (discussion: DiscussionTable) => void
  readonly onNewDiscussion: () => void
}

// ─── Status badge styles ───────────────────────────────────────────────────

const STATUS_VARIANT: Record<
  DiscussionTable['status'],
  'default' | 'secondary' | 'outline'
> = {
  draft: 'secondary',
  active: 'default',
  concluded: 'outline',
}

const STATUS_LABEL: Record<DiscussionTable['status'], string> = {
  draft: 'Draft',
  active: 'Active',
  concluded: 'Concluded',
}

const STATUS_CLASS: Record<DiscussionTable['status'], string> = {
  draft: 'text-muted-foreground',
  active: 'border-green-500/40 bg-green-500/10 text-green-400',
  concluded: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Discussion row ────────────────────────────────────────────────────────

function DiscussionRow({
  discussion,
  onSelect,
}: {
  readonly discussion: DiscussionTable
  readonly onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left',
        'transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      aria-label={`Open discussion: ${discussion.name}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <MessageSquare className="h-4 w-4 text-primary" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{discussion.name}</p>
          <div
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
              STATUS_CLASS[discussion.status],
            )}
          >
            {STATUS_LABEL[discussion.status]}
          </div>
        </div>

        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground" title={discussion.topic}>
          {discussion.topic}
        </p>

        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" aria-hidden />
          <span>{formatDate(discussion.createdAt)}</span>
        </div>
      </div>
    </button>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onNewDiscussion }: { readonly onNewDiscussion: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <MessageSquare className="h-7 w-7 text-muted-foreground" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">No discussions yet</p>
        <p className="text-xs text-muted-foreground">
          Start a team discussion to see it here.
        </p>
      </div>
      <Button size="sm" className="gap-1.5 text-xs" onClick={onNewDiscussion}>
        <Plus className="h-3.5 w-3.5" aria-hidden />
        New Discussion
      </Button>
    </div>
  )
}

// ─── DiscussionsList ───────────────────────────────────────────────────────

export function DiscussionsList({
  open,
  onOpenChange,
  discussions,
  onSelectDiscussion,
  onNewDiscussion,
}: DiscussionsListProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[480px] flex-col gap-0 p-0 sm:w-[480px]"
        aria-label="Discussions list"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Discussions</SheetTitle>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={onNewDiscussion}
              aria-label="Create new discussion"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New Discussion
            </Button>
          </div>
          <SheetDescription className="sr-only">
            All team discussions. Click one to open it.
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div
          className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4"
          role="list"
          aria-label="Discussion list"
        >
          {discussions.length === 0 ? (
            <EmptyState onNewDiscussion={onNewDiscussion} />
          ) : (
            discussions.map((discussion) => (
              <div key={discussion.id} role="listitem">
                <DiscussionRow
                  discussion={discussion}
                  onSelect={() => {
                    onSelectDiscussion(discussion)
                    onOpenChange(false)
                  }}
                />
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
