'use client'

import { useCallback, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { BottomBar } from '@/components/shell/bottom-bar'
import { CanvasPlaceholder } from '@/components/canvas/canvas-placeholder'
import { OrchestraCanvas, type UndoRedoControls } from '@/components/canvas/orchestra-canvas'
import { ShortcutOverlay } from '@/components/shell/shortcut-overlay'
import { AgentChat } from '@/components/panels/agent-chat'
import { ApprovalDialog } from '@/components/panels/approval-dialog'
import { SkillMarketplace } from '@/components/panels/skill-marketplace'
import { DiscussionWizard, type DiscussionAgent } from '@/components/panels/discussion-wizard'
import { DiscussionPanel } from '@/components/panels/discussion-panel'
import { McpManagement, type McpServer } from '@/components/panels/mcp-management'
import { ChainConfig, type ChainStep, type ConditionalEdge } from '@/components/panels/chain-config'
import { PrdEditor, type PrdData } from '@/components/panels/prd-editor'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useSocket } from '@/hooks/use-socket'
import { useNotifications } from '@/hooks/use-notifications'
import { useApprovals } from '@/hooks/use-approvals'
import type { AgentNodeData } from '@/lib/canvas-utils'
import type { AgentStatus, DiscussionTable, CreateDiscussionInput } from '@orchestra/shared'
import type { OrchestraNotification } from '@/hooks/use-notifications'

// ─── Types ─────────────────────────────────────────────────────────────────

interface SelectedAgent {
  readonly id: string
  readonly name: string
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
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [discussionWizardOpen, setDiscussionWizardOpen] = useState(false)
  const [selectedDiscussion, setSelectedDiscussion] = useState<DiscussionTable | null>(null)
  const [discussionPanelOpen, setDiscussionPanelOpen] = useState(false)

  // MCP management state
  const [mcpManagementOpen, setMcpManagementOpen] = useState(false)
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])

  // Chain config state
  const [chainConfigOpen, setChainConfigOpen] = useState(false)

  // PRD editor state
  const [prdEditorOpen, setPrdEditorOpen] = useState(false)

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

  const handleUndoRedoReady = useCallback((controls: UndoRedoControls) => {
    undoRedoRef.current = controls
  }, [])

  const showCanvas = nodes.length > 0

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
    // Placeholder: integrate command palette when available
  }, [])

  const handleCreateAgent = useCallback(() => {
    // Placeholder: open create-agent dialog when available
  }, [])

  const handleToggleMarketplace = useCallback(() => {
    setMarketplaceOpen((prev) => !prev)
  }, [])

  const handleDiscussionsClick = useCallback(() => {
    setDiscussionWizardOpen(true)
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
    setSelectedDiscussion(provisional)
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
    setNodes((prev) =>
      prev.map((n) => ({ ...n, selected: false })),
    )
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
  })

  // ── Node double-click → open AgentChat ────────────────────────────────

  const handleNodeDoubleClick = useCallback(
    (nodeId: string, nodeType: string) => {
      if (nodeType !== 'agent') return

      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      const data = node.data as AgentNodeData
      setSelectedAgent({
        id: nodeId,
        name: data.name,
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
      // Real impl would emit to server via socket
      void steps
      void conditionalEdges
    },
    [],
  )

  // ── PRD pipeline ──────────────────────────────────────────────────────

  const handlePrdStart = useCallback((prd: PrdData) => {
    // Real impl would dispatch to server
    void prd
  }, [])

  // ── Canvas nodes/edges sync ───────────────────────────────────────────

  const handleNodesChange = useCallback((updated: Node[]) => {
    setNodes(updated)
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar
        notifications={notifications}
        unreadCount={unreadCount}
        onAcknowledge={acknowledge}
        onAcknowledgeAll={acknowledgeAll}
        onRemoveNotification={removeNotification}
        onReviewApproval={handleReviewApproval}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          onSkillsClick={handleToggleMarketplace}
          onDiscussionsClick={handleDiscussionsClick}
          onConnectionsClick={handleConnectionsClick}
        />
        <main className="relative flex-1 overflow-hidden">
          <div
            className={showCanvas ? 'h-full w-full' : 'hidden'}
            aria-hidden={!showCanvas}
          >
            <OrchestraCanvas
              initialNodes={nodes}
              onNodesChange={handleNodesChange}
              onUndoRedoReady={handleUndoRedoReady}
              onNodeDoubleClick={handleNodeDoubleClick}
            />
          </div>

          {!showCanvas && <CanvasPlaceholder />}
        </main>
      </div>

      <BottomBar
        connected={connected}
        connecting={connecting}
        socketError={socketError}
        runningAgentCount={runningAgentCount}
      />

      <ShortcutOverlay
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

      {/* Skill Marketplace */}
      <SkillMarketplace
        open={marketplaceOpen}
        onOpenChange={setMarketplaceOpen}
      />

      {/* MCP Management */}
      <McpManagement
        open={mcpManagementOpen}
        onOpenChange={setMcpManagementOpen}
        servers={mcpServers}
        onAdd={handleMcpAdd}
        onEdit={handleMcpEdit}
        onDelete={handleMcpDelete}
      />

      {/* Chain Config */}
      <ChainConfig
        open={chainConfigOpen}
        onOpenChange={setChainConfigOpen}
        nodes={nodes}
        edges={edges}
        onExecute={handleChainExecute}
      />

      {/* PRD Editor */}
      <PrdEditor
        open={prdEditorOpen}
        onOpenChange={setPrdEditorOpen}
        onStartPipeline={handlePrdStart}
      />

      {/* AgentChat */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent
          side="right"
          className="flex w-[420px] flex-col gap-0 p-0 sm:w-[500px]"
          aria-label={selectedAgent ? `Chat with ${selectedAgent.name}` : 'Agent chat'}
        >
          {selectedAgent && (
            <AgentChat
              agentId={selectedAgent.id}
              agentName={selectedAgent.name}
              agentStatus={selectedAgent.status}
              agentModel={selectedAgent.model}
              onClose={handleChatClose}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Approval Dialog */}
      <ApprovalDialog
        open={showApprovalDialog}
        onOpenChange={handleApprovalDialogChange}
        approval={approvalDialogData}
        onApprove={approve}
        onReject={reject}
      />

      {/* Discussion Wizard */}
      <DiscussionWizard
        open={discussionWizardOpen}
        onOpenChange={setDiscussionWizardOpen}
        agents={discussionAgents}
        onCreate={handleDiscussionCreate}
      />

      {/* Discussion Panel */}
      <DiscussionPanel
        open={discussionPanelOpen}
        onOpenChange={setDiscussionPanelOpen}
        discussion={selectedDiscussion}
      />
    </div>
  )
}
