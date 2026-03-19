'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  AlertTriangle,
  DollarSign,
  PlayCircle,
  GitBranch,
  Loader2,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { Node, Edge } from '@xyflow/react'
import type { AgentNodeData } from '@/lib/canvas-utils'
import { MODEL_TIERS } from '@orchestra/shared'
import type { ModelTier } from '@orchestra/shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainStep {
  readonly nodeId: string
  readonly agentName: string
  readonly model?: string
}

export interface ConditionalEdge {
  readonly edgeId: string
  readonly sourceId: string
  readonly targetId: string
  readonly condition: string
}

export interface ChainConfigProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly nodes: readonly Node[]
  readonly edges: readonly Edge[]
  readonly onExecute: (steps: readonly ChainStep[], conditionalEdges: readonly ConditionalEdge[]) => void
}

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string
  deps: string[]
}

function topoSort(graphNodes: GraphNode[]): string[] | null {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const n of graphNodes) {
    if (!inDegree.has(n.id)) inDegree.set(n.id, 0)
    if (!adj.has(n.id)) adj.set(n.id, [])
  }

  for (const n of graphNodes) {
    for (const dep of n.deps) {
      adj.set(dep, [...(adj.get(dep) ?? []), n.id])
      inDegree.set(n.id, (inDegree.get(n.id) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id)
  })

  const sorted: string[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)
    for (const neighbour of adj.get(node) ?? []) {
      const deg = (inDegree.get(neighbour) ?? 1) - 1
      inDegree.set(neighbour, deg)
      if (deg === 0) queue.push(neighbour)
    }
  }

  // Cycle detected if not all nodes were processed
  if (sorted.length !== graphNodes.length) return null
  return sorted
}

function hasCycle(nodes: readonly Node[], edges: readonly Edge[]): boolean {
  const agentIds = new Set(nodes.filter((n) => n.type === 'agent').map((n) => n.id))

  const graphNodes: GraphNode[] = Array.from(agentIds).map((id) => ({
    id,
    deps: edges
      .filter((e) => e.target === id && agentIds.has(e.source))
      .map((e) => e.source),
  }))

  return topoSort(graphNodes) === null
}

function buildChain(nodes: readonly Node[], edges: readonly Edge[]): ChainStep[] {
  const agentNodes = nodes.filter((n) => n.type === 'agent')
  const agentIds = new Set(agentNodes.map((n) => n.id))

  const graphNodes: GraphNode[] = agentNodes.map((n) => ({
    id: n.id,
    deps: edges
      .filter((e) => e.target === n.id && agentIds.has(e.source))
      .map((e) => e.source),
  }))

  const order = topoSort(graphNodes)
  if (!order) return agentNodes.map((n) => ({ nodeId: n.id, agentName: (n.data as AgentNodeData).name, model: (n.data as AgentNodeData).model }))

  return order.map((id) => {
    const node = agentNodes.find((n) => n.id === id)!
    const data = node.data as AgentNodeData
    return { nodeId: id, agentName: data.name, model: data.model }
  })
}

// ---------------------------------------------------------------------------
// Cost estimate
// ---------------------------------------------------------------------------

const COST_PER_MESSAGE: Record<ModelTier, number> = {
  opus: 0.08,
  sonnet: 0.02,
  haiku: 0.005,
}

function estimateCost(model: string | undefined): number {
  if (!model) return COST_PER_MESSAGE.sonnet
  return COST_PER_MESSAGE[model as ModelTier] ?? COST_PER_MESSAGE.sonnet
}

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------

interface StepCardProps {
  readonly step: ChainStep
  readonly index: number
  readonly total: number
}

