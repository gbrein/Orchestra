'use client'

import { useRef, useState } from 'react'
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  readonly onRenameWorkspace?: (id: string, name: string) => void
  readonly onDeleteWorkspace?: (id: string) => void
}

// ─── WorkspaceSwitcher ─────────────────────────────────────────────────────

export function WorkspaceSwitcher({
  workspaces,
  activeId,
  onSelect,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const activeWorkspace = workspaces.find((w) => w.id === activeId)
  const isLastWorkspace = workspaces.length <= 1

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setCreatingNew(false)
      setNewName('')
      setRenamingId(null)
      setRenameValue('')
    }
  }

  function handleSelectWorkspace(id: string) {
    onSelect(id)
    setOpen(false)
  }

  function handleStartCreate() {
    setCreatingNew(true)
    setRenamingId(null)
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

  function handleStartRename(workspace: Workspace) {
    setRenamingId(workspace.id)
    setRenameValue(workspace.name)
    setCreatingNew(false)
    setTimeout(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }, 0)
  }

  function handleCancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  function handleConfirmRename() {
    const trimmed = renameValue.trim()
    if (!trimmed || !renamingId) return
    onRenameWorkspace?.(renamingId, trimmed)
    setRenamingId(null)
    setRenameValue('')
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirmRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelRename()
    }
  }

  function handleDeleteClick(workspace: Workspace) {
    setDeleteTarget(workspace)
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return
    onDeleteWorkspace?.(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <>
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
          {workspaces.map((workspace) =>
            renamingId === workspace.id ? (
              <div
                key={workspace.id}
                className="flex items-center gap-1.5 px-2 py-1.5"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  placeholder="Workspace name…"
                  className="h-7 flex-1 text-xs"
                  aria-label="Rename workspace"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 p-0"
                  onClick={handleConfirmRename}
                  disabled={!renameValue.trim()}
                  aria-label="Confirm rename"
                >
                  <Check className="h-3.5 w-3.5 text-green-500" aria-hidden />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 p-0"
                  onClick={handleCancelRename}
                  aria-label="Cancel rename"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            ) : (
              <DropdownMenuItem
                key={workspace.id}
                className="group flex items-center gap-2 text-xs"
                onSelect={() => handleSelectWorkspace(workspace.id)}
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    workspace.id === activeId ? 'text-primary' : 'opacity-0',
                  )}
                  aria-hidden
                />
                <span className="flex-1 truncate">{workspace.name}</span>
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {onRenameWorkspace && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartRename(workspace)
                      }}
                      aria-label={`Rename ${workspace.name}`}
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" aria-hidden />
                    </Button>
                  )}
                  {onDeleteWorkspace && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      disabled={isLastWorkspace}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteClick(workspace)
                      }}
                      aria-label={`Delete ${workspace.name}`}
                    >
                      <Trash2
                        className={cn(
                          'h-3 w-3',
                          isLastWorkspace ? 'text-muted-foreground/40' : 'text-destructive',
                        )}
                        aria-hidden
                      />
                    </Button>
                  )}
                </div>
              </DropdownMenuItem>
            ),
          )}

          <DropdownMenuSeparator />

          {creatingNew ? (
            <div
              className="flex items-center gap-1.5 px-2 py-1.5"
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{deleteTarget?.name}&rdquo;? This will remove all canvas layouts and
              resources associated with this workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
