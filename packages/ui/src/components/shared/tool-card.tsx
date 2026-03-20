'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  Wrench,
} from 'lucide-react'

export interface ToolCardData {
  readonly toolName: string
  readonly input: unknown
  readonly output?: unknown
  readonly id?: string
}

export interface ToolCardProps {
  readonly tool: ToolCardData
}

export function ToolCard({ tool }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`Tool: ${tool.toolName}. Click to ${expanded ? 'collapse' : 'expand'} details.`}
      >
        <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 font-mono font-medium">{tool.toolName}</span>
        {tool.output === undefined && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-label="Running" />
        )}
        {tool.output !== undefined && (
          <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" aria-label="Completed" />
        )}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 text-xs">
          <p className="mb-1 font-medium text-muted-foreground">Input</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-2 font-mono text-[11px] text-foreground">
            {JSON.stringify(tool.input, null, 2)}
          </pre>
          {tool.output !== undefined && (
            <>
              <p className="mb-1 mt-2 font-medium text-muted-foreground">Output</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-2 font-mono text-[11px] text-foreground">
                {typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}
