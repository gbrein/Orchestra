'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar, type TopBarTab } from '@/components/shell/top-bar'
import { BottomBar } from '@/components/shell/bottom-bar'
import { CanvasPlaceholder } from '@/components/canvas/canvas-placeholder'
import { AgentCreateDialog } from '@/components/panels/agent-create-dialog'
import { TemplateGallery } from '@/components/canvas/template-gallery'
import { CommandPalette } from '@/components/shell/command-palette'
import type { CreateAgentInput } from '@orchestra/shared'
import { createAgentNode } from '@/lib/canvas-utils'
import { apiPost, apiDelete } from '@/lib/api'
import { createResourceNode } from '@/lib/canvas-utils'
import { OrchestraCanvas, type UndoRedoControls } from '@/components/canvas/orchestra-canvas'
import { WorkflowToolbar } from '@/components/canvas/workflow-toolbar'
import { MaestroDrawer } from '@/components/panels/maestro-drawer'
import { WorkflowChat, type WorkflowLogEntry } from '@/components/panels/workflow-chat'
import { hasAgentChain, buildChain } from '@/lib/chain-utils'
import { getSocket } from '@/lib/socket'
import { ShortcutOverlay } from '@/components/shell/shortcut-overlay'
import { AgentChat } from '@/components/panels/agent-chat'
import { ApprovalDialog } from '@/components/panels/approval-dialog'
import { SkillMarketplace } from '@/components/panels/skill-marketplace'
import { DiscussionWizard, type DiscussionAgent } from '@/components/panels/discussion-wizard'
import { DiscussionPanel } from '@/components/panels/discussion-panel'
import { DiscussionsList } from '@/components/panels/discussions-list'
import { HistoryPanel } from '@/components/panels/history-panel'
import { SettingsPanel } from '@/components/panels/settings-panel'
import { ResourceBrowser } from '@/components/panels/resource-browser'
import { McpManagement, type McpServer } from '@/components/panels/mcp-management'
import { ChainConfig, type ChainStep, type ConditionalEdge } from '@/components/panels/chain-config'
import { PrdEditor, type PrdData } from '@/components/panels/prd-editor'
import { AssistantsList, type AssistantSummary } from '@/components/panels/assistants-list'
import { GlobalSafetyPanel } from '@/components/panels/global-safety-panel'
import { AgentDrawer } from '@/components/panels/agent-drawer'
import { QuickRunBar } from '@/components/shell/quick-run-bar'
import { ActivityFeed } from '@/components/panels/activity-feed'
import { WorkspaceContextEditor } from '@/components/panels/workspace-context-editor'
import { WorkspacePlanEditor } from '@/components/panels/workspace-plan-editor'
import { GitPanel } from '@/components/panels/git-panel'
import { CostDashboard } from '@/components/panels/cost-dashboard'
import { WorkflowReviewDialog } from '@/components/panels/workflow-review-dialog'
import { SchedulesPanel } from '@/components/panels/schedules-panel'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { apiGet, apiPatch } from '@/lib/api'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { ComplexityContext, useComplexityState } from '@/hooks/use-complexity'
import { useSocket } from '@/hooks/use-socket'
import { useCanvasPersistence } from '@/hooks/use-canvas-persistence'
import { useAgentStatus } from '@/hooks/use-agent-status'
import { useNotifications } from '@/hooks/use-notifications'
import { injectMessagesIntoCache, type ChatMessage } from '@/hooks/use-agent-stream'
import { useApprovals } from '@/hooks/use-approvals'
import { usePanel } from '@/hooks/use-panel'
import type { AgentNodeData } from '@/lib/canvas-utils'
import type { AgentStatus, DiscussionTable, CreateDiscussionInput } from '@orchestra/shared'
import type { OrchestraNotification } from '@/hooks/use-notifications'

// ─── Types ─────────────────────────────────────────────────────────────────

interface SelectedAgent {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly purpose?: string
  readonly status: AgentStatus
  readonly model?: string
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  // ── Panel manager: one right-side panel at a time ──
  const { panel, openPanel, closePanel, isOpen } = usePanel()

