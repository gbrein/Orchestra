'use client'

import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnConnect,
  ReactFlowProvider,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { AgentNode } from './nodes/agent-node'
import { SkillNode } from './nodes/skill-node'
import { PolicyNode } from './nodes/policy-node'
import { OrchestraEdge, type OrchestraEdgeData } from './edges/orchestra-edge'
import {
  isValidConnection,
  DRAG_TYPES,
  type AgentNodeData,
  type SkillNodeData,
  type PolicyNodeData,
} from '@/lib/canvas-utils'

// ─── Node and edge type registries ────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
  agent: AgentNode,
  skill: SkillNode,
  policy: PolicyNode,
}

const EDGE_TYPES: EdgeTypes = {
  orchestra: OrchestraEdge,
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function resolveEdgeType(
  sourceNode: Node | undefined,
): OrchestraEdgeData['edgeType'] {
  if (sourceNode?.type === 'skill' || sourceNode?.type === 'policy') {
    return 'association'
  }
  return 'flow'
}

// ─── Inner canvas (needs ReactFlowProvider ancestor) ──────────────────────

interface OrchestraCanvasInnerProps {
  initialNodes: Node[]
  initialEdges: Edge[]
  onNodesChange?: (nodes: Node[]) => void
}

function OrchestraCanvasInner({
  initialNodes,
  initialEdges,
  onNodesChange,
}: OrchestraCanvasInnerProps) {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges)
  const rfInstance = useRef<ReactFlowInstance | null>(null)

  // ── Connection handler ────────────────────────────────────────────────

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return

      const sourceNode = nodes.find((n) => n.id === connection.source)
      const targetNode = nodes.find((n) => n.id === connection.target)

      // Enforce: skill/policy may only connect to agent targets
      if (
        (sourceNode?.type === 'skill' || sourceNode?.type === 'policy') &&
        targetNode?.type !== 'agent'
      ) {
        return
      }

      const edgeType = resolveEdgeType(sourceNode)

      const newEdge: Edge = {
        id: crypto.randomUUID(),
        source: connection.source ?? '',
        target: connection.target ?? '',
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'orchestra',
        data: { edgeType } satisfies OrchestraEdgeData,
      }

      setEdges((prev) => addEdge(newEdge, prev))
    },
    [nodes, setEdges],
  )

  // ── Drag-and-drop handlers ────────────────────────────────────────────

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      if (!rfInstance.current) return

      const dragType = Object.values(DRAG_TYPES).find((t) =>
        event.dataTransfer.types.includes(t),
      )
      if (!dragType) return

      const rawData = event.dataTransfer.getData(dragType)
      if (!rawData) return

      let parsedData: Record<string, unknown>
      try {
        parsedData = JSON.parse(rawData) as Record<string, unknown>
      } catch {
        return
      }

      const position = rfInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      let newNode: Node

      if (dragType === DRAG_TYPES.AGENT) {
        const agentData: AgentNodeData = {
          name: (parsedData['name'] as string | undefined) ?? 'New Agent',
          description: parsedData['description'] as string | undefined,
          avatar: parsedData['avatar'] as string | undefined,
          status: (parsedData['status'] as AgentNodeData['status'] | undefined) ?? 'idle',
          model: parsedData['model'] as string | undefined,
          purpose: parsedData['purpose'] as string | undefined,
        }
        newNode = { id: crypto.randomUUID(), type: 'agent', position, data: agentData }
      } else if (dragType === DRAG_TYPES.SKILL) {
        const skillData: SkillNodeData = {
          name: (parsedData['name'] as string | undefined) ?? 'New Skill',
          category: parsedData['category'] as string | undefined,
        }
        newNode = { id: crypto.randomUUID(), type: 'skill', position, data: skillData }
      } else if (dragType === DRAG_TYPES.POLICY) {
        const policyData: PolicyNodeData = {
          name: (parsedData['name'] as string | undefined) ?? 'New Policy',
          level: (parsedData['level'] as PolicyNodeData['level'] | undefined) ?? 'agent',
        }
        newNode = { id: crypto.randomUUID(), type: 'policy', position, data: policyData }
      } else {
        return
      }

      setNodes((prev) => {
        const updated = [...prev, newNode]
        onNodesChange?.(updated)
        return updated
      })
    },
    [setNodes, onNodesChange],
  )

  return (
    <div className="h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onInit={(instance) => {
          rfInstance.current = instance
        }}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={['Backspace', 'Delete']}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--border))"
        />

        <Controls
          position="bottom-right"
          showInteractive={false}
        />

        <MiniMap
          position="bottom-right"
          className="!bottom-24 !right-4 overflow-hidden rounded-md border border-border !bg-card"
          nodeColor={(node) => {
            if (node.type === 'agent') return 'hsl(var(--primary))'
            if (node.type === 'skill') return 'hsl(var(--secondary-foreground))'
            if (node.type === 'policy') return 'hsl(217 91% 60%)'
            return 'hsl(var(--muted-foreground))'
          }}
          maskColor="hsl(var(--background) / 0.7)"
        />
      </ReactFlow>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────

export interface OrchestraCanvasProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onNodesChange?: (nodes: Node[]) => void
}

export function OrchestraCanvas({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
}: OrchestraCanvasProps) {
  return (
    <ReactFlowProvider>
      <OrchestraCanvasInner
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        onNodesChange={onNodesChange}
      />
    </ReactFlowProvider>
  )
}
