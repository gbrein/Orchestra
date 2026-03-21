'use client'

import { Play, Square, Loader2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  readonly index: number
  readonly total: number
  readonly agentName: string
}

export interface WorkflowToolbarProps {
  readonly hasChain: boolean
  readonly isRunning: boolean
  readonly currentStep?: WorkflowStep | null
  readonly onRun: () => void
  readonly onStop: () => void
  readonly onOpenChat: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WorkflowToolbar({
  hasChain,
  isRunning,
  currentStep,
  onRun,
  onStop,
  onOpenChat,
}: WorkflowToolbarProps) {
  if (!hasChain) return null

  return (
    <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur-sm">
      {isRunning ? (
        <>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 gap-1.5 rounded-full px-3 text-xs"
            onClick={onStop}
            aria-label="Stop workflow"
          >
            <Square className="h-3 w-3 fill-current" aria-hidden />
            Stop
          </Button>
          {currentStep && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />
              <span>
                Step {currentStep.index}/{currentStep.total}
              </span>
              <span className="max-w-[120px] truncate font-medium text-foreground">
                {currentStep.agentName}
              </span>
            </div>
          )}
          {!currentStep && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />
              <span>Running...</span>
            </div>
          )}
        </>
      ) : (
        <Button
          size="sm"
          className="h-7 gap-1.5 rounded-full bg-green-600 px-3 text-xs text-white hover:bg-green-700"
          onClick={onOpenChat}
          aria-label="Open workflow chat"
        >
          <Play className="h-3 w-3 fill-current" aria-hidden />
          Run Workflow
        </Button>
      )}

      {/* Chat button */}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 rounded-full p-0"
        onClick={onOpenChat}
        aria-label="Open workflow chat"
        title="Workflow Chat"
      >
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
      </Button>

    </div>
  )
}
