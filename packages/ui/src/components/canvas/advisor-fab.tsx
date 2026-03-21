'use client'

import { Lightbulb, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AdvisorFabProps {
  readonly visible: boolean
  readonly running: boolean
  readonly disabled: boolean
  readonly onClick: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AdvisorFab({ visible, running, disabled, onClick }: AdvisorFabProps) {
  if (!visible) return null

  return (
    <div className="absolute bottom-6 left-6 z-10">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || running}
        className={cn(
          'group relative flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-200',
          'cursor-pointer shadow-lg backdrop-blur-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          running
            ? 'border-amber-500/50 bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
            : disabled
              ? 'border-border/50 bg-card/60 opacity-50 cursor-not-allowed'
              : 'border-amber-500/30 bg-card/80 hover:border-amber-400/50 hover:bg-amber-500/10 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
        )}
        aria-label={running ? 'Advisor is analyzing...' : 'Analyze workflow with Advisor'}
        title={disabled ? 'Run the workflow first' : running ? 'Analyzing...' : 'Advisor — analyze and suggest improvements'}
      >
        {running ? (
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" aria-hidden />
        ) : (
          <Lightbulb className={cn(
            'h-5 w-5 transition-colors',
            disabled ? 'text-muted-foreground' : 'text-amber-400',
          )} aria-hidden />
        )}

        {/* Pulse ring when running */}
        {running && (
          <span className="absolute inset-0 animate-ping rounded-full border border-amber-400/30" />
        )}
      </button>

      {/* Label tooltip on hover */}
      <div className={cn(
        'absolute left-14 top-1/2 -translate-y-1/2 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-md',
        'pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100',
        disabled && 'hidden',
      )}>
        {running ? 'Analyzing...' : 'Advisor'}
      </div>
    </div>
  )
}
