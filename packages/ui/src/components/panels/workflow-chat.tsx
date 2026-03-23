'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  GitBranch,
  Download,
  Lightbulb,
  Loader2,
  Play,
  Save,
  Send,
  Square,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ModeToggle } from '@/components/panels/mode-toggle'
import { ToolCard, type ToolCardData } from '@/components/shared/tool-card'
import { FolderPicker } from '@/components/shared/folder-picker'
import { AdvisorCard, type AdvisorResultData } from '@/components/panels/advisor-card'
import type { AgentMode, TokenUsage } from '@orchestra/shared'
import type { ChainStep } from '@/lib/chain-utils'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowLogEntry {
  readonly id: string
  readonly type:
    | 'user'
    | 'step_start'
    | 'step_text'
    | 'step_tool_use'
    | 'step_tool_result'
    | 'step_complete'
    | 'chain_complete'
    | 'error'
    | 'system'
    | 'maestro_thinking'
    | 'maestro_decision'
    | 'maestro_redirect_request'
    | 'maestro_redirect_approved'
    | 'maestro_redirect_declined'
    | 'advisor_analyzing'
    | 'advisor_result'
  readonly content: string
  readonly agentName?: string
  readonly stepIndex?: number
  readonly timestamp: Date
  readonly partial?: boolean
  readonly completed?: boolean
  readonly toolUse?: ToolCardData
  readonly cwd?: string
  readonly usage?: TokenUsage
  readonly maestroAction?: 'continue' | 'redirect' | 'conclude'
  readonly requestId?: string
  readonly advisorResult?: AdvisorResultData
}

export interface WorkflowChatProps {
  readonly steps: readonly ChainStep[]
  readonly isRunning: boolean
  readonly log: readonly WorkflowLogEntry[]
  readonly mode: AgentMode
  readonly hasWorkspace: boolean
  readonly maestroEnabled: boolean
  readonly workingDirectory?: string | null
  readonly onWorkingDirectoryChange?: (dir: string | null) => void
  readonly onSendMessage: (message: string) => void
  readonly onRun: (message: string) => void
  readonly onStop: () => void
  readonly onModeChange: (mode: AgentMode) => void
  readonly onClearLog: () => void
  readonly onStepClick?: (stepIndex: number) => void
  readonly onMaestroToggle: (enabled: boolean) => void
  readonly onMaestroRedirectRespond?: (requestId: string, approved: boolean) => void
  readonly hasCompletedRun: boolean
  readonly advisorRunning: boolean
  readonly advisorModel: string
  readonly onAdvisorRequest: (model: string) => void
  readonly onAdvisorModelChange: (model: string) => void
  readonly onApplySkill: (agentId: string, skillName: string) => Promise<void>
  readonly onUpdatePersona: (agentId: string, newPersona: string) => Promise<void>
  readonly onSaveOutput?: (content: string) => void
}

// ─── Log entry component ────────────────────────────────────────────────────

