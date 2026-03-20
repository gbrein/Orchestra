'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from '@/lib/api'

// ─── Types ─────────────────────────────────────────────────────────────────

export type ResourceKind = 'file' | 'link' | 'note' | 'variable'

export interface WorkspaceResource {
  readonly id: string
  readonly workspaceId: string
  readonly kind: ResourceKind
  readonly name: string
  readonly value: string
  readonly mimeType?: string
  readonly size?: number
  readonly secret?: boolean
  readonly description?: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateResourceInput {
  readonly kind: ResourceKind
  readonly name: string
  readonly value: string
  readonly mimeType?: string
  readonly size?: number
  readonly secret?: boolean
  readonly description?: string
}

export interface UseResourcesReturn {
  resources: WorkspaceResource[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  uploadFile: (file: File) => Promise<void>
  createResource: (input: CreateResourceInput) => Promise<void>
  updateResource: (id: string, input: Partial<CreateResourceInput>) => Promise<void>
  deleteResource: (id: string) => Promise<void>
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useResources(workspaceId: string | null): UseResourcesReturn {
  const [resources, setResources] = useState<WorkspaceResource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<WorkspaceResource[]>(
        `/api/workspaces/${workspaceId}/resources`,
      )
      setResources(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resources')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const uploadFile = useCallback(
    async (file: File) => {
      if (!workspaceId) return
      setError(null)
      try {
        const created = await apiUpload<WorkspaceResource>(
          `/api/workspaces/${workspaceId}/resources/upload`,
          file,
          { workspaceId },
        )
        setResources((prev) => [...prev, created])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
        throw err
      }
    },
    [workspaceId],
  )

  const createResource = useCallback(
    async (input: CreateResourceInput) => {
      if (!workspaceId) return
      setError(null)
      try {
        const created = await apiPost<WorkspaceResource>(
          `/api/workspaces/${workspaceId}/resources`,
          { ...input, workspaceId },
        )
        setResources((prev) => [...prev, created])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create resource')
        throw err
      }
    },
    [workspaceId],
  )

  const updateResource = useCallback(
    async (id: string, input: Partial<CreateResourceInput>) => {
      if (!workspaceId) return
      setError(null)
      try {
        const updated = await apiPatch<WorkspaceResource>(
          `/api/workspaces/${workspaceId}/resources/${id}`,
          input,
        )
        setResources((prev) =>
          prev.map((r) => (r.id === id ? updated : r)),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update resource')
        throw err
      }
    },
    [workspaceId],
  )

  const deleteResource = useCallback(
    async (id: string) => {
      if (!workspaceId) return
      setError(null)
      try {
        await apiDelete(`/api/workspaces/${workspaceId}/resources/${id}`)
        setResources((prev) => prev.filter((r) => r.id !== id))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete resource')
        throw err
      }
    },
    [workspaceId],
  )

  return {
    resources,
    loading,
    error,
    refresh,
    uploadFile,
    createResource,
    updateResource,
    deleteResource,
  }
}
