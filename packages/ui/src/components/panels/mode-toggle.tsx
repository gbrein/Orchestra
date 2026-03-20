'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { AgentMode } from '@orchestra/shared'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ModeToggleProps {
  readonly mode: AgentMode
  readonly onChange: (mode: AgentMode) => void
  readonly disabled?: boolean
}

// ─── Mode config ────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<AgentMode, { label: string; color: string; activeColor: string }> = {
  plan: {
    label: 'Plan',
    color: 'text-blue-400',
    activeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  },
  default: {
    label: 'Default',
    color: 'text-muted-foreground',
    activeColor: 'bg-muted text-foreground border-border',
  },
  edit: {
    label: 'Edit',
    color: 'text-green-400',
    activeColor: 'bg-green-500/20 text-green-400 border-green-500/40',
  },
}

const MODES: readonly AgentMode[] = ['plan', 'default', 'edit'] as const

// ─── Component ──────────────────────────────────────────────────────────────

export function ModeToggle({ mode, onChange, disabled = false }: ModeToggleProps) {
  const [confirmingEdit, setConfirmingEdit] = useState(false)

  const handleSelect = useCallback(
    (newMode: AgentMode) => {
      if (disabled || newMode === mode) return

      // Switching TO edit requires confirmation
      if (newMode === 'edit' && mode !== 'edit') {
        setConfirmingEdit(true)
        return
      }

      onChange(newMode)
    },
    [mode, onChange, disabled],
  )

  const confirmEdit = useCallback(() => {
    setConfirmingEdit(false)
    onChange('edit')
  }, [onChange])

  const cancelEdit = useCallback(() => {
    setConfirmingEdit(false)
  }, [])

  return (
    <div className="flex flex-col gap-1">
      <div
        className="inline-flex items-center rounded-md border border-border bg-background p-0.5"
        role="radiogroup"
        aria-label="Permission mode"
      >
        {MODES.map((m) => {
          const config = MODE_CONFIG[m]
          const isActive = m === mode

          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled}
              className={cn(
                'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
                isActive
                  ? `${config.activeColor} border`
                  : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
              onClick={() => handleSelect(m)}
            >
              {config.label}
            </button>
          )
        })}
      </div>

      {/* Edit mode confirmation */}
      {confirmingEdit && (
        <div className="flex items-center gap-1.5 rounded border border-yellow-500/40 bg-yellow-500/10 px-2 py-1.5 text-[11px]">
          <span className="text-yellow-400">Edit mode lets this agent modify files.</span>
          <button
            type="button"
            className="rounded bg-green-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-500 transition-colors"
            onClick={confirmEdit}
          >
            Confirm
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={cancelEdit}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Mode badge (for canvas nodes) ─────────────────────────────────────────

interface ModeBadgeProps {
  readonly mode: AgentMode
}

const MODE_DOT_COLORS: Record<AgentMode, string> = {
  plan: 'bg-blue-400',
  default: 'bg-muted-foreground',
  edit: 'bg-green-400',
}

export function ModeBadge({ mode }: ModeBadgeProps) {
  if (mode === 'default') return null

  const config = MODE_CONFIG[mode]

  return (
    <span className="inline-flex items-center gap-1 text-[10px]">
      <span className={cn('h-1.5 w-1.5 rounded-full', MODE_DOT_COLORS[mode])} aria-hidden />
      <span className={config.color}>{config.label}</span>
    </span>
  )
}

// ─── Mode border color (for canvas node left border) ────────────────────────

export const MODE_BORDER_COLORS: Record<AgentMode, string | null> = {
  plan: '#60a5fa',   // blue-400
  default: null,
  edit: '#4ade80',   // green-400
}
