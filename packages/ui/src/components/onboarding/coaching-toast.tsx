'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export interface CoachingToastProps {
  readonly visible: boolean
  readonly onDismiss: () => void
  readonly message: string
  readonly autoHideMs?: number
}

export function CoachingToast({
  visible,
  onDismiss,
  message,
  autoHideMs = 10_000,
}: CoachingToastProps) {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onDismiss, autoHideMs)
    return () => clearTimeout(timer)
  }, [visible, onDismiss, autoHideMs])

  if (!visible) return null

  return (
    <div className="absolute bottom-20 left-1/2 z-50 -translate-x-1/2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 shadow-lg">
        <p className="text-xs text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
