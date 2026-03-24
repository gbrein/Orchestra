'use client'

import { useState, useCallback } from 'react'

// ─── Panel Types ────────────────────────────────────────────────────────────

/**
 * Discriminated union representing which right-side panel is open.
 * Only ONE panel can be open at a time (except workflowChat which coexists).
 */
export type ActivePanel =
  | { readonly type: 'none' }
  | { readonly type: 'agent-drawer'; readonly agentId: string }
  | { readonly type: 'agent-chat'; readonly agentId: string }
  | { readonly type: 'skill-marketplace' }
  | { readonly type: 'schedules' }
  | { readonly type: 'discussion-panel'; readonly discussionId: string }
  | { readonly type: 'discussions-list' }
  | { readonly type: 'resource-browser' }
  | { readonly type: 'assistants-list' }
  | { readonly type: 'safety' }
  | { readonly type: 'settings' }
  | { readonly type: 'history' }
  | { readonly type: 'mcp-management' }
  | { readonly type: 'chain-config' }
  | { readonly type: 'prd-editor' }
  | { readonly type: 'activity' }
  | { readonly type: 'context-editor' }
  | { readonly type: 'cost-dashboard' }
  | { readonly type: 'plan-editor' }
  | { readonly type: 'git' }
  | { readonly type: 'maestro-drawer' }
  | { readonly type: 'facilitators' }

export type PanelType = ActivePanel['type']

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UsePanelReturn {
  /** The currently active panel. */
  readonly panel: ActivePanel
  /** Open a specific panel. Closes any other open panel. */
  readonly openPanel: (panel: ActivePanel) => void
  /** Close the current panel (sets to 'none'). */
  readonly closePanel: () => void
  /** Check if a specific panel type is currently open. */
  readonly isOpen: (type: PanelType) => boolean
  /** Toggle a panel: if it's open, close it; if closed, open it. */
  readonly togglePanel: (panel: ActivePanel) => void
}

const NONE: ActivePanel = { type: 'none' }

export function usePanel(): UsePanelReturn {
  const [panel, setPanel] = useState<ActivePanel>(NONE)

  const openPanel = useCallback((next: ActivePanel) => {
    setPanel(next)
  }, [])

  const closePanel = useCallback(() => {
    setPanel(NONE)
  }, [])

  const isOpen = useCallback((type: PanelType) => {
    return panel.type === type
  }, [panel.type])

  const togglePanel = useCallback((next: ActivePanel) => {
    setPanel((prev) => (prev.type === next.type ? NONE : next))
  }, [])

  return { panel, openPanel, closePanel, isOpen, togglePanel }
}
