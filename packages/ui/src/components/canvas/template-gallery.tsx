'use client'

import { useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import {
  GitPullRequest,
  FileText,
  Search,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CANVAS_TEMPLATES, type CanvasTemplate } from '@/lib/canvas-templates'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateGalleryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTemplate: (nodes: Node[], edges: Edge[]) => void
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  GitPullRequest,
  FileText,
  Search,
  Lightbulb,
}

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Lightbulb
}

// ─── Template card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: CanvasTemplate
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onSelect: () => void
}

function TemplateCard({
  template,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onSelect,
}: TemplateCardProps) {
  const Icon = resolveIcon(template.icon)

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 rounded-lg border bg-card p-4 transition-all duration-150',
        isHovered
          ? 'border-primary/50 bg-accent/30 shadow-md'
          : 'border-border hover:border-border/80',
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Icon + node count */}
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-md border transition-colors',
            isHovered
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-muted/50 text-muted-foreground',
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>

        <Badge
          variant="secondary"
          className="text-[10px] font-medium"
        >
          {template.nodeCount} node{template.nodeCount !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Name + description */}
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold leading-none">{template.name}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {template.description}
        </p>
      </div>

      {/* CTA button — visible on hover */}
      <div
        className={cn(
          'mt-auto transition-all duration-150',
          isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none',
        )}
      >
        <Button
          size="sm"
          className="w-full text-xs"
          onClick={onSelect}
          tabIndex={isHovered ? 0 : -1}
        >
          Use this template
        </Button>
      </div>

      {/* Always-available click target for non-hover devices */}
      <button
        type="button"
        className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Load template: ${template.name}`}
        onClick={onSelect}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TemplateGallery({ open, onOpenChange, onSelectTemplate }: TemplateGalleryProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  function handleSelect(template: CanvasTemplate) {
    const { nodes, edges } = template.load()
    onSelectTemplate(nodes, edges)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Canvas Templates</DialogTitle>
          <DialogDescription>
            Start from a pre-built layout. You can customise everything after loading.
          </DialogDescription>
        </DialogHeader>

        <div
          className="grid grid-cols-2 gap-3 pt-2"
          role="list"
          aria-label="Available canvas templates"
        >
          {CANVAS_TEMPLATES.map((template) => (
            <div key={template.id} role="listitem">
              <TemplateCard
                template={template}
                isHovered={hoveredId === template.id}
                onMouseEnter={() => setHoveredId(template.id)}
                onMouseLeave={() => setHoveredId(null)}
                onSelect={() => handleSelect(template)}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
