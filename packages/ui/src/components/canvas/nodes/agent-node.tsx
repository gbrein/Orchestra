'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import Image from 'next/image'
import { Circle, Loader2, Clock, AlertCircle, CheckCircle2, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStatusColor, getStatusLabel, type AgentNodeData, type ChainNodeState } from '@/lib/canvas-utils'
import { ModeBadge, MODE_BORDER_COLORS } from '@/components/panels/mode-toggle'
import type { AgentStatus, AgentMode } from '@orchestra/shared'
import { MODEL_TIERS } from '@orchestra/shared'

// ─── Status icon ───────────────────────────────────────────────────────────

const STATUS_ICON_MAP: Record<AgentStatus, React.ElementType> = {
  idle: Circle,
  running: Loader2,
  waiting_approval: Clock,
  error: AlertCircle,
}

function StatusIcon({ status }: { status: AgentStatus }) {
  const Icon = STATUS_ICON_MAP[status] ?? Circle
  return (
    <Icon
      className={cn('h-3 w-3', status === 'running' && 'animate-spin')}
      aria-hidden
    />
  )
}

// ─── Avatar ────────────────────────────────────────────────────────────────

function AgentAvatar({ avatar, name }: { avatar?: string; name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')

  if (avatar) {
    return (
      <Image
        src={avatar}
        alt=""
        aria-hidden
        width={32}
        height={32}
        className="rounded-full object-cover"
      />
    )
  }

  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
      aria-hidden
    >
      {initials || '?'}
    </div>
  )
}

// ─── Model badge ───────────────────────────────────────────────────────────

function ModelBadge({ model }: { model?: string }) {
  if (!model) return null

  const label =
    model in MODEL_TIERS
      ? MODEL_TIERS[model as keyof typeof MODEL_TIERS].label
      : model

  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
      {label}
    </span>
  )
}

// ─── Agent node ────────────────────────────────────────────────────────────

// NodeProps uses Record<string,unknown> for data; we cast to our typed interface.
function AgentNodeComponent(props: NodeProps) {
  const data = props.data as AgentNodeData
  const { selected } = props
  const { name, description, avatar, status, model, permissionMode, chainState, hasSchedule } = data
  const statusColor = getStatusColor(status)
  const statusLabel = getStatusLabel(status)
  const modeBorderColor = MODE_BORDER_COLORS[(permissionMode ?? 'default') as AgentMode]

  const isActive = chainState === 'active'
  const isCompleted = chainState === 'completed'
  const isPending = chainState === 'pending'
  const isChainError = chainState === 'error'

  return (
    <>
      {/* Target handle — left side */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !rounded-full !border-2 !border-border !bg-background transition-colors hover:!border-primary"
      />

      {/* Card */}
      <div
        className={cn(
          'relative w-[220px] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-md transition-all duration-300',
          selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
          // Chain execution visual states
          isActive && 'ring-2 ring-blue-400/70 shadow-[0_0_20px_rgba(96,165,250,0.3)]',
          isCompleted && 'border-green-500/40',
          isPending && 'opacity-50',
          isChainError && 'ring-2 ring-red-400/70',
        )}
        style={modeBorderColor ? { borderLeftWidth: 3, borderLeftColor: modeBorderColor } : undefined}
        role="button"
        aria-label={`Agent: ${name}, status: ${statusLabel}`}
        tabIndex={0}
      >
        {/* Schedule badge — top right corner */}
        {hasSchedule && (
          <div
            className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border bg-card shadow-sm"
            title="Has scheduled task"
          >
            <Timer className="h-3 w-3 text-amber-400" aria-hidden />
          </div>
        )}

        {/* Status bar — top accent strip */}
        <div
          className={cn('h-1 w-full transition-colors', isActive && 'animate-pulse')}
          style={{ backgroundColor: isCompleted ? 'hsl(142, 71%, 45%)' : statusColor }}
          aria-hidden
        />

        {/* Card body */}
        <div className="p-3">
          {/* Top row: avatar + name/description */}
          <div className="flex items-start gap-2.5">
            <AgentAvatar avatar={avatar} name={name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{name}</p>
              {description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
              )}
            </div>
          </div>

          {/* Bottom row: model badge + mode + status */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ModelBadge model={model} />
              <ModeBadge mode={(permissionMode ?? 'default') as AgentMode} />
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {isCompleted ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-400" aria-hidden />
                  <span className="text-green-400">Done</span>
                </>
              ) : (
                <>
                  <StatusIcon status={status} />
                  <span>{statusLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Source handle — right side */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !rounded-full !border-2 !border-border !bg-background transition-colors hover:!border-primary"
      />
    </>
  )
}

export const AgentNode = memo(AgentNodeComponent)
AgentNode.displayName = 'AgentNode'
