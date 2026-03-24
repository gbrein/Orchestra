'use client'

import { useEffect } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface CoachingTooltipProps {
  readonly visible: boolean
  readonly onDismiss: () => void
  readonly message: string
  readonly side?: 'top' | 'right' | 'bottom' | 'left'
  readonly children: React.ReactNode
  /** Auto-dismiss after this many milliseconds (default 10000). */
  readonly autoHideMs?: number
}

export function CoachingTooltip({
  visible,
  onDismiss,
  message,
  side = 'right',
  children,
  autoHideMs = 10_000,
}: CoachingTooltipProps) {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onDismiss, autoHideMs)
    return () => clearTimeout(timer)
  }, [visible, onDismiss, autoHideMs])

  if (!visible) return <>{children}</>

  return (
    <Tooltip open delayDuration={0}>
      <TooltipTrigger asChild onClick={onDismiss}>
        <div className="relative">
          {children}
          {/* Pulsing indicator dot */}
          <span
            className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 motion-safe:animate-pulse"
            aria-hidden
          >
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[220px] text-xs">
        {message}
      </TooltipContent>
    </Tooltip>
  )
}
