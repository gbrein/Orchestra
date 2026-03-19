'use client'

import { useState } from 'react'
import { Bot, Puzzle, Shield, MessageSquare, Plug, PanelLeftClose, PanelLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NodeType = 'agent' | 'skill' | 'safety' | 'discussion' | 'connection'

interface SidebarItem {
  readonly icon: React.ElementType
  readonly label: string
  readonly shortcut?: string
  readonly nodeType: NodeType
}

export interface SidebarProps {
  readonly onCreateAgent?: () => void
  readonly onAssistantsClick?: () => void
  readonly onSkillsClick?: () => void
  readonly onSafetyClick?: () => void
  readonly onDiscussionsClick?: () => void
  readonly onConnectionsClick?: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITEMS: readonly SidebarItem[] = [
  { icon: Bot, label: 'Assistants', shortcut: 'N', nodeType: 'agent' },
  { icon: Puzzle, label: 'Skills', shortcut: 'S', nodeType: 'skill' },
  { icon: Shield, label: 'Safety Rules', nodeType: 'safety' },
  { icon: MessageSquare, label: 'Discussions', nodeType: 'discussion' },
  { icon: Plug, label: 'Connections', nodeType: 'connection' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sidebar({ onCreateAgent, onAssistantsClick, onSkillsClick, onSafetyClick, onDiscussionsClick, onConnectionsClick }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  function handleDragStart(e: React.DragEvent<HTMLButtonElement>, nodeType: NodeType) {
    e.dataTransfer.setData(
      'application/orchestra-node',
      JSON.stringify({ type: nodeType }),
    )
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r bg-card transition-all duration-200',
        collapsed ? 'w-12' : 'w-56',
      )}
    >
      {/* Collapse toggle */}
      <div className="flex h-10 items-center justify-end px-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <Separator />

      {/* Node palette */}
      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Node palette">
        {ITEMS.map((item) => (
          <Tooltip key={item.label} delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn('justify-start gap-2', collapsed && 'justify-center px-0')}
                draggable
                onDragStart={(e) => handleDragStart(e, item.nodeType)}
                onClick={
                  item.nodeType === 'agent'
                    ? onAssistantsClick
                    : item.nodeType === 'skill'
                    ? onSkillsClick
                    : item.nodeType === 'safety'
                    ? onSafetyClick
                    : item.nodeType === 'discussion'
                    ? onDiscussionsClick
                    : item.nodeType === 'connection'
                    ? onConnectionsClick
                    : undefined
                }
                aria-label={item.label}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="flex-1 text-left text-xs">{item.label}</span>
                )}
                {!collapsed && item.shortcut && (
                  <kbd className="rounded border bg-muted px-1 text-[10px] text-muted-foreground">
                    {item.shortcut}
                  </kbd>
                )}
              </Button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="text-xs">
                {item.label}
                {item.shortcut && (
                  <kbd className="ml-2 text-muted-foreground">{item.shortcut}</kbd>
                )}
              </TooltipContent>
            )}
          </Tooltip>
        ))}
      </nav>

      <Separator />

      {/* Quick create */}
      <div className="p-2">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn('w-full gap-2', collapsed && 'px-0')}
              aria-label="Create new assistant"
              onClick={onCreateAgent}
            >
              <Plus className="h-4 w-4" />
              {!collapsed && <span className="text-xs">New Assistant</span>}
            </Button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="text-xs">
              New Assistant
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  )
}
