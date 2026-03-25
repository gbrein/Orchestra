'use client'

import { Sparkles, LayoutTemplate, Bot, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type FirstAction = 'describe' | 'template' | 'create' | 'skip'

export interface StepFirstActionProps {
  readonly onAction: (action: FirstAction, description?: string) => void
  readonly onBack: () => void
  readonly isGenerating?: boolean
}

export function StepFirstAction({ onAction, onBack, isGenerating = false }: StepFirstActionProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          You&apos;re ready.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          What would you like to do first?
        </p>
      </div>

      {/* Primary: describe a task */}
      <form
        className="w-full max-w-md"
        onSubmit={(e) => {
          e.preventDefault()
          const input = e.currentTarget.querySelector('input') as HTMLInputElement
          const val = input?.value.trim()
          if (val) {
            onAction('describe', val)
          }
        }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="text"
              placeholder="Build a REST API with tests and code review..."
              className="h-11 w-full rounded-lg border bg-background pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              aria-label="Describe what you want to build"
              disabled={isGenerating}
            />
          </div>
          <Button type="submit" className="h-11 px-5" disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                Generating...
              </>
            ) : (
              'Go'
            )}
          </Button>
        </div>
      </form>

      {/* Secondary actions */}
      <div className="flex w-full max-w-md gap-4">
        <button
          type="button"
          onClick={() => onAction('template')}
          className="flex flex-1 flex-col items-center gap-2 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
          disabled={isGenerating}
        >
          <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium">Start from Template</span>
          <span className="text-[10px] text-muted-foreground">Pre-built workflows</span>
        </button>
        <button
          type="button"
          onClick={() => onAction('create')}
          className="flex flex-1 flex-col items-center gap-2 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
          disabled={isGenerating}
        >
          <Bot className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium">Create an Assistant</span>
          <span className="text-[10px] text-muted-foreground">Build from scratch</span>
        </button>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} disabled={isGenerating}>
          Back
        </Button>
        <Button variant="ghost" onClick={() => onAction('skip')} disabled={isGenerating}>
          Skip
        </Button>
      </div>
    </div>
  )
}
