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
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [discussionWizardOpen, setDiscussionWizardOpen] = useState(false)
  const [selectedDiscussion, setSelectedDiscussion] = useState<DiscussionTable | null>(null)
  const [discussionPanelOpen, setDiscussionPanelOpen] = useState(false)

  // New panel states
  const [resourceBrowserOpen, setResourceBrowserOpen] = useState(false)
  const [assistantsListOpen, setAssistantsListOpen] = useState(false)
  const [safetyPanelOpen, setSafetyPanelOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [discussionsListOpen, setDiscussionsListOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TopBarTab>('workspace')

  // All discussions created during this session (local state)
  const [discussions, setDiscussions] = useState<DiscussionTable[]>([])

  // MCP management state
  const [mcpManagementOpen, setMcpManagementOpen] = useState(false)
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])

  // Chain config state
  const [chainConfigOpen, setChainConfigOpen] = useState(false)

  // PRD editor state
  const [prdEditorOpen, setPrdEditorOpen] = useState(false)

  const [quickRunOpen, setQuickRunOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [contextEditorOpen, setContextEditorOpen] = useState(false)
  const [costDashboardOpen, setCostDashboardOpen] = useState(false)
  const [planEditorOpen, setPlanEditorOpen] = useState(false)
  const [gitPanelOpen, setGitPanelOpen] = useState(false)
  const [workflowRunning, setWorkflowRunning] = useState(false)
  const [workflowStep, setWorkflowStep] = useState<{ index: number; total: number; agentName: string } | null>(null)
  const [workflowChatOpen, setWorkflowChatOpen] = useState(false)
  const [workflowLog, setWorkflowLog] = useState<WorkflowLogEntry[]>([])
  const [workflowMode, setWorkflowMode] = useState<import('@orchestra/shared').AgentMode>('default')
  const [workspaceWorkingDir, setWorkspaceWorkingDir] = useState<string | null>(null)
  const [createAgentOpen, setCreateAgentOpen] = useState(false)
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

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
    setChatOpen(true)
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

  const { sessionTokens, activeAgentIds } = useAgentStatus(handleAgentStatusChange)

  const handleSettingsClose = useCallback((open: boolean) => {
    setSettingsOpen(open)
    if (!open) refreshComplexity()
  }, [refreshComplexity])

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

  const handleDescribe = useCallback(async (description: string) => {
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
  }, [])

  const handleToggleMarketplace = useCallback(() => {
    setMarketplaceOpen((prev) => !prev)
  }, [])

  // Sidebar "Discussions" → open DiscussionWizard directly (no list needed from sidebar)
  const handleSidebarDiscussionsClick = useCallback(() => {
    setDiscussionWizardOpen(true)
  }, [])

  // TopBar "Discussions" tab → open the list panel
  const handleTopBarDiscussionsClick = useCallback(() => {
    setActiveTab('discussions')
    setDiscussionsListOpen(true)
    setHistoryOpen(false)
  }, [])

  // TopBar "History" tab → open history panel
  const handleTopBarHistoryClick = useCallback(() => {
    setActiveTab('history')
    setHistoryOpen(true)
    setDiscussionsListOpen(false)
  }, [])

  // TopBar "Settings" gear → open settings panel
  const handleSettingsClick = useCallback(() => {
    setSettingsOpen(true)
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

  const handleCreateWorkspace = useCallback(async (name: string) => {
    if (nodes.length > 0) saveCanvas(nodes, edges)
    await createWorkspace(name)
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
    setResourceBrowserOpen(true)
  }, [])

  const handleAssistantsClick = useCallback(() => {
    setAssistantsListOpen(true)
  }, [])

  const handleSafetyClick = useCallback(() => {
    setSafetyPanelOpen(true)
  }, [])

  const handleSelectAssistant = useCallback((assistant: AssistantSummary) => {
    setAssistantsListOpen(false)
    setSelectedAgent({
      id: assistant.id,
      name: assistant.name,
      status: assistant.status,
      model: assistant.model,
    })
    setChatOpen(true)
  }, [])

  const handleDeleteAssistant = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id))
    // Also delete from DB
    void apiDelete(`/api/agents/${id}`).catch(() => {})
  }, [])

  const handleConnectionsClick = useCallback(() => {
    setMcpManagementOpen(true)
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
    setDiscussionPanelOpen(true)
  }, [])

  const handleSelectDiscussionFromList = useCallback((discussion: DiscussionTable) => {
    setSelectedDiscussion(discussion)
    setDiscussionPanelOpen(true)
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
    setChatOpen(false)
    setMarketplaceOpen(false)
    setDiscussionWizardOpen(false)
    setDiscussionPanelOpen(false)
    setMcpManagementOpen(false)
    setChainConfigOpen(false)
    setPrdEditorOpen(false)
    setSettingsOpen(false)
    setDiscussionsListOpen(false)
    setHistoryOpen(false)
    setAssistantsListOpen(false)
    setSafetyPanelOpen(false)
    setResourceBrowserOpen(false)
    setQuickRunOpen(false)
    setActivityOpen(false)
    setContextEditorOpen(false)
    setCostDashboardOpen(false)
    setPlanEditorOpen(false)
    setWorkflowChatOpen(false)
    setGitPanelOpen(false)
    setNodes((prev) =>
      prev.map((n) => ({ ...n, selected: false })),
    )
  }, [])

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
      default: break
    }
  }, [handleCreateAgent, handleToggleMarketplace, handleTopBarDiscussionsClick, handleToggleShortcuts, handleUseTemplate])

  const handleQuickRun = useCallback(() => {
    setQuickRunOpen((prev) => !prev)
  }, [])

  const handleActivityClick = useCallback(() => {
    setActivityOpen(true)
  }, [])

  const handleContextEditorClick = useCallback(() => {
    setContextEditorOpen(true)
  }, [])

  const handleCostDashboardClick = useCallback(() => {
    setCostDashboardOpen(true)
  }, [])

  const handlePlanClick = useCallback(() => {
    setPlanEditorOpen(true)
  }, [])

  const handleGitClick = useCallback(() => {
    setGitPanelOpen(true)
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

    sock.emit('chain:execute', {
      chainId,
      definition,
      initialMessage: message,
      workspaceId: activeWorkspaceId ?? undefined,
    })
  }, [nodes, edges, workflowMode, activeWorkspaceId])

  const handleStopWorkflow = useCallback(() => {
    const chainId = workflowChainIdRef.current
    if (chainId) {
      const sock = getSocket()
      sock.emit('chain:stop', { chainId })
    }
    setWorkflowRunning(false)
    setWorkflowStep(null)
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

  const handleOpenWorkflowChat = useCallback(() => {
    setWorkflowChatOpen(true)
  }, [])

  // Track current chain ID, steps, per-step usage, per-step chat messages, and accumulated text
  const workflowChainIdRef = useRef<string>('')
  const workflowStepsRef = useRef<ReturnType<typeof buildChain>>([])
  const workflowStepUsageRef = useRef<Map<number, import('@orchestra/shared').TokenUsage>>(new Map())
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

    // Per-step usage — store on a ref so step_complete can include it
    socket.on('chain:step_usage', (data: { chainId: string; stepIndex: number; agentId: string; usage: import('@orchestra/shared').TokenUsage }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      workflowStepUsageRef.current.set(data.stepIndex, data.usage)
    })

    socket.on('chain:step_complete', (data: { chainId: string; stepIndex: number; agentId: string; output: string }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      const steps = workflowStepsRef.current
      const step = steps[data.stepIndex]
      const agentName = step?.agentName ?? `Agent ${data.stepIndex + 1}`
      const usage = workflowStepUsageRef.current.get(data.stepIndex)

      setWorkflowLog((prev) => {
        // Mark the step_start entry as completed (stops spinner)
        const updated = prev.map((entry) =>
          entry.type === 'step_start' && entry.stepIndex === data.stepIndex
            ? { ...entry, completed: true }
            : entry,
        )
        // Append the step_complete entry with output
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
      // Replace or add the final assistant message with complete output
      const finalMsgs = [
        ...stepMsgs.filter((m) => m.role === 'tool'),
        ...(data.output ? [{ id: crypto.randomUUID(), role: 'assistant' as const, content: data.output, timestamp: new Date() }] : []),
      ]
      workflowStepMsgsRef.current.set(data.stepIndex, finalMsgs)
    })

    socket.on('chain:complete', (data: { chainId: string; totalSteps: number }) => {
      if (data.chainId !== workflowChainIdRef.current) return
      setWorkflowRunning(false)
      setWorkflowStep(null)

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
        setResourceBrowserOpen(true)
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
      setChatOpen(true)
    },
    [nodes],
  )

  const handleChatClose = useCallback(() => {
    setChatOpen(false)
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
    setNodes(updated)
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
                onRun={handleOpenWorkflowChat}
                onStop={handleStopWorkflow}
                onOpenChat={handleOpenWorkflowChat}
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
          open={assistantsListOpen}
          onOpenChange={setAssistantsListOpen}
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
          open={safetyPanelOpen}
          onOpenChange={setSafetyPanelOpen}
        />
      </ErrorBoundary>

      {/* Settings Panel */}
      <ErrorBoundary>
        <SettingsPanel
          open={settingsOpen}
          onOpenChange={handleSettingsClose}
        />
      </ErrorBoundary>

      {/* Resource Browser */}
      <ErrorBoundary>
        <ResourceBrowser
          open={resourceBrowserOpen}
          onOpenChange={setResourceBrowserOpen}
          workspaceId={activeWorkspaceId || null}
        />
      </ErrorBoundary>

      {/* Discussions List */}
      <ErrorBoundary>
        <DiscussionsList
          open={discussionsListOpen}
          onOpenChange={(open) => {
            setDiscussionsListOpen(open)
            if (!open && activeTab === 'discussions') setActiveTab('workspace')
          }}
          discussions={discussions}
          onSelectDiscussion={handleSelectDiscussionFromList}
          onNewDiscussion={() => {
            setDiscussionsListOpen(false)
            setDiscussionWizardOpen(true)
          }}
        />
      </ErrorBoundary>

      {/* History Panel */}
      <ErrorBoundary>
        <HistoryPanel
          open={historyOpen}
          onOpenChange={(open) => {
            setHistoryOpen(open)
            if (!open && activeTab === 'history') setActiveTab('workspace')
          }}
        />
      </ErrorBoundary>

      {/* Skill Marketplace */}
      <ErrorBoundary>
        <SkillMarketplace
          open={marketplaceOpen}
          onOpenChange={setMarketplaceOpen}
        />
      </ErrorBoundary>

      {/* MCP Management */}
      <ErrorBoundary>
        <McpManagement
          open={mcpManagementOpen}
          onOpenChange={setMcpManagementOpen}
          servers={mcpServers}
          onAdd={handleMcpAdd}
          onEdit={handleMcpEdit}
          onDelete={handleMcpDelete}
        />
      </ErrorBoundary>

      {/* Chain Config */}
      <ErrorBoundary>
        <ChainConfig
          open={chainConfigOpen}
          onOpenChange={setChainConfigOpen}
          nodes={nodes}
          edges={edges}
          onExecute={handleChainExecute}
        />
      </ErrorBoundary>

      {/* PRD Editor */}
      <ErrorBoundary>
        <PrdEditor
          open={prdEditorOpen}
          onOpenChange={setPrdEditorOpen}
          onStartPipeline={handlePrdStart}
        />
      </ErrorBoundary>

      {/* AgentChat */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
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
                  setChatOpen(false)
                  setDrawerOpen(true)
                }}
                onManageResources={() => {
                  setResourceBrowserOpen(true)
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
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onSave={(updates) => {
            if (!selectedAgent) return
            setNodes((prev) => prev.map((n) =>
              n.id === selectedAgent.id
                ? { ...n, data: { ...n.data, ...updates } }
                : n,
            ))
            setDrawerOpen(false)
          }}
          onOpenMarketplace={() => {
            setDrawerOpen(false)
            setMarketplaceOpen(true)
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

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onCommand={handleCommand}
      />

      {/* Discussion Panel */}
      <ErrorBoundary>
        <DiscussionPanel
          open={discussionPanelOpen}
          onOpenChange={setDiscussionPanelOpen}
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
          setChatOpen(true)
        }}
      />

      {/* Activity Feed */}
      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
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
      <Sheet open={contextEditorOpen} onOpenChange={setContextEditorOpen}>
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
      <Sheet open={costDashboardOpen} onOpenChange={setCostDashboardOpen}>
        <SheetContent side="right" className="w-[450px] p-0 sm:w-[450px]">
          <SheetTitle className="border-b border-border px-4 py-3 text-sm font-semibold">
            Cost Dashboard
          </SheetTitle>
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 48px)' }}>
            <CostDashboard />
          </div>
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
              // Inject into agent chat cache and open
              injectMessagesIntoCache(step.nodeId, msgs)
              setSelectedAgent({
                id: step.nodeId,
                name: step.agentName,
                status: 'idle' as AgentStatus,
                model: step.model,
              })
              setChatOpen(true)
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Workspace Plan Editor */}
      <Sheet open={planEditorOpen} onOpenChange={setPlanEditorOpen}>
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
      <GitPanel key={`git-${activeWorkspaceId}-${workspaceWorkingDir}`} open={gitPanelOpen} onOpenChange={setGitPanelOpen} workspaceId={activeWorkspaceId} />
    </div>
    </ComplexityContext.Provider>
  )
}
