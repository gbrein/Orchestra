'use client'

import { Bot, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MaestroOverlayProps {
  readonly visible: boolean
  readonly enabled: boolean
  readonly status: 'idle' | 'thinking' | 'decided'
  readonly lastAction: 'continue' | 'redirect' | 'conclude' | null
  readonly lastTargetAgent: string | null
  readonly onToggle: (enabled: boolean) => void
}

// ─── Action badge config ────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { label: string; color: string }> = {
  continue: { label: 'continue', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  redirect: { label: 'redirect', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  conclude: { label: 'conclude', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MaestroOverlay({
  visible,
  enabled,
  status,
  lastAction,
  lastTargetAgent,
  onToggle,
}: MaestroOverlayProps) {
  if (!visible) return null

  const isThinking = enabled && status === 'thinking'
  const hasDecision = enabled && status === 'decided' && lastAction
  const actionStyle = lastAction ? ACTION_STYLES[lastAction] : null

  return (
    <div className="absolute left-1/2 top-[72px] z-10 -translate-x-1/2">
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className={cn(
          'group relative w-[260px] cursor-pointer rounded-xl border backdrop-blur-sm transition-all duration-300',
          enabled
            ? 'border-purple-500/40 bg-purple-950/60 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
            : 'border-border/50 bg-card/40 opacity-60 hover:opacity-80',
          isThinking && 'animate-pulse border-purple-400/60 shadow-[0_0_25px_rgba(168,85,247,0.25)]',
        )}
        title={enabled ? 'Maestro ON — click to disable' : 'Maestro OFF — click to enable'}
      >
        {/* Top accent line */}
        <div className={cn(
          'h-0.5 w-full rounded-t-xl transition-colors',
          enabled ? 'bg-purple-500/60' : 'bg-muted-foreground/20',
        )} />

        <div className="px-4 py-3">
          {/* Title row */}
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              enabled ? 'bg-purple-500/20' : 'bg-muted',
            )}>
              {isThinking ? (
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" aria-hidden />
              ) : (
                <Bot className={cn(
                  'h-4 w-4 transition-colors',
                  enabled ? 'text-purple-400' : 'text-muted-foreground',
                )} aria-hidden />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-[11px] font-bold uppercase tracking-[0.15em]',
                enabled ? 'text-purple-300' : 'text-muted-foreground',
              )}>
                Maestro
              </p>
              <p className="text-[10px] text-muted-foreground">
                {!enabled ? 'Disabled' : isThinking ? 'Evaluating...' : 'Orchestrator'}
              </p>
            </div>
            {/* Status dot */}
            <span className={cn(
              'h-2.5 w-2.5 rounded-full transition-all',
              enabled
                ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
                : 'bg-muted-foreground/30',
              isThinking && 'animate-pulse bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.6)]',
            )} />
          </div>

          {/* Decision row — only when there's a decision to show */}
          {hasDecision && actionStyle && (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-border/30 bg-background/30 px-2.5 py-1.5">
              <span className={cn(
                'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                actionStyle.color,
              )}>
                {actionStyle.label}
              </span>
              {lastTargetAgent && (
                <>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" aria-hidden />
                  <span className="truncate text-[10px] font-medium text-foreground/80">
                    {lastTargetAgent}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </button>
    </div>
  )
}
