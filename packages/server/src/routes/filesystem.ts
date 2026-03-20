import { FastifyInstance } from 'fastify'
import { readdir, stat } from 'fs/promises'
import { join, dirname, resolve, sep } from 'path'
import { homedir } from 'os'
import { z } from 'zod'
import { sendSuccess, sendError, ValidationError } from '../lib/errors'

const BrowseSchema = z.object({
  path: z.string().optional(),
})

export async function filesystemRoutes(app: FastifyInstance) {
  app.get('/api/fs/browse', async (req, reply) => {
    try {
      const { path: rawPath } = BrowseSchema.parse(req.query)
      const targetPath = resolve(rawPath || homedir())

      // Validate path exists and is a directory
      const stats = await stat(targetPath)
      if (!stats.isDirectory()) {
        return sendError(reply, new ValidationError(`Not a directory: ${targetPath}`))
      }

      const entries = await readdir(targetPath, { withFileTypes: true })

      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

      // Check if it looks like a git repo
      const hasGit = entries.some((e) => e.name === '.git' && e.isDirectory())

      const parent = dirname(targetPath)

      sendSuccess(reply, {
        current: targetPath,
        parent: parent !== targetPath ? parent : null,
        dirs,
        hasGit,
        sep,
      })
    } catch (error) {
      sendError(reply, error)
    }
  })
}
