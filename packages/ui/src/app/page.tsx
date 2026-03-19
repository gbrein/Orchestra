'use client'

import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { BottomBar } from '@/components/shell/bottom-bar'
import { CanvasPlaceholder } from '@/components/canvas/canvas-placeholder'

export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <CanvasPlaceholder />
        </main>
      </div>
      <BottomBar />
    </div>
  )
}
