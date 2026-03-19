import type { Env } from './env'
import type { DownloadRequestContext } from './download-request-context'
import type { ErrorResponder } from './response'

export type ProxyDownloadInput = DownloadRequestContext & {
  request: Request
  env: Env
  ctx: ExecutionContext
  errorResponse: ErrorResponder
}
