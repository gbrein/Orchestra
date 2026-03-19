'use client'

import type { Node, XYPosition } from '@xyflow/react'
import type { AgentStatus } from '@orchestra/shared'

// ─── Node data types ───────────────────────────────────────────────────────
// React Flow v12 requires data to extend Record<string, unknown>

export interface AgentNodeData extends Record<string, unknown> {
  name: string
  description?: string
  avatar?: string
  status: AgentStatus
  model?: string
  purpose?: string
}

export interface SkillNodeData extends Record<string, unknown> {
  name: string
  icon?: string
  category?: string
}

export interface PolicyNodeData extends Record<string, unknown> {
  name: string
  level: 'global' | 'agent' | 'session'
}

// ─── Typed node aliases ────────────────────────────────────────────────────

export type AgentFlowNode = Node<AgentNodeData, 'agent'>
export type SkillFlowNode = Node<SkillNodeData, 'skill'>
export type PolicyFlowNode = Node<PolicyNodeData, 'policy'>

// ─── Node factories ────────────────────────────────────────────────────────

export function createAgentNode(position: XYPosition, data: AgentNodeData): AgentFlowNode {
  return {
    id: crypto.randomUUID(),
    type: 'agent',
    position,
    data,
  }
}

export function createSkillNode(position: XYPosition, data: SkillNodeData): SkillFlowNode {
  return {
    id: crypto.randomUUID(),
    type: 'skill',
    position,
    data,
  }
}

export function createPolicyNode(position: XYPosition, data: PolicyNodeData): PolicyFlowNode {
  return {
    id: crypto.randomUUID(),
    type: 'policy',
    position,
    data,
  }
}

// ─── Connection validation ─────────────────────────────────────────────────

export function isValidConnection(connection: {
  source: string | null
  target: string | null
  sourceHandle?: string | null
  targetHandle?: string | null
}): boolean {
  if (!connection.source || !connection.target) return false
  if (connection.source === connection.target) return false
  return true
}

// ─── Status helpers ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'hsl(var(--status-idle))',
  running: 'hsl(var(--status-running))',
  waiting_approval: 'hsl(var(--status-waiting))',
  error: 'hsl(var(--status-error))',
}

export function getStatusColor(status: AgentStatus): string {
  return STATUS_COLORS[status]
}

const STATUS_ICONS: Record<AgentStatus, string> = {
  idle: 'circle',
  running: 'loader-2',
  waiting_approval: 'clock',
  error: 'alert-circle',
}

export function getStatusIcon(status: AgentStatus): string {
  return STATUS_ICONS[status]
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  waiting_approval: 'Waiting for approval',
  error: 'Error',
}

export function getStatusLabel(status: AgentStatus): string {
  return STATUS_LABELS[status]
}

// ─── Drag-and-drop helpers ─────────────────────────────────────────────────

export const DRAG_TYPES = {
  AGENT: 'application/orchestra-agent',
  SKILL: 'application/orchestra-skill',
  POLICY: 'application/orchestra-policy',
  MCP: 'application/orchestra-mcp',
} as const

export type DragType = (typeof DRAG_TYPES)[keyof typeof DRAG_TYPES]
