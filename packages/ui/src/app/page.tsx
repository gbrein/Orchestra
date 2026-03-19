'use client'

import { useCallback, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { BottomBar } from '@/components/shell/bottom-bar'
import { CanvasPlaceholder } from '@/components/canvas/canvas-placeholder'
import { OrchestraCanvas, type UndoRedoControls } from '@/components/canvas/orchestra-canvas'
import { ShortcutOverlay } from '@/components/shell/shortcut-overlay'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Undo/redo controls are surfaced from the canvas via callback
  const undoRedoRef = useRef<UndoRedoControls | null>(null)

  const handleUndoRedoReady = useCallback((controls: UndoRedoControls) => {
    undoRedoRef.current = controls
  }, [])

  const showCanvas = nodes.length > 0

  // ── Shortcut callbacks ─────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    undoRedoRef.current?.undo()
  }, [])

  const handleRedo = useCallback(() => {
    undoRedoRef.current?.redo()
  }, [])

  const handleDelete = useCallback(() => {
    // React Flow's internal delete is handled by the canvas deleteKeyCode.
    // Here we trigger the same via a synthetic keyboard event so the canvas
    // respects its own selected-node deletion logic.
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
    // Deselect all nodes
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
            />
          </div>

          {!showCanvas && <CanvasPlaceholder />}
        </main>
      </div>
      <BottomBar />

      <ShortcutOverlay
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  )
}
