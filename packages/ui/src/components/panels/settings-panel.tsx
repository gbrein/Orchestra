'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useTheme, type ThemeMode } from '@/hooks/use-theme'

// ─── Types ─────────────────────────────────────────────────────────────────

type SafetyLevel = 'cautious' | 'balanced' | 'autonomous'
type DefaultModel = 'deep-thinker' | 'all-rounder' | 'quick-helper'
type ConnectionStatus = 'connected' | 'disconnected' | 'checking'

export interface SettingsPanelProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

// ─── Storage keys ──────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'orchestra:settings:'

function storageGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function storageSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value))
  } catch {
    // Ignore write errors
  }
}

// ─── Section wrapper ───────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

// ─── Slider row ────────────────────────────────────────────────────────────

function SliderRow({
  label,
  min,
  max,
  value,
  onChange,
  leftLabel,
  rightLabel,
}: {
  readonly label: string
  readonly min: number
  readonly max: number
  readonly value: number
  readonly onChange: (v: number) => void
  readonly leftLabel?: string
  readonly rightLabel?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-3">
        {leftLabel && (
          <span className="shrink-0 text-xs text-muted-foreground">{leftLabel}</span>
        )}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-primary"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
        {rightLabel && (
          <span className="shrink-0 text-xs text-muted-foreground">{rightLabel}</span>
        )}
      </div>
    </div>
  )
}

// ─── Radio group row ───────────────────────────────────────────────────────

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string
  readonly options: ReadonlyArray<{ value: T; label: string; description?: string }>
  readonly value: T
  readonly onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
              value === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50',
            )}
          >
            <input
              type="radio"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 accent-primary"
              aria-label={opt.label}
            />
            <div>
              <p className="text-sm font-medium leading-tight">{opt.label}</p>
              {opt.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Toggle row ────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  warning,
}: {
  readonly label: string
  readonly description?: string
  readonly checked: boolean
  readonly onChange: (v: boolean) => void
  readonly warning?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            checked ? 'bg-primary' : 'bg-muted',
          )}
          aria-label={label}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
              checked ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        </button>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {warning && checked && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
          <p className="text-xs text-amber-400">{warning}</p>
        </div>
      )}
    </div>
  )
}

// ─── Connection indicator ──────────────────────────────────────────────────

function ConnectionIndicator({ status }: { readonly status: ConnectionStatus }) {
  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Checking…
      </span>
    )
  }
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Connected
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" aria-hidden />
      Unreachable
    </span>
  )
}

