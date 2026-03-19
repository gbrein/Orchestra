'use client'

import { useState, useEffect } from 'react'
import {
  Bot,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  MessageSquare,
  Calendar,
  Hash,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { ModelSelector } from './model-selector'
import { AgentSkillsTab } from './agent-skills-tab'
import {
  type Agent,
  type AgentPurpose,
  type ModelTier,
  recommendModel,
  TERMS,
} from '@orchestra/shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentDrawerProps {
  readonly agent: Agent | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSave: (updates: Partial<Agent>) => void
  readonly onOpenMarketplace?: () => void
}

type SafetyLevel = 'cautious' | 'balanced' | 'autonomous'

interface ConversationRow {
  readonly id: string
  readonly startedAt: string
  readonly messageCount: number
  readonly status: 'active' | 'ended'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const CAPABILITY_OPTIONS: readonly { key: string; label: string }[] = [
  { key: 'read_files', label: 'Read files' },
  { key: 'write_files', label: 'Write files' },
  { key: 'run_commands', label: 'Run commands' },
  { key: 'browse_web', label: 'Browse web' },
]

const STATUS_LABEL: Record<Agent['status'], string> = {
  idle: 'Idle',
  running: 'Running',
  waiting_approval: 'Waiting',
  error: 'Error',
}

const STATUS_VARIANT: Record<Agent['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  idle: 'secondary',
  running: 'default',
  waiting_approval: 'outline',
  error: 'destructive',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSafetyLevel(allowedTools: readonly string[]): SafetyLevel {
  const tools = [...allowedTools]
  if (tools.length === 0) return 'cautious'
  if (tools.includes('*')) return 'autonomous'
  return 'balanced'
}

function getToolsForSafetyLevel(level: SafetyLevel, current: readonly string[]): readonly string[] {
  if (level === 'cautious') return []
  if (level === 'autonomous') return ['*']
  // balanced — keep non-wildcard tools but strip wildcard
  return current.filter((t) => t !== '*')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Settings Tab
function SettingsTab({
  agent,
  onSave,
}: {
  readonly agent: Agent
  readonly onSave: (updates: Partial<Agent>) => void
}) {
  const [name, setName] = useState(agent.name)
  const [description, setDescription] = useState(agent.description ?? '')
  const [persona, setPersona] = useState(agent.persona)
  const [purpose, setPurpose] = useState<AgentPurpose>(agent.purpose ?? 'general')
  const [model, setModel] = useState<ModelTier | null>(agent.model)

  const recommendation = recommendModel(purpose)
  const effectiveRecommended = recommendation.tier

  const isDirty =
    name !== agent.name ||
    description !== (agent.description ?? '') ||
    persona !== agent.persona ||
    purpose !== (agent.purpose ?? 'general') ||
    model !== agent.model

  function handleSave() {
    onSave({ name, description: description || undefined, persona, purpose, model })
  }

  return (
    <div className="flex flex-col gap-5 py-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Assistant name"
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
          placeholder="What does this assistant do?"
          className="resize-none"
          rows={2}
          maxLength={300}
        />
      </div>

      {/* Personality / Persona */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {TERMS.persona.en}
        </label>
        <Textarea
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="You are a helpful assistant that..."
          className="resize-none"
          rows={5}
          maxLength={2000}
        />
        <p className="text-[11px] text-muted-foreground">
          This becomes the system prompt guiding how the assistant behaves.
        </p>
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

      {/* Model selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Model
        </label>
        <ModelSelector
          value={model}
          recommended={effectiveRecommended}
          reason={recommendation.reason}
          onChange={(tier) => setModel(tier)}
        />
      </div>

      {/* Save button */}
      {isDirty && (
        <Button onClick={handleSave} size="sm" className="self-end">
          Save changes
        </Button>
      )}
    </div>
  )
}

// Skills Tab — delegates to AgentSkillsTab component
function SkillsTab({
  agentId,
  onOpenMarketplace,
}: {
  readonly agentId: string
  readonly onOpenMarketplace: () => void
}) {
  const [skills, setSkills] = useState<
    Array<{
      skillId: string
      skillName: string
      skillCategory?: string
      priority: number
      enabled: boolean
    }>
  >([])

  function handleToggle(skillId: string, enabled: boolean) {
    setSkills((prev) =>
      prev.map((s) => (s.skillId === skillId ? { ...s, enabled } : s)),
    )
  }

  function handleRemove(skillId: string) {
    setSkills((prev) => prev.filter((s) => s.skillId !== skillId))
  }

  function handleReorder(
    reordered: ReadonlyArray<{ skillId: string; priority: number }>,
  ) {
    setSkills((prev) =>
      reordered.map(({ skillId, priority }) => {
        const existing = prev.find((s) => s.skillId === skillId)
        return existing ? { ...existing, priority } : { skillId, skillName: skillId, priority, enabled: true }
      }),
    )
  }

  return (
    <AgentSkillsTab
      agentId={agentId}
      skills={skills}
      onToggle={handleToggle}
      onRemove={handleRemove}
      onReorder={handleReorder}
      onOpenMarketplace={onOpenMarketplace}
    />
  )
}

// Safety Tab
function SafetyTab({
  agent,
  onSave,
}: {
  readonly agent: Agent
  readonly onSave: (updates: Partial<Agent>) => void
}) {
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>(
    getSafetyLevel(agent.allowedTools),
  )
  const [scope, setScope] = useState<string[]>([...agent.scope])
  const [newScopePath, setNewScopePath] = useState('')
  const [capabilities, setCapabilities] = useState<Set<string>>(
    new Set<string>(agent.allowedTools as string[]),
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [rawPolicy, setRawPolicy] = useState(
    JSON.stringify({ allowedTools: agent.allowedTools, scope: agent.scope }, null, 2),
  )
  const [rawError, setRawError] = useState<string | null>(null)

  const isDirty = true // simplified — always allow save

  const SAFETY_OPTIONS: readonly { value: SafetyLevel; label: string; description: string }[] = [
    {
      value: 'cautious',
      label: 'Cautious',
      description: 'Requires approval for all actions',
    },
    {
      value: 'balanced',
      label: 'Balanced',
      description: 'Requires approval for destructive commands only',
    },
    {
      value: 'autonomous',
      label: 'Autonomous',
      description: 'Runs without approval prompts',
    },
  ]

  function addScopePath() {
    const trimmed = newScopePath.trim()
    if (!trimmed || scope.includes(trimmed)) return
    setScope((prev) => [...prev, trimmed])
    setNewScopePath('')
  }

  function removeScopePath(path: string) {
    setScope((prev) => prev.filter((p) => p !== path))
  }

  function toggleCapability(key: string) {
    setCapabilities((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleRawChange(value: string) {
    setRawPolicy(value)
    try {
      JSON.parse(value)
      setRawError(null)
    } catch {
      setRawError('Invalid JSON')
    }
  }

  function handleSave() {
    const tools = getToolsForSafetyLevel(safetyLevel, Array.from(capabilities))
    onSave({ allowedTools: tools, scope })
  }

  return (
    <div className="flex flex-col gap-5 py-4">
      {/* Safety level */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Safety Level
        </label>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Safety level">
          {SAFETY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={safetyLevel === opt.value}
              onClick={() => setSafetyLevel(opt.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
                safetyLevel === opt.value ? 'border-primary bg-primary/5' : 'border-border bg-card',
              )}
            >
              <div
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  safetyLevel === opt.value ? 'border-primary' : 'border-muted-foreground/50',
                )}
              >
                {safetyLevel === opt.value && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Access / Scope */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {TERMS.scope.en} Paths
        </label>
        {scope.length > 0 && (
          <div className="flex flex-col gap-1">
            {scope.map((path) => (
              <div
                key={path}
                className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5"
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{path}</span>
                <button
                  type="button"
                  onClick={() => removeScopePath(path)}
                  aria-label={`Remove ${path}`}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={newScopePath}
            onChange={(e) => setNewScopePath(e.target.value)}
            placeholder="/path/to/directory"
            className="font-mono text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addScopePath()
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addScopePath}
            aria-label="Add path"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Capabilities */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {TERMS.allowedTools.en}
        </label>
        <div className="flex flex-col gap-2">
          {CAPABILITY_OPTIONS.map((cap) => {
            const checked = capabilities.has(cap.key)
            return (
              <label
                key={cap.key}
                className="flex cursor-pointer items-center gap-2.5"
              >
                <div
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleCapability(cap.key)}
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    checked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/50 bg-background',
                  )}
                >
                  {checked && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-sm">{cap.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {showAdvanced ? 'Hide advanced' : 'Show advanced'}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Raw Policy JSON
          </label>
          <Textarea
            value={rawPolicy}
            onChange={(e) => handleRawChange(e.target.value)}
            className="resize-none font-mono text-xs"
            rows={8}
            spellCheck={false}
          />
          {rawError && (
            <p className="text-xs text-destructive">{rawError}</p>
          )}
        </div>
      )}

      <Button onClick={handleSave} size="sm" className="self-end">
        Save changes
      </Button>
    </div>
  )
}

// Conversations Tab
function ConversationsTab({ agentId }: { readonly agentId: string }) {
  // In a real app this would be fetched from the server
  const conversations: ConversationRow[] = []

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">No conversations yet</p>
          <p className="text-xs text-muted-foreground">
            Start chatting to see your history here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 py-4" role="list" aria-label="Past conversations">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          role="listitem"
          className="flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-muted/50 cursor-pointer transition-colors"
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Session {conv.id.slice(0, 8)}</p>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(conv.startedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {conv.messageCount} messages
              </span>
            </div>
          </div>
          <Badge
            variant={conv.status === 'active' ? 'default' : 'secondary'}
            className="text-[10px]"
          >
            {conv.status}
          </Badge>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AgentDrawer({ agent, open, onOpenChange, onSave, onOpenMarketplace }: AgentDrawerProps) {
  const [activeTab, setActiveTab] = useState('settings')

  // Reset to settings tab when a new agent is selected
  useEffect(() => {
    if (agent) setActiveTab('settings')
  }, [agent?.id])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[420px] flex-col gap-0 p-0 sm:w-[540px]"
      >
        {agent === null ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No assistant selected</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="flex-row items-center gap-3 border-b px-6 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {agent.avatar ? (
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <Bot className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-base leading-tight">
                  {agent.name}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Configure {agent.name}
                </SheetDescription>
                <div className="mt-1">
                  <Badge variant={STATUS_VARIANT[agent.status]} className="text-[10px]">
                    {STATUS_LABEL[agent.status]}
                  </Badge>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="mx-4 mt-3 w-auto justify-start rounded-none border-b bg-transparent p-0">
                {(['settings', 'skills', 'safety', 'conversations'] as const).map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className={cn(
                      'rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium capitalize',
                      'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                    )}
                  >
                    {tab === 'conversations' ? 'Convos' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                <TabsContent value="settings" className="mt-0">
                  <SettingsTab agent={agent} onSave={onSave} />
                </TabsContent>

                <TabsContent value="skills" className="mt-0">
                  <SkillsTab
                    agentId={agent.id}
                    onOpenMarketplace={onOpenMarketplace ?? (() => undefined)}
                  />
                </TabsContent>

                <TabsContent value="safety" className="mt-0">
                  <SafetyTab agent={agent} onSave={onSave} />
                </TabsContent>

                <TabsContent value="conversations" className="mt-0">
                  <ConversationsTab agentId={agent.id} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
