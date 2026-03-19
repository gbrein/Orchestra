'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { apiGet, apiPost, apiPut } from '@/lib/api'

interface CanvasLayout {
  id: string
  viewport: { x: number; y: number; zoom: number }
  nodes: Node[]
  edges: Edge[]
}

interface Workspace {
  id: string
  name: string
  canvasLayouts?: Array<{ id: string }>
}

interface UseCanvasPersistenceReturn {
  workspaceId: string | null
  loaded: boolean
  saving: boolean
  lastSavedAt: Date | null
  loadCanvas: () => Promise<{ nodes: Node[]; edges: Edge[] } | null>
  saveCanvas: (nodes: Node[], edges: Edge[]) => void
}

const DEBOUNCE_MS = 2000

export function useCanvasPersistence(): UseCanvasPersistenceReturn {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)

  // Ensure a workspace exists (create on first visit)
  const ensureWorkspace = useCallback(async (): Promise<string> => {
    if (workspaceId) return workspaceId

    try {
      const workspaces = await apiGet<Workspace[]>('/api/workspaces')
      if (workspaces.length > 0) {
        setWorkspaceId(workspaces[0].id)
        return workspaces[0].id
      }
    } catch {
      // server might be down
    }

    try {
      const created = await apiPost<Workspace>('/api/workspaces', { name: 'My Workspace' })
      setWorkspaceId(created.id)
      return created.id
    } catch {
      return ''
    }
  }, [workspaceId])

  // Load canvas from server
  const loadCanvas = useCallback(async (): Promise<{ nodes: Node[]; edges: Edge[] } | null> => {
    try {
      const wsId = await ensureWorkspace()
      if (!wsId) { setLoaded(true); return null }

      const layout = await apiGet<CanvasLayout | null>(`/api/workspaces/${wsId}/canvas`)
      setLoaded(true)

      if (layout && layout.nodes && layout.nodes.length > 0) {
        return { nodes: layout.nodes, edges: layout.edges ?? [] }
      }
      return null
    } catch {
      setLoaded(true)
      return null
    }
  }, [ensureWorkspace])

  // Save canvas (debounced)
  const doSave = useCallback(async (nodes: Node[], edges: Edge[]) => {
    if (!workspaceId || nodes.length === 0) return

    setSaving(true)
    try {
      await apiPut(`/api/workspaces/${workspaceId}/canvas`, {
        name: 'default',
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
          data: e.data,
        })),
      })
      setLastSavedAt(new Date())
    } catch {
      // silent fail — next save will retry
    } finally {
      setSaving(false)
    }
  }, [workspaceId])

  const saveCanvas = useCallback((nodes: Node[], edges: Edge[]) => {
    pendingRef.current = { nodes, edges }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingRef.current
      if (pending) {
        pendingRef.current = null
        void doSave(pending.nodes, pending.edges)
      }
    }, DEBOUNCE_MS)
  }, [doSave])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return { workspaceId, loaded, saving, lastSavedAt, loadCanvas, saveCanvas }
}
