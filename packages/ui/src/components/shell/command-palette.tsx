'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Plus,
  Bot,
  Maximize,
  Trash2,
  ZoomIn,
  ZoomOut,
  Puzzle,
  Shield,
  MessageSquare,
  PanelLeft,
  Undo2,
  Redo2,
  Keyboard,
  Search,
  LayoutTemplate,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandItem {
  readonly id: string
  readonly category: string
  readonly label: string
  readonly description: string
  readonly icon: React.ElementType
  readonly shortcut?: string
}

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCommand: (commandId: string) => void
}

// ─── Command registry ─────────────────────────────────────────────────────────

const COMMANDS: readonly CommandItem[] = [
  // Assistants
  {
    id: 'assistant:create',
    category: 'Assistants',
    label: 'Create New Assistant',
    description: 'Add a new AI assistant to your workspace',
    icon: Plus,
  },
  {
    id: 'assistant:list',
    category: 'Assistants',
    label: 'List All Assistants',
    description: 'Browse and manage existing assistants',
    icon: Bot,
  },

  // Canvas
  {
    id: 'canvas:fit',
    category: 'Canvas',
    label: 'Fit to View',
    description: 'Zoom and pan to show all nodes',
    icon: Maximize,
  },
  {
    id: 'canvas:clear',
    category: 'Canvas',
    label: 'Clear Canvas',
    description: 'Remove all nodes and edges from the canvas',
    icon: Trash2,
  },
  {
    id: 'canvas:zoom-in',
    category: 'Canvas',
    label: 'Zoom In',
    description: 'Increase zoom level',
    icon: ZoomIn,
  },
  {
    id: 'canvas:zoom-out',
    category: 'Canvas',
    label: 'Zoom Out',
    description: 'Decrease zoom level',
    icon: ZoomOut,
  },

  // Navigation
  {
    id: 'nav:skills',
    category: 'Navigation',
    label: 'Open Skills Marketplace',
    description: 'Browse and install skills',
    icon: Puzzle,
    shortcut: 'S',
  },
  {
    id: 'nav:safety',
    category: 'Navigation',
    label: 'Open Safety Rules',
    description: 'Manage safety policies and guardrails',
    icon: Shield,
  },
  {
    id: 'nav:conversations',
    category: 'Navigation',
    label: 'View Conversations',
    description: 'Browse conversation history',
    icon: MessageSquare,
  },
  {
    id: 'nav:sidebar',
    category: 'Navigation',
    label: 'Toggle Sidebar',
    description: 'Show or hide the left panel',
    icon: PanelLeft,
  },

  // Actions
  {
    id: 'action:undo',
    category: 'Actions',
    label: 'Undo',
    description: 'Undo the last action',
    icon: Undo2,
    shortcut: 'Ctrl+Z',
  },
  {
    id: 'action:redo',
    category: 'Actions',
    label: 'Redo',
    description: 'Redo the previously undone action',
    icon: Redo2,
    shortcut: 'Ctrl+Shift+Z',
  },
  {
    id: 'action:shortcuts',
    category: 'Actions',
    label: 'Keyboard Shortcuts',
    description: 'View all keyboard shortcuts',
    icon: Keyboard,
    shortcut: '?',
  },

  // Templates
  {
    id: 'template:code-review',
    category: 'Templates',
    label: 'Load: Code Review Pipeline',
    description: 'Writer → Reviewer → Security Reviewer',
    icon: LayoutTemplate,
  },
  {
    id: 'template:content-writing',
    category: 'Templates',
    label: 'Load: Content Writing Team',
    description: 'Researcher → Writer → Editor',
    icon: LayoutTemplate,
  },
  {
    id: 'template:research',
    category: 'Templates',
    label: 'Load: Research Assistant',
    description: 'Solo research bot with web search and data analysis skills',
    icon: LayoutTemplate,
  },
  {
    id: 'template:brainstorm',
    category: 'Templates',
    label: 'Load: Brainstorm Team',
    description: 'Creative, Analyst, Devil\'s Advocate, and Moderator',
    icon: LayoutTemplate,
  },
]

// ─── Category order ───────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['Assistants', 'Canvas', 'Navigation', 'Actions', 'Templates']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterCommands(commands: readonly CommandItem[], query: string): readonly CommandItem[] {
  if (!query.trim()) return commands

  const normalized = query.toLowerCase()

  return commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(normalized) ||
      cmd.description.toLowerCase().includes(normalized) ||
      cmd.category.toLowerCase().includes(normalized),
  )
}

