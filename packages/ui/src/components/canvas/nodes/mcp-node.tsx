'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Plug } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Data type
// ---------------------------------------------------------------------------

export interface McpNodeData extends Record<string, unknown> {
  name: string
  serverType?: 'stdio'
  description?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function McpNodeComponent(props: NodeProps) {
  const data = props.data as McpNodeData
  const { selected } = props
  const { name, serverType, description } = data

  return (
    <>
      {/* Card */}
      <div
        className={cn(
          'flex min-w-[140px] flex-col gap-1.5 rounded-md border bg-card px-3 py-2 shadow-sm',
          'border-purple-500/60',
          selected && 'ring-2 ring-purple-500 ring-offset-1 ring-offset-background',
        )}
        role="button"
        aria-label={`MCP Server: ${name}`}
        tabIndex={0}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-purple-500/40 bg-purple-500/10 text-purple-400">
            <Plug className="h-3.5 w-3.5" aria-hidden />
          </div>
          <span className="whitespace-nowrap text-xs font-medium text-card-foreground truncate">
            {name}
          </span>
          {serverType && (
            <span className="shrink-0 rounded border border-purple-500/30 bg-purple-500/10 px-1 py-0.5 font-mono text-[9px] leading-none text-purple-400">
              {serverType}
            </span>
          )}
        </div>
        {description && (
          <p className="truncate text-[10px] leading-none text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Source handle — right side (connects to agents) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-purple-500/60 !bg-background transition-colors hover:!border-purple-400"
      />
    </>
  )
}

export const McpNode = memo(McpNodeComponent)
McpNode.displayName = 'McpNode'
