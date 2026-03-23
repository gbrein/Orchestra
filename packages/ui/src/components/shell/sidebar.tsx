'use client'

import { useState } from 'react'
import {
  Bot, Puzzle, Shield, MessageSquare, Plug, PanelLeftClose, PanelLeft,
  Plus, Home, FolderOpen, Activity, ClipboardList, GitBranch,
  GripVertical, Clock, Settings, Search,
} from 'lucide-react'
import { DRAG_TYPES } from '@/lib/canvas-utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useComplexity } from '@/hooks/use-complexity'
import { FavoritesSection } from '@/components/shell/favorites-section'

// ─── Types ──────────────────────────────────────────────────────────────────

export type NodeType = 'agent' | 'skill' | 'safety' | 'discussion' | 'connection' | 'resource' | 'activity' | 'plan' | 'git'

interface FavoriteAgent {
  readonly id: string
  readonly name: string
  readonly avatar?: string | null
  readonly status: string
}

export interface SidebarProps {
  readonly favorites?: readonly FavoriteAgent[]
  readonly onSelectFavorite?: (agentId: string) => void
  readonly onHomeClick?: () => void
  readonly onCreateAgent?: () => void
  readonly onAssistantsClick?: () => void
  readonly onSkillsClick?: () => void
  readonly onSafetyClick?: () => void
  readonly onDiscussionsClick?: () => void
  readonly onConnectionsClick?: () => void
  readonly onResourcesClick?: () => void
  readonly onActivityClick?: () => void
  readonly onPlanClick?: () => void
  readonly onGitClick?: () => void
  readonly onSchedulesClick?: () => void
  readonly onSettingsClick?: () => void
  readonly onCommandPalette?: () => void
}

// ─── Section: Draggable nodes ───────────────────────────────────────────────

interface DragItem {
  readonly icon: React.ElementType
  readonly label: string
  readonly nodeType: NodeType
  readonly mimeType: string
  readonly minTier: 'simple' | 'standard' | 'full'
}

const DRAG_ITEMS: readonly DragItem[] = [
  { icon: Bot, label: 'Assistant', nodeType: 'agent', mimeType: DRAG_TYPES.AGENT, minTier: 'simple' },
  { icon: Puzzle, label: 'Skill', nodeType: 'skill', mimeType: DRAG_TYPES.SKILL, minTier: 'simple' },
  { icon: Shield, label: 'Safety Rule', nodeType: 'safety', mimeType: DRAG_TYPES.POLICY, minTier: 'standard' },
  { icon: FolderOpen, label: 'Resource', nodeType: 'resource', mimeType: DRAG_TYPES.RESOURCE, minTier: 'standard' },
  { icon: Plug, label: 'Connection', nodeType: 'connection', mimeType: DRAG_TYPES.MCP, minTier: 'full' },
]

// ─── Section: Browse navigation ─────────────────────────────────────────────

interface NavItem {
  readonly icon: React.ElementType
  readonly label: string
  readonly shortcut?: string
  readonly action: string
  readonly minTier: 'simple' | 'standard' | 'full'
}

const BROWSE_ITEMS: readonly NavItem[] = [
  { icon: Bot, label: 'Assistants', shortcut: 'N', action: 'assistants', minTier: 'simple' },
  { icon: Puzzle, label: 'Skills', shortcut: 'S', action: 'skills', minTier: 'simple' },
  { icon: MessageSquare, label: 'Discussions', action: 'discussions', minTier: 'standard' },
  { icon: Activity, label: 'Activity', action: 'activity', minTier: 'standard' },
  { icon: Clock, label: 'Schedules', action: 'schedules', minTier: 'simple' },
]

const WORKSPACE_ITEMS: readonly NavItem[] = [
  { icon: ClipboardList, label: 'Plan', shortcut: 'P', action: 'plan', minTier: 'simple' },
  { icon: GitBranch, label: 'Git', shortcut: 'G', action: 'git', minTier: 'standard' },
  { icon: FolderOpen, label: 'Resources', shortcut: 'R', action: 'resources', minTier: 'standard' },
]

// ─── Component ──────────────────────────────────────────────────────────────

const TIER_ORDER = { simple: 0, standard: 1, full: 2 } as const

