'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import type { GitStatusResult, GitLogEntry, GitBranchEntry, GitPushResult } from '@orchestra/shared'

export interface UseGitReturn {
  status: GitStatusResult | null
  log: GitLogEntry[]
  branches: GitBranchEntry[]
  loading: boolean
  error: string | null
  refreshStatus: () => Promise<void>
  refreshLog: () => Promise<void>
  refreshBranches: () => Promise<void>
  stageFiles: (paths: string[]) => Promise<void>
  unstageFiles: (paths: string[]) => Promise<void>
  commit: (message: string) => Promise<void>
  push: () => Promise<GitPushResult>
}

export function useGit(active: boolean): UseGitReturn {
  const [status, setStatus] = useState<GitStatusResult | null>(null)
  const [log, setLog] = useState<GitLogEntry[]>([])
  const [branches, setBranches] = useState<GitBranchEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const data = await apiGet<GitStatusResult>('/api/git/status')
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get git status')
    }
  }, [])

  const refreshLog = useCallback(async () => {
    try {
      const data = await apiGet<GitLogEntry[]>('/api/git/log?limit=30')
      setLog(data)
    } catch {
      // best effort
    }
  }, [])

  const refreshBranches = useCallback(async () => {
    try {
      const data = await apiGet<GitBranchEntry[]>('/api/git/branches')
      setBranches(data)
    } catch {
      // best effort
    }
  }, [])

  // Initial load + auto-refresh
  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    setLoading(true)
    Promise.all([refreshStatus(), refreshLog(), refreshBranches()])
      .finally(() => setLoading(false))

    intervalRef.current = setInterval(() => {
      void refreshStatus()
    }, 10_000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [active, refreshStatus, refreshLog, refreshBranches])

  const stageFiles = useCallback(async (paths: string[]) => {
    setError(null)
    try {
      await apiPost('/api/git/stage', { paths })
      await refreshStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stage files')
    }
  }, [refreshStatus])

  const unstageFiles = useCallback(async (paths: string[]) => {
    setError(null)
    try {
      await apiPost('/api/git/unstage', { paths })
      await refreshStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unstage files')
    }
  }, [refreshStatus])

  const commit = useCallback(async (message: string) => {
    setError(null)
    try {
      await apiPost('/api/git/commit', { message })
      await Promise.all([refreshStatus(), refreshLog()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed')
    }
  }, [refreshStatus, refreshLog])

  const push = useCallback(async (): Promise<GitPushResult> => {
    setError(null)
    try {
      const result = await apiPost<GitPushResult>('/api/git/push', {})
      if (!result.success) {
        setError(result.message)
      }
      await refreshStatus()
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed'
      setError(msg)
      return { success: false, message: msg }
    }
  }, [refreshStatus])

  return {
    status, log, branches, loading, error,
    refreshStatus, refreshLog, refreshBranches,
    stageFiles, unstageFiles, commit, push,
  }
}
