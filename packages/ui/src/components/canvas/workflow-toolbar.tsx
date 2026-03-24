'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Play,
  Square,
  Loader2,
  MessageSquare,
  Bot,
  Lightbulb,
  ArrowRight,
  Send,
  ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useCoachingStep } from '@/hooks/use-onboarding'
import { CoachingTooltip } from '@/components/onboarding/coaching-tooltip'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  readonly index: number
  readonly total: number
  readonly agentName: string
}

export interface WorkflowToolbarProps {
  readonly hasChain: boolean
  readonly isRunning: boolean
  readonly currentStep?: WorkflowStep | null
  // Run/Stop
  readonly onRun: (message: string) => void
  readonly onStop: () => void
  // Chat
  readonly chatOpen: boolean
  readonly onToggleChat: () => void
  // Maestro
  readonly maestroEnabled: boolean
  readonly maestroStatus: 'idle' | 'thinking' | 'decided'
  readonly maestroLastAction: 'continue' | 'redirect' | 'conclude' | null
  readonly maestroLastTargetAgent: string | null
  readonly onMaestroToggle: () => void
  // Advisor
  readonly advisorVisible: boolean
  readonly advisorRunning: boolean
  readonly onAdvisorClick: () => void
  // Planner
  readonly plannerEnabled: boolean
  readonly plannerStatus: 'idle' | 'planning' | 'done'
  readonly onPlannerToggle: () => void
  // Last message for re-run
  readonly lastMessage?: string
}

// ─── Maestro action badge styles ────────────────────────────────────────────

