export interface CanvasViewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

export type EdgeType = 'association' | 'flow' | 'conditional'

export interface CanvasNodeData {
  readonly id: string
  readonly type: 'agent' | 'skill' | 'policy' | 'discussion' | 'mcp'
  readonly position: { readonly x: number; readonly y: number }
  readonly data: Record<string, unknown>
}

export interface CanvasEdgeData {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly type: EdgeType
  readonly condition?: string
}

export interface CanvasLayout {
  readonly id: string
  readonly name: string
  readonly workspaceId: string
  readonly viewport: CanvasViewport
  readonly nodes: readonly CanvasNodeData[]
  readonly edges: readonly CanvasEdgeData[]
  readonly updatedAt: string
}

export interface Workspace {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly updatedAt: string
}
