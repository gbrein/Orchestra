import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import type { TokenUsage } from '@orchestra/shared'

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
  return process.platform === 'win32' ? 'claude.cmd' : 'claude'
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
      const exitCode = code ?? 1
      if (exitCode !== 0 && this._stderrBuffer.length > 0) {
        this.emit('error', new Error(`Claude exited with code ${exitCode}: ${this._stderrBuffer.trim()}`))
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
      '--output-format', 'stream-json',
      '--include-partial-messages',
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
      case 'content_block_delta': {
        const delta = event.delta as { type?: string; text?: string } | undefined
        if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
          this.emit('text', { content: delta.text, partial: true })
        }
        break
      }

      case 'content_block_stop': {
        // Signals end of a streaming text block; emit a non-partial flush
        const content = (event.content as string | undefined) ?? ''
        if (content.length > 0) {
          this.emit('text', { content, partial: false })
        }
        break
      }

      case 'message_delta': {
        const usage = event.usage as { input_tokens?: number; output_tokens?: number } | undefined
        if (usage) {
          const inputTokens = usage.input_tokens ?? 0
          const outputTokens = usage.output_tokens ?? 0
          // Approximate cost: sonnet pricing as a reasonable default
          const estimatedCostUsd = inputTokens * 0.000003 + outputTokens * 0.000015
          this.emit('usage', { inputTokens, outputTokens, estimatedCostUsd })
        }
        break
      }

      case 'tool_use': {
        this.emit('tool_use', {
          toolName: (event.name as string | undefined) ?? 'unknown',
          input: event.input ?? {},
          id: (event.id as string | undefined) ?? '',
        })
        break
      }

      case 'tool_result': {
        this.emit('tool_result', {
          toolName: (event.tool_name as string | undefined) ?? 'unknown',
          output: event.output ?? {},
          toolUseId: (event.tool_use_id as string | undefined) ?? '',
        })
        break
      }

      case 'result': {
        // Final result event from stream-json — contains the full message
        const resultContent = event.result as string | undefined
        if (resultContent && resultContent.length > 0) {
          this.emit('text', { content: resultContent, partial: false })
        }
        break
      }

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
