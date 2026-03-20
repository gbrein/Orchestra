'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
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
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { AgentNode } from './nodes/agent-node'
import { SkillNode } from './nodes/skill-node'
import { PolicyNode } from './nodes/policy-node'
import { McpNode, type McpNodeData } from './nodes/mcp-node'
import { ResourceNode, type ResourceNodeData } from './nodes/resource-node'
import { StickyNoteNode } from './nodes/sticky-note-node'
import { OrchestraEdge, type OrchestraEdgeData } from './edges/orchestra-edge'
import {
  isValidConnection,
  DRAG_TYPES,
  type AgentNodeData,
  type SkillNodeData,
  type PolicyNodeData,
} from '@/lib/canvas-utils'
import { useUndoRedo } from '@/hooks/use-undo-redo'

// ─── Node and edge type registries ────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
  agent: AgentNode,
  skill: SkillNode,
  policy: PolicyNode,
  mcp: McpNode,
  resource: ResourceNode,
  note: StickyNoteNode,
}

const EDGE_TYPES: EdgeTypes = {
  orchestra: OrchestraEdge,
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function resolveEdgeType(
  sourceNode: Node | undefined,
): OrchestraEdgeData['edgeType'] {
  if (
    sourceNode?.type === 'skill' ||
    sourceNode?.type === 'policy' ||
    sourceNode?.type === 'mcp'
  ) {
    return 'association'
  }
  return 'flow'
}

// ─── Inner canvas (needs ReactFlowProvider ancestor) ──────────────────────

interface OrchestraCanvasInnerProps {
  initialNodes: Node[]
  initialEdges: Edge[]
  onNodesChange?: (nodes: Node[]) => void
  onUndoRedoReady?: (controls: UndoRedoControls) => void
  onViewReady?: (controls: CanvasViewControls) => void
  onNodeDoubleClick?: (nodeId: string, nodeType: string) => void
  onZoomChange?: (zoom: number) => void
  activeAgentIds?: ReadonlySet<string>
}

export interface UndoRedoControls {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export interface CanvasViewControls {
  zoomIn: () => void
  zoomOut: () => void
  fitView: () => void
  getZoom: () => number
}

function OrchestraCanvasInner({
  initialNodes,
  initialEdges,
  onNodesChange,
  onUndoRedoReady,
  onViewReady,
  onNodeDoubleClick,
  onZoomChange,
  activeAgentIds,
}: OrchestraCanvasInnerProps) {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges)
  const rfInstance = useRef<ReactFlowInstance | null>(null)
  const reactFlowInstance = useReactFlow()
  const { setNodes: rfSetNodes, setEdges: rfSetEdges } = reactFlowInstance

  // Sync when parent pushes new nodes/edges (e.g. template load, drag-drop from placeholder)
  const prevInitialNodesRef = useRef(initialNodes)
  const prevInitialEdgesRef = useRef(initialEdges)

  useEffect(() => {
    if (initialNodes !== prevInitialNodesRef.current) {
      prevInitialNodesRef.current = initialNodes
      setNodes(initialNodes)
    }
  }, [initialNodes, setNodes])

  useEffect(() => {
    if (initialEdges !== prevInitialEdgesRef.current) {
      prevInitialEdgesRef.current = initialEdges
      setEdges(initialEdges)
    }
  }, [initialEdges, setEdges])

  // ── View controls (zoom, fit) ──────────────────────────────────────────
  const viewControlsRef = useRef(false)
  if (!viewControlsRef.current && onViewReady) {
    viewControlsRef.current = true
    // Defer to avoid calling during render
    setTimeout(() => {
      onViewReady({
        zoomIn: () => reactFlowInstance.zoomIn(),
        zoomOut: () => reactFlowInstance.zoomOut(),
        fitView: () => reactFlowInstance.fitView({ padding: 0.2 }),
        getZoom: () => reactFlowInstance.getZoom(),
      })
    }, 0)
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────

  const { undo, redo, canUndo, canRedo, takeSnapshot } = useUndoRedo({
    nodes,
    edges,
    setNodes: (next) => {
      rfSetNodes(next)
      onNodesChange?.(next)
    },
    setEdges: rfSetEdges,
  })

  // Expose undo/redo controls to the parent via callback ref pattern
  const controlsRef = useRef<UndoRedoControls | null>(null)
  const nextControls: UndoRedoControls = { undo, redo, canUndo, canRedo }

  if (
    onUndoRedoReady &&
    (controlsRef.current === null ||
      controlsRef.current.canUndo !== canUndo ||
      controlsRef.current.canRedo !== canRedo)
  ) {
    controlsRef.current = nextControls
    onUndoRedoReady(nextControls)
  }

  // ── Connection handler ────────────────────────────────────────────────

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return

      const sourceNode = nodes.find((n) => n.id === connection.source)
      const targetNode = nodes.find((n) => n.id === connection.target)

      // skill / policy / mcp nodes may only connect to agent targets
      if (
        (sourceNode?.type === 'skill' ||
          sourceNode?.type === 'policy' ||
          sourceNode?.type === 'mcp') &&
        targetNode?.type !== 'agent'
      ) {
        return
      }

      takeSnapshot()

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
    [nodes, setEdges, takeSnapshot],
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
      } else if (dragType === DRAG_TYPES.MCP) {
        const mcpData: McpNodeData = {
          name: (parsedData['name'] as string | undefined) ?? 'MCP Server',
          serverType: (parsedData['serverType'] as McpNodeData['serverType'] | undefined) ?? 'stdio',
          description: parsedData['description'] as string | undefined,
        }
        newNode = { id: crypto.randomUUID(), type: 'mcp', position, data: mcpData }
      } else if (dragType === DRAG_TYPES.RESOURCE) {
        const resourceData: ResourceNodeData = {
          label: (parsedData['label'] as string | undefined) ?? 'Resources',
          fileCount: (parsedData['fileCount'] as number | undefined) ?? 0,
          linkCount: (parsedData['linkCount'] as number | undefined) ?? 0,
          noteCount: (parsedData['noteCount'] as number | undefined) ?? 0,
          variableCount: (parsedData['variableCount'] as number | undefined) ?? 0,
        }
        newNode = { id: crypto.randomUUID(), type: 'resource', position, data: resourceData }
      } else {
        return
      }

      takeSnapshot()

      setNodes((prev) => {
        const updated = [...prev, newNode]
        onNodesChange?.(updated)
        return updated
      })
    },
    [setNodes, onNodesChange, takeSnapshot],
  )

  // ── Node drag – snapshot before position changes ───────────────────────

  const handleNodeDragStart = useCallback(() => {
    takeSnapshot()
  }, [takeSnapshot])

  // ── Node double-click ─────────────────────────────────────────────────

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeDoubleClick?.(node.id, node.type ?? '')
    },
    [onNodeDoubleClick],
  )

  return (
    <div className="h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={useMemo(() =>
          activeAgentIds && activeAgentIds.size > 0
            ? edges.map((e) => ({
                ...e,
                data: { ...e.data, isActive: activeAgentIds.has(e.source) },
              }))
            : edges,
          [edges, activeAgentIds],
        )}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDoubleClick={handleNodeDoubleClick}
        onMoveEnd={(_event, viewport) => {
          onZoomChange?.(Math.round(viewport.zoom * 100))
        }}
        onInit={(instance) => {
          rfInstance.current = instance
          onZoomChange?.(Math.round(instance.getZoom() * 100))
        }}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--border))"
        />

        <MiniMap
          position="bottom-right"
          className="!bottom-4 !right-4 overflow-hidden rounded-md border border-border !bg-card"
          nodeColor={(node) => {
            if (node.type === 'agent') return 'hsl(var(--primary))'
            if (node.type === 'skill') return 'hsl(var(--secondary-foreground))'
            if (node.type === 'policy') return 'hsl(217 91% 60%)'
            if (node.type === 'mcp') return 'hsl(271 91% 65%)'
            if (node.type === 'resource') return 'hsl(189 94% 43%)'
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
  onUndoRedoReady?: (controls: UndoRedoControls) => void
  onViewReady?: (controls: CanvasViewControls) => void
  onNodeDoubleClick?: (nodeId: string, nodeType: string) => void
  onZoomChange?: (zoom: number) => void
  activeAgentIds?: ReadonlySet<string>
}

export function OrchestraCanvas({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onUndoRedoReady,
  onViewReady,
  onNodeDoubleClick,
  onZoomChange,
  activeAgentIds,
}: OrchestraCanvasProps) {
  return (
    <ReactFlowProvider>
      <OrchestraCanvasInner
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        onNodesChange={onNodesChange}
        onUndoRedoReady={onUndoRedoReady}
        onViewReady={onViewReady}
        onNodeDoubleClick={onNodeDoubleClick}
        onZoomChange={onZoomChange}
        activeAgentIds={activeAgentIds}
      />
    </ReactFlowProvider>
  )
}
