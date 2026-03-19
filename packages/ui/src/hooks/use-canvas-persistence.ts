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

export interface PersistWorkspace {
  id: string
  name: string
}

interface UseCanvasPersistenceReturn {
  workspaces: PersistWorkspace[]
  activeWorkspaceId: string
  loaded: boolean
  saving: boolean
  loadCanvas: () => Promise<{ nodes: Node[]; edges: Edge[] } | null>
  saveCanvas: (nodes: Node[], edges: Edge[]) => void
  switchWorkspace: (id: string) => Promise<{ nodes: Node[]; edges: Edge[] } | null>
  createWorkspace: (name: string) => Promise<string>
}

const DEBOUNCE_MS = 2000

export function useCanvasPersistence(): UseCanvasPersistenceReturn {
  const [workspaces, setWorkspaces] = useState<PersistWorkspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeIdRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch workspaces from API
  const fetchWorkspaces = useCallback(async (): Promise<PersistWorkspace[]> => {
    try {
      const list = await apiGet<PersistWorkspace[]>('/api/workspaces')
      setWorkspaces(list)
      return list
    } catch {
      return []
    }
  }, [])

  // Ensure at least one workspace exists
  const ensureWorkspace = useCallback(async (): Promise<string> => {
    if (activeIdRef.current) return activeIdRef.current

    const list = await fetchWorkspaces()
    if (list.length > 0) {
      activeIdRef.current = list[0].id
      setActiveWorkspaceId(list[0].id)
      return list[0].id
    }

    try {
      const created = await apiPost<PersistWorkspace>('/api/workspaces', { name: 'My Workspace' })
      activeIdRef.current = created.id
      setActiveWorkspaceId(created.id)
      setWorkspaces([created])
      return created.id
    } catch {
      return ''
    }
  }, [fetchWorkspaces])

  // Load canvas for a specific workspace
  const loadCanvasForWorkspace = useCallback(async (wsId: string): Promise<{ nodes: Node[]; edges: Edge[] } | null> => {
    if (!wsId) return null
    try {
      const layout = await apiGet<CanvasLayout | null>(`/api/workspaces/${wsId}/canvas`)
      if (layout?.nodes?.length) {
        return { nodes: layout.nodes, edges: layout.edges ?? [] }
      }
      return null
    } catch {
      return null
    }
  }, [])

  // Load canvas for the active workspace
  const loadCanvas = useCallback(async (): Promise<{ nodes: Node[]; edges: Edge[] } | null> => {
    const wsId = await ensureWorkspace()
    setLoaded(true)
    return loadCanvasForWorkspace(wsId)
  }, [ensureWorkspace, loadCanvasForWorkspace])

  // Save canvas (debounced)
  const doSave = useCallback(async (nodes: Node[], edges: Edge[]) => {
    const wsId = activeIdRef.current
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
    } catch {
      // silent retry next time
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

  // Switch to a different workspace
  const switchWorkspace = useCallback(async (id: string): Promise<{ nodes: Node[]; edges: Edge[] } | null> => {
    // Save current workspace first (flush)
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    activeIdRef.current = id
    setActiveWorkspaceId(id)
    return loadCanvasForWorkspace(id)
  }, [loadCanvasForWorkspace])

  // Create a new workspace
  const createWorkspace = useCallback(async (name: string): Promise<string> => {
    try {
      const created = await apiPost<PersistWorkspace>('/api/workspaces', { name })
      setWorkspaces((prev) => [...prev, created])
      activeIdRef.current = created.id
      setActiveWorkspaceId(created.id)
      return created.id
    } catch {
      return ''
    }
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return {
    workspaces,
    activeWorkspaceId,
    loaded,
    saving,
    loadCanvas,
    saveCanvas,
    switchWorkspace,
    createWorkspace,
  }
}
