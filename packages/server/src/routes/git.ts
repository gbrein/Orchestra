import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sendSuccess, sendError } from '../lib/errors'
import * as git from '../lib/git'

const PathsSchema = z.object({
  paths: z.array(z.string().min(1)).min(1),
})

const CommitSchema = z.object({
  message: z.string().min(1).max(1000),
})

const LogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
})

const DiffQuerySchema = z.object({
  file: z.string().optional(),
})

export async function gitRoutes(app: FastifyInstance) {
  app.get('/api/git/status', async (_req, reply) => {
    try {
      const status = await git.getStatus()
      sendSuccess(reply, status)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.get('/api/git/log', async (req, reply) => {
    try {
      const { limit } = LogQuerySchema.parse(req.query)
      const log = await git.getLog(limit)
      sendSuccess(reply, log)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.get('/api/git/branches', async (_req, reply) => {
    try {
      const branches = await git.getBranches()
      sendSuccess(reply, branches)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.get('/api/git/diff', async (req, reply) => {
    try {
      const { file } = DiffQuerySchema.parse(req.query)
      const diff = await git.getDiff(file)
      sendSuccess(reply, diff)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.post('/api/git/stage', async (req, reply) => {
    try {
      const { paths } = PathsSchema.parse(req.body)
      await git.stageFiles(paths)
      sendSuccess(reply, { staged: paths })
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.post('/api/git/unstage', async (req, reply) => {
    try {
      const { paths } = PathsSchema.parse(req.body)
      await git.unstageFiles(paths)
      sendSuccess(reply, { unstaged: paths })
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.post('/api/git/commit', async (req, reply) => {
    try {
      const { message } = CommitSchema.parse(req.body)
      const hash = await git.commit(message)
      sendSuccess(reply, { hash, message })
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.post('/api/git/push', async (_req, reply) => {
    try {
      const result = await git.push()
      sendSuccess(reply, result)
    } catch (error) {
      sendError(reply, error)
    }
  })
}
