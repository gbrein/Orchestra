'use client'

import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

// ─── Types ──────────────────────────────────────────────────────────────────

export type MaestroRigor = 1 | 2 | 3 | 4 | 5

export interface MaestroDrawerProps {
  readonly enabled: boolean
  readonly rigor: MaestroRigor
  readonly customInstructions: string
  readonly onToggle: (enabled: boolean) => void
  readonly onRigorChange: (rigor: MaestroRigor) => void
  readonly onCustomInstructionsChange: (instructions: string) => void
}

// ─── Rigor levels ───────────────────────────────────────────────────────────

const RIGOR_LEVELS: readonly { readonly value: MaestroRigor; readonly label: string; readonly description: string; readonly color: string }[] = [
  { value: 1, label: 'Relaxed', description: 'Almost always continues. Only redirects for critical errors.', color: 'bg-green-500' },
  { value: 2, label: 'Lenient', description: 'Accepts most outputs. Redirects only when something important is missing.', color: 'bg-emerald-500' },
  { value: 3, label: 'Balanced', description: 'Default level. Evaluates quality fairly, suggests improvements when worthwhile.', color: 'bg-amber-500' },
  { value: 4, label: 'Strict', description: 'Higher standards. Expects thorough work and may redirect for incomplete outputs.', color: 'bg-orange-500' },
  { value: 5, label: 'Demanding', description: 'Very high bar. Expects comprehensive, production-ready output from every step.', color: 'bg-red-500' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function MaestroDrawer({
  enabled,
  rigor,
  customInstructions,
  onToggle,
  onRigorChange,
  onCustomInstructionsChange,
}: MaestroDrawerProps) {
  const currentLevel = RIGOR_LEVELS.find((l) => l.value === rigor) ?? RIGOR_LEVELS[2]!

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
            enabled ? 'bg-purple-500/20' : 'bg-muted',
          )}>
            <Bot className={cn(
              'h-5 w-5',
              enabled ? 'text-purple-400' : 'text-muted-foreground',
            )} aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold uppercase tracking-[0.1em] text-purple-300">Maestro</p>
            <p className="text-xs text-muted-foreground">Workflow Orchestrator</p>
          </div>
          {/* Toggle */}
          <button
            type="button"
            onClick={() => onToggle(!enabled)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              enabled ? 'bg-purple-500' : 'bg-muted-foreground/30',
            )}
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle Maestro"
          >
            <span className={cn(
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200',
              enabled ? 'translate-x-5' : 'translate-x-0',
            )} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Rigor slider */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Criticism Level</label>
            <Badge variant="outline" className={cn(
              'text-[10px] px-2 py-0.5',
              enabled ? 'border-purple-500/30 text-purple-400' : 'text-muted-foreground',
            )}>
              {currentLevel.label}
            </Badge>
          </div>

          {/* Level dots */}
          <div className="flex items-center gap-1 mb-3">
            {RIGOR_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => onRigorChange(level.value)}
                className={cn(
                  'flex-1 h-2 rounded-full transition-all cursor-pointer',
                  level.value <= rigor ? level.color : 'bg-muted',
                  level.value <= rigor && 'opacity-90',
                )}
                aria-label={`Set rigor to ${level.label}`}
                title={level.label}
              />
            ))}
          </div>

          {/* Slider */}
          <input
            type="range"
            min={1}
            max={5}
            value={rigor}
            onChange={(e) => onRigorChange(Number(e.target.value) as MaestroRigor)}
            className="w-full accent-purple-500"
            aria-label="Criticism level"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">Relaxed</span>
            <span className="text-[10px] text-muted-foreground">Demanding</span>
          </div>

          {/* Description */}
          <p className="mt-2 text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
            {currentLevel.description}
          </p>
        </section>

        {/* Custom instructions */}
        <section>
          <label className="text-sm font-medium block mb-2">Custom Instructions</label>
          <p className="text-[11px] text-muted-foreground mb-2">
            Additional instructions for the Maestro when evaluating agent outputs. These are appended to the system prompt.
          </p>
          <Textarea
            value={customInstructions}
            onChange={(e) => onCustomInstructionsChange(e.target.value)}
            placeholder="e.g., Always ensure code includes TypeScript types. Prioritize security over performance..."
            className="min-h-[100px] max-h-[200px] resize-y text-xs"
            rows={4}
          />
        </section>

        {/* How it works */}
        <section>
          <p className="text-sm font-medium mb-2">How Maestro Works</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
              <span>Evaluates each agent's output after completion</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
              <span>Contextualizes messages so the next agent understands the full picture</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
              <span>Can redirect (retry) a step if output quality is insufficient</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
              <span>Can conclude the workflow early if the objective is already met</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
              <span>Learns patterns between runs to improve future evaluations</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
