'use client'

import { Circle, Wifi, WifiOff, Loader2, ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Props ──────────────────────────────────────────────────────────────────

export interface BottomBarProps {
  readonly connected?: boolean
  readonly connecting?: boolean
  readonly socketError?: string | null
  readonly runningAgentCount?: number
  readonly sessionCostUsd?: number
  readonly zoomLevel?: number
  readonly onZoomIn?: () => void
  readonly onZoomOut?: () => void
  readonly onFitView?: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BottomBar({
  connected = false,
  connecting = false,
  socketError = null,
  runningAgentCount = 0,
  sessionCostUsd = 0,
  zoomLevel = 100,
  onZoomIn,
  onZoomOut,
  onFitView,
}: BottomBarProps) {
  const connectionLabel = connecting
    ? 'Connecting…'
    : connected
      ? 'Connected'
      : socketError
        ? 'Connection error'
        : 'Disconnected'

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t bg-card px-4 text-xs text-muted-foreground">
      {/* Left: Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Circle
            className={cn(
              'h-2 w-2 fill-current',
              connected
                ? 'text-[var(--status-running)]'
                : socketError
                  ? 'text-[var(--status-error)]'
                  : 'text-[var(--status-idle)]',
            )}
            aria-hidden
          />
          <span>
            {connected
              ? 'Ready'
              : socketError
                ? 'Error'
                : connecting
                  ? 'Connecting'
                  : 'Offline'}
          </span>
        </div>

        <div
          className="flex items-center gap-1.5"
          aria-label={connectionLabel}
          title={socketError ?? undefined}
        >
          {connecting ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : connected ? (
            <Wifi className="h-3 w-3" aria-hidden />
          ) : (
            <WifiOff className="h-3 w-3" aria-hidden />
          )}
          <span>{connectionLabel}</span>
        </div>
      </div>

      {/* Center: Agent count + session cost */}
      <div className="flex items-center gap-3">
        <span>
          {runningAgentCount === 0
            ? '0 assistants running'
            : `${runningAgentCount} assistant${runningAgentCount > 1 ? 's' : ''} running`}
        </span>
        <span aria-hidden>·</span>
        <span>${sessionCostUsd.toFixed(2)} session cost</span>
      </div>

      {/* Right: Zoom controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          aria-label="Zoom out"
          onClick={onZoomOut}
        >
          <ZoomOut className="h-3 w-3" aria-hidden />
        </Button>
        <span className="w-10 text-center" aria-label={`Zoom level ${zoomLevel} percent`}>
          {zoomLevel}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          aria-label="Zoom in"
          onClick={onZoomIn}
        >
          <ZoomIn className="h-3 w-3" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          aria-label="Fit canvas to view"
          onClick={onFitView}
        >
          <Maximize className="h-3 w-3" aria-hidden />
        </Button>
      </div>
    </footer>
  )
}
