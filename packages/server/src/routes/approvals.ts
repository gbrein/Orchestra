import type { FastifyInstance } from 'fastify'
import { sendSuccess, sendError, NotFoundError } from '../lib/errors'
import type { ApprovalManager } from '../engine/approval-manager'

export function approvalRoutes(approvalManager: ApprovalManager) {
  return async function routes(app: FastifyInstance) {
    // GET /api/approvals — list all pending approvals
    app.get('/api/approvals', async (_req, reply) => {
      try {
        const approvals = approvalManager.getPending()
        sendSuccess(reply, approvals)
      } catch (error) {
        sendError(reply, error)
      }
    })

    // GET /api/approvals/count — pending count for notification badge
    app.get('/api/approvals/count', async (_req, reply) => {
      try {
        const count = approvalManager.getPendingCount()
        sendSuccess(reply, { count })
      } catch (error) {
        sendError(reply, error)
      }
    })

    // POST /api/approvals/:id/approve
    app.post<{ Params: { id: string } }>('/api/approvals/:id/approve', async (req, reply) => {
      try {
        const approval = approvalManager.approve(req.params.id)
        if (!approval) throw new NotFoundError('Approval', req.params.id)
        sendSuccess(reply, { approved: true, approval })
      } catch (error) {
        sendError(reply, error)
      }
    })

    // POST /api/approvals/:id/reject
    app.post<{ Params: { id: string } }>('/api/approvals/:id/reject', async (req, reply) => {
      try {
        const approval = approvalManager.reject(req.params.id)
        if (!approval) throw new NotFoundError('Approval', req.params.id)
        sendSuccess(reply, { rejected: true, approval })
      } catch (error) {
        sendError(reply, error)
      }
    })
  }
}