const ACTION_STYLES: Record<string, { label: string; color: string }> = {
  continue: { label: 'continue', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  redirect: { label: 'redirect', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  conclude: { label: 'conclude', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WorkflowToolbar({
  hasChain,
  isRunning,
  currentStep,
  onRun,
  onStop,
  chatOpen,
  onToggleChat,
  maestroEnabled,
  maestroStatus,
  maestroLastAction,
  maestroLastTargetAgent,
  onMaestroToggle,
  advisorVisible,
  advisorRunning,
  onAdvisorClick,
  plannerEnabled,
  plannerStatus,
  onPlannerToggle,
  lastMessage,
}: WorkflowToolbarProps) {
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const runCoaching = useCoachingStep('runWorkflow')

  // Focus input when it appears
  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  if (!hasChain) return null

  const handleRunClick = () => {
    if (lastMessage) {
      // Re-run with last message
      onRun(lastMessage)
    } else {
      // Show inline input
      setShowInput(true)
    }
  }

  const handleInputSubmit = () => {
    const msg = inputValue.trim()
    if (!msg) return
    onRun(msg)
    setInputValue('')
    setShowInput(false)
  }

  const isThinking = maestroEnabled && maestroStatus === 'thinking'
  const hasDecision = maestroEnabled && maestroStatus === 'decided' && maestroLastAction
  const actionStyle = maestroLastAction ? ACTION_STYLES[maestroLastAction] : null

  return (
    <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-border bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">

      {/* ── Run / Stop ── */}
      {isRunning ? (
        <Button
          size="sm"
          variant="destructive"
          className="h-7 gap-1.5 rounded-lg px-2.5 text-xs"
          onClick={onStop}
          aria-label="Stop workflow"
        >
          <Square className="h-3 w-3 fill-current" aria-hidden />
          Stop
        </Button>
      ) : showInput ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => { e.preventDefault(); handleInputSubmit() }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={() => { if (!inputValue.trim()) setShowInput(false) }}
            placeholder="Task for this workflow..."
            className="h-7 w-44 rounded-lg border bg-background px-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowInput(false); setInputValue('') } }}
          />
          <Button
            type="submit"
            size="sm"
            className="h-7 w-7 rounded-lg bg-green-600 p-0 hover:bg-green-700"
            disabled={!inputValue.trim()}
            aria-label="Run workflow"
          >
            <Send className="h-3 w-3" aria-hidden />
          </Button>
        </form>
      ) : (
        <CoachingTooltip
          visible={runCoaching.visible}
          onDismiss={runCoaching.dismiss}
          message="Your workflow is ready. Hit Run to execute."
          side="bottom"
        >
          <Button
            size="sm"
            className="h-7 gap-1.5 rounded-lg bg-green-600 px-2.5 text-xs text-white hover:bg-green-700"
            onClick={() => { runCoaching.dismiss(); handleRunClick() }}
            aria-label="Run workflow"
          >
            <Play className="h-3 w-3 fill-current" aria-hidden />
            Run
          </Button>
        </CoachingTooltip>
      )}

      {/* ── Step Indicator ── */}
      {isRunning && (
        <>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />
            {currentStep ? (
              <>
                <span>{currentStep.index}/{currentStep.total}</span>
                <span className="max-w-[100px] truncate font-medium text-foreground">
                  {currentStep.agentName}
                </span>
              </>
            ) : (
              <span>Running...</span>
            )}
          </div>
        </>
      )}

      <Separator orientation="vertical" className="h-5" />

      {/* ── Maestro Badge ── */}
      <button
        type="button"
        onClick={onMaestroToggle}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors',
          maestroEnabled
            ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25'
            : 'text-muted-foreground hover:bg-muted',
        )}
        title={maestroEnabled ? 'Maestro ON — click to toggle' : 'Maestro OFF — click to enable'}
      >
        {isThinking ? (
          <Loader2 className="h-3 w-3 animate-spin text-purple-400" aria-hidden />
        ) : (
          <Bot className={cn(
            'h-3 w-3',
            maestroEnabled ? 'text-purple-400' : 'text-muted-foreground',
          )} aria-hidden />
        )}
        <span className="hidden sm:inline">
          {isThinking ? 'Evaluating' : 'Maestro'}
        </span>
        {maestroEnabled && (
          <span className={cn(
            'h-1.5 w-1.5 rounded-full',
            isThinking ? 'animate-pulse bg-purple-400' : 'bg-green-400',
          )} />
        )}
        {/* Inline decision */}
        {hasDecision && actionStyle && (
          <>
            <span className={cn(
              'rounded border px-1 py-0 text-[9px] font-semibold',
              actionStyle.color,
            )}>
              {actionStyle.label}
            </span>
            {maestroLastTargetAgent && (
              <>
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50" aria-hidden />
                <span className="max-w-[70px] truncate text-[10px] text-foreground/70">
                  {maestroLastTargetAgent}
                </span>
              </>
            )}
          </>
        )}
      </button>

      {/* ── Planner Badge ── */}
      <button
        type="button"
        onClick={onPlannerToggle}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors',
          plannerEnabled
            ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25'
            : 'text-muted-foreground hover:bg-muted',
        )}
        title={plannerEnabled ? 'Planner ON — analyzes workflow before execution' : 'Planner OFF — click to enable'}
      >
        {plannerStatus === 'planning' ? (
          <Loader2 className="h-3 w-3 animate-spin text-cyan-400" aria-hidden />
        ) : (
          <ClipboardList className={cn(
            'h-3 w-3',
            plannerEnabled ? 'text-cyan-400' : 'text-muted-foreground',
          )} aria-hidden />
        )}
        <span className="hidden sm:inline">
          {plannerStatus === 'planning' ? 'Planning' : 'Planner'}
        </span>
        {plannerEnabled && (
          <span className={cn(
            'h-1.5 w-1.5 rounded-full',
            plannerStatus === 'planning' ? 'animate-pulse bg-cyan-400' : 'bg-green-400',
          )} />
        )}
      </button>

      {/* ── Advisor Button ── */}
      {advisorVisible && (
        <button
          type="button"
          onClick={onAdvisorClick}
          disabled={advisorRunning}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors',
            advisorRunning
              ? 'bg-amber-500/15 text-amber-400'
              : 'text-muted-foreground hover:bg-muted hover:text-amber-400',
          )}
          title={advisorRunning ? 'Analyzing...' : 'Analyze with Advisor'}
        >
          {advisorRunning ? (
            <Loader2 className="h-3 w-3 animate-spin text-amber-400" aria-hidden />
          ) : (
            <Lightbulb className="h-3 w-3" aria-hidden />
          )}
          <span className="hidden sm:inline">Advisor</span>
        </button>
      )}

      <Separator orientation="vertical" className="h-5" />

      {/* ── Chat Toggle ── */}
      <Button
        size="sm"
        variant="ghost"
        className={cn(
          'h-7 w-7 rounded-lg p-0',
          chatOpen && 'bg-primary/10 text-primary',
        )}
        onClick={onToggleChat}
        aria-label={chatOpen ? 'Close workflow chat' : 'Open workflow chat'}
        title="Workflow Chat"
      >
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  )
}
