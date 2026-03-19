'use client'

import { memo } from 'react'
import { getBezierPath, type EdgeProps } from '@xyflow/react'

export interface OrchestraEdgeData extends Record<string, unknown> {
  edgeType?: 'association' | 'flow' | 'conditional'
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

  // Flow edges (agent → agent): solid, animated, primary color
  return (
    <>
      {/* Shadow path for visual depth */}
      <path
        d={edgePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={3}
        strokeOpacity={0.1}
      />
      {/* Main animated path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeOpacity={0.8}
        strokeDasharray="6 3"
        markerEnd={markerEnd}
        style={{ animation: 'dashdraw 0.8s linear infinite' }}
      />
    </>
  )
}

export const OrchestraEdge = memo(OrchestraEdgeComponent)
OrchestraEdge.displayName = 'OrchestraEdge'
