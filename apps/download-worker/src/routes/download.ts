import type { Env } from '../types/env'
import { proxyDownload } from '../services/proxy-download'
import { resolveDownloadRequest } from '../services/resolve-download-request'
import { createErrorResponder } from '../helpers/response'

export const handleDownloadRequest = async (request: Request, env: Env, ctx: ExecutionContext) => {
  const errorResponse = createErrorResponder(env)

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return errorResponse(405, 'Method Not Allowed')
  }

  const resolved = await resolveDownloadRequest(request, env, errorResponse)
  if (!resolved.ok) {
    return resolved.response
  }

  return proxyDownload({
    request,
    env,
    ctx,
    errorResponse,
    ...resolved.value,
  })
}
