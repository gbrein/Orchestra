'use client'

import { Music, Bell, Settings, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function TopBar() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-4">
      {/* Left: Logo + Workspace name */}
      <div className="flex items-center gap-3">
        <Music className="h-5 w-5 text-primary" aria-hidden />
        <span className="text-sm font-semibold">Orchestra</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
          My Workspace
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* Center: View tabs */}
      <nav className="flex items-center gap-1" aria-label="Main navigation">
        <Button variant="ghost" size="sm" className="h-7 text-xs font-medium" aria-current="page">
          Workspace
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
          Discussions
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
          History
        </Button>
      </nav>

      {/* Right: Notifications + Settings */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <Badge
            variant="destructive"
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center p-0 text-[10px]"
          >
            0
          </Badge>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
