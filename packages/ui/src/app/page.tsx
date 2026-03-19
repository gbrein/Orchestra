'use client'

import { useState } from 'react'
import type { Node } from '@xyflow/react'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { BottomBar } from '@/components/shell/bottom-bar'
import { CanvasPlaceholder } from '@/components/canvas/canvas-placeholder'
import { OrchestraCanvas } from '@/components/canvas/orchestra-canvas'

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>([])

  const showCanvas = nodes.length > 0

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
            />
          </div>

          {!showCanvas && <CanvasPlaceholder />}
        </main>
      </div>
      <BottomBar />
    </div>
  )
}
