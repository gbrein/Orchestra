'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { SessionHistory } from './session-history'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface HistoryPanelProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

// ─── HistoryPanel ──────────────────────────────────────────────────────────

export function HistoryPanel({ open, onOpenChange }: HistoryPanelProps) {
  function handleSelectSession(_sessionId: string) {
    // Future: open a session replay view
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[500px] flex-col gap-0 p-0 sm:w-[500px]"
        aria-label="Session history"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Session History</SheetTitle>
          <SheetDescription>All sessions across all agents.</SheetDescription>
        </SheetHeader>

        {/* Reuse the existing SessionHistory panel with a global "all" agent id */}
        <SessionHistory agentId="all" onSelectSession={handleSelectSession} />
      </SheetContent>
    </Sheet>
  )
}
