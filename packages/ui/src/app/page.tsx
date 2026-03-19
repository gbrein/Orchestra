'use client'

import { useCallback, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
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
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useSocket } from '@/hooks/use-socket'
import { useNotifications } from '@/hooks/use-notifications'
import { useApprovals } from '@/hooks/use-approvals'
import type { AgentNodeData } from '@/lib/canvas-utils'
import type { AgentStatus } from '@orchestra/shared'
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)

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

  // Undo/redo controls are surfaced from the canvas via callback
  const undoRedoRef = useRef<UndoRedoControls | null>(null)

  const handleUndoRedoReady = useCallback((controls: UndoRedoControls) => {
    undoRedoRef.current = controls
  }, [])

  const showCanvas = nodes.length > 0

  // Derive running agent count from canvas nodes
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

  const handleToggleShortcuts = useCallback(() => {
    setShortcutsOpen((prev) => !prev)
  }, [])

  const handleEscape = useCallback(() => {
    setShortcutsOpen(false)
    setChatOpen(false)
    setMarketplaceOpen(false)
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

  // ── Approval dialog handlers ───────────────────────────────────────────

  const handleApprovalDialogChange = useCallback(
    (open: boolean) => {
      if (!open) {
        dismissDialog()
      }
    },
    [dismissDialog],
  )

  // "Review" button in notification panel opens the approval dialog for
  // the relevant agent. The useApprovals hook holds the queue; clicking
  // Review simply re-surfaces the dialog if it was dismissed.
  const handleReviewApproval = useCallback((_notification: OrchestraNotification) => {
    // currentApproval is tracked by useApprovals; the ApprovalDialog
    // will re-open on the next approval event. Future work can
    // deep-link into a specific pending approval from here.
    void _notification
  }, [])

  // ── Approval data conversion ───────────────────────────────────────────

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
        <Sidebar onSkillsClick={handleToggleMarketplace} />
        <main className="relative flex-1 overflow-hidden">
          {/* Canvas is always mounted so React Flow can initialise; it is
              hidden (not unmounted) when the placeholder is shown so we don't
              lose node state on first drop. */}
          <div
            className={showCanvas ? 'h-full w-full' : 'hidden'}
            aria-hidden={!showCanvas}
          >
            <OrchestraCanvas
              initialNodes={nodes}
              onNodesChange={setNodes}
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

      {/* Skill Marketplace Sheet — opens from sidebar or command palette */}
      <SkillMarketplace
        open={marketplaceOpen}
        onOpenChange={setMarketplaceOpen}
      />

      {/* AgentChat Sheet — opens when an agent node is double-clicked */}
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

      {/* Approval Dialog — opens when an agent requests permission */}
      <ApprovalDialog
        open={showApprovalDialog}
        onOpenChange={handleApprovalDialogChange}
        approval={approvalDialogData}
        onApprove={approve}
        onReject={reject}
      />
    </div>
  )
}
