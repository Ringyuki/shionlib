import type { ErrorResponseBody, ErrorResponder } from '../types/response'
import type { Env } from '../types/env'

export const createErrorResponder =
  (env: Env): ErrorResponder =>
  (status: number, message: string) =>
    Response.json(
      {
        code: status,
        message,
        timestamp: env.CF_VERSION_METADATA.timestamp,
        version: env.CF_VERSION_METADATA.id,
      } satisfies ErrorResponseBody,
      { status },
    )
