'use client'

import { useEffect, useState, useCallback } from 'react'
import { DollarSign, Loader2, BarChart3 } from 'lucide-react'
import { apiGet } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CostData {
  readonly period: { days: number; since: string }
  readonly total: {
    costUsd: number
    inputTokens: number
    outputTokens: number
    sessions: number
  }
  readonly byModel: Record<
    string,
    { inputTokens: number; outputTokens: number; costUsd: number; count: number }
  >
}

// ─── CSS bar chart ──────────────────────────────────────────────────────────

function CostBar({
  label,
  value,
  maxValue,
  color,
}: {
  readonly label: string
  readonly value: number
  readonly maxValue: number
  readonly color: string
}) {
  const pct = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 0

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-muted h-3">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-16 shrink-0 text-[10px] text-muted-foreground">${value.toFixed(4)}</span>
    </div>
  )
}

// ─── Model colors ───────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4-5': '#a78bfa',
  'claude-sonnet-4-5': '#60a5fa',
  'claude-haiku-4-5': '#34d399',
}

function getModelColor(model: string): string {
  return MODEL_COLORS[model] ?? '#94a3b8'
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CostDashboard() {
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const result = await apiGet<CostData>('/api/analytics/cost?days=30')
      setData(result)
    } catch {
      // best effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || data.total.sessions === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No usage data yet</p>
        <p className="text-xs text-muted-foreground/70">
          Run agents to see cost tracking here.
        </p>
      </div>
    )
  }

  const modelEntries = Object.entries(data.byModel)
  const maxCost = Math.max(...modelEntries.map(([, v]) => v.costUsd))

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3 text-center">
          <DollarSign className="mx-auto h-4 w-4 text-green-400" />
          <p className="mt-1 text-lg font-bold">${data.total.costUsd.toFixed(4)}</p>
          <p className="text-[10px] text-muted-foreground">Total cost</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="mt-1 text-lg font-bold">{data.total.sessions}</p>
          <p className="text-[10px] text-muted-foreground">Sessions</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="mt-1 text-lg font-bold">
            {((data.total.inputTokens + data.total.outputTokens) / 1000).toFixed(1)}k
          </p>
          <p className="text-[10px] text-muted-foreground">Tokens</p>
        </div>
      </div>

      {/* Breakdown by model */}
      <div>
        <p className="mb-2 text-xs font-medium">Cost by Model (last {data.period.days} days)</p>
        <div className="flex flex-col gap-2">
          {modelEntries.map(([model, stats]) => (
            <CostBar
              key={model}
              label={model.replace('claude-', '').replace('-4-5', '')}
              value={stats.costUsd}
              maxValue={maxCost}
              color={getModelColor(model)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