  // ── Dialog states (modals overlay, don't compete with panels) ──
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [discussionWizardOpen, setDiscussionWizardOpen] = useState(false)
  const [quickRunOpen, setQuickRunOpen] = useState(false)
  const [createAgentOpen, setCreateAgentOpen] = useState(false)
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // ── Non-panel state ──
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedWorkflow, setGeneratedWorkflow] = useState<import('@orchestra/shared').GeneratedWorkflowWithLayout | null>(null)
  const [selectedDiscussion, setSelectedDiscussion] = useState<DiscussionTable | null>(null)
  const [activeTab, setActiveTab] = useState<TopBarTab>('workspace')
  const [discussions, setDiscussions] = useState<DiscussionTable[]>([])
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])
  const [workflowRunning, setWorkflowRunning] = useState(false)
  const [workflowStep, setWorkflowStep] = useState<{ index: number; total: number; agentName: string } | null>(null)
  const [workflowChatOpen, setWorkflowChatOpen] = useState(false)
  const [workflowLog, setWorkflowLog] = useState<WorkflowLogEntry[]>([])
  const [workflowMode, setWorkflowMode] = useState<import('@orchestra/shared').AgentMode>('default')
  const [maestroEnabled, setMaestroEnabled] = useState(true)
  const [plannerEnabled, setPlannerEnabled] = useState(false)
  const [plannerStatus, setPlannerStatus] = useState<'idle' | 'planning' | 'done'>('idle')
  const [maestroRigor, setMaestroRigor] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [maestroCustomInstructions, setMaestroCustomInstructions] = useState('')
  const [maestroStatus, setMaestroStatus] = useState<'idle' | 'thinking' | 'decided'>('idle')
  const [maestroLastAction, setMaestroLastAction] = useState<'continue' | 'redirect' | 'conclude' | null>(null)
  const [maestroLastTargetAgent, setMaestroLastTargetAgent] = useState<string | null>(null)
  const [advisorRunning, setAdvisorRunning] = useState(false)
  const [advisorModel, setAdvisorModel] = useState('claude-haiku-4-5-20251001')
  const [workspaceWorkingDir, setWorkspaceWorkingDir] = useState<string | null>(null)

  // Favorites — fetched from DB
  const [favoriteAgents, setFavoriteAgents] = useState<Array<{ id: string; name: string; avatar?: string | null; status: string }>>([])

  useEffect(() => {
    apiGet<Array<{ id: string; name: string; avatar: string | null; status: string; isFavorite: boolean }>>('/api/agents')
      .then((agents) => {
        setFavoriteAgents(
          agents
            .filter((a) => a.isFavorite)
            .map((a) => ({ id: a.id, name: a.name, avatar: a.avatar, status: a.status })),
        )
      })
      .catch(() => {})
  }, [])

  const handleSelectFavorite = useCallback((agentId: string) => {
    const fav = favoriteAgents.find((a) => a.id === agentId)
    if (!fav) return
    setSelectedAgent({
      id: fav.id,
      name: fav.name,
      status: fav.status as AgentStatus,
    })
    openPanel({ type: 'agent-chat', agentId: selectedAgent?.id ?? '' })
  }, [favoriteAgents])

  const [zoomLevel, setZoomLevel] = useState(100)
  const { value: complexity, refresh: refreshComplexity } = useComplexityState()
  const {
    workspaces, activeWorkspaceId, loaded: canvasLoaded,
    loadCanvas, saveCanvas, switchWorkspace, createWorkspace,
    renameWorkspace, deleteWorkspace,
  } = useCanvasPersistence()

  // Fetch workspace workingDirectory when workspace changes
  useEffect(() => {
    if (!activeWorkspaceId) {
      setWorkspaceWorkingDir(null)
      return
    }
    apiGet<Array<{ id: string; workingDirectory?: string | null }>>('/api/workspaces')
      .then((ws) => {
        const match = ws.find((w) => w.id === activeWorkspaceId)
        setWorkspaceWorkingDir(match?.workingDirectory ?? null)
      })
      .catch(() => {})
  }, [activeWorkspaceId])

  const handleWorkingDirectoryChange = useCallback(async (dir: string | null) => {
    if (!activeWorkspaceId) return
    try {
      await apiPatch(`/api/workspaces/${activeWorkspaceId}`, {
        workingDirectory: dir,
      })
      setWorkspaceWorkingDir(dir)
    } catch (err) {
      console.error('Failed to save working directory:', err)
    }
  }, [activeWorkspaceId])

  const handleAgentStatusChange = useCallback((agentId: string, status: import('@orchestra/shared').AgentStatus) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === agentId ? { ...n, data: { ...n.data, status } } : n,
      ),
    )
  }, [])

  const { sessionTokens, activeAgentIds, addTokens } = useAgentStatus(handleAgentStatusChange)


  const { connected, connecting, error: socketError } = useSocket()

  const {
    notifications,
    unreadCount,
    acknowledge,
    acknowledgeAll,
    removeNotification,
  } = useNotifications()

  const {
    currentApproval,
    showApprovalDialog,
    approve,
    reject,
    dismissDialog,
  } = useApprovals()

  const undoRedoRef = useRef<UndoRedoControls | null>(null)
  const viewRef = useRef<import('@/components/canvas/orchestra-canvas').CanvasViewControls | null>(null)

  const handleUndoRedoReady = useCallback((controls: UndoRedoControls) => {
    undoRedoRef.current = controls
  }, [])

  const handleViewReady = useCallback((controls: import('@/components/canvas/orchestra-canvas').CanvasViewControls) => {
    viewRef.current = controls
  }, [])

  const handleZoomIn = useCallback(() => {
    viewRef.current?.zoomIn()
    const z = viewRef.current?.getZoom()
    if (z) setZoomLevel(Math.round(z * 100))
  }, [])

  const handleZoomOut = useCallback(() => {
    viewRef.current?.zoomOut()
    const z = viewRef.current?.getZoom()
    if (z) setZoomLevel(Math.round(z * 100))
  }, [])

  const handleFitView = useCallback(() => {
    viewRef.current?.fitView()
    setTimeout(() => {
      const z = viewRef.current?.getZoom()
      if (z) setZoomLevel(Math.round(z * 100))
    }, 100)
  }, [])

  // Load canvas from DB on mount (but don't auto-switch to canvas view)
  const [savedNodes, setSavedNodes] = useState<Node[]>([])
  const [savedEdges, setSavedEdges] = useState<Edge[]>([])
  const [showHome, setShowHome] = useState(true)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void loadCanvas().then((data) => {
      if (data) {
        setSavedNodes(data.nodes)
        setSavedEdges(data.edges)
      }
    })
  }, [loadCanvas])

  const goToWorkspace = useCallback(() => {
    if (savedNodes.length > 0) {
      setNodes(savedNodes)
      setEdges(savedEdges)
    }
    setShowHome(false)
    setTimeout(() => {
      viewRef.current?.fitView()
      const z = viewRef.current?.getZoom()
      if (z) setZoomLevel(Math.round(z * 100))
    }, 300)
  }, [savedNodes, savedEdges])

  const showCanvas = !showHome && nodes.length > 0

  const runningAgentCount = nodes.filter(
    (n) => n.type === 'agent' && (n.data as AgentNodeData).status === 'running',
  ).length

  // ── Shortcut callbacks ─────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    undoRedoRef.current?.undo()
  }, [])

  const handleRedo = useCallback(() => {
    undoRedoRef.current?.redo()
  }, [])

  const handleDelete = useCallback(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'Delete',
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(event)
  }, [])

  const handleSelectAll = useCallback(() => {
    setNodes((prev) =>
      prev.map((n) => ({ ...n, selected: true })),
    )
  }, [])

  const handleCommandPalette = useCallback(() => {
    setCommandPaletteOpen((prev) => !prev)
  }, [])

  const handleCreateAgent = useCallback(() => {
    setCreateAgentOpen(true)
  }, [])

  const handleUseTemplate = useCallback(() => {
    setTemplateGalleryOpen(true)
  }, [])

  const handleAgentCreated = useCallback(async (input: CreateAgentInput) => {
    try {
      // Persist to DB so the backend can find this agent when spawning
      const saved = await apiPost<{ id: string }>('/api/agents', {
        name: input.name,
        persona: input.persona ?? `You are ${input.name}, a helpful assistant.`,
        description: input.description,
        purpose: input.purpose,
        model: input.model,
        scope: input.scope ?? [],
        allowedTools: input.allowedTools ?? [],
      })

      const node = createAgentNode(
        { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 },
        {
          name: input.name,
          description: input.description,
          status: 'idle',
          model: input.model,
          purpose: input.purpose,
        },
      )
      // Use the DB id so the socket handler can find the agent
      node.id = saved.id
      setNodes((prev) => [...prev, node])
    } catch {
      // If API fails (server down), create local-only node
      const node = createAgentNode(
        { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 },
        {
          name: input.name,
          description: input.description,
          status: 'idle',
          model: input.model,
          purpose: input.purpose,
        },
      )
      setNodes((prev) => [...prev, node])
    }
    setCreateAgentOpen(false)
  }, [])

  const handleTemplateSelected = useCallback(async (templateNodes: Node[], templateEdges: Edge[]) => {
    // Persist each agent node to DB so they can be spawned
    const persistedNodes = await Promise.all(
      templateNodes.map(async (node) => {
        if (node.type !== 'agent') return node
        const data = node.data as AgentNodeData
        try {
          const saved = await apiPost<{ id: string }>('/api/agents', {
            name: data.name,
            persona: `You are ${data.name}. ${data.description ?? ''}`.trim(),
            description: data.description,
            purpose: data.purpose,
            model: data.model,
            scope: [],
            allowedTools: [],
          })
          return { ...node, id: saved.id }
        } catch {
          return node // keep local-only if server unavailable
        }
      }),
    )

    // Update edge source/target ids to match persisted agent ids
    const idMap = new Map<string, string>()
    templateNodes.forEach((orig, i) => {
      if (orig.id !== persistedNodes[i].id) {
        idMap.set(orig.id, persistedNodes[i].id)
      }
    })

    const updatedEdges = templateEdges.map((edge) => ({
      ...edge,
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
    }))

    setNodes(persistedNodes)
    setEdges(updatedEdges)
    setTemplateGalleryOpen(false)
    setTimeout(() => {
      viewRef.current?.fitView()
      const z = viewRef.current?.getZoom()
      if (z) setZoomLevel(Math.round(z * 100))
    }, 200)
  }, [])

  // Materialize a generated workflow onto the canvas (persist agents, create nodes/edges)
  const materializeWorkflow = useCallback(async (workflow: import('@orchestra/shared').GeneratedWorkflowWithLayout) => {
    // Persist each agent to DB (same pattern as handleTemplateSelected)
    const persistedAgents = await Promise.all(
      workflow.agents.map(async (agent) => {
        try {
          const saved = await apiPost<{ id: string }>('/api/agents', {
            name: agent.name,
            persona: agent.persona,
            description: agent.description,
            purpose: agent.purpose,
            model: agent.model,
            scope: [],
            allowedTools: [],
          })
          return { ...agent, persistedId: saved.id }
        } catch {
          return { ...agent, persistedId: agent.tempId }
        }
      }),
    )

    // Build ID map: tempId → persisted DB id
    const idMap = new Map<string, string>()
    for (const agent of persistedAgents) {
      idMap.set(agent.tempId, agent.persistedId)
    }

    // Assign skills to agents (best-effort, don't block on failure)
    for (const agent of persistedAgents) {
      for (const skillId of agent.suggestedSkills) {
        apiPost(`/api/agents/${agent.persistedId}/skills/${skillId}`, {}).catch(() => {})
      }
    }

    // Create React Flow nodes
    const newNodes = persistedAgents.map((agent) => {
      const node = createAgentNode(
        agent.position,
        {
          name: agent.name,
          description: agent.description,
          status: 'idle' as const,
          model: agent.model,
          purpose: agent.purpose,
        },
      )
      node.id = agent.persistedId
      return node
    })

    // Create React Flow edges with remapped IDs
    const newEdges: Edge[] = workflow.edges.map((edge) => ({
      id: crypto.randomUUID(),
      source: idMap.get(edge.from) ?? edge.from,
      target: idMap.get(edge.to) ?? edge.to,
      type: 'orchestra' as const,
      data: { edgeType: 'flow' as const },
    }))

    setNodes(newNodes)
    setEdges(newEdges)
    setTimeout(() => {
      viewRef.current?.fitView()
      const z = viewRef.current?.getZoom()
      if (z) setZoomLevel(Math.round(z * 100))
    }, 200)
  }, [])

  const handleDescribe = useCallback(async (description: string) => {
    setIsGenerating(true)
    try {
      const workflow = await apiPost<import('@orchestra/shared').GeneratedWorkflowWithLayout>(
        '/api/workflows/generate',
        { description },
      )
      // Open review dialog instead of materializing directly
      setGeneratedWorkflow(workflow)
      setReviewDialogOpen(true)
    } catch {
      // Fallback: create a single agent (original behavior)
      const name = description.length > 30 ? description.slice(0, 30) + '...' : description
      try {
        const saved = await apiPost<{ id: string }>('/api/agents', {
          name,
          persona: `You are a helpful assistant. The user described you as: "${description}". Follow these instructions carefully.`,
          description,
          purpose: 'general',
          model: 'sonnet',
          scope: [],
          allowedTools: [],
        })
        const node = createAgentNode(
          { x: 300, y: 250 },
          { name, description, status: 'idle', model: 'sonnet', purpose: 'general' },
        )
        node.id = saved.id
        setNodes((prev) => [...prev, node])
      } catch {
        const node = createAgentNode(
          { x: 300, y: 250 },
          { name, description, status: 'idle', model: 'sonnet', purpose: 'general' },
        )
        setNodes((prev) => [...prev, node])
      }
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const handleToggleMarketplace = useCallback(() => {
    isOpen('skill-marketplace') ? closePanel() : openPanel({ type: 'skill-marketplace' })
  }, [])

  // Sidebar "Discussions" → open DiscussionWizard directly (no list needed from sidebar)
  const handleSidebarDiscussionsClick = useCallback(() => {
    setDiscussionWizardOpen(true)
  }, [])

  // TopBar "Discussions" tab → open the list panel
  const handleTopBarDiscussionsClick = useCallback(() => {
    setActiveTab('discussions')
    openPanel({ type: 'discussions-list' })
    /* history closed by panel switch */
  }, [])

  // TopBar "History" tab → open history panel
  const handleTopBarHistoryClick = useCallback(() => {
    setActiveTab('history')
    openPanel({ type: 'history' })
    /* discussions closed by panel switch */
  }, [])

  // TopBar "Settings" gear → open settings panel
  const handleSettingsClick = useCallback(() => {
    openPanel({ type: 'settings' })
  }, [])

  const handleSelectWorkspace = useCallback(async (id: string) => {
    // Save current canvas first, then switch
    if (nodes.length > 0) saveCanvas(nodes, edges)
    const data = await switchWorkspace(id)
    setNodes(data?.nodes ?? [])
    setEdges(data?.edges ?? [])
    setShowHome(false)
    setActiveTab('workspace')
    setTimeout(() => {
      viewRef.current?.fitView()
      const z = viewRef.current?.getZoom()
      if (z) setZoomLevel(Math.round(z * 100))
    }, 300)
  }, [nodes, edges, saveCanvas, switchWorkspace])

  const handleCreateWorkspace = useCallback(async (name: string, workingDirectory?: string) => {
    if (nodes.length > 0) saveCanvas(nodes, edges)
    await createWorkspace(name, workingDirectory)
    if (workingDirectory) setWorkspaceWorkingDir(workingDirectory)
    setNodes([])
    setEdges([])
    setShowHome(false)
    setActiveTab('workspace')
  }, [nodes, edges, saveCanvas, createWorkspace])

  const handleRenameWorkspace = useCallback(async (id: string, name: string) => {
    await renameWorkspace(id, name)
  }, [renameWorkspace])

  const handleDeleteWorkspace = useCallback(async (id: string) => {
    await deleteWorkspace(id)
    // Load canvas for the new active workspace
    const remaining = workspaces.filter((w) => w.id !== id)
    if (remaining.length > 0) {
      const data = await switchWorkspace(remaining[0].id)
      setNodes(data?.nodes ?? [])
      setEdges(data?.edges ?? [])
    }
  }, [deleteWorkspace, workspaces, switchWorkspace])

  const handleResourcesClick = useCallback(() => {
    openPanel({ type: 'resource-browser' })
  }, [])

  const handleAssistantsClick = useCallback(() => {
    openPanel({ type: 'assistants-list' })
  }, [])

  const handleSafetyClick = useCallback(() => {
    openPanel({ type: 'safety' })
  }, [])

  const handleSelectAssistant = useCallback((assistant: AssistantSummary) => {
    closePanel()
    setSelectedAgent({
      id: assistant.id,
      name: assistant.name,
      status: assistant.status,
      model: assistant.model,
    })
    openPanel({ type: 'agent-chat', agentId: selectedAgent?.id ?? '' })
  }, [])

  const handleDeleteAssistant = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id))
    // Also delete from DB
    void apiDelete(`/api/agents/${id}`).catch(() => {})
  }, [])

  const handleConnectionsClick = useCallback(() => {
    openPanel({ type: 'mcp-management' })
  }, [])

  const handleDiscussionCreate = useCallback((config: CreateDiscussionInput) => {
    const provisional: DiscussionTable = {
      id: crypto.randomUUID(),
      name: config.name,
      topic: config.topic,
      format: config.format,
      moderatorId: config.moderatorId,
      status: 'draft',
      conclusion: null,
      maxRounds: config.maxRounds ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setDiscussions((prev) => [...prev, provisional])
    setSelectedDiscussion(provisional)
    openPanel({ type: 'discussion-panel', discussionId: selectedDiscussion?.id ?? '' })
  }, [])

  const handleSelectDiscussionFromList = useCallback((discussion: DiscussionTable) => {
    setSelectedDiscussion(discussion)
    openPanel({ type: 'discussion-panel', discussionId: selectedDiscussion?.id ?? '' })
  }, [])

  const discussionAgents: DiscussionAgent[] = nodes
    .filter((n) => n.type === 'agent')
    .map((n) => {
      const data = n.data as AgentNodeData
      return {
        id: n.id,
        name: data.name,
        model: data.model,
      }
    })

  const handleToggleShortcuts = useCallback(() => {
    setShortcutsOpen((prev) => !prev)
  }, [])

  const handleEscape = useCallback(() => {
    setShortcutsOpen(false)
    setDiscussionWizardOpen(false)
    setQuickRunOpen(false)
    setWorkflowChatOpen(false)
    closePanel()
    setNodes((prev) =>
      prev.map((n) => ({ ...n, selected: false })),
    )
  }, [closePanel])

  const handleCommand = useCallback((commandId: string) => {
    setCommandPaletteOpen(false)
    switch (commandId) {
      case 'assistant:create': handleCreateAgent(); break
      case 'canvas:fit': break
      case 'nav:skills': handleToggleMarketplace(); break
      case 'nav:discussions': handleTopBarDiscussionsClick(); break
      case 'nav:shortcuts': handleToggleShortcuts(); break
      case 'template:code-review':
      case 'template:content':
      case 'template:research':
        handleUseTemplate(); break
      case 'nav:schedules': openPanel({ type: 'schedules' }); break
      default: break
    }
  }, [handleCreateAgent, handleToggleMarketplace, handleTopBarDiscussionsClick, handleToggleShortcuts, handleUseTemplate])

  const handleQuickRun = useCallback(() => {
    setQuickRunOpen((prev) => !prev)
  }, [])

  const handleActivityClick = useCallback(() => {
    openPanel({ type: 'activity' })
  }, [])

  const handleContextEditorClick = useCallback(() => {
    openPanel({ type: 'context-editor' })
  }, [])

  const handleCostDashboardClick = useCallback(() => {
    openPanel({ type: 'cost-dashboard' })
  }, [])

  const handlePlanClick = useCallback(() => {
    openPanel({ type: 'plan-editor' })
  }, [])

  const handleGitClick = useCallback(() => {
    openPanel({ type: 'git' })
  }, [])

  const handleRunWorkflow = useCallback(async (message: string) => {
    const chain = buildChain(nodes, edges)
    if (chain.length < 2) {
      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'error' as const,
          content: chain.length === 0
            ? 'No agents on the canvas. Add at least 2 connected agents to run a workflow.'
            : 'Connect at least 2 agents with edges to form a workflow chain.',
          timestamp: new Date(),
        },
      ])
      return
    }

    // Ensure all agents in the chain exist in the database
    for (const step of chain) {
      try {
        await apiGet(`/api/agents/${step.nodeId}`)
      } catch {
        // Agent not in DB — sync it now
        const node = nodes.find((n) => n.id === step.nodeId)
        const data = node?.data as AgentNodeData | undefined
        try {
          const saved = await apiPost<{ id: string }>('/api/agents', {
            id: step.nodeId,
            name: data?.name ?? step.agentName,
            persona: `You are ${data?.name ?? step.agentName}. ${data?.description ?? ''}`.trim(),
            purpose: data?.purpose,
            model: data?.model,
            scope: [],
            allowedTools: [],
          })
          // If DB assigned a different ID, update the node
          if (saved.id !== step.nodeId) {
            setNodes((prev) => prev.map((n) =>
              n.id === step.nodeId ? { ...n, id: saved.id } : n,
            ))
          }
        } catch (syncErr) {
          setWorkflowLog((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: 'error' as const,
              content: `Agent "${step.agentName}" could not be saved to database. Please recreate it.`,
              timestamp: new Date(),
            },
          ])
          return
        }
      }
    }

    const sock = getSocket()
    if (!sock.connected) {
      sock.connect()
      // Give socket a moment to connect before emitting
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('timeout'))
        }, 3000)
        sock.once('connect', () => {
          clearTimeout(timeout)
          resolve()
        })
        // If already connected by the time listener fires
        if (sock.connected) {
          clearTimeout(timeout)
          resolve()
        }
      }).catch(() => {
        setWorkflowLog((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'error' as const,
            content: 'Cannot connect to server. Make sure the backend is running on port 3001.',
            timestamp: new Date(),
          },
        ])
        return
      })
      // If we returned from the catch, don't continue
      if (!sock.connected) return
    }

    const chainId = crypto.randomUUID()
    workflowChainIdRef.current = chainId
    workflowStepsRef.current = chain

    const definition = {
      steps: chain.map((step) => ({
        agentId: step.nodeId,
      })),
      edges: chain.slice(0, -1).map((_, i) => ({
        from: i,
        to: i + 1,
      })),
    }

    // Add user message and system log entry
    setWorkflowLog((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'user',
        content: message,
        timestamp: new Date(),
      },
      {
        id: crypto.randomUUID(),
        type: 'system',
        content: `Starting workflow with ${chain.length} steps (mode: ${workflowMode})`,
        timestamp: new Date(),
      },
    ])

    setWorkflowRunning(true)
    setWorkflowStep({ index: 1, total: chain.length, agentName: chain[0].agentName })

    if (plannerEnabled) setPlannerStatus('planning')

    sock.emit('chain:execute', {
      chainId,
      definition,
      initialMessage: message,
      workspaceId: activeWorkspaceId ?? undefined,
      maestro: maestroEnabled,
      maestroRigor,
      maestroCustomInstructions: maestroCustomInstructions || undefined,
      planner: plannerEnabled,
    })
  }, [nodes, edges, workflowMode, activeWorkspaceId, maestroEnabled, maestroRigor, maestroCustomInstructions, plannerEnabled])

  const handleStopWorkflow = useCallback(() => {
    const chainId = workflowChainIdRef.current
    if (chainId) {
      const sock = getSocket()
      sock.emit('chain:stop', { chainId })
    }
    setWorkflowRunning(false)
    setWorkflowStep(null)
    setMaestroStatus('idle')
    setMaestroLastAction(null)
    setMaestroLastTargetAgent(null)
    setWorkflowLog((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'system',
        content: 'Workflow stopped by user',
        timestamp: new Date(),
      },
    ])
  }, [])

  const handleWorkflowSendMessage = useCallback((message: string) => {
    setWorkflowLog((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'user',
        content: message,
        timestamp: new Date(),
      },
    ])
  }, [])

  const handleClearWorkflowLog = useCallback(() => {
    setWorkflowLog([])
  }, [])


  const handleSaveWorkflowOutput = useCallback(async (content: string) => {
    // Collect all step outputs from the log
    const stepOutputs = workflowLog
      .filter((e) => e.type === 'step_complete' && e.content)
      .map((e) => `## ${e.agentName ?? 'Agent'}\n\n${e.content}`)
      .join('\n\n---\n\n')

    const fullOutput = stepOutputs || content
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `workflow-output-${timestamp}.md`

    // Determine target directory
    const dir = workspaceWorkingDir || '.'

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${API_BASE}/api/fs/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ directory: dir, filename, content: fullOutput }),
      })
      const data = await res.json()
      if (data.success) {
        setWorkflowLog((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'system' as const,
            content: `Output saved to ${data.data.path}`,
            timestamp: new Date(),
          },
        ])
      } else {
        setWorkflowLog((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'error' as const,
            content: `Failed to save: ${data.error}`,
            timestamp: new Date(),
          },
        ])
      }
    } catch (err) {
      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'error' as const,
          content: `Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: new Date(),
        },
      ])
    }
  }, [workflowLog, workspaceWorkingDir])

  const handleAdvisorRequest = useCallback((model: string) => {
    const chainId = lastCompletedChainIdRef.current
    if (!chainId) return
    const sock = getSocket()
    sock.emit('advisor:analyze', { chainId, model })
  }, [])

  const handleApplySkill = useCallback(async (agentId: string, skillName: string) => {
    const installRes = await apiPost<{ id: string }>('/api/skills/install', {
      name: skillName,
      source: 'marketplace',
    })
    await apiPost(`/api/agents/${agentId}/skills/${installRes.id}`, {})
  }, [])

  const handleUpdatePersona = useCallback(async (agentId: string, newPersona: string) => {
    await apiPatch(`/api/agents/${agentId}`, { persona: newPersona })
  }, [])

  const handleMaestroRedirectRespond = useCallback((requestId: string, approved: boolean) => {
    const chainId = workflowChainIdRef.current
    if (!chainId) return

    const sock = getSocket()
    sock.emit('chain:maestro_redirect_response', { chainId, requestId, approved })

    // Update log: remove the request entry and add result
    setWorkflowLog((prev) => {
      const updated = prev.map((e) =>
        e.type === 'maestro_redirect_request' && e.requestId === requestId
          ? { ...e, requestId: undefined }
          : e,
      )
      return [
        ...updated,
        {
          id: crypto.randomUUID(),
          type: approved ? 'maestro_redirect_approved' as WorkflowLogEntry['type'] : 'maestro_redirect_declined' as WorkflowLogEntry['type'],
          content: approved ? 'Redirect approved' : 'Continuing forward',
          timestamp: new Date(),
        },
      ]
    })
  }, [])

  // Track current chain ID, steps, per-step usage, per-step chat messages, and accumulated text
  const workflowChainIdRef = useRef<string>('')
  const lastCompletedChainIdRef = useRef<string>('')
  const workflowStepsRef = useRef<ReturnType<typeof buildChain>>([])
  const workflowStepUsageRef = useRef<Map<number, import('@orchestra/shared').TokenUsage>>(new Map())
  const addTokensRef = useRef(addTokens)
  addTokensRef.current = addTokens
  const workflowStepMsgsRef = useRef<Map<number, ChatMessage[]>>(new Map())
  const workflowStepTextRef = useRef<Map<number, string>>(new Map())

  // Listen for chain socket events to update workflow log
  const chainListenersAttachedRef = useRef(false)
  useEffect(() => {
    if (chainListenersAttachedRef.current) return
    chainListenersAttachedRef.current = true

    const socket = getSocket()

    socket.on('chain:step_start', (data: { chainId: string; stepIndex: number; agentId: string; cwd?: string }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      const steps = workflowStepsRef.current
      const step = steps[data.stepIndex]
      const agentName = step?.agentName ?? `Agent ${data.stepIndex + 1}`

      setWorkflowStep({ index: data.stepIndex + 1, total: steps.length, agentName })

      // Set chain visual state: active for current, pending for future
      setNodes((prev) => prev.map((n) => {
        if (n.type !== 'agent') return n
        const nd = n.data as import('@/lib/canvas-utils').AgentNodeData
        if (n.id === data.agentId) {
          return { ...n, data: { ...nd, chainState: 'active' } }
        }
        // Mark not-yet-started agents as pending (if not already completed)
        if (nd.chainState !== 'completed' && nd.chainState !== 'active') {
          return { ...n, data: { ...nd, chainState: 'pending' } }
        }
        return n
      }))

      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'step_start' as const,
          content: '',
          agentName,
          stepIndex: data.stepIndex,
          cwd: data.cwd,
          timestamp: new Date(),
        },
      ])
      // Update canvas node status to running
      setNodes((prev) => prev.map((n) =>
        n.id === data.agentId ? { ...n, data: { ...n.data, status: 'running' } } : n,
      ))
      // Init step tracking
      workflowStepMsgsRef.current.set(data.stepIndex, [])
      workflowStepTextRef.current.set(data.stepIndex, '')
    })

    // Streaming text — accumulate in ref, update single log entry per step
    socket.on('chain:step_text', (data: { chainId: string; stepIndex: number; agentId: string; content: string; partial: boolean }) => {
      if (data.chainId !== workflowChainIdRef.current) return

      // Accumulate text in ref (source of truth)
      const prev = workflowStepTextRef.current.get(data.stepIndex) ?? ''
      const accumulated = prev + data.content
      workflowStepTextRef.current.set(data.stepIndex, accumulated)

      // Update or create a single step_text entry for this stepIndex
      setWorkflowLog((logPrev) => {
        const idx = logPrev.findIndex(
          (e) => e.type === 'step_text' && e.stepIndex === data.stepIndex,
        )

        const entry = {
          id: idx >= 0 ? logPrev[idx]!.id : crypto.randomUUID(),
          type: 'step_text' as const,
          content: accumulated,
          stepIndex: data.stepIndex,
          partial: data.partial,
          timestamp: idx >= 0 ? logPrev[idx]!.timestamp : new Date(),
        }

        if (idx >= 0) {
          return [...logPrev.slice(0, idx), entry, ...logPrev.slice(idx + 1)]
        }
        return [...logPrev, entry]
      })
    })

    // Tool usage
    socket.on('chain:step_tool_use', (data: { chainId: string; stepIndex: number; agentId: string; toolName: string; input: unknown; id: string }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      const steps = workflowStepsRef.current
      const step = steps[data.stepIndex]
      const agentName = step?.agentName ?? `Agent ${data.stepIndex + 1}`

      // Collect for step history
      const stepMsgs = workflowStepMsgsRef.current.get(data.stepIndex) ?? []
      stepMsgs.push({ id: data.id, role: 'tool', content: data.toolName, toolUse: { toolName: data.toolName, input: data.input }, timestamp: new Date() })
      workflowStepMsgsRef.current.set(data.stepIndex, stepMsgs)

      setWorkflowLog((prev) => [
        ...prev,
        {
          id: data.id,
          type: 'step_tool_use' as const,
          content: data.toolName,
          agentName,
          stepIndex: data.stepIndex,
          toolUse: { toolName: data.toolName, input: data.input, id: data.id },
          timestamp: new Date(),
        },
      ])
    })

    // Tool result — update matching tool_use entry with output
    socket.on('chain:step_tool_result', (data: { chainId: string; stepIndex: number; agentId: string; toolName: string; output: unknown; toolUseId: string }) => {
      if (data.chainId !== workflowChainIdRef.current) return

      // Update step history tool message
      const stepMsgs = workflowStepMsgsRef.current.get(data.stepIndex) ?? []
      const toolMsg = stepMsgs.find((m) => m.role === 'tool' && m.id === data.toolUseId)
      if (toolMsg?.toolUse) {
        toolMsg.toolUse.output = data.output
      }

      setWorkflowLog((prev) => {
        const toolIdx = prev.findIndex(
          (e) => e.type === 'step_tool_use' && e.toolUse?.id === data.toolUseId,
        )
        if (toolIdx < 0) return prev

        const existing = prev[toolIdx]!
        return [
          ...prev.slice(0, toolIdx),
          {
            ...existing,
            toolUse: { ...existing.toolUse!, output: data.output },
          },
          ...prev.slice(toolIdx + 1),
        ]
      })
    })

    // Per-step usage — store on a ref so step_complete can include it,
    // and also increment the global session token counter in the bottom bar.
    socket.on('chain:step_usage', (data: { chainId: string; stepIndex: number; agentId: string; usage: import('@orchestra/shared').TokenUsage }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      workflowStepUsageRef.current.set(data.stepIndex, data.usage)
      const total = (data.usage?.inputTokens ?? 0) + (data.usage?.outputTokens ?? 0)
      addTokensRef.current(total)
    })

    socket.on('chain:step_complete', (data: { chainId: string; stepIndex: number; agentId: string; output: string }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      const steps = workflowStepsRef.current
      const step = steps[data.stepIndex]
      const agentName = step?.agentName ?? `Agent ${data.stepIndex + 1}`
      const usage = workflowStepUsageRef.current.get(data.stepIndex)

      // Mark agent as completed in chain visual state
      setNodes((prev) => prev.map((n) => {
        if (n.type !== 'agent' || n.id !== data.agentId) return n
        return { ...n, data: { ...(n.data as import('@/lib/canvas-utils').AgentNodeData), chainState: 'completed' } }
      }))

      setWorkflowLog((prev) => {
        // Mark the step_start entry as completed and remove duplicates
        const updated = prev
          .filter((entry) => {
            // Remove previous step_complete for this step (retry case)
            if (entry.type === 'step_complete' && entry.stepIndex === data.stepIndex) return false
            // Remove step_text for this step (output already shown in step_complete)
            if (entry.type === 'step_text' && entry.stepIndex === data.stepIndex) return false
            return true
          })
          .map((entry) =>
            entry.type === 'step_start' && entry.stepIndex === data.stepIndex
              ? { ...entry, completed: true }
              : entry,
          )
        return [
          ...updated,
          {
            id: crypto.randomUUID(),
            type: 'step_complete' as const,
            content: data.output,
            agentName,
            stepIndex: data.stepIndex,
            usage,
            timestamp: new Date(),
          },
        ]
      })
      // Update canvas node status back to idle
      setNodes((prev) => prev.map((n) =>
        n.id === data.agentId ? { ...n, data: { ...n.data, status: 'idle' } } : n,
      ))
      // Build definitive step history from the complete output
      const stepMsgs = workflowStepMsgsRef.current.get(data.stepIndex) ?? []
      const finalMsgs = [
        ...stepMsgs.filter((m) => m.role === 'tool'),
        ...(data.output ? [{ id: crypto.randomUUID(), role: 'assistant' as const, content: data.output, timestamp: new Date() }] : []),
      ]
      workflowStepMsgsRef.current.set(data.stepIndex, finalMsgs)
      // Auto-inject into agent chat cache so opening the agent
      // from canvas/sidebar shows the workflow history immediately
      if (finalMsgs.length > 0) {
        injectMessagesIntoCache(data.agentId, finalMsgs, usage)
      }
    })

    socket.on('chain:complete', (data: { chainId: string; totalSteps: number }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      setWorkflowRunning(false)
      setWorkflowStep(null)
      setMaestroStatus('idle')
      setMaestroLastAction(null)
      setPlannerStatus('idle')

      // Clear chain visual states after a delay (keep completed checkmarks visible briefly)
      setTimeout(() => {
        setNodes((prev) => prev.map((n) => {
          if (n.type !== 'agent') return n
          const nd = n.data as import('@/lib/canvas-utils').AgentNodeData
          if (nd.chainState) {
            return { ...n, data: { ...nd, chainState: undefined } }
          }
          return n
        }))
      }, 3000)
      lastCompletedChainIdRef.current = data.chainId

      // Calculate total usage across all steps
      let totalIn = 0
      let totalOut = 0
      let totalCost = 0
      workflowStepUsageRef.current.forEach((u) => {
        totalIn += u.inputTokens
        totalOut += u.outputTokens
        totalCost += u.estimatedCostUsd ?? 0
      })
      const totalUsage = totalIn > 0 ? { inputTokens: totalIn, outputTokens: totalOut, estimatedCostUsd: totalCost } : undefined
      workflowStepUsageRef.current.clear()
      workflowStepTextRef.current.clear()

      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'chain_complete' as const,
          content: `Completed ${data.totalSteps} steps`,
          usage: totalUsage,
          timestamp: new Date(),
        },
      ])
    })

    socket.on('chain:error', (data: { chainId: string; stepIndex: number; error: string }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      const steps = workflowStepsRef.current
      const step = steps[data.stepIndex]
      const agentName = step?.agentName ?? `Agent ${data.stepIndex + 1}`

      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'error' as const,
          content: `${agentName}: ${data.error}`,
          timestamp: new Date(),
        },
      ])
    })

    // Maestro events
    socket.on('chain:maestro_decision', (data) => {
      if (data.chainId !== workflowChainIdRef.current) return

      // Detect "thinking" vs actual decision
      const isThinking = data.reasoning === 'Evaluating step output...'
      if (isThinking) {
        setMaestroStatus('thinking')
        return
      }

      // Update canvas-level maestro status
      setMaestroStatus('decided')
      setMaestroLastAction(data.action)
      setMaestroLastTargetAgent(data.targetAgentName || null)
      // Reset to idle after a moment so the badge fades
      setTimeout(() => {
        setMaestroStatus('idle')
        setMaestroLastAction(null)
        setMaestroLastTargetAgent(null)
      }, 4000)

      // Replace any existing "thinking" entry with the actual decision
      setWorkflowLog((prev) => {
        const withoutThinking = prev.filter((e) => e.type !== 'maestro_thinking')
        const entryType: WorkflowLogEntry['type'] = 'maestro_decision'
        return [
          ...withoutThinking,
          {
            id: crypto.randomUUID(),
            type: entryType,
            content: data.reasoning,
            maestroAction: data.action,
            timestamp: new Date(),
          },
        ]
      })
    })

    socket.on('chain:maestro_redirect_request', (data) => {
      if (data.chainId !== workflowChainIdRef.current) return

      const entryType: WorkflowLogEntry['type'] = 'maestro_redirect_request'
      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: entryType,
          content: data.reasoning,
          agentName: data.toAgent,
          requestId: data.requestId,
          timestamp: new Date(),
        },
      ])
    })

    // Planner events
    socket.on('chain:planner_start', (data: { chainId: string }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      setPlannerStatus('planning')
      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'system' as const,
          content: 'Planner is analyzing the workflow...',
          timestamp: new Date(),
        },
      ])
    })

    socket.on('chain:planner_result', (data: { chainId: string; plan: any }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      setPlannerStatus('done')
      const plan = data.plan
      const changesCount = (plan?.agentChanges?.length ?? 0) + (plan?.edgeChanges?.length ?? 0)
      const summary = changesCount > 0
        ? `Planner suggests ${changesCount} change${changesCount > 1 ? 's' : ''}: ${plan.analysis}`
        : `Planner approved the workflow: ${plan.analysis}`
      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'system' as const,
          content: summary,
          timestamp: new Date(),
        },
      ])
    })

    socket.on('chain:planner_error', (data: { chainId: string; error: string }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      setPlannerStatus('idle')
      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'error' as const,
          content: `Planner error: ${data.error}`,
          timestamp: new Date(),
        },
      ])
    })

    // Advisor events
    socket.on('advisor:analyzing', (data) => {
      if (data.chainId !== lastCompletedChainIdRef.current) return
      setAdvisorRunning(true)
      setWorkflowChatOpen(true)
      const entryType: WorkflowLogEntry['type'] = 'advisor_analyzing'
      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: entryType,
          content: 'Analyzing workflow run...',
          timestamp: new Date(),
        },
      ])
    })

    socket.on('advisor:result', (data) => {
      if (data.chainId !== lastCompletedChainIdRef.current) return
      setAdvisorRunning(false)
      setWorkflowChatOpen(true)
      const entryType: WorkflowLogEntry['type'] = 'advisor_result'
      setWorkflowLog((prev) => {
        const withoutAnalyzing = prev.filter((e) => e.type !== 'advisor_analyzing')
        return [
          ...withoutAnalyzing,
          {
            id: crypto.randomUUID(),
            type: entryType,
            content: data.result.overallAssessment,
            advisorResult: data.result,
            timestamp: new Date(),
          },
        ]
      })
    })

    socket.on('advisor:error', (data) => {
      if (data.chainId !== lastCompletedChainIdRef.current) return
      setAdvisorRunning(false)
      setWorkflowLog((prev) => {
        const withoutAnalyzing = prev.filter((e) => e.type !== 'advisor_analyzing')
        return [
          ...withoutAnalyzing,
          {
            id: crypto.randomUUID(),
            type: 'error' as const,
            content: `Advisor analysis failed: ${data.error}`,
            timestamp: new Date(),
          },
        ]
      })
    })

    // Listen for executor-level errors (e.g. agent not found, chain execution failed)
    // These are emitted as 'agent:error' by the backend when the whole chain fails
    socket.on('agent:error', (data: { agentId: string; sessionId: string; error: string; type: string }) => {
      // Match by chainId (stored in agentId field for chain-level errors)
      if (data.agentId !== workflowChainIdRef.current) return

      setWorkflowRunning(false)
      setWorkflowStep(null)
      setWorkflowLog((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'error' as const,
          content: data.error,
          timestamp: new Date(),
        },
      ])
    })
  }, [])

  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDelete: handleDelete,
    onSelectAll: handleSelectAll,
    onCommandPalette: handleCommandPalette,
    onCreateAgent: handleCreateAgent,
    onToggleMarketplace: handleToggleMarketplace,
    onToggleShortcuts: handleToggleShortcuts,
    onEscape: handleEscape,
    onQuickRun: handleQuickRun,
  })

  // ── Node double-click → open AgentChat ────────────────────────────────

  const handleNodeDoubleClick = useCallback(
    (nodeId: string, nodeType: string) => {
      if (nodeType === 'resource') {
        openPanel({ type: 'resource-browser' })
        return
      }
      if (nodeType === 'skill') {
        openPanel({ type: 'skill-marketplace' })
        return
      }
      if (nodeType === 'policy') {
        openPanel({ type: 'safety' })
        return
      }
      if (nodeType === 'mcp') {
        openPanel({ type: 'mcp-management' })
        return
      }

      if (nodeType !== 'agent') return

      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      const data = node.data as AgentNodeData
      setSelectedAgent({
        id: nodeId,
        name: data.name,
        description: data.description,
        purpose: data.purpose,
        status: data.status,
        model: data.model,
      })
      openPanel({ type: 'agent-chat', agentId: selectedAgent?.id ?? '' })
    },
    [nodes],
  )

  const handleChatClose = useCallback(() => {
    closePanel()
  }, [])

  // ── Approval dialog ────────────────────────────────────────────────────

  const handleApprovalDialogChange = useCallback(
    (open: boolean) => {
      if (!open) dismissDialog()
    },
    [dismissDialog],
  )

  const handleReviewApproval = useCallback((_notification: OrchestraNotification) => {
    void _notification
  }, [])

  const approvalDialogData = currentApproval
    ? {
        id: currentApproval.id,
        agentId: currentApproval.agentId,
        agentName: currentApproval.agentName,
        command: currentApproval.command,
        description: currentApproval.description,
        toolName: currentApproval.toolName,
      }
    : null

  // ── MCP server CRUD ────────────────────────────────────────────────────

  const handleMcpAdd = useCallback((server: Omit<McpServer, 'id'>) => {
    setMcpServers((prev) => [...prev, { ...server, id: crypto.randomUUID() }])
  }, [])

  const handleMcpEdit = useCallback((id: string, updates: Omit<McpServer, 'id'>) => {
    setMcpServers((prev) =>
      prev.map((s) => (s.id === id ? { ...updates, id } : s)),
    )
  }, [])

  const handleMcpDelete = useCallback((id: string) => {
    setMcpServers((prev) => prev.filter((s) => s.id !== id))
  }, [])

  // ── Chain execution ────────────────────────────────────────────────────

  const handleChainExecute = useCallback(
    (steps: readonly ChainStep[], conditionalEdges: readonly ConditionalEdge[]) => {
      void steps
      void conditionalEdges
    },
    [],
  )

  // ── PRD pipeline ──────────────────────────────────────────────────────

  const handlePrdStart = useCallback((prd: PrdData) => {
    void prd
  }, [])

  // ── Canvas nodes/edges sync ───────────────────────────────────────────

  // Auto-save canvas on any change (debounced in the hook)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  useEffect(() => {
    if (!canvasLoaded || nodes.length === 0) return
    saveCanvas(nodes, edges)
  }, [nodes, edges, canvasLoaded, saveCanvas])

  const handleNodesChange = useCallback((updated: Node[]) => {
    // Detect removed nodes and clean up edges + DB
    setNodes((prev) => {
      const removedIds = new Set(
        prev.filter((n) => !updated.some((u) => u.id === n.id)).map((n) => n.id),
      )
      if (removedIds.size > 0) {
        // Remove edges connected to deleted nodes
        setEdges((prevEdges) =>
          prevEdges.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target)),
        )
        // Best-effort DB cleanup for agent nodes
        for (const id of removedIds) {
          void apiDelete(`/api/agents/${id}`).catch(() => {})
        }
      }
      return updated
    })
  }, [])

  return (
    <ComplexityContext.Provider value={complexity}>
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar
        notifications={notifications}
        unreadCount={unreadCount}
        onAcknowledge={acknowledge}
        onAcknowledgeAll={acknowledgeAll}
        onRemoveNotification={removeNotification}
        onReviewApproval={handleReviewApproval}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onHomeClick={() => setShowHome(true)}
        onWorkspaceClick={goToWorkspace}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        onRenameWorkspace={handleRenameWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
        onDiscussionsClick={handleTopBarDiscussionsClick}
        onHistoryClick={handleTopBarHistoryClick}
        onSettingsClick={handleSettingsClick}
        activeTab={activeTab}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          favorites={favoriteAgents}
          onSelectFavorite={handleSelectFavorite}
          onHomeClick={() => setShowHome(true)}
          onCreateAgent={handleCreateAgent}
          onAssistantsClick={handleAssistantsClick}
          onSkillsClick={handleToggleMarketplace}
          onSafetyClick={handleSafetyClick}
          onDiscussionsClick={handleSidebarDiscussionsClick}
          onConnectionsClick={handleConnectionsClick}
          onResourcesClick={handleResourcesClick}
          onActivityClick={handleActivityClick}
          onPlanClick={handlePlanClick}
          onGitClick={handleGitClick}
          onSchedulesClick={() => openPanel({ type: 'schedules' })}
          onSettingsClick={() => openPanel({ type: 'settings' })}
          onCommandPalette={() => setCommandPaletteOpen(true)}
        />
        <main className="relative flex-1 overflow-hidden">
          <ErrorBoundary>
            <div
              className={showCanvas ? 'h-full w-full' : 'hidden'}
              aria-hidden={!showCanvas}
            >
              <WorkflowToolbar
                hasChain={hasAgentChain(nodes, edges)}
                isRunning={workflowRunning}
                currentStep={workflowStep}
                onRun={(message) => { handleRunWorkflow(message); setWorkflowChatOpen(true) }}
                onStop={handleStopWorkflow}
                chatOpen={workflowChatOpen}
                onToggleChat={() => setWorkflowChatOpen((prev) => !prev)}
                maestroEnabled={maestroEnabled}
                maestroStatus={maestroStatus}
                maestroLastAction={maestroLastAction}
                maestroLastTargetAgent={maestroLastTargetAgent}
                onMaestroToggle={() => setMaestroEnabled((prev) => !prev)}
                advisorVisible={!!lastCompletedChainIdRef.current && !workflowRunning}
                advisorRunning={advisorRunning}
                onAdvisorClick={() => handleAdvisorRequest(advisorModel)}
                plannerEnabled={plannerEnabled}
                plannerStatus={plannerStatus}
                onPlannerToggle={() => setPlannerEnabled((prev) => !prev)}
                lastMessage={workflowLog.find((e) => e.type === 'user')?.content}
              />
              <OrchestraCanvas
                initialNodes={nodes}
                initialEdges={edges}
                onNodesChange={handleNodesChange}
                onUndoRedoReady={handleUndoRedoReady}
                onViewReady={handleViewReady}
                onNodeDoubleClick={handleNodeDoubleClick}
                onZoomChange={setZoomLevel}
                activeAgentIds={activeAgentIds}
              />
            </div>

            {!showCanvas && (
              <CanvasPlaceholder
                onCreateAssistant={() => { setShowHome(false); handleCreateAgent() }}
                onStartDiscussion={() => { setShowHome(false); handleSidebarDiscussionsClick() }}
                onUseTemplate={() => { setShowHome(false); handleUseTemplate() }}
                onExploreSkills={() => { setShowHome(false); handleToggleMarketplace() }}
                onDescribe={(desc) => { setShowHome(false); handleDescribe(desc) }}
                onGoToWorkspace={goToWorkspace}
                hasExistingCanvas={savedNodes.length > 0}
                isGenerating={isGenerating}
              />
            )}
          </ErrorBoundary>
        </main>
      </div>

      <BottomBar
        connected={connected}
        connecting={connecting}
        socketError={socketError}
        runningAgentCount={runningAgentCount}
        sessionTokens={sessionTokens}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
      />

      <ShortcutOverlay
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

      {/* Assistants List */}
      <ErrorBoundary>
        <AssistantsList
          open={isOpen('assistants-list')}
          onOpenChange={(open) => open ? openPanel({ type: 'assistants-list' }) : closePanel()}
          assistants={nodes
            .filter((n) => n.type === 'agent')
            .map((n) => {
              const d = n.data as AgentNodeData
              return { id: n.id, name: d.name, description: d.description, status: d.status, model: d.model, purpose: d.purpose }
            })}
          onSelect={handleSelectAssistant}
          onCreateNew={handleCreateAgent}
          onDelete={handleDeleteAssistant}
        />
      </ErrorBoundary>

      {/* Global Safety Panel */}
      <ErrorBoundary>
        <GlobalSafetyPanel
          open={isOpen('safety')}
          onOpenChange={(open) => open ? openPanel({ type: 'safety' }) : closePanel()}
        />
      </ErrorBoundary>

      {/* Settings Panel */}
      <ErrorBoundary>
        <SettingsPanel
          open={isOpen('settings')}
          onOpenChange={(open) => { if (!open) { closePanel(); refreshComplexity() } }}
        />
      </ErrorBoundary>

      {/* Resource Browser */}
      <ErrorBoundary>
        <ResourceBrowser
          open={isOpen('resource-browser')}
          onOpenChange={(open) => open ? openPanel({ type: 'resource-browser' }) : closePanel()}
          workspaceId={activeWorkspaceId || null}
        />
      </ErrorBoundary>

      {/* Discussions List */}
      <ErrorBoundary>
        <DiscussionsList
          open={isOpen('discussions-list')}
          onOpenChange={(open) => {
            if (open) openPanel({ type: 'discussions-list' }); else closePanel()
            if (!open && activeTab === 'discussions') setActiveTab('workspace')
          }}
          discussions={discussions}
          onSelectDiscussion={handleSelectDiscussionFromList}
          onNewDiscussion={() => {
            /* discussions closed by panel switch */
            setDiscussionWizardOpen(true)
          }}
        />
      </ErrorBoundary>

      {/* History Panel */}
      <ErrorBoundary>
        <HistoryPanel
          open={isOpen('history')}
          onOpenChange={(open) => {
            if (open) openPanel({ type: 'history' }); else closePanel()
            if (!open && activeTab === 'history') setActiveTab('workspace')
          }}
        />
      </ErrorBoundary>

      {/* Skill Marketplace */}
      <ErrorBoundary>
        <SkillMarketplace
          open={isOpen('skill-marketplace')}
          onOpenChange={(open) => open ? openPanel({ type: 'skill-marketplace' }) : closePanel()}
        />
      </ErrorBoundary>

      {/* MCP Management */}
      <ErrorBoundary>
        <McpManagement
          open={isOpen('mcp-management')}
          onOpenChange={(open) => open ? openPanel({ type: 'mcp-management' }) : closePanel()}
          servers={mcpServers}
          onAdd={handleMcpAdd}
          onEdit={handleMcpEdit}
          onDelete={handleMcpDelete}
        />
      </ErrorBoundary>

      {/* Chain Config */}
      <ErrorBoundary>
        <ChainConfig
          open={isOpen('chain-config')}
          onOpenChange={(open) => open ? openPanel({ type: 'chain-config' }) : closePanel()}
          nodes={nodes}
          edges={edges}
          onExecute={handleChainExecute}
        />
      </ErrorBoundary>

      {/* PRD Editor */}
      <ErrorBoundary>
        <PrdEditor
          open={isOpen('prd-editor')}
          onOpenChange={(open) => open ? openPanel({ type: 'prd-editor' }) : closePanel()}
          onStartPipeline={handlePrdStart}
        />
      </ErrorBoundary>

      {/* AgentChat */}
      <Sheet open={isOpen('agent-chat')} onOpenChange={(open) => open ? openPanel({ type: 'agent-chat', agentId: selectedAgent?.id ?? '' }) : closePanel()}>
        <SheetContent
          side="right"
          className="flex w-[420px] flex-col gap-0 p-0 sm:w-[500px] [&>button.absolute]:hidden"
        >
          <SheetTitle className="sr-only">
            {selectedAgent ? `Chat with ${selectedAgent.name}` : 'Agent chat'}
          </SheetTitle>
          <ErrorBoundary>
            {selectedAgent ? (
              <AgentChat
                agentId={selectedAgent.id}
                agentName={selectedAgent.name}
                agentDescription={selectedAgent.description}
                agentPurpose={selectedAgent.purpose}
                agentStatus={selectedAgent.status}
                agentModel={selectedAgent.model}
                workspaceId={activeWorkspaceId || null}
                onEdit={() => {
                  closePanel()
                  openPanel({ type: 'agent-drawer', agentId: selectedAgent?.id ?? '' })
                }}
                onManageResources={() => {
                  openPanel({ type: 'resource-browser' })
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select an assistant to start chatting
              </div>
            )}
          </ErrorBoundary>
        </SheetContent>
      </Sheet>

      {/* Agent Drawer (edit) */}
      <ErrorBoundary>
        <AgentDrawer
          agent={selectedAgent ? ({
            id: selectedAgent.id,
            name: selectedAgent.name,
            avatar: null,
            description: selectedAgent.description ?? null,
            persona: '',
            purpose: selectedAgent.purpose ?? null,
            scope: [],
            allowedTools: [],
            memoryEnabled: false,
            model: selectedAgent.model ?? null,
            status: selectedAgent.status,
            permissionMode: 'default' as const,
            loopEnabled: false,
            loopCriteria: null,
            maxIterations: 10,
            teamEnabled: false,
            isFavorite: false,
            canvasX: 0,
            canvasY: 0,
            createdAt: '',
            updatedAt: '',
          } as any) : null}
          open={isOpen('agent-drawer')}
          onOpenChange={(open) => open ? openPanel({ type: 'agent-drawer', agentId: selectedAgent?.id ?? '' }) : closePanel()}
          onSave={(updates) => {
            if (!selectedAgent) return
            setNodes((prev) => prev.map((n) =>
              n.id === selectedAgent.id
                ? { ...n, data: { ...n.data, ...updates } }
                : n,
            ))
            closePanel()
          }}
          onOpenMarketplace={() => {
            closePanel()
            openPanel({ type: 'skill-marketplace' })
          }}
        />
      </ErrorBoundary>

      {/* Approval Dialog */}
      <ErrorBoundary>
        <ApprovalDialog
          open={showApprovalDialog}
          onOpenChange={handleApprovalDialogChange}
          approval={approvalDialogData}
          onApprove={approve}
          onReject={reject}
        />
      </ErrorBoundary>

      {/* Discussion Wizard */}
      <ErrorBoundary>
        <DiscussionWizard
          open={discussionWizardOpen}
          onOpenChange={setDiscussionWizardOpen}
          agents={discussionAgents}
          onCreate={handleDiscussionCreate}
        />
      </ErrorBoundary>

      {/* Agent Create Dialog */}
      <ErrorBoundary>
        <AgentCreateDialog
          open={createAgentOpen}
          onOpenChange={setCreateAgentOpen}
          onCreate={handleAgentCreated}
        />
      </ErrorBoundary>

      {/* Template Gallery */}
      <ErrorBoundary>
        <TemplateGallery
          open={templateGalleryOpen}
          onOpenChange={setTemplateGalleryOpen}
          onSelectTemplate={handleTemplateSelected}
        />
      </ErrorBoundary>

      {/* Schedules Panel */}
      <SchedulesPanel open={isOpen('schedules')} onOpenChange={(open) => open ? openPanel({ type: 'schedules' }) : closePanel()} />

      {/* Workflow Review Dialog */}
      <WorkflowReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        workflow={generatedWorkflow}
        onConfirm={materializeWorkflow}
        onSaveAsTemplate={async (wf) => {
          try {
            await apiPost('/api/saved-workflows', {
              name: wf.name,
              description: `Generated workflow with ${wf.agents.length} agents`,
              workflow: wf,
            })
          } catch { /* best-effort */ }
        }}
      />

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onCommand={handleCommand}
      />

      {/* Discussion Panel */}
      <ErrorBoundary>
        <DiscussionPanel
          open={isOpen('discussion-panel')}
          onOpenChange={(open) => open ? openPanel({ type: 'discussion-panel', discussionId: selectedDiscussion?.id ?? '' }) : closePanel()}
          discussion={selectedDiscussion}
        />
      </ErrorBoundary>

      {/* Quick Run Bar (Cmd+Shift+R) */}
      <QuickRunBar
        open={quickRunOpen}
        agents={nodes
          .filter((n) => n.type === 'agent')
          .map((n) => {
            const d = n.data as AgentNodeData
            return { id: n.id, name: d.name, description: d.description }
          })}
        onClose={() => setQuickRunOpen(false)}
        onRun={(agentId, message) => {
          const node = nodes.find((n) => n.id === agentId)
          if (!node) return
          const d = node.data as AgentNodeData
          setSelectedAgent({
            id: agentId,
            name: d.name,
            description: d.description,
            purpose: d.purpose,
            status: d.status,
            model: d.model,
          })
          openPanel({ type: 'agent-chat', agentId: selectedAgent?.id ?? '' })
        }}
      />

      {/* Activity Feed */}
      <Sheet open={isOpen('activity')} onOpenChange={(open) => open ? openPanel({ type: 'activity' }) : closePanel()}>
        <SheetContent side="right" className="w-[400px] p-0 sm:w-[400px]">
          <SheetTitle className="border-b border-border px-4 py-3 text-sm font-semibold">
            Activity
          </SheetTitle>
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 48px)' }}>
            <ActivityFeed workspaceId={activeWorkspaceId || null} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Workspace Context Editor */}
      <Sheet open={isOpen('context-editor')} onOpenChange={(open) => open ? openPanel({ type: 'context-editor' }) : closePanel()}>
        <SheetContent side="right" className="w-[500px] p-0 sm:w-[500px]">
          <SheetTitle className="border-b border-border px-4 py-3 text-sm font-semibold">
            Workspace Context
          </SheetTitle>
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 48px)' }}>
            {activeWorkspaceId ? (
              <WorkspaceContextEditor workspaceId={activeWorkspaceId} />
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Select a workspace first
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cost Dashboard */}
      <Sheet open={isOpen('cost-dashboard')} onOpenChange={(open) => open ? openPanel({ type: 'cost-dashboard' }) : closePanel()}>
        <SheetContent side="right" className="w-[450px] p-0 sm:w-[450px]">
          <SheetTitle className="border-b border-border px-4 py-3 text-sm font-semibold">
            Cost Dashboard
          </SheetTitle>
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 48px)' }}>
            <CostDashboard />
          </div>
        </SheetContent>
      </Sheet>
      {/* Maestro Drawer */}
      <Sheet open={isOpen('maestro-drawer')} onOpenChange={(open) => open ? openPanel({ type: 'maestro-drawer' }) : closePanel()}>
        <SheetContent
          side="right"
          className="flex w-[380px] flex-col gap-0 p-0 sm:w-[400px] [&>button.absolute]:hidden"
        >
          <SheetTitle className="sr-only">Maestro Settings</SheetTitle>
          <MaestroDrawer
            enabled={maestroEnabled}
            rigor={maestroRigor}
            customInstructions={maestroCustomInstructions}
            onToggle={setMaestroEnabled}
            onRigorChange={setMaestroRigor}
            onCustomInstructionsChange={setMaestroCustomInstructions}
          />
        </SheetContent>
      </Sheet>

      {/* Workflow Chat */}
      <Sheet open={workflowChatOpen} onOpenChange={setWorkflowChatOpen}>
        <SheetContent
          side="right"
          className="flex w-[420px] flex-col gap-0 p-0 sm:w-[480px] [&>button.absolute]:hidden"
        >
          <SheetTitle className="sr-only">Workflow Chat</SheetTitle>
          <WorkflowChat
            steps={buildChain(nodes, edges)}
            isRunning={workflowRunning}
            log={workflowLog}
            mode={workflowMode}
            hasWorkspace={!!activeWorkspaceId}
            maestroEnabled={maestroEnabled}
            onMaestroToggle={setMaestroEnabled}
            onMaestroRedirectRespond={handleMaestroRedirectRespond}
            hasCompletedRun={!!lastCompletedChainIdRef.current}
            advisorRunning={advisorRunning}
            advisorModel={advisorModel}
            onAdvisorRequest={handleAdvisorRequest}
            onAdvisorModelChange={setAdvisorModel}
            onApplySkill={handleApplySkill}
            onUpdatePersona={handleUpdatePersona}
            onSaveOutput={handleSaveWorkflowOutput}
            workingDirectory={workspaceWorkingDir}
            onWorkingDirectoryChange={(dir) => void handleWorkingDirectoryChange(dir)}
            onSendMessage={handleWorkflowSendMessage}
            onRun={handleRunWorkflow}
            onStop={handleStopWorkflow}
            onModeChange={setWorkflowMode}
            onClearLog={handleClearWorkflowLog}
            onStepClick={(stepIndex) => {
              const steps = workflowStepsRef.current
              const step = steps[stepIndex]
              if (!step) return
              const msgs = workflowStepMsgsRef.current.get(stepIndex) ?? []
              if (msgs.length === 0) {
                // Show feedback — no history available yet
                setWorkflowLog((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    type: 'system' as const,
                    content: `No conversation history available for ${step.agentName} yet.`,
                    timestamp: new Date(),
                  },
                ])
                return
              }
              // Close workflow chat and open agent chat with step history
              setWorkflowChatOpen(false)
              injectMessagesIntoCache(step.nodeId, msgs)
              setSelectedAgent({
                id: step.nodeId,
                name: step.agentName,
                status: 'idle' as AgentStatus,
                model: step.model,
              })
              // Small delay for Sheet transition
              setTimeout(() => openPanel({ type: 'agent-chat', agentId: selectedAgent?.id ?? '' }), 200)
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Workspace Plan Editor */}
      <Sheet open={isOpen('plan-editor')} onOpenChange={(open) => open ? openPanel({ type: 'plan-editor' }) : closePanel()}>
        <SheetContent side="right" className="w-[500px] p-0 sm:w-[500px]">
          <SheetTitle className="border-b border-border px-4 py-3 text-sm font-semibold">
            Workspace Plan
          </SheetTitle>
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 48px)' }}>
            {activeWorkspaceId ? (
              <WorkspacePlanEditor workspaceId={activeWorkspaceId} />
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Select a workspace first
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Git Panel */}
      <GitPanel key={`git-${activeWorkspaceId}-${workspaceWorkingDir}`} open={isOpen('git')} onOpenChange={(open) => open ? openPanel({ type: 'git' }) : closePanel()} workspaceId={activeWorkspaceId} />
    </div>
    </ComplexityContext.Provider>
  )
}
