'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Save, Loader2, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Memory {
  readonly id: string
  readonly key: string
  readonly value: string
}

interface AgentMemoryTabProps {
  readonly agentId: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AgentMemoryTab({ agentId }: AgentMemoryTabProps) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const fetchMemories = useCallback(async () => {
    try {
      const data = await apiGet<Memory[]>(`/api/agents/${agentId}/memories`)
      setMemories(data)
    } catch {
      // best effort
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    void fetchMemories()
  }, [fetchMemories])

  const handleAdd = useCallback(async () => {
    if (!newKey.trim() || !newValue.trim()) return
    try {
      const memory = await apiPost<Memory>(`/api/agents/${agentId}/memories`, {
        key: newKey.trim(),
        value: newValue.trim(),
      })
      setMemories((prev) => [...prev, memory])
      setNewKey('')
      setNewValue('')
    } catch {
      // best effort
    }
  }, [agentId, newKey, newValue])

  const handleSave = useCallback(
    async (memoryId: string) => {
      if (!editValue.trim()) return
      try {
        const updated = await apiPatch<Memory>(
          `/api/agents/${agentId}/memories/${memoryId}`,
          { value: editValue.trim() },
        )
        setMemories((prev) => prev.map((m) => (m.id === memoryId ? updated : m)))
        setEditingId(null)
      } catch {
        // best effort
      }
    },
    [agentId, editValue],
  )

  const handleDelete = useCallback(
    async (memoryId: string) => {
      try {
        await apiDelete(`/api/agents/${agentId}/memories/${memoryId}`)
        setMemories((prev) => prev.filter((m) => m.id !== memoryId))
      } catch {
        // best effort
      }
    },
    [agentId],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Brain className="h-4 w-4 text-purple-400" />
        Agent Memory
      </div>

      {/* Memory entries */}
      <div className="flex flex-col gap-2">
        {memories.map((mem) => (
          <div key={mem.id} className="rounded-md border border-border p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-medium text-primary">{mem.key}</span>
              <div className="flex items-center gap-1">
                {editingId === mem.id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => void handleSave(mem.id)}
                    aria-label="Save"
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setEditingId(mem.id)
                      setEditValue(mem.value)
                    }}
                    aria-label="Edit"
                  >
                    <Save className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive"
                  onClick={() => void handleDelete(mem.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {editingId === mem.id ? (
              <textarea
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                rows={2}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{mem.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="rounded-md border border-dashed border-border p-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="flex h-7 w-1/3 rounded border border-border bg-background px-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <input
            type="text"
            placeholder="Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="flex h-7 flex-1 rounded border border-border bg-background px-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={!newKey.trim() || !newValue.trim()}
            onClick={() => void handleAdd()}
            aria-label="Add memory"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
