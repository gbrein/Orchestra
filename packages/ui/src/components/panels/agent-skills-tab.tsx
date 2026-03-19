'use client'

import { useState } from 'react'
import { GripVertical, Trash2, Plus, Box, Tag, Puzzle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkillRow {
  readonly skillId: string
  readonly skillName: string
  readonly skillCategory?: string
  readonly priority: number
  readonly enabled: boolean
}

export interface AgentSkillsTabProps {
  readonly agentId: string
  readonly skills: readonly SkillRow[]
  readonly onToggle: (skillId: string, enabled: boolean) => void
  readonly onRemove: (skillId: string) => void
  readonly onReorder: (skills: ReadonlyArray<{ skillId: string; priority: number }>) => void
  readonly onOpenMarketplace: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  Development: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Writing: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Analysis: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Research: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  Data: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryColor(category: string | undefined): string {
  if (!category) return 'bg-muted text-muted-foreground border-border'
  return CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground border-border'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentSkillsTab({
  agentId: _agentId,
  skills,
  onToggle,
  onRemove,
  onReorder,
  onOpenMarketplace,
}: AgentSkillsTabProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [localSkills, setLocalSkills] = useState<readonly SkillRow[]>(skills)

  // Sync local state when props change
  if (skills !== localSkills && dragIndex === null) {
    setLocalSkills(skills)
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, overIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === overIndex) return

    const reordered = [...localSkills]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(overIndex, 0, moved)

    const withPriority: SkillRow[] = reordered.map((s, i) => ({ ...s, priority: i + 1 }))
    setLocalSkills(withPriority)
    setDragIndex(overIndex)
  }

  function handleDragEnd() {
    setDragIndex(null)
    onReorder(
      localSkills.map((s) => ({ skillId: s.skillId, priority: s.priority })),
    )
  }

  if (localSkills.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Puzzle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">No skills added</p>
          <p className="text-xs text-muted-foreground">
            Browse the marketplace to add abilities.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onOpenMarketplace} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Browse Marketplace
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div
        className="flex flex-col gap-1"
        role="list"
        aria-label="Skills attached to this assistant"
      >
        {localSkills.map((skill, index) => (
          <div
            key={skill.skillId}
            role="listitem"
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              'flex items-center gap-2 rounded-lg border bg-card p-3 transition-opacity',
              dragIndex === index && 'opacity-50',
            )}
          >
            {/* Priority number */}
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
              aria-label={`Priority ${skill.priority}`}
            >
              {skill.priority}
            </span>

            {/* Drag handle */}
            <GripVertical
              className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing"
              aria-hidden
            />

            {/* Skill icon */}
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted"
              aria-hidden
            >
              <Box className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Skill info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-none">{skill.skillName}</p>
              {skill.skillCategory && (
                <span
                  className={cn(
                    'mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                    getCategoryColor(skill.skillCategory),
                  )}
                >
                  <Tag className="h-2 w-2" />
                  {skill.skillCategory}
                </span>
              )}
            </div>

            {/* Toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={skill.enabled}
              aria-label={`${skill.enabled ? 'Disable' : 'Enable'} ${skill.skillName}`}
              onClick={() => onToggle(skill.skillId, !skill.enabled)}
              className={cn(
                'relative h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                skill.enabled ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  skill.enabled ? 'translate-x-4' : 'translate-x-0',
                )}
              />
            </button>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemove(skill.skillId)}
              aria-label={`Remove ${skill.skillName}`}
              className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add skill button */}
      <Button
        size="sm"
        variant="outline"
        onClick={onOpenMarketplace}
        className="self-start gap-1.5"
        aria-label="Open skill marketplace to add a skill"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Skill
      </Button>
    </div>
  )
}
