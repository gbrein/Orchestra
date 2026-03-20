'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiGet, apiPatch } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Workspace {
  readonly id: string
  readonly name: string
  readonly contextDocument?: string | null
}

interface WorkspaceContextEditorProps {
  readonly workspaceId: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WorkspaceContextEditor({ workspaceId }: WorkspaceContextEditorProps) {
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const workspaces = await apiGet<Workspace[]>('/api/workspaces')
        const ws = workspaces.find((w) => w.id === workspaceId)
        const doc = ws?.contextDocument ?? ''
        setContent(doc)
        setSavedContent(doc)
      } catch {
        // best effort
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [workspaceId])

  const isDirty = content !== savedContent

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await apiPatch(`/api/workspaces/${workspaceId}/context`, {
        contextDocument: content || null,
      })
      setSavedContent(content)
    } catch {
      // best effort
    } finally {
      setSaving(false)
    }
  }, [workspaceId, content])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-cyan-400" />
          Workspace Context
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={!isDirty || saving}
          onClick={() => void handleSave()}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Save
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        This document is injected into every agent prompt in this workspace. Use it for shared instructions, project context, or coding standards.
      </p>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# Workspace Context\n\nDescribe the project, conventions, or instructions that all agents should follow..."
        className="min-h-[200px] font-mono text-xs"
        rows={12}
      />
    </div>
  )
}
