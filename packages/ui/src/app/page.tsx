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
import { CostDashboard } from '@/components/panels/cost-dashboard'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { apiGet } from '@/lib/api'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { ComplexityContext, useComplexityState } from '@/hooks/use-complexity'
import { useSocket } from '@/hooks/use-socket'
import { useCanvasPersistence } from '@/hooks/use-canvas-persistence'
import { useNotifications } from '@/hooks/use-notifications'
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
  } = useCanvasPersistence()

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
        />
        <main className="relative flex-1 overflow-hidden">
          <ErrorBoundary>
            <div
              className={showCanvas ? 'h-full w-full' : 'hidden'}
              aria-hidden={!showCanvas}
            >
              <OrchestraCanvas
                initialNodes={nodes}
                initialEdges={edges}
                onNodesChange={handleNodesChange}
                onUndoRedoReady={handleUndoRedoReady}
                onViewReady={handleViewReady}
                onNodeDoubleClick={handleNodeDoubleClick}
                onZoomChange={setZoomLevel}
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
    </div>
    </ComplexityContext.Provider>
  )
}