function LogEntry({
  entry,
  onStepClick,
  onMaestroRedirectRespond,
  onApplySkill,
  onUpdatePersona,
  onSaveOutput,
}: {
  readonly entry: WorkflowLogEntry
  readonly onStepClick?: (stepIndex: number) => void
  readonly onMaestroRedirectRespond?: (requestId: string, approved: boolean) => void
  readonly onApplySkill?: (agentId: string, skillName: string) => Promise<void>
  readonly onUpdatePersona?: (agentId: string, newPersona: string) => Promise<void>
  readonly onSaveOutput?: (content: string) => void
}) {
  if (entry.type === 'user') {
    return (
      <div className="flex justify-end" role="listitem">
        <div className="max-w-[80%] rounded-lg rounded-br-sm bg-muted px-3 py-2 text-sm">
          <p className="whitespace-pre-wrap break-words">{entry.content}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    )
  }

  if (entry.type === 'step_start') {
    return (
      <div role="listitem">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {entry.completed ? (
            <CheckCircle2 className="h-3 w-3 text-green-500" aria-hidden />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />
          )}
          <span>
            Step {(entry.stepIndex ?? 0) + 1}: {entry.completed ? '' : 'Running '}
            <span className="font-medium text-foreground">{entry.agentName}</span>
          </span>
        </div>
        {entry.cwd && (
          <div className="ml-5 mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <FolderOpen className="h-2.5 w-2.5" aria-hidden />
            <span className="font-mono">{entry.cwd}</span>
          </div>
        )}
      </div>
    )
  }

  if (entry.type === 'step_text') {
    return (
      <div className="ml-5" role="listitem">
        <div className="whitespace-pre-wrap break-words rounded bg-card border border-border px-2.5 py-1.5 text-xs text-foreground">
          {entry.content}
          {entry.partial && (
            <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-primary" aria-label="Streaming" />
          )}
        </div>
      </div>
    )
  }

  if (entry.type === 'step_tool_use') {
    return (
      <div className="ml-5" role="listitem">
        {entry.toolUse && <ToolCard tool={entry.toolUse} />}
      </div>
    )
  }

  // step_tool_result is handled by updating the tool_use entry, not rendered separately

  if (entry.type === 'step_complete') {
    const clickable = onStepClick && entry.stepIndex !== undefined
    return (
      <div
        className={cn('flex items-start gap-2', clickable && 'cursor-pointer rounded-md px-1 -mx-1 hover:bg-muted/50 transition-colors')}
        role="listitem"
        onClick={clickable ? () => onStepClick(entry.stepIndex!) : undefined}
        title={clickable ? 'Click to view full agent conversation' : undefined}
      >
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium">
              {entry.agentName} completed
            </p>
            {entry.usage && (
              <span className="text-[10px] text-muted-foreground">
                {entry.usage.inputTokens + entry.usage.outputTokens} tokens
                {entry.usage.estimatedCostUsd !== undefined && (
                  <> &middot; ${entry.usage.estimatedCostUsd.toFixed(4)}</>
                )}
              </span>
            )}
          </div>
          {entry.content && (
            <p className="mt-0.5 whitespace-pre-wrap break-words rounded bg-card border border-border px-2 py-1.5 text-xs text-muted-foreground">
              {entry.content.length > 500 ? entry.content.slice(0, 500) + '\u2026' : entry.content}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (entry.type === 'chain_complete') {
    return (
      <div className="rounded-md bg-green-500/10 px-3 py-2" role="listitem">
        <div className="flex items-center gap-2 text-xs text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="font-medium">Workflow completed</span>
          {entry.usage && (
            <span className="text-green-400/70">
              &middot; {(entry.usage.inputTokens + entry.usage.outputTokens).toLocaleString()} tokens
              {entry.usage.estimatedCostUsd !== undefined && entry.usage.estimatedCostUsd > 0 && (
                <> &middot; ${entry.usage.estimatedCostUsd.toFixed(4)}</>
              )}
            </span>
          )}
          <div className="flex-1" />
          {onSaveOutput && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-[10px] text-green-400/70 hover:text-green-400"
              onClick={() => onSaveOutput(entry.content)}
              aria-label="Save workflow output to project folder"
              title="Save output to project folder"
            >
              <Download className="h-3 w-3" aria-hidden />
              Save
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (entry.type === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="listitem">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{entry.content}</span>
      </div>
    )
  }

  if (entry.type === 'maestro_thinking') {
    return (
      <div className="flex items-center gap-2 rounded-md bg-purple-500/10 px-3 py-2 text-xs text-purple-400" role="listitem">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        <span className="font-medium">Maestro evaluating...</span>
      </div>
    )
  }

  if (entry.type === 'maestro_decision') {
    const actionIcon = entry.maestroAction === 'conclude'
      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" aria-hidden />
      : entry.maestroAction === 'redirect'
        ? <AlertCircle className="h-3.5 w-3.5 text-amber-400" aria-hidden />
        : <Bot className="h-3.5 w-3.5 text-purple-400" aria-hidden />

    return (
      <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-3 py-2" role="listitem">
        <div className="flex items-center gap-2 text-xs font-medium text-purple-400">
          {actionIcon}
          <span>Maestro</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-500/30 text-purple-400">
            {entry.maestroAction}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{entry.content}</p>
      </div>
    )
  }

  if (entry.type === 'maestro_redirect_request') {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5" role="listitem">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          <span>Maestro suggests redirect</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{entry.content}</p>
        {entry.requestId && onMaestroRedirectRespond && (
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-3 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
              onClick={() => onMaestroRedirectRespond(entry.requestId!, true)}
            >
              Approve Redirect
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs text-muted-foreground"
              onClick={() => onMaestroRedirectRespond(entry.requestId!, false)}
            >
              Continue Forward
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (entry.type === 'maestro_redirect_approved') {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-400" role="listitem">
        <Check className="h-3 w-3" aria-hidden />
        <span>Redirect approved — re-running {entry.agentName}</span>
      </div>
    )
  }

  if (entry.type === 'maestro_redirect_declined') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground" role="listitem">
        <span>Redirect declined — continuing forward</span>
      </div>
    )
  }

  if (entry.type === 'advisor_analyzing') {
    return (
      <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-400" role="listitem">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        <span className="font-medium">Advisor analyzing workflow...</span>
      </div>
    )
  }

  if (entry.type === 'advisor_result' && entry.advisorResult) {
    return (
      <AdvisorCard
        result={entry.advisorResult}
        onApplySkill={onApplySkill ?? (async () => {})}
        onUpdatePersona={onUpdatePersona ?? (async () => {})}
      />
    )
  }

  // system
  return (
    <div className="text-center text-[10px] text-muted-foreground" role="listitem">
      {entry.content}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WorkflowChat({
  steps,
  isRunning,
  log,
  mode,
  workingDirectory,
  onWorkingDirectoryChange,
  onSendMessage,
  onRun,
  onStop,
  onModeChange,
  onClearLog,
  onStepClick,
  hasWorkspace,
  maestroEnabled,
  onMaestroToggle,
  onMaestroRedirectRespond,
  hasCompletedRun,
  advisorRunning,
  advisorModel,
  onAdvisorRequest,
  onAdvisorModelChange,
  onApplySkill,
  onUpdatePersona,
  onSaveOutput,
}: WorkflowChatProps) {
  const [value, setValue] = useState('')
  const [dirExpanded, setDirExpanded] = useState(false)
  const [dirInput, setDirInput] = useState(workingDirectory ?? '')
  const [dirSaving, setDirSaving] = useState(false)
  const [dirSaved, setDirSaved] = useState(false)
  const [folderPickerOpen, setFolderPickerOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Sync dirInput when workingDirectory prop changes
  useEffect(() => {
    setDirInput(workingDirectory ?? '')
  }, [workingDirectory])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  const canSend = value.trim().length > 0

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed) return

    if (isRunning) {
      onSendMessage(trimmed)
    } else {
      onRun(trimmed)
    }
    setValue('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border px-4 py-3">
        {/* Title + status */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-500">
            <GitBranch className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Execution Log</p>
            <span className="text-[10px] text-muted-foreground">
              {steps.length} steps {isRunning ? '— running' : ''}
            </span>
          </div>
          <ModeToggle mode={mode} onChange={onModeChange} disabled={isRunning} />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={onClearLog}
            aria-label="Clear log"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
          </Button>
        </div>

        {/* Chain steps overview */}
        {steps.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {steps.map((step, i) => (
              <div key={step.nodeId} className="flex items-center gap-1">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                  {step.agentName}
                </span>
                {i < steps.length - 1 && (
                  <span className="text-[10px] text-muted-foreground">&rarr;</span>
                )}
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Log */}
      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        role="list"
        aria-label="Workflow log"
        aria-live="polite"
      >
        {log.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <GitBranch className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-sm font-medium">Run your workflow</p>
            <p className="text-xs text-muted-foreground">
              Send a message below to start the chain. Each agent will process in order.
            </p>
          </div>
        ) : (
          <>
            {log.map((entry) => (
              <LogEntry key={entry.id} entry={entry} onStepClick={onStepClick} onMaestroRedirectRespond={onMaestroRedirectRespond} onApplySkill={onApplySkill} onUpdatePersona={onUpdatePersona} onSaveOutput={onSaveOutput} />
            ))}
            <div ref={bottomRef} aria-hidden />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRunning
                ? 'Send additional instructions\u2026 (Ctrl+Enter)'
                : 'Describe what the workflow should do\u2026 (Ctrl+Enter to run)'
            }
            className="min-h-[60px] max-h-[160px] resize-none text-sm"
            rows={2}
            aria-label="Workflow message input"
          />
          <div className="flex shrink-0 flex-col gap-1.5">
            {isRunning ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 w-8 p-0"
                onClick={onStop}
                aria-label="Stop workflow"
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                onClick={handleSend}
                disabled={!canSend}
                aria-label={canSend ? 'Run workflow' : 'Type a message first'}
              >
                {canSend ? (
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