// ─── SettingsPanel ─────────────────────────────────────────────────────────

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  // ── Theme ────────────────────────────────────────────────────────────
  const { mode: themeMode, setMode: setThemeMode } = useTheme()

  // ── Appearance ────────────────────────────────────────────────────────
  const [complexity, setComplexity] = useState(() => storageGet<number>('complexity', 5))

  // ── Connection ────────────────────────────────────────────────────────
  const [serverUrl, setServerUrl] = useState(() =>
    storageGet<string>('serverUrl', 'http://localhost:3001'),
  )
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  // ── Safety ────────────────────────────────────────────────────────────
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>(() =>
    storageGet<SafetyLevel>('safetyLevel', 'balanced'),
  )

  // ── Models ────────────────────────────────────────────────────────────
  const [defaultModel, setDefaultModel] = useState<DefaultModel>(() =>
    storageGet<DefaultModel>('defaultModel', 'all-rounder'),
  )

  // ── Advanced ──────────────────────────────────────────────────────────
  const [agentTeams, setAgentTeams] = useState(() => storageGet<boolean>('agentTeams', false))
  const [maxConcurrent, setMaxConcurrent] = useState(() =>
    storageGet<number>('maxConcurrent', 5),
  )
  const [maxBudget, setMaxBudget] = useState(() => storageGet<string>('maxBudget', ''))

  // Persist all settings to localStorage on change
  useEffect(() => { storageSet('complexity', complexity) }, [complexity])
  useEffect(() => { storageSet('serverUrl', serverUrl) }, [serverUrl])
  useEffect(() => { storageSet('safetyLevel', safetyLevel) }, [safetyLevel])
  useEffect(() => { storageSet('defaultModel', defaultModel) }, [defaultModel])
  useEffect(() => { storageSet('agentTeams', agentTeams) }, [agentTeams])
  useEffect(() => { storageSet('maxConcurrent', maxConcurrent) }, [maxConcurrent])
  useEffect(() => { storageSet('maxBudget', maxBudget) }, [maxBudget])

  function handleTestConnection() {
    setConnectionStatus('checking')
    // Simulate a connectivity probe — replace with real fetch in production
    setTimeout(() => {
      setConnectionStatus(serverUrl.includes('localhost') ? 'connected' : 'disconnected')
    }, 1200)
  }

  const complexityLabel =
    complexity <= 3 ? 'Simple' : complexity <= 7 ? 'Standard' : 'Full Control'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[500px] flex-col gap-0 p-0 sm:w-[500px]"
        aria-label="Settings"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
          <SheetTitle className="text-base">Settings</SheetTitle>
          <SheetDescription className="sr-only">
            Configure Orchestra preferences. Changes are saved automatically.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          {/* Appearance */}
          <Section title="Appearance">
            <RadioGroup<ThemeMode>
              label="Theme"
              value={themeMode}
              onChange={setThemeMode}
              options={[
                { value: 'system', label: 'System', description: 'Follow your OS preference.' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <SliderRow
              label={`Interface Complexity — ${complexityLabel}`}
              min={1}
              max={10}
              value={complexity}
              onChange={setComplexity}
              leftLabel="Simple"
              rightLabel="Full Control"
            />
          </Section>

          <Separator />

          {/* Connection */}
          <Section title="Connection">
            <div className="flex flex-col gap-2">
              <label htmlFor="server-url" className="text-sm font-medium">
                Server URL
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="server-url"
                  value={serverUrl}
                  onChange={(e) => {
                    setServerUrl(e.target.value)
                    setConnectionStatus('disconnected')
                  }}
                  placeholder="http://localhost:3001"
                  className="flex-1 text-sm"
                  aria-describedby="server-url-status"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-xs"
                  onClick={handleTestConnection}
                  disabled={connectionStatus === 'checking'}
                  aria-label="Test connection"
                >
                  Test
                </Button>
              </div>
              <div id="server-url-status">
                <ConnectionIndicator status={connectionStatus} />
              </div>
            </div>
          </Section>

          <Separator />

          {/* Safety */}
          <Section title="Safety">
            <RadioGroup<SafetyLevel>
              label="Global safety level"
              value={safetyLevel}
              onChange={setSafetyLevel}
              options={[
                {
                  value: 'cautious',
                  label: 'Cautious',
                  description: 'Approve every tool call. Best for sensitive environments.',
                },
                {
                  value: 'balanced',
                  label: 'Balanced',
                  description: 'Approve risky operations; allow safe ones automatically.',
                },
                {
                  value: 'autonomous',
                  label: 'Autonomous',
                  description: 'Agents act without approval. Use with trusted workflows only.',
                },
              ]}
            />
          </Section>

          <Separator />

          {/* Models */}
          <Section title="Models">
            <RadioGroup<DefaultModel>
              label="Default model"
              value={defaultModel}
              onChange={setDefaultModel}
              options={[
                {
                  value: 'deep-thinker',
                  label: 'Deep Thinker',
                  description: 'Opus — best reasoning, higher cost.',
                },
                {
                  value: 'all-rounder',
                  label: 'All-Rounder',
                  description: 'Sonnet — balanced speed and capability.',
                },
                {
                  value: 'quick-helper',
                  label: 'Quick Helper',
                  description: 'Haiku — fast and economical.',
                },
              ]}
            />
          </Section>

          <Separator />

          {/* Advanced */}
          <Section title="Advanced">
            <ToggleRow
              label="Agent Teams"
              description="Allow agents to spawn sub-agents and coordinate as a team."
              checked={agentTeams}
              onChange={setAgentTeams}
              warning="Agent teams significantly increase token usage and cost per session."
            />

            <SliderRow
              label={`Max Concurrent Agents — ${maxConcurrent}`}
              min={1}
              max={10}
              value={maxConcurrent}
              onChange={setMaxConcurrent}
              leftLabel="1"
              rightLabel="10"
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="max-budget" className="text-sm font-medium">
                Max Budget per Session ($)
              </label>
              <Input
                id="max-budget"
                type="number"
                min={0}
                step={0.01}
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder="No limit"
                className="text-sm"
                aria-describedby="max-budget-desc"
              />
              <p id="max-budget-desc" className="text-xs text-muted-foreground">
                Sessions will pause and request confirmation when this threshold is reached.
              </p>
            </div>
          </Section>

          <Separator />

          {/* About */}
          <Section title="About">
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono text-xs">0.1.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">License</span>
                <span className="text-xs">MIT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">GitHub</span>
                <a
                  href="https://github.com/orchestra-ai/orchestra"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  aria-label="Open Orchestra GitHub repository (opens in new tab)"
                >
                  orchestra-ai/orchestra
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </div>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
