'use client'

import { useState } from 'react'
import { Bot, ArrowRight, ArrowLeft, Check, ChevronDown, Plus, Trash2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { ModelSelector } from './model-selector'
import {
  type CreateAgentInput,
  type AgentPurpose,
  type ModelTier,
  recommendModel,
  TERMS,
  MODEL_TIERS,
} from '@orchestra/shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentCreateDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onCreate: (agent: CreateAgentInput) => void
}

type SimpleStep = 'describe' | 'preview' | 'confirm'

interface GeneratedPreview {
  readonly name: string
  readonly description: string
  readonly persona: string
  readonly purpose: AgentPurpose
  readonly model: ModelTier
  readonly scope: string[]
  readonly allowedTools: string[]
}

const PURPOSE_OPTIONS: readonly { value: AgentPurpose; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'writing', label: 'Writing' },
  { value: 'coding', label: 'Coding' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'chat', label: 'Chat' },
  { value: 'review', label: 'Review' },
  { value: 'research', label: 'Research' },
  { value: 'creative', label: 'Creative' },
  { value: 'data', label: 'Data' },
]

// ---------------------------------------------------------------------------
// Mock "AI" generation — splits a free-text description into structured fields
// ---------------------------------------------------------------------------

function mockGenerateFromDescription(description: string): GeneratedPreview {
  const lower = description.toLowerCase()

  let purpose: AgentPurpose = 'general'
  if (lower.includes('code') || lower.includes('debug') || lower.includes('program')) {
    purpose = 'coding'
  } else if (lower.includes('write') || lower.includes('draft') || lower.includes('edit')) {
    purpose = 'writing'
  } else if (lower.includes('analyz') || lower.includes('analys') || lower.includes('insight')) {
    purpose = 'analysis'
  } else if (lower.includes('research') || lower.includes('find information')) {
    purpose = 'research'
  } else if (lower.includes('review')) {
    purpose = 'review'
  } else if (lower.includes('creat') || lower.includes('story') || lower.includes('poem')) {
    purpose = 'creative'
  } else if (lower.includes('data') || lower.includes('csv') || lower.includes('chart')) {
    purpose = 'data'
  } else if (lower.includes('chat') || lower.includes('talk') || lower.includes('conversation')) {
    purpose = 'chat'
  }

  const recommendation = recommendModel(purpose)

  // Build a plausible name from the first meaningful words
  const words = description.trim().split(/\s+/).slice(0, 4)
  const rawName = words.join(' ')
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1) + ' Assistant'

  const persona = `You are a helpful assistant focused on ${purpose} tasks. ${description.trim()}`

  return {
    name,
    description: description.trim(),
    persona,
    purpose,
    model: recommendation.tier,
    scope: [],
    allowedTools: [],
  }
}

// ---------------------------------------------------------------------------
// Simple Mode
// ---------------------------------------------------------------------------

function SimpleMode({
  onClose,
  onCreate,
  onAdvanced,
}: {
  readonly onClose: () => void
  readonly onCreate: (input: CreateAgentInput) => void
  readonly onAdvanced: () => void
}) {
  const [step, setStep] = useState<SimpleStep>('describe')
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState<GeneratedPreview | null>(null)
  const [loading, setLoading] = useState(false)

  function handleGenerate() {
    if (!description.trim()) return
    setLoading(true)
    // Simulate async generation
    setTimeout(() => {
      setPreview(mockGenerateFromDescription(description))
      setLoading(false)
      setStep('preview')
    }, 800)
  }

  function handleConfirm() {
    if (!preview) return
    onCreate({
      name: preview.name,
      persona: preview.persona,
      description: preview.description,
      purpose: preview.purpose,
      model: preview.model,
      scope: preview.scope,
      allowedTools: preview.allowedTools,
    })
    onClose()
  }

  const recommendation = preview ? recommendModel(preview.purpose) : null

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          {step === 'describe' && 'Create an Assistant'}
          {step === 'preview' && 'Preview'}
          {step === 'confirm' && 'Confirm'}
        </DialogTitle>
        <DialogDescription>
          {step === 'describe' && 'Describe what you want this assistant to do in plain language.'}
          {step === 'preview' && 'Review the generated configuration before creating.'}
          {step === 'confirm' && 'Your assistant is ready to create.'}
        </DialogDescription>
      </DialogHeader>

      {/* Step indicator */}
      <div className="flex items-center gap-2 py-1" aria-label="Step progress">
        {(['describe', 'preview', 'confirm'] as SimpleStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : ['describe', 'preview', 'confirm'].indexOf(step) > i
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {['describe', 'preview', 'confirm'].indexOf(step) > i ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step: Describe */}
      {step === 'describe' && (
        <div className="flex flex-col gap-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="E.g. I want an assistant that reviews my code and suggests improvements, focuses on TypeScript, and explains every change it makes."
            className="min-h-[140px] resize-none text-sm"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Be as descriptive as you like — tone, focus area, things to avoid.
          </p>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && preview && recommendation && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
            <PreviewRow label="Name" value={preview.name} />
            <PreviewRow label="Purpose" value={preview.purpose} />
            <PreviewRow label={TERMS.persona.en} value={preview.persona} multiline />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Recommended Model
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
              <span className="text-sm font-medium">{MODEL_TIERS[preview.model].label}</span>
              <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                ~${MODEL_TIERS[preview.model].estimatedCostPerMessage.toFixed(3)}/msg
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{recommendation.reason}</p>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && preview && (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <p>
            <span className="font-medium">{preview.name}</span> will be created with purpose{' '}
            <span className="font-medium">{preview.purpose}</span> using the{' '}
            <span className="font-medium">{MODEL_TIERS[preview.model].label}</span> model.
          </p>
          <p className="text-muted-foreground">
            You can adjust all settings after creation from the assistant drawer.
          </p>
        </div>
      )}

      <DialogFooter className="flex items-center justify-between sm:justify-between">
        <button
          type="button"
          onClick={onAdvanced}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          I prefer to configure manually
        </button>

        <div className="flex items-center gap-2">
          {step !== 'describe' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(step === 'confirm' ? 'preview' : 'describe')}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back
            </Button>
          )}

          {step === 'describe' && (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!description.trim() || loading}
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
              )}
              {loading ? 'Generating...' : 'Continue'}
            </Button>
          )}

          {step === 'preview' && (
            <Button size="sm" onClick={() => setStep('confirm')}>
              <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
              Looks good
            </Button>
          )}

          {step === 'confirm' && (
            <Button size="sm" onClick={handleConfirm}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Create Assistant
            </Button>
          )}
        </div>
      </DialogFooter>
    </>
  )
}

