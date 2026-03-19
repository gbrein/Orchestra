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
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useSocket } from '@/hooks/use-socket'
import type { AgentNodeData } from '@/lib/canvas-utils'
import type { AgentStatus } from '@orchestra/shared'

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

  const { connected, connecting, error: socketError } = useSocket()

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
    // Placeholder: toggle skills marketplace sidebar when available
  }, [])

  const handleToggleShortcuts = useCallback(() => {
    setShortcutsOpen((prev) => !prev)
  }, [])

  const handleEscape = useCallback(() => {
    setShortcutsOpen(false)
    setChatOpen(false)
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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
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
    </div>
  )
}
