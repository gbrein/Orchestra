'use client'

import { Sparkles, Layers, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type WorkMode = 'quick' | 'full'

export interface StepWorkModeProps {
  readonly value: WorkMode | null
  readonly onChange: (mode: WorkMode) => void
  readonly onContinue: () => void
  readonly onBack: () => void
}

const MODES = [
  {
    id: 'quick' as const,
    icon: Sparkles,
    title: 'Quick Start',
    description: 'Describe what you want, Orchestra handles the rest. Best for trying things out.',
  },
  {
    id: 'full' as const,
    icon: Layers,
    title: 'Full Control',
    description: 'Build agent teams with skills, safety rules, and custom workflows. For power users.',
  },
]

export function StepWorkMode({ value, onChange, onContinue, onBack }: StepWorkModeProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          How do you want to work?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose how much control you want. You can switch modes anytime in Settings.
        </p>
      </div>

      <div className="flex w-full max-w-lg gap-4">
        {MODES.map((mode) => {
          const selected = value === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all',
                selected
                  ? 'border-primary bg-accent/10'
                  : 'border-border hover:border-border/80',
              )}
            >
              {selected && (
                <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary" aria-hidden />
              )}
              <mode.icon className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-semibold">{mode.title}</span>
              <p className="text-xs text-muted-foreground leading-relaxed">{mode.description}</p>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={!value}>
          Continue
        </Button>
      </div>
    </div>
  )
}
