import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { WorkflowGenerator } from '../engine/workflow-generator'

const GenerateBodySchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
})

const GENERATION_TIMEOUT_MS = 60_000

export async function workflowGeneratorRoutes(app: FastifyInstance) {
  const generator = new WorkflowGenerator()

  app.post('/api/workflows/generate', async (request, reply) => {
    const parsed = GenerateBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid input',
      })
    }

    try {
      const workflow = await Promise.race([
        generator.generate(parsed.data.description),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Workflow generation timed out after 60 seconds')), GENERATION_TIMEOUT_MS),
        ),
      ])
      return reply.send({ success: true, data: workflow })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Workflow generation failed'
      const isTimeout = message.includes('timed out')
      console.error('[WorkflowGenerator Route]', isTimeout ? 'TIMEOUT' : 'ERROR', message)
      return reply.status(isTimeout ? 504 : 500).send({ success: false, error: message })
    }
  })
}
