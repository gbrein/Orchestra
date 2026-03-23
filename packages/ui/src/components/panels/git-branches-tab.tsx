'use client'

import { useState } from 'react'
import { Check, GitBranch, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GitBranchEntry } from '@orchestra/shared'

interface GitBranchesTabProps {
  readonly branches: readonly GitBranchEntry[]
  readonly onCheckout?: (branch: string) => Promise<void>
}

export function GitBranchesTab({ branches, onCheckout }: GitBranchesTabProps) {
  const [switching, setSwitching] = useState<string | null>(null)

  async function handleClick(branch: GitBranchEntry) {
    if (branch.current || !onCheckout || switching) return
    setSwitching(branch.name)
    try {
      await onCheckout(branch.name)
    } finally {
      setSwitching(null)
    }
  }

  if (branches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <GitBranch className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No branches found</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-0.5" role="list" aria-label="Git branches">
      {branches.map((branch) => (
        <li key={branch.name}>
          <button
            type="button"
            disabled={branch.current || switching !== null}
            onClick={() => handleClick(branch)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
              branch.current
                ? 'bg-primary/5 cursor-default'
                : 'hover:bg-muted/50 cursor-pointer',
              switching === branch.name && 'opacity-70',
            )}
          >
            {switching === branch.name ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-label="Switching..." />
            ) : branch.current ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Current branch" />
            ) : (
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span
              className={cn(
                'truncate font-mono text-xs',
                branch.current && 'font-medium text-primary',
              )}
            >
              {branch.name}
            </span>
            {!branch.current && !switching && (
              <span className="ml-auto text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                switch
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
