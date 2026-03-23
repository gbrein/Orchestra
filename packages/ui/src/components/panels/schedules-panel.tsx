'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  Loader2,
  Zap,
  Bot,
  Workflow,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScheduledTask {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly type: 'workflow' | 'agent'
  readonly targetId: string
  readonly message: string
  readonly schedule: string
  readonly timezone: string
  readonly enabled: boolean
  readonly maestroEnabled: boolean
  readonly lastRunAt: string | null
  readonly nextRunAt: string | null
  readonly lastStatus: string | null
  readonly createdAt: string
}

// ─── Schedule presets ───────────────────────────────────────────────────────

const PRESETS: readonly { label: string; cron: string }[] = [
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every 2 hours', cron: '0 */2 * * *' },
  { label: 'Every day at 9am', cron: '0 9 * * *' },
  { label: 'Weekdays at 9am', cron: '0 9 * * 1-5' },
  { label: 'Every Monday at 9am', cron: '0 9 * * 1' },
]

// ─── Props ──────────────────────────────────────────────────────────────────

export interface SchedulesPanelProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SchedulesPanel({ open, onOpenChange }: SchedulesPanelProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  // Fetch tasks when panel opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    apiGet<ScheduledTask[]>('/api/schedules')
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [open])

  const handleToggle = useCallback(async (task: ScheduledTask) => {
    try {
      const updated = await apiPatch<ScheduledTask>(`/api/schedules/${task.id}`, {
        enabled: !task.enabled,
      })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    } catch { /* best-effort */ }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiDelete(`/api/schedules/${id}`)
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch { /* best-effort */ }
  }, [])

  const handleRunNow = useCallback(async (id: string) => {
    try {
      await apiPost(`/api/schedules/${id}/run-now`, {})
      // Refresh to get updated lastRunAt
      const updated = await apiGet<ScheduledTask[]>('/api/schedules')
      setTasks(updated)
    } catch { /* best-effort */ }
  }, [])

  const handleCreated = useCallback((task: ScheduledTask) => {
    setTasks((prev) => [task, ...prev])
    setCreateOpen(false)
  }, [])

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const statusColor = (status: string | null) => {
    if (status === 'success') return 'text-green-400'
    if (status === 'error') return 'text-red-400'
    if (status === 'running') return 'text-blue-400'
    return 'text-muted-foreground'
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[420px] sm:w-[480px]">
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" aria-hidden />
            Scheduled Tasks
          </SheetTitle>

          <div className="mt-4 flex flex-col gap-3">
            <Button size="sm" className="gap-1.5 self-start" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New Schedule
            </Button>

            <Separator />

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && tasks.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No scheduled tasks yet.
              </p>
            )}

            {tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border bg-card p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {task.type === 'agent' ? (
                        <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      ) : (
                        <Workflow className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      )}
                      <span className="text-sm font-medium">{task.name}</span>
                      <Badge
                        variant={task.enabled ? 'default' : 'secondary'}
                        className="text-[9px]"
                      >
                        {task.enabled ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      <code className="rounded bg-muted px-1">{task.schedule}</code>
                      {' '}({task.timezone})
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleRunNow(task.id)}
                      aria-label="Run now"
                      title="Run now"
                    >
                      <Zap className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleToggle(task)}
                      aria-label={task.enabled ? 'Pause' : 'Resume'}
                      title={task.enabled ? 'Pause' : 'Resume'}
                    >
                      {task.enabled ? (
                        <Pause className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Play className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(task.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
                  <span>
                    Last: {formatDate(task.lastRunAt)}
                    {task.lastStatus && (
                      <span className={` ml-1 ${statusColor(task.lastStatus)}`}>
                        ({task.lastStatus})
                      </span>
                    )}
                  </span>
                  <span>Next: {formatDate(task.nextRunAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <CreateScheduleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </>
  )
}

// ─── Create Schedule Dialog ─────────────────────────────────────────────────

interface CreateScheduleDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onCreated: (task: ScheduledTask) => void
}

function CreateScheduleDialog({ open, onOpenChange, onCreated }: CreateScheduleDialogProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'agent' | 'workflow'>('agent')
  const [targetId, setTargetId] = useState('')
  const [message, setMessage] = useState('')
  const [schedule, setSchedule] = useState('0 9 * * *')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || !targetId.trim()) return
    setSaving(true)
    try {
      const task = await apiPost<ScheduledTask>('/api/schedules', {
        name: name.trim(),
        type,
        targetId: targetId.trim(),
        message: message.trim(),
        schedule,
        timezone,
      })
      onCreated(task)
      // Reset form
      setName('')
      setTargetId('')
      setMessage('')
      setSchedule('0 9 * * *')
    } catch { /* best-effort */ }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Scheduled Task</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            placeholder="Schedule name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex gap-2">
            <Button
              variant={type === 'agent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('agent')}
              className="flex-1 gap-1"
            >
              <Bot className="h-3.5 w-3.5" aria-hidden />
              Agent
            </Button>
            <Button
              variant={type === 'workflow' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('workflow')}
              className="flex-1 gap-1"
            >
              <Workflow className="h-3.5 w-3.5" aria-hidden />
              Workflow
            </Button>
          </div>

          <Input
            placeholder={type === 'agent' ? 'Agent ID' : 'Saved Workflow ID'}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          />

          <Textarea
            placeholder="Message / task prompt"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[60px]"
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Schedule</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.cron}
                  type="button"
                  onClick={() => setSchedule(preset.cron)}
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] transition-colors ${
                    schedule === preset.cron
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <Input
              placeholder="Cron expression (e.g. 0 9 * * 1-5)"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <Input
            placeholder="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="text-xs"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !targetId.trim()}
          >
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden /> : null}
            Create Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
