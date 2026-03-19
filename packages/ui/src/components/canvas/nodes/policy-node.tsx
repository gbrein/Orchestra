'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PolicyNodeData } from '@/lib/canvas-utils'

const LEVEL_STYLES: Record<PolicyNodeData['level'], string> = {
  global: 'border-blue-500/60 text-blue-400',
  agent: 'border-yellow-500/60 text-yellow-400',
  session: 'border-muted-foreground/40 text-muted-foreground',
}

const LEVEL_LABELS: Record<PolicyNodeData['level'], string> = {
  global: 'Global',
  agent: 'Agent',
  session: 'Session',
}

function PolicyNodeComponent(props: NodeProps) {
  const data = props.data as PolicyNodeData
  const { selected } = props
  const { name, level } = data
  const levelStyle = LEVEL_STYLES[level]
  const levelLabel = LEVEL_LABELS[level]

  return (
    <>
      {/* Card */}
      <div
        className={cn(
          'flex min-w-[120px] flex-col gap-1.5 rounded-md border bg-card px-3 py-2 shadow-sm',
          levelStyle,
          selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        )}
        role="button"
        aria-label={`Policy: ${name}, level: ${levelLabel}`}
        tabIndex={0}
      >
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="whitespace-nowrap text-xs font-medium text-card-foreground">{name}</span>
        </div>
        <span className="text-[10px] leading-none opacity-70">{levelLabel} policy</span>
      </div>

      {/* Source handle — right side only */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-border !bg-background transition-colors hover:!border-primary"
      />
    </>
  )
}

export const PolicyNode = memo(PolicyNodeComponent)
PolicyNode.displayName = 'PolicyNode'
