import type { Node, Edge } from '@xyflow/react'
import type { AgentNodeData } from '@/lib/canvas-utils'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChainStep {
  readonly nodeId: string
  readonly agentName: string
  readonly model?: string
}

interface GraphNode {
  id: string
  deps: string[]
}

// ─── Topological sort ───────────────────────────────────────────────────────

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

  if (sorted.length !== graphNodes.length) return null
  return sorted
}

// ─── Exports ────────────────────────────────────────────────────────────────

/** Returns true if the agent graph has a cycle */
export function hasCycle(nodes: readonly Node[], edges: readonly Edge[]): boolean {
  const agentIds = new Set(nodes.filter((n) => n.type === 'agent').map((n) => n.id))

  const graphNodes: GraphNode[] = Array.from(agentIds).map((id) => ({
    id,
    deps: edges
      .filter((e) => e.target === id && agentIds.has(e.source))
      .map((e) => e.source),
  }))

  return topoSort(graphNodes) === null
}

/** Builds an ordered chain of agent steps from canvas nodes/edges */
export function buildChain(nodes: readonly Node[], edges: readonly Edge[]): ChainStep[] {
  const agentNodes = nodes.filter((n) => n.type === 'agent')
  const agentIds = new Set(agentNodes.map((n) => n.id))

  const graphNodes: GraphNode[] = agentNodes.map((n) => ({
    id: n.id,
    deps: edges
      .filter((e) => e.target === n.id && agentIds.has(e.source))
      .map((e) => e.source),
  }))

  const order = topoSort(graphNodes)
  if (!order) {
    return agentNodes.map((n) => ({
      nodeId: n.id,
      agentName: (n.data as AgentNodeData).name,
      model: (n.data as AgentNodeData).model,
    }))
  }

  return order.map((id) => {
    const node = agentNodes.find((n) => n.id === id)!
    const data = node.data as AgentNodeData
    return { nodeId: id, agentName: data.name, model: data.model }
  })
}

/** Returns true if there are at least 2 agent nodes connected by an edge */
export function hasAgentChain(nodes: readonly Node[], edges: readonly Edge[]): boolean {
  const agentIds = new Set(nodes.filter((n) => n.type === 'agent').map((n) => n.id))
  return edges.some((e) => agentIds.has(e.source) && agentIds.has(e.target))
}
