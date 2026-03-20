'use client'

import { Bot, MessageSquare, Layout, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export interface CanvasPlaceholderProps {
  readonly onCreateAssistant?: () => void
  readonly onStartDiscussion?: () => void
  readonly onUseTemplate?: () => void
  readonly onExploreSkills?: () => void
  readonly onDescribe?: (description: string) => void
  readonly onGoToWorkspace?: () => void
  readonly hasExistingCanvas?: boolean
}

interface QuickAction {
  readonly icon: React.ElementType
  readonly title: string
  readonly description: string
  readonly actionKey: keyof Omit<CanvasPlaceholderProps, 'onDescribe'>
}

const ACTIONS: readonly QuickAction[] = [
  {
    icon: Bot,
    title: 'Create an Assistant',
    description: 'Build a helper for a specific task',
    actionKey: 'onCreateAssistant',
  },
  {
    icon: MessageSquare,
    title: 'Start a Team Discussion',
    description: 'Multiple assistants brainstorm together',
    actionKey: 'onStartDiscussion',
  },
  {
    icon: Layout,
    title: 'Use a Template',
    description: 'Start with a pre-built setup',
    actionKey: 'onUseTemplate',
  },
  {
    icon: Sparkles,
    title: 'Explore Skills',
    description: 'Add abilities to your assistants',
    actionKey: 'onExploreSkills',
  },
]

export function CanvasPlaceholder({
  onCreateAssistant,
  onStartDiscussion,
  onUseTemplate,
  onExploreSkills,
  onDescribe,
  onGoToWorkspace,
  hasExistingCanvas,
}: CanvasPlaceholderProps) {
  const callbacks: Record<string, (() => void) | undefined> = {
    onCreateAssistant,
    onStartDiscussion,
    onUseTemplate,
    onExploreSkills,
  }
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex max-w-lg flex-col items-center gap-8 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome to Orchestra</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            What would you like to do?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ACTIONS.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent"
              role="button"
              tabIndex={0}
              aria-label={action.title}
              onClick={() => callbacks[action.actionKey]?.()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  callbacks[action.actionKey]?.()
                }
              }}
            >
              <CardHeader className="p-4">
                <action.icon className="mb-2 h-6 w-6 text-primary" aria-hidden />
                <CardTitle className="text-sm">{action.title}</CardTitle>
                <CardDescription className="text-xs">{action.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="w-full">
          <p className="mb-2 text-xs text-muted-foreground">Or describe what you need:</p>
          <form
            className="flex gap-2"
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
            <input
              type="text"
              placeholder="I need help analyzing my sales data..."
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Describe what you need"
            />
            <Button type="submit" size="sm">Go</Button>
          </form>
        </div>

        {hasExistingCanvas && onGoToWorkspace && (
          <Button
            variant="outline"
            className="gap-2"
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