function groupByCategory(
  commands: readonly CommandItem[],
): Array<{ category: string; items: CommandItem[] }> {
  const map = new Map<string, CommandItem[]>()

  for (const cmd of commands) {
    const existing = map.get(cmd.category)
    if (existing) {
      existing.push(cmd)
    } else {
      map.set(cmd.category, [cmd])
    }
  }

  return CATEGORY_ORDER
    .filter((cat) => map.has(cat))
    .map((cat) => ({ category: cat, items: map.get(cat) ?? [] }))
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text

  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded-[2px]">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── Shortcut badge ───────────────────────────────────────────────────────────

function ShortcutBadge({ shortcut }: { shortcut: string }) {
  const parts = shortcut.split('+')

  return (
    <span className="flex items-center gap-0.5">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {part}
        </kbd>
      ))}
    </span>
  )
}

// ─── Command item row ─────────────────────────────────────────────────────────

interface CommandRowProps {
  item: CommandItem
  isSelected: boolean
  query: string
  onSelect: () => void
  onHover: () => void
}

function CommandRow({ item, isSelected, query, onSelect, onHover }: CommandRowProps) {
  const Icon = item.icon

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-accent/50',
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
          isSelected
            ? 'border-accent-foreground/20 bg-background/50'
            : 'border-border bg-muted/50',
        )}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <span className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span className="truncate text-sm font-medium leading-none">
          {highlightMatch(item.label, query)}
        </span>
        <span className="truncate text-xs text-muted-foreground leading-none">
          {item.description}
        </span>
      </span>

      {item.shortcut && <ShortcutBadge shortcut={item.shortcut} />}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandPalette({ open, onOpenChange, onCommand }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = filterCommands(COMMANDS, query)
  const groups = groupByCategory(filtered)

  // Flat ordered list for keyboard navigation
  const flatItems = groups.flatMap((g) => g.items)

  const resetState = useCallback(() => {
    setQuery('')
    setSelectedIndex(0)
  }, [])

  // Reset when opening
  useEffect(() => {
    if (open) {
      resetState()
      // Focus input after animation frame so the dialog is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [open, resetState])

  // Keep selected item in view
  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const selectedEl = list.querySelector('[aria-selected="true"]') as HTMLElement | null
    selectedEl?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleSelect = useCallback(
    (id: string) => {
      onCommand(id)
      onOpenChange(false)
    },
    [onCommand, onOpenChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1))
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        }
        case 'Enter': {
          e.preventDefault()
          const item = flatItems[selectedIndex]
          if (item) handleSelect(item.id)
          break
        }
        case 'Escape': {
          onOpenChange(false)
          break
        }
      }
    },
    [flatItems, selectedIndex, handleSelect, onOpenChange],
  )

  // Reset selection when query changes
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setSelectedIndex(0)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[500px] gap-0 overflow-hidden p-0"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
        // Prevent default close on Escape so we handle it ourselves
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          onOpenChange(false)
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="command-list"
            placeholder="Type a command or search..."
            value={query}
            onChange={handleQueryChange}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-list"
          role="listbox"
          aria-label="Commands"
          className="max-h-[380px] overflow-y-auto p-2"
        >
          {flatItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40" aria-hidden />
              <p className="text-sm text-muted-foreground">No commands found for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <>
              {groups.map((group, groupIndex) => {
                // Offset into the flat list to compute selectedIndex per item
                const offset = groups
                  .slice(0, groupIndex)
                  .reduce((acc, g) => acc + g.items.length, 0)

                return (
                  <div key={group.category}>
                    {groupIndex > 0 && <Separator className="my-1.5" />}

                    <p className="mb-1 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.category}
                    </p>

                    {group.items.map((item, itemIndex) => {
                      const flatIndex = offset + itemIndex

                      return (
                        <CommandRow
                          key={item.id}
                          item={item}
                          isSelected={flatIndex === selectedIndex}
                          query={query}
                          onSelect={() => handleSelect(item.id)}
                          onHover={() => setSelectedIndex(flatIndex)}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t px-4 py-2">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5">↑</kbd>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5">↵</kbd>
              select
            </span>
          </div>
          {filtered.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
