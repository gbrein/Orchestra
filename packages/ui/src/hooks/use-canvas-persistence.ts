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
}

interface UseCanvasPersistenceReturn {
  loaded: boolean
  saving: boolean
  lastSavedAt: Date | null
  loadCanvas: () => Promise<{ nodes: Node[]; edges: Edge[] } | null>
  saveCanvas: (nodes: Node[], edges: Edge[]) => void
}

const DEBOUNCE_MS = 2000

export function useCanvasPersistence(): UseCanvasPersistenceReturn {
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const workspaceIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ensure a workspace exists
  const ensureWorkspace = useCallback(async (): Promise<string> => {
    if (workspaceIdRef.current) return workspaceIdRef.current

    try {
      const workspaces = await apiGet<Workspace[]>('/api/workspaces')
      if (workspaces.length > 0) {
        workspaceIdRef.current = workspaces[0].id
        return workspaces[0].id
      }
    } catch {
      // server down
    }

    try {
      const created = await apiPost<Workspace>('/api/workspaces', { name: 'My Workspace' })
      workspaceIdRef.current = created.id
      return created.id
    } catch {
      return ''
    }
  }, [])

  const loadCanvas = useCallback(async (): Promise<{ nodes: Node[]; edges: Edge[] } | null> => {
    try {
      const wsId = await ensureWorkspace()
      if (!wsId) { setLoaded(true); return null }

      const layout = await apiGet<CanvasLayout | null>(`/api/workspaces/${wsId}/canvas`)
      setLoaded(true)

      if (layout?.nodes?.length) {
        return { nodes: layout.nodes, edges: layout.edges ?? [] }
      }
      return null
    } catch {
      setLoaded(true)
      return null
    }
  }, [ensureWorkspace])

  const doSave = useCallback(async (nodes: Node[], edges: Edge[]) => {
    const wsId = workspaceIdRef.current
    if (!wsId || nodes.length === 0) return

    setSaving(true)
    try {
      await apiPut(`/api/workspaces/${wsId}/canvas`, {
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
      // silent — next save will retry
    } finally {
      setSaving(false)
    }
  }, [])

  const saveCanvas = useCallback((nodes: Node[], edges: Edge[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void doSave(nodes, edges)
    }, DEBOUNCE_MS)
  }, [doSave])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return { loaded, saving, lastSavedAt, loadCanvas, saveCanvas }
}
