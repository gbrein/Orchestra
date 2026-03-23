'use client'

import { useState, useCallback } from 'react'
import { Trash2, ArrowRight, Bot, X, Save } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type {
  GeneratedWorkflowWithLayout,
  GeneratedAgentWithPosition,
  GeneratedEdge,
  AgentPurpose,
  ModelTier,
} from '@orchestra/shared'

// ─── Props ──────────────────────────────────────────────────────────────────

export interface WorkflowReviewDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly workflow: GeneratedWorkflowWithLayout | null
  readonly onConfirm: (workflow: GeneratedWorkflowWithLayout) => void
  readonly onSaveAsTemplate?: (workflow: GeneratedWorkflowWithLayout) => void
}

// ─── Model options ──────────────────────────────────────────────────────────

const MODEL_OPTIONS: readonly { value: ModelTier; label: string }[] = [
  { value: 'opus', label: 'Opus (Deep)' },
  { value: 'sonnet', label: 'Sonnet (Balanced)' },
  { value: 'haiku', label: 'Haiku (Fast)' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function WorkflowReviewDialog({
  open,
  onOpenChange,
  workflow,
  onConfirm,
  onSaveAsTemplate,
}: WorkflowReviewDialogProps) {
  // Local mutable copy for editing
  const [editedAgents, setEditedAgents] = useState<GeneratedAgentWithPosition[]>([])
  const [editedEdges, setEditedEdges] = useState<GeneratedEdge[]>([])
  const [maestroEnabled, setMaestroEnabled] = useState(false)
  const [workflowName, setWorkflowName] = useState('')

  // Sync when workflow changes
  const [lastWorkflow, setLastWorkflow] = useState<GeneratedWorkflowWithLayout | null>(null)
  if (workflow && workflow !== lastWorkflow) {
    setLastWorkflow(workflow)
    setEditedAgents([...workflow.agents])
    setEditedEdges([...workflow.edges])
    setMaestroEnabled(workflow.maestroEnabled)
    setWorkflowName(workflow.name)
  }

  const updateAgent = useCallback((tempId: string, changes: Partial<GeneratedAgentWithPosition>) => {
    setEditedAgents((prev) =>
      prev.map((a) => (a.tempId === tempId ? { ...a, ...changes } : a)),
    )
  }, [])

  const removeAgent = useCallback((tempId: string) => {
    setEditedAgents((prev) => prev.filter((a) => a.tempId !== tempId))
    setEditedEdges((prev) => prev.filter((e) => e.from !== tempId && e.to !== tempId))
  }, [])

  const removeSkill = useCallback((tempId: string, skillId: string) => {
    setEditedAgents((prev) =>
      prev.map((a) =>
        a.tempId === tempId
          ? { ...a, suggestedSkills: a.suggestedSkills.filter((s) => s !== skillId) }
          : a,
      ),
    )
  }, [])

  const buildEditedWorkflow = useCallback((): GeneratedWorkflowWithLayout => ({
    name: workflowName,
    agents: editedAgents,
    edges: editedEdges,
    maestroEnabled,
  }), [workflowName, editedAgents, editedEdges, maestroEnabled])

  const handleConfirm = useCallback(() => {
    onConfirm(buildEditedWorkflow())
    onOpenChange(false)
  }, [onConfirm, buildEditedWorkflow, onOpenChange])

  const handleSave = useCallback(() => {
    onSaveAsTemplate?.(buildEditedWorkflow())
  }, [onSaveAsTemplate, buildEditedWorkflow])

  // Build agent name lookup for edge display
  const agentNameMap = new Map(editedAgents.map((a) => [a.tempId, a.name]))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" aria-hidden />
            Review Generated Workflow
          </DialogTitle>
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="mt-2 text-sm font-medium"
            aria-label="Workflow name"
          />
        </DialogHeader>

        {/* Agent Cards */}
        <div className="flex flex-col gap-4">
          {editedAgents.map((agent, idx) => (
            <div
              key={agent.tempId}
              className="rounded-lg border bg-card p-4"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  <Input
                    value={agent.name}
                    onChange={(e) => updateAgent(agent.tempId, { name: e.target.value })}
                    className="mb-1 h-8 text-sm font-semibold"
                    aria-label={`Agent ${idx + 1} name`}
                  />
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {agent.purpose}
                    </Badge>
                    <select
                      value={agent.model}
                      onChange={(e) => updateAgent(agent.tempId, { model: e.target.value as ModelTier })}
                      className="h-6 rounded border bg-background px-2 text-[10px]"
                      aria-label={`Agent ${idx + 1} model`}
                    >
                      {MODEL_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAgent(agent.tempId)}
                  aria-label={`Remove ${agent.name}`}
                  disabled={editedAgents.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>

              <Textarea
                value={agent.persona}
                onChange={(e) => updateAgent(agent.tempId, { persona: e.target.value })}
                className="mb-2 min-h-[60px] text-xs"
                aria-label={`Agent ${idx + 1} persona`}
              />

              {agent.suggestedSkills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {agent.suggestedSkills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="gap-1 text-[10px]">
                      {skill}
                      <button
                        onClick={() => removeSkill(agent.tempId, skill)}
                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                        aria-label={`Remove skill ${skill}`}
                      >
                        <X className="h-2.5 w-2.5" aria-hidden />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Edges */}
        {editedEdges.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Execution Flow</p>
              <div className="flex flex-wrap gap-2">
                {editedEdges.map((edge, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {agentNameMap.get(edge.from) ?? edge.from}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                    <Badge variant="outline" className="text-[10px]">
                      {agentNameMap.get(edge.to) ?? edge.to}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Maestro Toggle */}
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Maestro Orchestration</p>
            <p className="text-xs text-muted-foreground">
              AI coordinator evaluates each step and decides the next action
            </p>
          </div>
          <button
            role="switch"
            aria-checked={maestroEnabled}
            onClick={() => setMaestroEnabled((prev) => !prev)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              maestroEnabled ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                maestroEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {onSaveAsTemplate && (
            <Button variant="secondary" onClick={handleSave} className="gap-1">
              <Save className="h-3.5 w-3.5" aria-hidden />
              Save as Template
            </Button>
          )}
          <Button onClick={handleConfirm} disabled={editedAgents.length === 0}>
            Add to Canvas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
