import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import type { TokenUsage } from '@orchestra/shared'
import type { MergedMcpConfig } from './mcp-config-builder'

export interface SpawnOptions {
  readonly agentId: string
  readonly sessionId: string
  readonly message: string
  readonly systemPrompt: string
  readonly appendSystemPrompt?: string
  readonly allowedTools?: readonly string[]
  readonly model?: string
  readonly permissionMode?: string
  readonly maxBudgetUsd?: number
  readonly env?: Record<string, string>
  readonly mcpConfig?: MergedMcpConfig
  readonly addDirs?: string[]
}

export interface StreamEvent {
  readonly type: string
  readonly [key: string]: unknown
}

export interface SpawnerEvents {
  text: (data: { content: string; partial: boolean }) => void
  tool_use: (data: { toolName: string; input: unknown; id: string }) => void
  tool_result: (data: { toolName: string; output: unknown; toolUseId: string }) => void
  completion: (data: { exitCode: number }) => void
  usage: (data: TokenUsage) => void
  error: (err: Error) => void
}

// Resolve the claude CLI command name cross-platform.
// On Windows the CLI binary is `claude.cmd`; on Unix it is `claude`.
function resolveClaudeCommand(): string {
  // claude is installed as claude.exe on Windows (not .cmd)
  return 'claude'
}

// Build the allowed-env object passed to the child process.
// Only forward a safe, minimal set of variables [G20].
function buildChildEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const allowed: Array<keyof NodeJS.ProcessEnv> = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'ANTHROPIC_API_KEY',
    'LANG',
    'TERM',
    'APPDATA',        // needed by npm/node on Windows
    'LOCALAPPDATA',   // needed by npm/node on Windows
    'TEMP',
    'TMP',
    'SystemRoot',     // needed on Windows for system tools
    'ComSpec',        // cmd.exe path on Windows
  ]

  const env: NodeJS.ProcessEnv = {}
  for (const key of allowed) {
    const val = process.env[key as string]
    if (val !== undefined) {
      env[key as string] = val
    }
  }

  // Merge caller-supplied extras (never DATABASE_URL etc.)
  for (const [k, v] of Object.entries(extra)) {
    const upper = k.toUpperCase()
    if (upper !== 'DATABASE_URL' && upper !== 'SESSION_SECRET') {
      env[k] = v
    }
  }

  return env
}

export class ClaudeCodeSpawner extends EventEmitter {
  private _process: ChildProcess | null = null
  private _stderrBuffer = ''

  spawn(options: SpawnOptions): void {
    if (this._process !== null) {
      throw new Error(`Spawner for agent ${options.agentId} already has a running process`)
    }

    const args = this.buildArgs(options)
    const env = buildChildEnv(options.env)
    const command = resolveClaudeCommand()

    // [G8] Never use shell: true — spawn directly with args array
    this._process = spawn(command, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      // On Unix create a new process group so we can kill the whole tree
      ...(process.platform !== 'win32' && { detached: true }),
    })

    this._process.stdout?.setEncoding('utf8')
    this._process.stderr?.setEncoding('utf8')

    let stdoutBuffer = ''

