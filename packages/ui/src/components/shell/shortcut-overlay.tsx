'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─── Types ────────────────────────────────────────────────────────────────

interface ShortcutRow {
  description: string
  keys: string[]
}

interface ShortcutCategory {
  title: string
  shortcuts: ShortcutRow[]
}

interface ShortcutOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Shortcut definitions ─────────────────────────────────────────────────

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Canvas',
    shortcuts: [
      { description: 'Pan canvas', keys: ['Space', 'Drag'] },
      { description: 'Zoom in', keys: ['Ctrl', '+'] },
      { description: 'Zoom out', keys: ['Ctrl', '-'] },
      { description: 'Fit view', keys: ['Ctrl', 'Shift', 'F'] },
      { description: 'Select all', keys: ['Ctrl', 'A'] },
    ],
  },
  {
    title: 'Nodes',
    shortcuts: [
      { description: 'New agent', keys: ['N'] },
      { description: 'Delete selected', keys: ['Del'] },
      { description: 'Delete selected', keys: ['Backspace'] },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { description: 'Command palette', keys: ['Ctrl', 'K'] },
      { description: 'Toggle skills sidebar', keys: ['S'] },
      { description: 'Shortcut help', keys: ['?'] },
      { description: 'Close / deselect', keys: ['Esc'] },
    ],
  },
  {
    title: 'Editing',
    shortcuts: [
      { description: 'Undo', keys: ['Ctrl', 'Z'] },
      { description: 'Redo', keys: ['Ctrl', 'Shift', 'Z'] },
      { description: 'Redo (alt)', keys: ['Ctrl', 'Y'] },
    ],
  },
]

// ─── Sub-components ────────────────────────────────────────────────────────

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground shadow-sm">
      {label}
    </kbd>
  )
}

function ShortcutEntry({ description, keys }: ShortcutRow) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-foreground">{description}</span>
      <div className="flex items-center gap-1 shrink-0">
        {keys.map((k, i) => (
          <KeyBadge key={i} label={k} />
        ))}
      </div>
    </div>
  )
}

function CategorySection({ title, shortcuts }: ShortcutCategory) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y divide-border/40">
        {shortcuts.map((s) => (
          <ShortcutEntry key={s.description + s.keys.join()} {...s} />
        ))}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────

export function ShortcutOverlay({ open, onOpenChange }: ShortcutOverlayProps) {
  const leftColumn = SHORTCUT_CATEGORIES.slice(0, 2)
  const rightColumn = SHORTCUT_CATEGORIES.slice(2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-6">
        <DialogHeader>
          <DialogTitle className="text-base">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
          <div className="flex flex-col gap-6">
            {leftColumn.map((cat) => (
              <CategorySection key={cat.title} {...cat} />
            ))}
          </div>
          <div className="flex flex-col gap-6">
            {rightColumn.map((cat) => (
              <CategorySection key={cat.title} {...cat} />
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Press <KeyBadge label="?" /> or <KeyBadge label="Esc" /> to close
        </p>
      </DialogContent>
    </Dialog>
  )
}
