'use client'

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import {
  FileText,
  Image,
  FileJson,
  File,
  ExternalLink,
  Key,
  FolderOpen,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Download,
  Paperclip,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  useResources,
  type WorkspaceResource,
  type CreateResourceInput,
} from '@/hooks/use-resources'

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ResourceBrowserProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly workspaceId: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function FileIcon({ mimeType }: { readonly mimeType?: string }) {
  if (!mimeType) return <File className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
  if (mimeType.startsWith('image/'))
    return <Image className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
  if (mimeType === 'application/json' || mimeType.includes('json'))
    return <FileJson className="h-4 w-4 shrink-0 text-yellow-400" aria-hidden />
  if (mimeType.startsWith('text/'))
    return <FileText className="h-4 w-4 shrink-0 text-green-400" aria-hidden />
  return <File className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

type TabId = 'files' | 'links' | 'notes' | 'variables'

const TABS: { id: TabId; label: string }[] = [
  { id: 'files', label: 'Files' },
  { id: 'links', label: 'Links' },
  { id: 'notes', label: 'Notes' },
  { id: 'variables', label: 'Variables' },
]

// ─── Files tab ──────────────────────────────────────────────────────────────

interface FilesTabProps {
  readonly files: WorkspaceResource[]
  readonly onUpload: (file: File) => Promise<void>
  readonly onDelete: (id: string) => Promise<void>
  readonly onRename: (id: string, name: string) => Promise<void>
}

function FilesTab({ files, onUpload, onDelete, onRename }: FilesTabProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length === 0) return
      setUploading(true)
      for (const file of droppedFiles) {
        setUploadProgress(`Uploading ${file.name}…`)
        try {
          await onUpload(file)
        } catch {
          // error handled by hook
        }
      }
      setUploading(false)
      setUploadProgress(null)
    },
    [onUpload],
  )

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? [])
      if (selected.length === 0) return
      setUploading(true)
      for (const file of selected) {
        setUploadProgress(`Uploading ${file.name}…`)
        try {
          await onUpload(file)
        } catch {
          // error handled by hook
        }
      }
      setUploading(false)
      setUploadProgress(null)
      // Reset file input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [onUpload],
  )

  function startRename(resource: WorkspaceResource) {
    setRenamingId(resource.id)
    setRenameValue(resource.name)
  }

  async function commitRename(id: string) {
    if (renameValue.trim()) {
      await onRename(id, renameValue.trim())
    }
    setRenamingId(null)
  }

  function handleRenameKeyDown(e: KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === 'Enter') void commitRename(id)
    if (e.key === 'Escape') setRenamingId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
          dragging
            ? 'border-cyan-400 bg-cyan-400/10'
            : 'border-border bg-muted/20 hover:border-muted-foreground/50',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => void handleDrop(e)}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Drop files here or click to browse"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
        }}
      >
        <Paperclip className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Drop files here or click to browse
        </p>
        {uploading && uploadProgress && (
          <p className="flex items-center gap-1.5 text-xs text-cyan-400">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {uploadProgress}
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        aria-hidden
        onChange={(e) => void handleFileInputChange(e)}
      />

      {/* File list */}
      {files.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No files uploaded yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1" role="list" aria-label="Uploaded files">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <FileIcon mimeType={f.mimeType} />
              <div className="min-w-0 flex-1">
                {renamingId === f.id ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => void commitRename(f.id)}
                    onKeyDown={(e) => handleRenameKeyDown(e, f.id)}
                    className="h-6 text-xs"
                    aria-label="Rename file"
                  />
                ) : (
                  <p className="truncate text-xs font-medium">{f.name}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {f.size !== undefined ? formatBytes(f.size) : '—'} · {formatDate(f.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  aria-label={`Preview ${f.name}`}
                  title="Preview"
                  onClick={() => window.open(f.value, '_blank')}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  aria-label={`Download ${f.name}`}
                  title="Download"
                  asChild
                >
                  <a href={f.value} download={f.name}>
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  aria-label={`Rename ${f.name}`}
                  title="Rename"
                  onClick={() => startRename(f)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  aria-label={`Delete ${f.name}`}
                  title="Delete"
                  onClick={() => void onDelete(f.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Links tab ──────────────────────────────────────────────────────────────

interface LinksTabProps {
  readonly links: WorkspaceResource[]
  readonly onCreate: (input: CreateResourceInput) => Promise<void>
  readonly onDelete: (id: string) => Promise<void>
}

function LinksTab({ links, onCreate, onDelete }: LinksTabProps) {
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!url.trim()) return
    setSaving(true)
    try {
      await onCreate({
        kind: 'link',
        name: title.trim() || url.trim(),
        value: url.trim(),
        description: description.trim() || undefined,
      })
      setUrl('')
      setTitle('')
      setDescription('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {adding ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Input
            placeholder="URL *"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="text-xs"
            aria-label="Link URL"
          />
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xs"
            aria-label="Link title"
          />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-xs"
            aria-label="Link description"
          />
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setAdding(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void handleAdd()}
              disabled={!url.trim() || saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : 'Add'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add Link
        </Button>
      )}

      {links.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No links added yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1" role="list" aria-label="Workspace links">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{link.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{link.value}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(link.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  aria-label={`Open ${link.name}`}
                  title="Open link"
                  onClick={() => window.open(link.value, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  aria-label={`Delete ${link.name}`}
                  title="Delete"
                  onClick={() => void onDelete(link.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Notes tab ──────────────────────────────────────────────────────────────

interface NotesTabProps {
  readonly notes: WorkspaceResource[]
  readonly onCreate: (input: CreateResourceInput) => Promise<void>
  readonly onUpdate: (id: string, input: Partial<CreateResourceInput>) => Promise<void>
  readonly onDelete: (id: string) => Promise<void>
}

function NotesTab({ notes, onCreate, onUpdate, onDelete }: NotesTabProps) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  async function handleAdd() {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      await onCreate({
        kind: 'note',
        name: newTitle.trim(),
        value: newContent.trim(),
      })
      setNewTitle('')
      setNewContent('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  function handleExpandToggle(id: string, currentValue: string) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      setEditValues((prev) => ({ ...prev, [id]: currentValue }))
    }
  }

  async function handleNoteBlur(id: string) {
    const value = editValues[id]
    if (value !== undefined) {
      await onUpdate(id, { value })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {adding ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Input
            placeholder="Note title *"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="text-xs"
            aria-label="Note title"
          />
          <Textarea
            placeholder="Write your note here…"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="min-h-[80px] resize-none text-xs"
            aria-label="Note content"
          />
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setAdding(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void handleAdd()}
              disabled={!newTitle.trim() || saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : 'Add'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add Note
        </Button>
      )}

      {notes.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No notes added yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1" role="list" aria-label="Workspace notes">
          {notes.map((note) => {
            const isExpanded = expandedId === note.id
            return (
              <li
                key={note.id}
                className="rounded-md border border-border overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 text-left"
                    onClick={() => handleExpandToggle(note.id, note.value)}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} note: ${note.name}`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex-1 truncate text-xs font-medium">{note.name}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    )}
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    aria-label={`Delete note ${note.name}`}
                    onClick={() => void onDelete(note.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
                {isExpanded && (
                  <div className="border-t border-border px-3 py-2">
                    <Textarea
                      value={editValues[note.id] ?? note.value}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [note.id]: e.target.value }))
                      }
                      onBlur={() => void handleNoteBlur(note.id)}
                      className="min-h-[80px] resize-none text-xs"
                      aria-label={`Edit note ${note.name}`}
                      placeholder="Write your note here…"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Auto-saves on blur · {formatDate(note.updatedAt)}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── Variables tab ──────────────────────────────────────────────────────────

interface VariablesTabProps {
  readonly variables: WorkspaceResource[]
  readonly onCreate: (input: CreateResourceInput) => Promise<void>
  readonly onUpdate: (id: string, input: Partial<CreateResourceInput>) => Promise<void>
  readonly onDelete: (id: string) => Promise<void>
}

function VariablesTab({ variables, onCreate, onUpdate, onDelete }: VariablesTabProps) {
  const [adding, setAdding] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newSecret, setNewSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())

  async function handleAdd() {
    if (!newKey.trim()) return
    setSaving(true)
    try {
      await onCreate({
        kind: 'variable',
        name: newKey.trim(),
        value: newValue,
        secret: newSecret,
      })
      setNewKey('')
      setNewValue('')
      setNewSecret(false)
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleEditSave(variable: WorkspaceResource) {
    await onUpdate(variable.id, { value: editValue })
    setEditingId(null)
  }

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {adding ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Input
            placeholder="Key *"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="font-mono text-xs"
            aria-label="Variable key"
          />
          <Input
            placeholder="Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            type={newSecret ? 'password' : 'text'}
            className="font-mono text-xs"
            aria-label="Variable value"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={newSecret}
              onChange={(e) => setNewSecret(e.target.checked)}
              className="rounded"
              aria-label="Secret variable"
            />
            Secret (mask value)
          </label>
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setAdding(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void handleAdd()}
              disabled={!newKey.trim() || saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : 'Add'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add Variable
        </Button>
      )}

      {variables.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No variables added yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1" role="list" aria-label="Workspace variables">
          {variables.map((variable) => {
            const isRevealed = revealedIds.has(variable.id)
            const displayValue =
              variable.secret && !isRevealed
                ? '••••••••'
                : variable.value

            return (
              <li
                key={variable.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <Key className="h-3.5 w-3.5 shrink-0 text-yellow-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-medium">{variable.name}</p>
                  {editingId === variable.id ? (
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => void handleEditSave(variable)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleEditSave(variable)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="mt-0.5 h-6 font-mono text-[10px]"
                      type={variable.secret ? 'password' : 'text'}
                      aria-label={`Edit value of ${variable.name}`}
                    />
                  ) : (
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {displayValue}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {variable.secret && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      aria-label={isRevealed ? 'Hide value' : 'Show value'}
                      title={isRevealed ? 'Hide' : 'Show'}
                      onClick={() => toggleReveal(variable.id)}
                    >
                      {isRevealed ? (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    aria-label={`Edit ${variable.name}`}
                    title="Edit"
                    onClick={() => {
                      setEditingId(variable.id)
                      setEditValue(variable.value)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    aria-label={`Delete ${variable.name}`}
                    title="Delete"
                    onClick={() => void onDelete(variable.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── ResourceBrowser ────────────────────────────────────────────────────────

export function ResourceBrowser({
  open,
  onOpenChange,
  workspaceId,
}: ResourceBrowserProps) {
  const [activeTab, setActiveTab] = useState<TabId>('files')
  const {
    resources,
    loading,
    error,
    refresh,
    uploadFile,
    createResource,
    updateResource,
    deleteResource,
  } = useResources(workspaceId)

  const files = resources.filter((r) => r.kind === 'file')
  const links = resources.filter((r) => r.kind === 'link')
  const notes = resources.filter((r) => r.kind === 'note')
  const variables = resources.filter((r) => r.kind === 'variable')

  const handleRename = useCallback(
    (id: string, name: string) => updateResource(id, { name }),
    [updateResource],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[420px] flex-col gap-0 p-0 sm:w-[480px] [&>button.absolute]:hidden"
      >
        <SheetTitle className="sr-only">Workspace Resources</SheetTitle>

        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-cyan-400" aria-hidden />
            <span className="text-sm font-semibold">Workspace Resources</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => void refresh()}
              disabled={loading}
              aria-label="Refresh resources"
              title="Refresh"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
                aria-hidden
              />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => onOpenChange(false)}
              aria-label="Close resources panel"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="shrink-0 border-b border-destructive/40 bg-destructive/10 px-4 py-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Tab bar */}
        <div
          className="flex shrink-0 border-b border-border"
          role="tablist"
          aria-label="Resource tabs"
        >
          {TABS.map((tab) => {
            const count =
              tab.id === 'files'
                ? files.length
                : tab.id === 'links'
                ? links.length
                : tab.id === 'notes'
                ? notes.length
                : variables.length

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-cyan-400 text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                      activeTab === tab.id
                        ? 'bg-cyan-400/20 text-cyan-400'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          role="tabpanel"
          aria-label={`${activeTab} tab`}
        >
          {loading && resources.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading resources" />
            </div>
          ) : (
            <>
              {activeTab === 'files' && (
                <FilesTab
                  files={files}
                  onUpload={uploadFile}
                  onDelete={deleteResource}
                  onRename={handleRename}
                />
              )}
              {activeTab === 'links' && (
                <LinksTab
                  links={links}
                  onCreate={createResource}
                  onDelete={deleteResource}
                />
              )}
              {activeTab === 'notes' && (
                <NotesTab
                  notes={notes}
                  onCreate={createResource}
                  onUpdate={updateResource}
                  onDelete={deleteResource}
                />
              )}
              {activeTab === 'variables' && (
                <VariablesTab
                  variables={variables}
                  onCreate={createResource}
                  onUpdate={updateResource}
                  onDelete={deleteResource}
                />
              )}
            </>
          )}
        </div>

        <Separator />

        {/* Footer summary */}
        <div className="shrink-0 px-4 py-2">
          <p className="text-[10px] text-muted-foreground">
            {files.length} {files.length === 1 ? 'file' : 'files'} · {links.length} {links.length === 1 ? 'link' : 'links'} · {notes.length} {notes.length === 1 ? 'note' : 'notes'} · {variables.length} {variables.length === 1 ? 'variable' : 'variables'}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
