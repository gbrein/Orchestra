'use client'

import { useState } from 'react'
import { ArrowLeft, Check, Trash2, Star, User, Tag, Box } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { Skill } from '@orchestra/shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillDetailProps {
  readonly skill: Skill
  readonly installedSkillIds: ReadonlySet<string>
  readonly installedOnCount?: number
  readonly onBack: () => void
  readonly onInstall: (skillId: string) => Promise<void>
  readonly onUninstall: (skillId: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  Development: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Writing: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Analysis: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Research: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  Data: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
}

function getCategoryColor(category: string | null): string {
  if (!category) return 'bg-muted text-muted-foreground border-border'
  return CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground border-border'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillDetail({
  skill,
  installedSkillIds,
  installedOnCount = 0,
  onBack,
  onInstall,
  onUninstall,
}: SkillDetailProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isInstalled = installedSkillIds.has(skill.id)

  async function handleInstall() {
    setLoading(true)
    setError(null)
    try {
      await onInstall(skill.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install skill')
    } finally {
      setLoading(false)
    }
  }

  async function handleUninstall() {
    setLoading(true)
    setError(null)
    try {
      await onUninstall(skill.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to uninstall skill')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Back button */}
      <div className="flex items-center border-b px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Back to marketplace"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Hero */}
        <div className="mb-5 flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted text-2xl"
            aria-hidden
          >
            {skill.icon ?? <Box className="h-7 w-7 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-tight">{skill.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {skill.category && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    getCategoryColor(skill.category),
                  )}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {skill.category}
                </span>
              )}
              {skill.version && (
                <Badge variant="outline" className="text-[10px]">
                  v{skill.version}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {skill.author && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {skill.author}
            </span>
          )}
          {installedOnCount > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              Installed on {installedOnCount} assistant{installedOnCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <Separator className="mb-4" />

        {/* Description */}
        <div className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Description
          </h3>
          <p className="text-sm leading-relaxed text-foreground">{skill.description}</p>
        </div>

        {/* What this skill does */}
        <div className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What this skill does
          </h3>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              This skill extends your assistant with additional capabilities. Once installed, your
              assistant can use the tools and workflows provided by this skill to complete relevant
              tasks.
            </p>
            {skill.gitUrl && (
              <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
                Source: {skill.gitUrl}
              </p>
            )}
          </div>
        </div>

        {/* Source info */}
        {skill.source === 'git' && skill.gitUrl && (
          <div className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Source
            </h3>
            <div className="rounded-md border bg-card px-3 py-2">
              <p className="break-all font-mono text-xs text-muted-foreground">{skill.gitUrl}</p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Sticky footer with action button */}
      <div className="border-t px-5 py-4">
        {isInstalled ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUninstall}
            disabled={loading}
            className="w-full gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            {loading ? 'Uninstalling...' : 'Uninstall Skill'}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleInstall}
            disabled={loading}
            className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check className="h-4 w-4" />
            {loading ? 'Installing...' : 'Install Skill'}
          </Button>
        )}
      </div>
    </div>
  )
}
