'use client'

import { memo, useState, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StickyNoteNodeData extends Record<string, unknown> {
  text?: string
  color?: string
}

// ─── Colors ─────────────────────────────────────────────────────────────────

const NOTE_COLORS: Record<string, { bg: string; border: string }> = {
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', border: 'border-yellow-300 dark:border-yellow-500/40' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', border: 'border-blue-300 dark:border-blue-500/40' },
  green: { bg: 'bg-green-100 dark:bg-green-500/20', border: 'border-green-300 dark:border-green-500/40' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-500/20', border: 'border-pink-300 dark:border-pink-500/40' },
}

// ─── Component ──────────────────────────────────────────────────────────────

function StickyNoteNodeComponent(props: NodeProps) {
  const data = props.data as StickyNoteNodeData
  const colorKey = (data.color ?? 'yellow') as string
  const colors = NOTE_COLORS[colorKey] ?? NOTE_COLORS.yellow

  const [text, setText] = useState(data.text ?? '')
  const [editing, setEditing] = useState(!data.text)

  const handleBlur = useCallback(() => {
    setEditing(false)
    // Update node data through React Flow (the parent canvas persists)
    data.text = text
  }, [text, data])

  return (
    <div
      className={`w-[180px] rounded-md border ${colors.border} ${colors.bg} p-3 shadow-sm`}
      onDoubleClick={() => setEditing(true)}
    >
      {editing ? (
        <textarea
          className="w-full bg-transparent text-xs outline-none resize-none placeholder:text-muted-foreground"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          placeholder="Type a note..."
          autoFocus
        />
      ) : (
        <p className="min-h-[60px] whitespace-pre-wrap text-xs text-foreground">
          {text || 'Double-click to edit...'}
        </p>
      )}
    </div>
  )
}

export const StickyNoteNode = memo(StickyNoteNodeComponent)
StickyNoteNode.displayName = 'StickyNoteNode'
