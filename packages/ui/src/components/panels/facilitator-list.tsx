'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserRoundCog, Plus, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { apiGet, apiPost, apiDelete } from '@/lib/api'

interface Facilitator {
  readonly id: string
  readonly name: string
  readonly description?: string | null
  readonly model?: string | null
  readonly avatar?: string | null
}

interface CreateFacilitatorFormProps {
  readonly onCreated: (f: Facilitator) => void
  readonly onCancel: () => void
}

function CreateFacilitatorForm({ onCreated, onCancel }: CreateFacilitatorFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('sonnet')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const created = await apiPost<Facilitator>('/api/agents', {
        name: name.trim(),
        description: description.trim() || undefined,
        persona: `You are ${name.trim()}, a skilled discussion facilitator. You guide discussions, ensure all participants are heard, synthesize viewpoints, and keep conversations productive and focused.`,
        purpose: 'general',
        model,
        isFacilitator: true,
        scope: [],
        allowedTools: [],
      })
      onCreated(created)
    } catch {
      // Error handled by caller
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-3">
      <input
        type="text"
        placeholder="Facilitator name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        autoFocus
      />
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="opus">Opus</option>
        <option value="sonnet">Sonnet</option>
        <option value="haiku">Haiku</option>
      </select>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving || !name.trim()}>
          {saving ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  )
}

export interface FacilitatorListProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSelect: (facilitator: Facilitator) => void
}

export function FacilitatorList({ open, onOpenChange, onSelect }: FacilitatorListProps) {
  const [facilitators, setFacilitators] = useState<Facilitator[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadFacilitators = useCallback(async () => {
    setLoading(true)
    try {
      const agents = await apiGet<Facilitator[]>('/api/agents?facilitator=true')
      setFacilitators(agents)
    } catch {
      // keep existing
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadFacilitators()
    }
  }, [open, loadFacilitators])

  const handleCreated = (f: Facilitator) => {
    setFacilitators((prev) => [f, ...prev])
    setShowCreate(false)
  }

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/api/agents/${id}`)
      setFacilitators((prev) => prev.filter((f) => f.id !== id))
    } catch {
      // silent
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px]">
        <SheetHeader className="flex flex-row items-center justify-between pr-6">
          <SheetTitle className="flex items-center gap-2">
            <UserRoundCog className="h-5 w-5" />
            Facilitators
            <Badge variant="secondary" className="text-xs">
              {facilitators.length}
            </Badge>
          </SheetTitle>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </SheetHeader>

        <Separator className="my-3" />

        {showCreate && (
          <>
            <CreateFacilitatorForm
              onCreated={handleCreated}
              onCancel={() => setShowCreate(false)}
            />
            <Separator className="my-3" />
          </>
        )}

        {loading && facilitators.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : facilitators.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <UserRoundCog className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No facilitators yet.</p>
            <p className="text-xs text-muted-foreground">
              Create one to moderate discussions.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Create your first facilitator
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {facilitators.map((f) => (
              <div
                key={f.id}
                role="button"
                tabIndex={0}
                className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent cursor-pointer"
                onClick={() => onSelect(f)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(f) }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {f.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{f.name}</span>
                    {f.model && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {f.model}
                      </Badge>
                    )}
                  </div>
                  {f.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {f.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(f.id)
                  }}
                  aria-label={`Delete ${f.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
