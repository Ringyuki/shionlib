import type { Env } from './types/env'
import { DownloadLimiter } from './durable-objects/download-limiter'
import { handleDownloadRequest } from './routes/download'

export default {
  fetch(request, env, ctx) {
    return handleDownloadRequest(request, env as Env, ctx)
  },
} satisfies ExportedHandler<Env>

export { DownloadLimiter }
