'use client'

import { Circle, Wifi, ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BottomBar() {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t bg-card px-4 text-xs text-muted-foreground">
      {/* Left: Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Circle className="h-2 w-2 fill-[var(--status-idle)] text-[var(--status-idle)]" aria-hidden />
          <span>Ready</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi className="h-3 w-3" aria-hidden />
          <span>Connected</span>
        </div>
      </div>

      {/* Center: Agent count */}
      <div className="flex items-center gap-3">
        <span>0 assistants running</span>
        <span>·</span>
        <span>$0.00 session cost</span>
      </div>

      {/* Right: Zoom controls */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Zoom out">
          <ZoomOut className="h-3 w-3" />
        </Button>
        <span className="w-10 text-center">100%</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Zoom in">
          <ZoomIn className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Fit to view">
          <Maximize className="h-3 w-3" />
        </Button>
      </div>
    </footer>
  )
}
