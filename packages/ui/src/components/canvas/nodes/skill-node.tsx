'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Puzzle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SkillNodeData } from '@/lib/canvas-utils'

function SkillNodeComponent(props: NodeProps) {
  const data = props.data as SkillNodeData
  const { selected } = props
  const { name } = data

  return (
    <>
      {/* Pill card */}
      <div
        className={cn(
          'flex min-w-[100px] items-center gap-2 rounded-full border bg-secondary px-3 py-1.5 text-secondary-foreground shadow-sm',
          selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        )}
        role="button"
        aria-label={`Skill: ${name}`}
        tabIndex={0}
      >
        <Puzzle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="whitespace-nowrap text-xs font-medium">{name}</span>
      </div>

      {/* Source handle — right side only (skills attach to agents) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-border !bg-background transition-colors hover:!border-primary"
      />
    </>
  )
}

export const SkillNode = memo(SkillNodeComponent)
SkillNode.displayName = 'SkillNode'
