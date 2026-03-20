'use client'

import { memo } from 'react'
import { getBezierPath, type EdgeProps } from '@xyflow/react'

export interface OrchestraEdgeData extends Record<string, unknown> {
  edgeType?: 'association' | 'flow' | 'conditional'
  isActive?: boolean
}

// EdgeProps uses Record<string,unknown> for data; we cast to our typed interface.
function OrchestraEdgeComponent(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
  } = props

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const typedData = data as OrchestraEdgeData | undefined
  const edgeType = typedData?.edgeType ?? 'flow'
  const isActive = typedData?.isActive ?? false

  // Association edges (skill/policy → agent): dashed, muted
  if (edgeType === 'association') {
    return (
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        strokeOpacity={0.6}
        markerEnd={markerEnd}
      />
    )
  }

  // Flow edges (agent → agent): animated, with active/idle states
  if (isActive) {
    return (
      <>
        {/* Glow path */}
        <path
          d={edgePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={8}
          strokeOpacity={0.12}
          style={{
            filter: 'drop-shadow(0 0 6px hsl(var(--primary)))',
            animation: 'edgepulse 2s ease-in-out infinite',
          }}
        />
        {/* Shadow path */}
        <path
          d={edgePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={4}
          strokeOpacity={0.15}
        />
        {/* Main animated path — fast */}
        <path
          id={id}
          d={edgePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          strokeOpacity={1}
          strokeDasharray="6 3"
          markerEnd={markerEnd}
          style={{ animation: 'dashdraw 0.4s linear infinite' }}
        />
      </>
    )
  }

  // Idle flow edge — subtle, slow
  return (
    <>
      {/* Shadow path for visual depth */}
      <path
        d={edgePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={3}
        strokeOpacity={0.05}
      />
      {/* Main path — slow animation */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.5}
        strokeOpacity={0.3}
        strokeDasharray="6 3"
        markerEnd={markerEnd}
        style={{ animation: 'dashdraw 4s linear infinite' }}
      />
    </>
  )
}

export const OrchestraEdge = memo(OrchestraEdgeComponent)
OrchestraEdge.displayName = 'OrchestraEdge'
