'use client'

import { Bot, MessageSquare, Layout, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface QuickAction {
  readonly icon: React.ElementType
  readonly title: string
  readonly description: string
}

const ACTIONS: readonly QuickAction[] = [
  {
    icon: Bot,
    title: 'Create an Assistant',
    description: 'Build a helper for a specific task',
  },
  {
    icon: MessageSquare,
    title: 'Start a Team Discussion',
    description: 'Multiple assistants brainstorm together',
  },
  {
    icon: Layout,
    title: 'Use a Template',
    description: 'Start with a pre-built setup',
  },
  {
    icon: Sparkles,
    title: 'Explore Skills',
    description: 'Add abilities to your assistants',
  },
]

export function CanvasPlaceholder() {
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
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="I need help analyzing my sales data..."
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Describe what you need"
            />
            <Button size="sm">Go</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
