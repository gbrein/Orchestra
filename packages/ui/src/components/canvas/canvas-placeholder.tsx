'use client'

import { Sparkles, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface CanvasPlaceholderProps {
  readonly onCreateAssistant?: () => void
  readonly onStartDiscussion?: () => void
  readonly onUseTemplate?: () => void
  readonly onExploreSkills?: () => void
  readonly onDescribe?: (description: string) => void
  readonly onGoToWorkspace?: () => void
  readonly hasExistingCanvas?: boolean
  readonly isGenerating?: boolean
}

export function CanvasPlaceholder({
  onCreateAssistant,
  onUseTemplate,
  onDescribe,
  onGoToWorkspace,
  hasExistingCanvas,
  isGenerating = false,
}: CanvasPlaceholderProps) {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex w-full max-w-xl flex-col items-center gap-6 px-4 text-center">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            What do you want to build?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Describe your task and Orchestra will create a team of AI agents to accomplish it.
          </p>
        </div>

        {/* Hero input — primary CTA */}
        <form
          className="w-full"
          onSubmit={(e) => {
            e.preventDefault()
            const input = e.currentTarget.querySelector('input') as HTMLInputElement
            const value = input?.value.trim()
            if (value) {
              onDescribe?.(value)
              if (input) input.value = ''
            }
          }}
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="text"
                placeholder="Build a REST API for a todo app with tests and code review..."
                className="h-11 w-full rounded-lg border bg-background pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                aria-label="Describe what you want to build"
                disabled={isGenerating}
              />
            </div>
            <Button
              type="submit"
              disabled={isGenerating}
              className="h-11 px-5"
            >
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
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>or</span>
          <button
            type="button"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
            onClick={onUseTemplate}
          >
            Use a Template
          </button>
          <span className="text-border">|</span>
          <button
            type="button"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
            onClick={onCreateAssistant}
          >
            Create an Assistant
          </button>
        </div>

        {/* Continue to workspace */}
        {hasExistingCanvas && onGoToWorkspace && (
          <Button
            variant="outline"
            className="mt-2 gap-2"
            onClick={onGoToWorkspace}
          >
            Continue to your workspace
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
