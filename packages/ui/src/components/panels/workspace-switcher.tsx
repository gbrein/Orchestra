'use client'

import { useRef, useState } from 'react'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Workspace {
  readonly id: string
  readonly name: string
}

export interface WorkspaceSwitcherProps {
  readonly workspaces: readonly Workspace[]
  readonly activeId: string
  readonly onSelect: (id: string) => void
  readonly onCreateWorkspace: (name: string) => void
}

// ─── WorkspaceSwitcher ─────────────────────────────────────────────────────

export function WorkspaceSwitcher({
  workspaces,
  activeId,
  onSelect,
  onCreateWorkspace,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const activeWorkspace = workspaces.find((w) => w.id === activeId)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setCreatingNew(false)
      setNewName('')
    }
  }

  function handleSelectWorkspace(id: string) {
    onSelect(id)
    setOpen(false)
  }

  function handleStartCreate() {
    setCreatingNew(true)
    // Focus the input after the DOM updates
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  function handleCancelCreate() {
    setCreatingNew(false)
    setNewName('')
  }

  function handleConfirmCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    onCreateWorkspace(trimmed)
    setCreatingNew(false)
    setNewName('')
    setOpen(false)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirmCreate()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelCreate()
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label={`Current workspace: ${activeWorkspace?.name ?? 'My Workspace'}. Click to switch.`}
        >
          {activeWorkspace?.name ?? 'My Workspace'}
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            className="flex items-center gap-2 text-xs"
            onSelect={() => handleSelectWorkspace(workspace.id)}
          >
            <Check
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                workspace.id === activeId ? 'text-primary' : 'opacity-0',
              )}
              aria-hidden
            />
            <span className="truncate">{workspace.name}</span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {creatingNew ? (
          <div
            className="flex items-center gap-1.5 px-2 py-1.5"
            // Prevent the dropdown from closing when interacting with the input area
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Workspace name…"
              className="h-7 flex-1 text-xs"
              aria-label="New workspace name"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 shrink-0 p-0"
              onClick={handleConfirmCreate}
              disabled={!newName.trim()}
              aria-label="Confirm new workspace"
            >
              <Check className="h-3.5 w-3.5 text-green-500" aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 shrink-0 p-0"
              onClick={handleCancelCreate}
              aria-label="Cancel new workspace"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        ) : (
          <DropdownMenuItem
            className="flex items-center gap-2 text-xs"
            onSelect={(e) => {
              e.preventDefault()
              handleStartCreate()
            }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>Create New Workspace</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