    this._process.stdout?.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split('\n')
      // Keep the last (potentially incomplete) line in the buffer
      stdoutBuffer = lines.pop() ?? ''
      for (const raw of lines) {
        // Strip \r for Windows line endings
        const line = raw.replace(/\r$/, '').trim()
        if (line.length === 0) continue
        this.handleLine(line)
      }
    })

    this._process.stderr?.on('data', (chunk: string) => {
      this._stderrBuffer += chunk
    })

    this._process.on('error', (err) => {
      this.emit('error', err)
      this._process = null
    })

    this._process.on('close', (code) => {
      // Flush any remaining buffered stdout
      if (stdoutBuffer.trim().length > 0) {
        this.handleLine(stdoutBuffer.replace(/\r$/, '').trim())
      }
      const exitCode = code ?? 0
      // Only treat as error if exit code is non-zero AND stderr contains
      // something other than benign warnings (like the stdin warning)
      const stderrContent = this._stderrBuffer.trim()
      const isBenignStderr = !stderrContent || stderrContent.includes('no stdin data received')
      if (exitCode !== 0 && !isBenignStderr) {
        this.emit('error', new Error(`Claude exited with code ${exitCode}: ${stderrContent}`))
      } else {
        this.emit('completion', { exitCode })
      }
      this._process = null
    })
  }

  // Send a follow-up message via stdin (stream-json continuation)
  sendMessage(message: string): void {
    if (!this._process?.stdin) {
      throw new Error('No running process to send a message to')
    }
    const payload = JSON.stringify({ type: 'user', message }) + '\n'
    this._process.stdin.write(payload)
  }

  kill(): void {
    if (!this._process) return
    const pid = this._process.pid

    if (pid === undefined) {
      this._process.kill('SIGKILL')
      this._process = null
      return
    }

    // [G13] Platform-specific process tree kill
    if (process.platform === 'win32') {
      // taskkill /T kills the entire process tree; /F forces it
      spawn('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore' })
    } else {
      // Use negative PID to kill the entire process group (requires detached: true)
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {
        // Fall back to killing the direct process if group kill fails
        this._process.kill('SIGKILL')
      }
    }
    this._process = null
  }

  get isRunning(): boolean {
    return this._process !== null
  }

  get pid(): number | null {
    return this._process?.pid ?? null
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private buildArgs(options: SpawnOptions): string[] {
    const args: string[] = [
      '--print',
      '--verbose',
      '--output-format', 'stream-json',
      '--permission-mode', options.permissionMode ?? 'dontAsk',
      '--system-prompt', options.systemPrompt,
      '--session-id', options.sessionId,
      '--name', `orchestra-${options.agentId}`,
      '--no-session-persistence',
    ]

    if (options.model) {
      args.push('--model', options.model)
    }

    if (options.appendSystemPrompt) {
      args.push('--append-system-prompt', options.appendSystemPrompt)
    }

    if (options.allowedTools && options.allowedTools.length > 0) {
      args.push('--allowedTools', options.allowedTools.join(','))
    }

    if (options.maxBudgetUsd !== undefined) {
      args.push('--max-budget-usd', String(options.maxBudgetUsd))
    }

    if (options.mcpConfig && Object.keys(options.mcpConfig.mcpServers).length > 0) {
      // Serialize only the mcpServers map — conflicts are internal metadata
      const serialized = JSON.stringify({ mcpServers: options.mcpConfig.mcpServers })
      args.push('--mcp-config', serialized)
    }

    if (options.addDirs?.length) {
      for (const dir of options.addDirs) {
        args.push('--add-dir', dir)
      }
    }

    // The initial message is the final positional argument
    args.push(options.message)

    return args
  }

  private handleLine(line: string): void {
    let event: StreamEvent
    try {
      event = JSON.parse(line) as StreamEvent
    } catch {
      // Non-JSON lines (e.g., debug output) — ignore silently
      return
    }

    this.dispatchEvent(event)
  }

  private dispatchEvent(event: StreamEvent): void {
    switch (event.type) {
      // ── Claude Code CLI stream-json format ──────────────────────────

      case 'assistant': {
        // {"type":"assistant","message":{"content":[{"type":"text","text":"..."}],"usage":{...}}}
        const msg = event.message as {
          content?: Array<{ type: string; text?: string; name?: string; input?: unknown; id?: string }>
          usage?: { input_tokens?: number; output_tokens?: number }
          stop_reason?: string | null
        } | undefined

        if (!msg?.content) break

        for (const block of msg.content) {
          if (block.type === 'text' && typeof block.text === 'string') {
            const isPartial = msg.stop_reason === null
            this.emit('text', { content: block.text, partial: isPartial })
          }
          if (block.type === 'tool_use' && block.name) {
            this.emit('tool_use', {
              toolName: block.name,
              input: block.input ?? {},
              id: block.id ?? '',
            })
          }
          if (block.type === 'tool_result') {
            this.emit('tool_result', {
              toolName: (block as any).tool_name ?? 'unknown',
              output: (block as any).output ?? {},
              toolUseId: (block as any).tool_use_id ?? '',
            })
          }
        }

        // Emit usage if present
        if (msg.usage) {
          const inputTokens = msg.usage.input_tokens ?? 0
          const outputTokens = msg.usage.output_tokens ?? 0
          const estimatedCostUsd = inputTokens * 0.000003 + outputTokens * 0.000015
          this.emit('usage', { inputTokens, outputTokens, estimatedCostUsd })
        }
        break
      }

      case 'result': {
        // {"type":"result","result":"Hello","total_cost_usd":0.15,"usage":{...}}
        const resultContent = event.result as string | undefined
        if (resultContent && resultContent.length > 0) {
          this.emit('text', { content: resultContent, partial: false })
        }

        // Extract usage from the result event
        const resultUsage = event.usage as {
          input_tokens?: number
          output_tokens?: number
        } | undefined
        if (resultUsage) {
          const inputTokens = resultUsage.input_tokens ?? 0
          const outputTokens = resultUsage.output_tokens ?? 0
          const totalCost = (event.total_cost_usd as number | undefined) ?? (inputTokens * 0.000003 + outputTokens * 0.000015)
          this.emit('usage', { inputTokens, outputTokens, estimatedCostUsd: totalCost })
        }
        break
      }

      case 'rate_limit_event':
        // Rate limit info — log but don't surface to user
        break

      case 'system':
      case 'init':
      case 'ping':
        // Lifecycle events — no action needed
        break

      default:
        // Unknown event types are silently ignored
        break
    }
  }
}
