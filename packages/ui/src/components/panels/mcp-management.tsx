'use client'

import { useState } from 'react'
import {
  Plug,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  ExternalLink,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpServer {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly type: 'stdio'
  readonly command: string
  readonly args: readonly string[]
  readonly env: Readonly<Record<string, string>>
}

type ConnectionTestState = 'idle' | 'testing' | 'success' | 'failure'

export interface McpManagementProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly servers: readonly McpServer[]
  readonly onAdd: (server: Omit<McpServer, 'id'>) => void
  readonly onEdit: (id: string, updates: Omit<McpServer, 'id'>) => void
  readonly onDelete: (id: string) => void
}

// ---------------------------------------------------------------------------
// Blank form state
// ---------------------------------------------------------------------------

interface FormState {
  name: string
  description: string
  command: string
  argsRaw: string
  envPairs: Array<{ key: string; value: string }>
}

function blankForm(): FormState {
  return {
    name: '',
    description: '',
    command: '',
    argsRaw: '',
    envPairs: [{ key: '', value: '' }],
  }
}

function serverToForm(server: McpServer): FormState {
  return {
    name: server.name,
    description: server.description,
    command: server.command,
    argsRaw: server.args.join(', '),
    envPairs: Object.entries(server.env).length > 0
      ? Object.entries(server.env).map(([key, value]) => ({ key, value }))
      : [{ key: '', value: '' }],
  }
}

function formToServer(form: FormState): Omit<McpServer, 'id'> {
  const args = form.argsRaw
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)

  const env: Record<string, string> = {}
  for (const pair of form.envPairs) {
    const k = pair.key.trim()
    const v = pair.value.trim()
    if (k) env[k] = v
  }

  return {
    name: form.name.trim(),
    description: form.description.trim(),
    type: 'stdio',
    command: form.command.trim(),
    args,
    env,
  }
}

function isFormValid(form: FormState): boolean {
  return form.name.trim().length > 0 && form.command.trim().length > 0
}

// ---------------------------------------------------------------------------
// Server form dialog
// ---------------------------------------------------------------------------

interface ServerFormDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly initialForm: FormState
  readonly onSubmit: (server: Omit<McpServer, 'id'>) => void
}

