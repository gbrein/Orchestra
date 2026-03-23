// Scheduler — manages cron-based recurring execution of workflows and agents.

import { Cron } from 'croner'
import { prisma } from '../lib/prisma'
import { ClaudeCodeSpawner } from './spawner'
import { randomUUID } from 'crypto'
import type { Server as SocketIOServer } from 'socket.io'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScheduledJob {
  readonly taskId: string
  readonly cron: Cron
}

interface SchedulerOptions {
  readonly io: SocketIOServer
}

// ─── Scheduler Class ────────────────────────────────────────────────────────

export class Scheduler {
  private readonly jobs = new Map<string, ScheduledJob>()
  private readonly io: SocketIOServer

  constructor(options: SchedulerOptions) {
    this.io = options.io
  }

  /** Load all enabled tasks from DB and start their cron jobs. */
  async start(): Promise<void> {
    const tasks = await prisma.scheduledTask.findMany({
      where: { enabled: true },
    })

    for (const task of tasks) {
      this.scheduleTask(task.id, task.schedule, task.timezone)
    }
  }

  /** Stop all cron jobs (graceful shutdown). */
  stop(): void {
    for (const job of this.jobs.values()) {
      job.cron.stop()
    }
    this.jobs.clear()
  }

  /** Add or replace a cron job for a task. */
  scheduleTask(taskId: string, cronExpression: string, timezone: string): void {
    // Remove existing job if any
    this.unscheduleTask(taskId)

    const cron = new Cron(cronExpression, { timezone }, () => {
      void this.executeTask(taskId)
    })

    this.jobs.set(taskId, { taskId, cron })

    // Update nextRunAt in DB
    const nextRun = cron.nextRun()
    if (nextRun) {
      void prisma.scheduledTask.update({
        where: { id: taskId },
        data: { nextRunAt: nextRun },
      }).catch(() => {})
    }
  }

  /** Remove a cron job for a task. */
  unscheduleTask(taskId: string): void {
    const existing = this.jobs.get(taskId)
    if (existing) {
      existing.cron.stop()
      this.jobs.delete(taskId)
    }
  }

  /** Execute a task immediately (manual trigger or cron tick). */
  async executeTask(taskId: string): Promise<void> {
    const task = await prisma.scheduledTask.findUnique({ where: { id: taskId } })
    if (!task || !task.enabled) return

    // Update status to running
    await prisma.scheduledTask.update({
      where: { id: taskId },
      data: { lastStatus: 'running', lastRunAt: new Date() },
    }).catch(() => {})

    this.io.emit('schedule:run_start' as any, { taskId, name: task.name })

    try {
      if (task.type === 'agent') {
        await this.executeAgentTask(task.targetId, task.message)
      } else {
        await this.executeWorkflowTask(task.targetId, task.message)
      }

      await prisma.scheduledTask.update({
        where: { id: taskId },
        data: {
          lastStatus: 'success',
          nextRunAt: this.jobs.get(taskId)?.cron.nextRun() ?? null,
        },
      }).catch(() => {})

      this.io.emit('schedule:run_complete' as any, { taskId, name: task.name, status: 'success' })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'

      await prisma.scheduledTask.update({
        where: { id: taskId },
        data: {
          lastStatus: 'error',
          nextRunAt: this.jobs.get(taskId)?.cron.nextRun() ?? null,
        },
      }).catch(() => {})

      this.io.emit('schedule:run_error' as any, { taskId, name: task.name, error: errorMsg })
    }
  }

  /** Spawn a single agent with a message. */
  private executeAgentTask(agentId: string, message: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const spawner = new ClaudeCodeSpawner()

      spawner.on('completion', () => resolve())
      spawner.on('error', (err: Error) => reject(err))

      try {
        spawner.spawn({
          agentId: `sched-${agentId.slice(0, 8)}`,
          sessionId: randomUUID(),
          message: message || 'Execute your assigned task.',
          systemPrompt: 'You are a helpful assistant executing a scheduled task. Complete the task thoroughly.',
          permissionMode: 'plan',
          maxBudgetUsd: 0.20,
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  /** Load a saved workflow and execute it as a simple sequential chain. */
  private async executeWorkflowTask(workflowId: string, message: string): Promise<void> {
    const saved = await prisma.savedWorkflow.findUnique({ where: { id: workflowId } })
    if (!saved) {
      throw new Error(`Saved workflow ${workflowId} not found`)
    }

    const workflow = saved.workflow as any
    const agents = Array.isArray(workflow.agents) ? workflow.agents : []

    // Execute agents sequentially, passing output forward
    let previousOutput = message || 'Execute this workflow.'

    for (const agent of agents) {
      previousOutput = await this.spawnAndCollect(
        agent.name ?? 'Agent',
        agent.persona ?? '',
        previousOutput,
        agent.model ?? 'sonnet',
      )
    }
  }

  private spawnAndCollect(
    name: string,
    systemPrompt: string,
    message: string,
    model: string,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const spawner = new ClaudeCodeSpawner()
      let output = ''

      spawner.on('text', (data: { content: string; partial: boolean }) => {
        if (data.partial) {
          output += data.content
        } else {
          output = data.content
        }
      })

      spawner.on('completion', () => resolve(output))
      spawner.on('error', (err: Error) => reject(err))

      const MODEL_IDS: Record<string, string> = {
        opus: 'claude-opus-4-5-20250514',
        sonnet: 'claude-sonnet-4-5-20250514',
        haiku: 'claude-haiku-4-5-20251001',
      }

      try {
        spawner.spawn({
          agentId: `sched-${randomUUID().slice(0, 8)}`,
          sessionId: randomUUID(),
          message,
          systemPrompt: systemPrompt || `You are ${name}. Complete the task given to you.`,
          model: MODEL_IDS[model] ?? MODEL_IDS.sonnet,
          permissionMode: 'plan',
          maxBudgetUsd: 0.15,
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }
}
