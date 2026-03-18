import type { Env } from '../types/env'
import { proxyDownload } from '../services/proxy-download'
import { resolveDownloadRequest } from '../services/resolve-download-request'

export const handleDownloadRequest = async (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const resolved = await resolveDownloadRequest(request, env)
  if (!resolved.ok) {
    return resolved.response
  }

  return proxyDownload({
    request,
    env,
    ctx,
    ...resolved.value,
  })
}