function ServerFormDialog({
  open,
  onOpenChange,
  title,
  initialForm,
  onSubmit,
}: ServerFormDialogProps) {
  const [form, setForm] = useState<FormState>(initialForm)

  // Reset when dialog reopens with new initial data
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setForm(initialForm)
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addEnvPair() {
    setForm((prev) => ({
      ...prev,
      envPairs: [...prev.envPairs, { key: '', value: '' }],
    }))
  }

  function removeEnvPair(index: number) {
    setForm((prev) => ({
      ...prev,
      envPairs: prev.envPairs.filter((_, i) => i !== index),
    }))
  }

  function updateEnvPair(index: number, field: 'key' | 'value', val: string) {
    setForm((prev) => ({
      ...prev,
      envPairs: prev.envPairs.map((pair, i) =>
        i === index ? { ...pair, [field]: val } : pair,
      ),
    }))
  }

  function handleSubmit() {
    if (!isFormValid(form)) return
    onSubmit(formToServer(form))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. filesystem"
              maxLength={80}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Description
            </label>
            <Input
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="What does this server provide?"
              maxLength={200}
            />
          </div>

          {/* Command */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Command <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.command}
              onChange={(e) => updateField('command', e.target.value)}
              placeholder="npx, python, /usr/bin/my-server"
              className="font-mono text-xs"
            />
          </div>

          {/* Args */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Arguments (comma-separated)
            </label>
            <Input
              value={form.argsRaw}
              onChange={(e) => updateField('argsRaw', e.target.value)}
              placeholder="-y, @modelcontextprotocol/server-filesystem, /tmp"
              className="font-mono text-xs"
            />
          </div>

          {/* Env vars */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Environment Variables
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={addEnvPair}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              {form.envPairs.map((pair, i) => (
                <div key={i} className="flex gap-1.5">
                  <Input
                    value={pair.key}
                    onChange={(e) => updateEnvPair(i, 'key', e.target.value)}
                    placeholder="KEY"
                    className="font-mono text-xs"
                  />
                  <Input
                    value={pair.value}
                    onChange={(e) => updateEnvPair(i, 'value', e.target.value)}
                    placeholder="value"
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeEnvPair(i)}
                    aria-label="Remove env var"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isFormValid(form)}>
            Save Connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Server card
// ---------------------------------------------------------------------------

interface ServerCardProps {
  readonly server: McpServer
  readonly onEdit: () => void
  readonly onDelete: () => void
}

function ServerCard({ server, onEdit, onDelete }: ServerCardProps) {
  const [testState, setTestState] = useState<ConnectionTestState>('idle')

  function handleTest() {
    setTestState('testing')
    // Simulate a connection test — replace with real API call
    setTimeout(() => {
      // Randomly succeed for demonstration; real impl would call an endpoint
      setTestState(Math.random() > 0.3 ? 'success' : 'failure')
      setTimeout(() => setTestState('idle'), 3000)
    }, 1500)
  }

  const commandPreview = [server.command, ...server.args].join(' ')

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-purple-500/10 text-purple-400">
          <Plug className="h-4 w-4" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{server.name}</p>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-[10px] shrink-0">
              {server.type}
            </Badge>
          </div>
          {server.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{server.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            aria-label={`Edit ${server.name}`}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${server.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Command preview */}
      <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5">
        <Terminal className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
          {commandPreview}
        </code>
      </div>

      {/* Test button + result */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs"
          onClick={handleTest}
          disabled={testState === 'testing'}
        >
          {testState === 'testing' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ExternalLink className="h-3 w-3" />
          )}
          {testState === 'testing' ? 'Testing…' : 'Test Connection'}
        </Button>

        {testState === 'success' && (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connected
          </span>
        )}
        {testState === 'failure' && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <XCircle className="h-3.5 w-3.5" />
            Failed
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function McpManagement({
  open,
  onOpenChange,
  servers,
  onAdd,
  onEdit,
  onDelete,
}: McpManagementProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<McpServer | null>(null)

  function handleAdd(server: Omit<McpServer, 'id'>) {
    onAdd(server)
  }

  function handleEdit(server: Omit<McpServer, 'id'>) {
    if (!editingServer) return
    onEdit(editingServer.id, server)
    setEditingServer(null)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-[420px] flex-col gap-0 p-0 sm:w-[500px]">
          <SheetHeader className="flex-row items-center gap-3 border-b px-6 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
              <Plug className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base">MCP Connections</SheetTitle>
              <SheetDescription className="text-xs">
                Manage external Model Context Protocol servers
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-0 overflow-y-auto px-6 pb-6 pt-4">
            {/* Add button */}
            <Button
              variant="outline"
              size="sm"
              className="mb-4 self-start gap-2"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Connection
            </Button>

            <Separator className="mb-4" />

            {/* Server list */}
            {servers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Plug className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">No connections yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add an MCP server to extend agent capabilities.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-col gap-3"
                role="list"
                aria-label="MCP server connections"
              >
                {servers.map((server) => (
                  <div key={server.id} role="listitem">
                    <ServerCard
                      server={server}
                      onEdit={() => setEditingServer(server)}
                      onDelete={() => onDelete(server.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add dialog */}
      <ServerFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        title="Add MCP Connection"
        initialForm={blankForm()}
        onSubmit={handleAdd}
      />

      {/* Edit dialog */}
      <ServerFormDialog
        open={editingServer !== null}
        onOpenChange={(o) => { if (!o) setEditingServer(null) }}
        title="Edit MCP Connection"
        initialForm={editingServer ? serverToForm(editingServer) : blankForm()}
        onSubmit={handleEdit}
      />
    </>
  )
}
