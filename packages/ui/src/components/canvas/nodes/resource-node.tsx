'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Data type ─────────────────────────────────────────────────────────────

export interface ResourceNodeData extends Record<string, unknown> {
  label?: string
  fileCount?: number
  linkCount?: number
  noteCount?: number
  variableCount?: number
}

// ─── Component ─────────────────────────────────────────────────────────────

function ResourceNodeComponent(props: NodeProps) {
  const data = props.data as ResourceNodeData
  const { selected } = props
  const {
    label = 'Resources',
    fileCount = 0,
    linkCount = 0,
    noteCount = 0,
    variableCount = 0,
  } = data

  const fileLine = `${fileCount} ${fileCount === 1 ? 'file' : 'files'} · ${linkCount} ${linkCount === 1 ? 'link' : 'links'}`
  const noteLine = `${noteCount} ${noteCount === 1 ? 'note' : 'notes'} · ${variableCount} ${variableCount === 1 ? 'var' : 'vars'}`

  return (
    <>
      {/* Target handle — left side */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !rounded-full !border-2 !border-border !bg-background transition-colors hover:!border-cyan-400"
      />

      {/* Card */}
      <div
        className={cn(
          'relative w-[200px] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-md transition-shadow',
          selected && 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-background',
        )}
        role="button"
        aria-label={`Resources node: ${fileCount} files, ${linkCount} links, ${noteCount} notes, ${variableCount} variables`}
        tabIndex={0}
      >
        {/* Teal/cyan accent bar */}
        <div
          className="h-1 w-full bg-cyan-500"
          aria-hidden
        />

        {/* Body */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <FolderOpen
              className="h-4 w-4 shrink-0 text-cyan-400"
              aria-hidden
            />
            <span className="truncate text-sm font-semibold leading-tight">
              {label}
            </span>
          </div>
          <div className="mt-1.5 space-y-0.5">
            <p className="text-[11px] text-muted-foreground">{fileLine}</p>
            <p className="text-[11px] text-muted-foreground">{noteLine}</p>
          </div>
        </div>
      </div>

      {/* Source handle — right side */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !rounded-full !border-2 !border-border !bg-background transition-colors hover:!border-cyan-400"
      />
    </>
  )
}

export const ResourceNode = memo(ResourceNodeComponent)
ResourceNode.displayName = 'ResourceNode'