export function Sidebar({
  favorites = [],
  onSelectFavorite,
  onHomeClick,
  onCreateAgent,
  onAssistantsClick,
  onSkillsClick,
  onSafetyClick,
  onDiscussionsClick,
  onConnectionsClick,
  onResourcesClick,
  onActivityClick,
  onPlanClick,
  onGitClick,
  onSchedulesClick,
  onSettingsClick,
  onCommandPalette,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { tier } = useComplexity()

  const isVisible = (minTier: 'simple' | 'standard' | 'full') =>
    TIER_ORDER[tier] >= TIER_ORDER[minTier]

  function handleDragStart(e: React.DragEvent<HTMLElement>, item: DragItem) {
    e.dataTransfer.setData(item.mimeType, JSON.stringify({ type: item.nodeType }))
    e.dataTransfer.effectAllowed = 'all'
  }

  const resolveAction = (action: string) => {
    const map: Record<string, (() => void) | undefined> = {
      assistants: onAssistantsClick,
      skills: onSkillsClick,
      discussions: onDiscussionsClick,
      activity: onActivityClick,
      schedules: onSchedulesClick,
      plan: onPlanClick,
      git: onGitClick,
      resources: onResourcesClick,
      safety: onSafetyClick,
      connections: onConnectionsClick,
    }
    return map[action]
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

      {/* Home */}
      <div className="p-2 pb-0">
        <SidebarButton collapsed={collapsed} icon={Home} label="Home" onClick={onHomeClick} />
      </div>

      {/* Favorites */}
      {!collapsed && favorites.length > 0 && (
        <div className="px-2 pt-2">
          <FavoritesSection agents={favorites} onSelect={onSelectFavorite ?? (() => {})} />
        </div>
      )}

      {/* ── Drag to Canvas ── */}
      <div className="px-2 pt-3">
        {!collapsed && (
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <GripVertical className="h-3 w-3" aria-hidden />
            Drag to Canvas
          </p>
        )}
        <div className="flex flex-col gap-0.5">
          {DRAG_ITEMS.filter((item) => isVisible(item.minTier)).map((item) => (
            <div
              key={item.label}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              className={cn(
                'flex cursor-grab items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors active:cursor-grabbing',
                'hover:bg-accent hover:text-foreground',
                collapsed && 'justify-center px-0',
              )}
              title={collapsed ? `Drag: ${item.label}` : undefined}
              aria-label={`Drag ${item.label} to canvas`}
            >
              <GripVertical className="h-3 w-3 shrink-0 opacity-40" aria-hidden />
              <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {!collapsed && <span>{item.label}</span>}
            </div>
          ))}
        </div>
      </div>

      <Separator className="mx-2 mt-2" />

      {/* ── Browse ── */}
      <div className="px-2 pt-2">
        {!collapsed && (
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Browse
          </p>
        )}
        <nav className="flex flex-col gap-0.5" aria-label="Browse panels">
          {BROWSE_ITEMS.filter((item) => isVisible(item.minTier)).map((item) => (
            <SidebarButton
              key={item.label}
              collapsed={collapsed}
              icon={item.icon}
              label={item.label}
              shortcut={item.shortcut}
              onClick={resolveAction(item.action)}
            />
          ))}
        </nav>
      </div>

      <Separator className="mx-2 mt-2" />

      {/* ── Workspace ── */}
      <div className="flex-1 px-2 pt-2">
        {!collapsed && (
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
        )}
        <nav className="flex flex-col gap-0.5" aria-label="Workspace panels">
          {WORKSPACE_ITEMS.filter((item) => isVisible(item.minTier)).map((item) => (
            <SidebarButton
              key={item.label}
              collapsed={collapsed}
              icon={item.icon}
              label={item.label}
              shortcut={item.shortcut}
              onClick={resolveAction(item.action)}
            />
          ))}
        </nav>
      </div>

      <Separator />

      {/* ── Quick Actions ── */}
      <div className="flex flex-col gap-1 p-2">
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
            <TooltipContent side="right" className="text-xs">New Assistant</TooltipContent>
          )}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn('w-full gap-2 text-muted-foreground', collapsed && 'px-0 justify-center')}
              onClick={onCommandPalette}
              aria-label="Search"
            >
              <Search className="h-3.5 w-3.5" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left text-xs">Search</span>
                  <kbd className="rounded border bg-muted px-1 text-[10px]">Ctrl+K</kbd>
                </>
              )}
            </Button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="text-xs">Search (Ctrl+K)</TooltipContent>
          )}
        </Tooltip>

        {/* Complexity tier indicator */}
        {!collapsed && tier !== 'full' && (
          <TierIndicator tier={tier} onSettingsClick={onSettingsClick} />
        )}
      </div>
    </aside>
  )
}

// ─── Sidebar Button (reusable) ──────────────────────────────────────────────

interface SidebarButtonProps {
  readonly collapsed: boolean
  readonly icon: React.ElementType
  readonly label: string
  readonly shortcut?: string
  readonly onClick?: () => void
}

// ─── Tier Indicator ─────────────────────────────────────────────────────────

const TIER_HIDDEN_COUNT: Record<string, number> = {
  simple: 6,
  standard: 1,
}

function TierIndicator({ tier, onSettingsClick }: { tier: string; onSettingsClick?: () => void }) {
  const hidden = TIER_HIDDEN_COUNT[tier] ?? 0
  if (hidden === 0) return null

  return (
    <button
      type="button"
      onClick={onSettingsClick}
      className="mt-1 w-full rounded-md border border-dashed border-border/50 px-2 py-1.5 text-center text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
    >
      {tier === 'simple' ? 'Simple' : 'Standard'} mode — {hidden} more feature{hidden > 1 ? 's' : ''} available
    </button>
  )
}

// ─── Sidebar Button (reusable) ──────────────────────────────────────────────

function SidebarButton({ collapsed, icon: Icon, label, shortcut, onClick }: SidebarButtonProps) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('justify-start gap-2', collapsed && 'justify-center px-0')}
          onClick={onClick}
          aria-label={label}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-left text-xs">{label}</span>
          )}
          {!collapsed && shortcut && (
            <kbd className="rounded border bg-muted px-1 text-[10px] text-muted-foreground">
              {shortcut}
            </kbd>
          )}
        </Button>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right" className="text-xs">
          {label}
          {shortcut && <kbd className="ml-2 text-muted-foreground">{shortcut}</kbd>}
        </TooltipContent>
      )}
    </Tooltip>
  )
}