function PreviewRow({
  label,
  value,
  multiline = false,
}: {
  readonly label: string
  readonly value: string
  readonly multiline?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-sm', multiline && 'whitespace-pre-wrap')}>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Advanced Mode
// ---------------------------------------------------------------------------

function AdvancedMode({
  onClose,
  onCreate,
  onSimple,
}: {
  readonly onClose: () => void
  readonly onCreate: (input: CreateAgentInput) => void
  readonly onSimple: () => void
}) {
  const [name, setName] = useState('')
  const [persona, setPersona] = useState('')
  const [description, setDescription] = useState('')
  const [purpose, setPurpose] = useState<AgentPurpose>('general')
  const [model, setModel] = useState<ModelTier | null>(null)
  const [scopePaths, setScopePaths] = useState<string[]>([])
  const [newPath, setNewPath] = useState('')
  const [allowedTools, setAllowedTools] = useState<string[]>([])
  const [newTool, setNewTool] = useState('')

  const recommendation = recommendModel(purpose)

  function addPath() {
    const trimmed = newPath.trim()
    if (!trimmed || scopePaths.includes(trimmed)) return
    setScopePaths((prev) => [...prev, trimmed])
    setNewPath('')
  }

  function removePath(path: string) {
    setScopePaths((prev) => prev.filter((p) => p !== path))
  }

  function addTool() {
    const trimmed = newTool.trim()
    if (!trimmed || allowedTools.includes(trimmed)) return
    setAllowedTools((prev) => [...prev, trimmed])
    setNewTool('')
  }

  function removeTool(tool: string) {
    setAllowedTools((prev) => prev.filter((t) => t !== tool))
  }

  function handleCreate() {
    if (!name.trim() || !persona.trim()) return
    onCreate({
      name: name.trim(),
      persona: persona.trim(),
      description: description.trim() || undefined,
      purpose,
      model: model ?? recommendation.tier,
      scope: scopePaths,
      allowedTools,
    })
    onClose()
  }

  const canCreate = name.trim().length > 0 && persona.trim().length > 0

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          New Assistant — Advanced
        </DialogTitle>
        <DialogDescription>
          Configure every detail manually.
        </DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Name <span className="text-destructive">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Assistant"
            maxLength={80}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short summary of what this assistant does"
            className="resize-none"
            rows={2}
            maxLength={300}
          />
        </div>

        {/* Persona */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {TERMS.persona.en} <span className="text-destructive">*</span>
          </label>
          <Textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="You are a helpful assistant that..."
            className="resize-none"
            rows={4}
            maxLength={2000}
          />
        </div>

        {/* Purpose */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Purpose
          </label>
          <div className="relative">
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as AgentPurpose)}
              className={cn(
                'w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8',
                'text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              )}
            >
              {PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <Separator />

        {/* Model */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Model
          </label>
          <ModelSelector
            value={model}
            recommended={recommendation.tier}
            reason={recommendation.reason}
            onChange={(tier) => setModel(tier)}
          />
        </div>

        <Separator />

        {/* Scope paths */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {TERMS.scope.en} Paths
          </label>
          {scopePaths.map((path) => (
            <div
              key={path}
              className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{path}</span>
              <button
                type="button"
                onClick={() => removePath(path)}
                aria-label={`Remove ${path}`}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="/path/to/directory"
              className="font-mono text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addPath()
                }
              }}
            />
            <Button type="button" size="sm" variant="outline" onClick={addPath} aria-label="Add path">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Allowed tools */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {TERMS.allowedTools.en}
          </label>
          {allowedTools.map((tool) => (
            <div
              key={tool}
              className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{tool}</span>
              <button
                type="button"
                onClick={() => removeTool(tool)}
                aria-label={`Remove ${tool}`}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newTool}
              onChange={(e) => setNewTool(e.target.value)}
              placeholder="read_files, run_commands, ..."
              className="font-mono text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTool()
                }
              }}
            />
            <Button type="button" size="sm" variant="outline" onClick={addTool} aria-label="Add tool">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter className="flex items-center justify-between sm:justify-between">
        <button
          type="button"
          onClick={onSimple}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Use simple mode instead
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!canCreate}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Create Assistant
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main Dialog
// ---------------------------------------------------------------------------

export function AgentCreateDialog({ open, onOpenChange, onCreate }: AgentCreateDialogProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')

  function handleClose() {
    onOpenChange(false)
    // Reset to simple when closed
    setTimeout(() => setMode('simple'), 300)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-[540px]">
        {mode === 'simple' ? (
          <SimpleMode
            onClose={handleClose}
            onCreate={onCreate}
            onAdvanced={() => setMode('advanced')}
          />
        ) : (
          <AdvancedMode
            onClose={handleClose}
            onCreate={onCreate}
            onSimple={() => setMode('simple')}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
