import type { FastifyReply } from 'fastify'
import type { ZodError } from 'zod'
import type { ApiResponse } from '@orchestra/shared'

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 404, 'NOT_FOUND')
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export function formatZodError(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
}

export function sendError(reply: FastifyReply, error: unknown): void {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      success: false,
      error: error.message,
    } satisfies ApiResponse<never>)
    return
  }

  if (isZodError(error)) {
    reply.status(400).send({
      success: false,
      error: formatZodError(error),
    } satisfies ApiResponse<never>)
    return
  }

  const message = error instanceof Error ? error.message : 'Internal server error'
  reply.status(500).send({
    success: false,
    error: message,
  } satisfies ApiResponse<never>)
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof Error && error.name === 'ZodError'
}

export function sendSuccess<T>(reply: FastifyReply, data: T, statusCode = 200): void {
  reply.status(statusCode).send({
    success: true,
    data,
  } satisfies ApiResponse<T>)
}