function StepCard({ step, index, total }: StepCardProps) {
  const cost = estimateCost(step.model)
  const modelLabel = step.model
    ? (MODEL_TIERS[step.model as ModelTier]?.label ?? step.model)
    : 'Default'

  return (
    <div className="flex items-center gap-3">
      {/* Step number */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {index + 1}
      </div>

      {/* Card */}
      <div className="flex flex-1 items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{step.agentName}</p>
          <p className="text-[11px] text-muted-foreground">{modelLabel}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          ~${cost.toFixed(3)}
        </span>
      </div>

      {/* Arrow between steps */}
      {index < total - 1 && (
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ChainConfig({
  open,
  onOpenChange,
  nodes,
  edges,
  onExecute,
}: ChainConfigProps) {
  const [conditionalEdges, setConditionalEdges] = useState<ConditionalEdge[]>([])
  const [executing, setExecuting] = useState(false)

  const cycle = useMemo(() => hasCycle(nodes, edges), [nodes, edges])
  const chain = useMemo(() => buildChain(nodes, edges), [nodes, edges])

  // Build initial conditional edge state from flow edges when panel opens
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      const flowEdges = edges
        .filter((e) => {
          const srcType = nodes.find((n) => n.id === e.source)?.type
          const tgtType = nodes.find((n) => n.id === e.target)?.type
          return srcType === 'agent' && tgtType === 'agent'
        })
        .map((e) => ({
          edgeId: e.id,
          sourceId: e.source,
          targetId: e.target,
          condition: '',
        }))
      setConditionalEdges(flowEdges)
    }
  }

  function updateCondition(edgeId: string, condition: string) {
    setConditionalEdges((prev) =>
      prev.map((ce) => (ce.edgeId === edgeId ? { ...ce, condition } : ce)),
    )
  }

  function handleExecute() {
    setExecuting(true)
    // Simulate brief async handoff — real impl emits to server
    setTimeout(() => {
      onExecute(chain, conditionalEdges)
      setExecuting(false)
      onOpenChange(false)
    }, 400)
  }

  const totalCost = chain.reduce((sum, step) => sum + estimateCost(step.model), 0)

  const agentEdges = conditionalEdges.filter((ce) => {
    const srcName = chain.find((s) => s.nodeId === ce.sourceId)?.agentName ?? ce.sourceId
    return srcName !== undefined
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[420px] flex-col gap-0 p-0 sm:w-[500px]">
        <SheetHeader className="flex-row items-center gap-3 border-b px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitBranch className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base">Chain Configuration</SheetTitle>
            <SheetDescription className="text-xs">
              Review execution order and configure conditional edges
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6 pt-4">
          {/* Cycle warning */}
          {cycle && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="text-sm font-medium text-destructive">Cycle detected</p>
                <p className="text-xs text-destructive/80">
                  The flow graph contains a cycle. Remove an edge to resolve it before executing.
                </p>
              </div>
            </div>
          )}

          {/* Chain steps */}
          {chain.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <GitBranch className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">No agent chain</p>
                <p className="text-xs text-muted-foreground">
                  Connect agents on the canvas to build an execution chain.
                </p>
              </div>
            </div>
          ) : (
            <section>
              <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Execution Order ({chain.length} {chain.length === 1 ? 'step' : 'steps'})
              </p>
              <div
                className="flex flex-col gap-2"
                role="list"
                aria-label="Chain execution steps"
              >
                {chain.map((step, index) => (
                  <div key={step.nodeId} role="listitem">
                    <StepCard step={step} index={index} total={chain.length} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Conditional edges */}
          {agentEdges.length > 0 && (
            <>
              <Separator />
              <section>
                <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Conditional Edges
                </p>
                <div className="flex flex-col gap-3">
                  {agentEdges.map((ce) => {
                    const srcName =
                      chain.find((s) => s.nodeId === ce.sourceId)?.agentName ?? ce.sourceId
                    const tgtName =
                      chain.find((s) => s.nodeId === ce.targetId)?.agentName ?? ce.targetId
                    return (
                      <div key={ce.edgeId} className="flex flex-col gap-1.5">
                        <label className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">{srcName}</span>
                          <ArrowRight className="mx-1 inline h-3 w-3" aria-hidden />
                          <span className="font-medium text-foreground">{tgtName}</span>
                          {' — condition pattern'}
                        </label>
                        <Input
                          value={ce.condition}
                          onChange={(e) => updateCondition(ce.edgeId, e.target.value)}
                          placeholder="e.g. APPROVED|SUCCESS"
                          className="font-mono text-xs"
                          aria-label={`Condition for edge ${srcName} to ${tgtName}`}
                        />
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t px-6 py-4">
          <div className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            <span>
              Est. total:{' '}
              <span className="font-medium text-foreground">~${totalCost.toFixed(3)}</span>
            </span>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExecute}
            disabled={chain.length === 0 || cycle || executing}
            className="gap-2"
          >
            {executing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Execute Chain
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
