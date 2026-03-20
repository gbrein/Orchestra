'use client'

import { Check, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GitBranchEntry } from '@orchestra/shared'

interface GitBranchesTabProps {
  readonly branches: readonly GitBranchEntry[]
}

export function GitBranchesTab({ branches }: GitBranchesTabProps) {
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
        <li
          key={branch.name}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5',
            branch.current ? 'bg-primary/5' : 'hover:bg-muted/50',
          )}
        >
          {branch.current ? (
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
        </li>
      ))}
    </ul>
  )
}
