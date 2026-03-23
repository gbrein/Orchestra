'use client'

import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Props ──────────────────────────────────────────────────────────────────

export interface BottomBarProps {
  readonly connected?: boolean
  readonly connecting?: boolean
  readonly socketError?: string | null
  readonly runningAgentCount?: number
  readonly sessionTokens?: number
  readonly zoomLevel?: number
  readonly onZoomIn?: () => void
  readonly onZoomOut?: () => void
  readonly onFitView?: () => void
}

// ─── Cost estimation (rough, based on Sonnet pricing) ───────────────────────

function estimateCost(tokens: number): string {
  // Approximate: $3/MTok input + $15/MTok output, assume 40/60 split
  const cost = tokens * 0.000006 + tokens * 0.000009
  if (cost < 0.01) return '<$0.01'
  return `$${cost.toFixed(2)}`
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BottomBar({
  connected = false,
  connecting = false,
  socketError = null,
  runningAgentCount = 0,
  sessionTokens = 0,
  zoomLevel = 100,
  onZoomIn,
  onZoomOut,
  onFitView,
}: BottomBarProps) {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t bg-card px-4 text-[11px] text-muted-foreground">
      {/* Left: Single connection indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            connecting
              ? 'animate-pulse bg-amber-400'
              : connected
                ? 'bg-green-400'
                : 'bg-red-400',
          )}
        />
        <span>
          {connecting ? 'Connecting' : connected ? 'Connected' : socketError ? 'Error' : 'Offline'}
        </span>
      </div>

      {/* Center: Workflow context */}
      <div className="flex items-center gap-3">
        {runningAgentCount > 0 && (
          <span>{runningAgentCount} running</span>
        )}
        {sessionTokens > 0 && (
          <>
            {runningAgentCount > 0 && <span className="text-muted-foreground/40">|</span>}
            <span>{sessionTokens.toLocaleString()} tokens ({estimateCost(sessionTokens)})</span>
          </>
        )}
        {runningAgentCount === 0 && sessionTokens === 0 && (
          <span>Ready</span>
        )}
      </div>

      {/* Right: Zoom controls */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" aria-label="Zoom out" onClick={onZoomOut}>
          <ZoomOut className="h-3 w-3" aria-hidden />
        </Button>
        <span className="w-9 text-center">{zoomLevel}%</span>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" aria-label="Zoom in" onClick={onZoomIn}>
          <ZoomIn className="h-3 w-3" aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" aria-label="Fit to view" onClick={onFitView}>
          <Maximize className="h-3 w-3" aria-hidden />
        </Button>
      </div>
    </footer>
  )
}
