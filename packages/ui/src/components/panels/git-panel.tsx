'use client'

import { useState } from 'react'
import {
  GitBranch,
  RefreshCw,
  X,
  Loader2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useGit } from '@/hooks/use-git'
import { GitStatusTab } from '@/components/panels/git-status-tab'
import { GitLogTab } from '@/components/panels/git-log-tab'
import { GitBranchesTab } from '@/components/panels/git-branches-tab'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GitPanelProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly workspaceId?: string | null
}

type GitTabId = 'status' | 'log' | 'branches'

const TABS: { id: GitTabId; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'log', label: 'Log' },
  { id: 'branches', label: 'Branches' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function GitPanel({ open, onOpenChange, workspaceId }: GitPanelProps) {
  const [activeTab, setActiveTab] = useState<GitTabId>('status')
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)
  const [pushing, setPushing] = useState(false)

  const {
    status, log, branches,
    loading, error,
    refreshStatus, refreshLog, refreshBranches,
    stageFiles, unstageFiles, commit, push,
  } = useGit(open, workspaceId)

  const stagedCount = status?.files.filter((f) => f.staged).length ?? 0
  const canCommit = commitMsg.trim().length > 0 && stagedCount > 0 && !committing

  async function handleCommit() {
    if (!canCommit) return
    setCommitting(true)
    try {
      await commit(commitMsg.trim())
      setCommitMsg('')
    } finally {
      setCommitting(false)
    }
  }

  async function handlePush() {
    setPushing(true)
    try {
      await push()
    } finally {
      setPushing(false)
    }
  }

  function handleRefresh() {
    void Promise.all([refreshStatus(), refreshLog(), refreshBranches()])
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[420px] flex-col gap-0 p-0 sm:w-[480px] [&>button.absolute]:hidden"
      >
        <SheetTitle className="sr-only">Git</SheetTitle>

        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-orange-400" aria-hidden />
            <span className="text-sm font-semibold">Git</span>
            {status && (
              <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                {status.branch}
              </Badge>
            )}
            {status && status.ahead > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-green-400">
                <ArrowUp className="h-2.5 w-2.5" aria-hidden />
                {status.ahead}
              </span>
            )}
            {status && status.behind > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-yellow-400">
                <ArrowDown className="h-2.5 w-2.5" aria-hidden />
                {status.behind}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh"
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
              aria-label="Close"
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
        <div className="flex shrink-0 border-b border-border" role="tablist" aria-label="Git tabs">
          {TABS.map((tab) => {
            const count =
              tab.id === 'status'
                ? status?.files.length ?? 0
                : tab.id === 'log'
                ? log.length
                : branches.length

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-orange-400 text-foreground'
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
                        ? 'bg-orange-400/20 text-orange-400'
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
        <div className="flex-1 overflow-y-auto px-4 py-4" role="tabpanel">
          {loading && !status ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {activeTab === 'status' && (
                <GitStatusTab
                  files={status?.files ?? []}
                  onStage={(paths) => void stageFiles(paths)}
                  onUnstage={(paths) => void unstageFiles(paths)}
                />
              )}
              {activeTab === 'log' && <GitLogTab entries={log} />}
              {activeTab === 'branches' && <GitBranchesTab branches={branches} />}
            </>
          )}
        </div>

        <Separator />

        {/* Commit footer */}
        <div className="shrink-0 px-4 py-3">
          <Textarea
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Commit message…"
            className="mb-2 min-h-[48px] max-h-[100px] resize-none font-mono text-xs"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                void handleCommit()
              }
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1 text-xs"
              disabled={!canCommit}
              onClick={() => void handleCommit()}
            >
              {committing ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden />
              ) : null}
              Commit{stagedCount > 0 ? ` (${stagedCount})` : ''}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={pushing}
              onClick={() => void handlePush()}
            >
              {pushing ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="mr-1 h-3 w-3" aria-hidden />
              )}
              Push
              {status && status.ahead > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[9px]">
                  {status.ahead}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
