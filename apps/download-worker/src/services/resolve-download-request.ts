import { buildOriginHeaders } from '../helpers/request'
import { decryptTicket } from './download-ticket'
import type { Env } from '../types/env'
import type { ErrorResponder } from '../types/response'
import type { DownloadRequestResolution } from '../types/download-request-context'
import type { DownloadProxyTicketPayload } from '../types/download-proxy-ticket'

const DOWNLOAD_ROUTE = /^\/dl\/(\d+)\/([^/]+)$/

export const resolveDownloadRequest = async (
  request: Request,
  env: Env,
  errorResponse: ErrorResponder,
): Promise<DownloadRequestResolution> => {
  const url = new URL(request.url)
  const ticket = url.searchParams.get('ticket')
  if (!ticket) {
    return reject(errorResponse(400, 'Missing ticket'))
  }

  const ticketPayload = await decryptTicket(ticket, env.TICKET_SECRET)
  if (!ticketPayload) {
    return reject(errorResponse(403, 'Invalid ticket'))
  }
  if (ticketPayload.exp <= Math.floor(Date.now() / 1000)) {
    return reject(errorResponse(410, 'Expired ticket'))
  }

  const routeMatch = url.pathname.match(DOWNLOAD_ROUTE)
  if (!routeMatch) {
    return reject(errorResponse(404, 'Not Found'))
  }

  const [, fileIdRaw, sessionIdRaw] = routeMatch
  const fileId = Number(fileIdRaw)
  const sessionId = decodeURIComponent(sessionIdRaw)
  if (fileId !== ticketPayload.fid || sessionId !== ticketPayload.sid) {
    return reject(errorResponse(403, 'Ticket mismatch'))
  }

  const originUrl = buildOriginUrl(ticketPayload)
  if (!originUrl) {
    return reject(errorResponse(403, 'Invalid ticket'))
  }

  const originRequest = new Request(originUrl, {
    method: request.method,
    headers: buildOriginHeaders(request),
    redirect: 'follow',
  })

  return {
    ok: true,
    value: {
      originRequest,
      ticketPayload,
    },
  }
}

const reject = (response: Response): DownloadRequestResolution => ({
  ok: false,
  response,
})

const buildOriginUrl = (ticketPayload: DownloadProxyTicketPayload) => {
  try {
    const downloadUrl = new URL(ticketPayload.u)
    if (downloadUrl.protocol !== 'https:') return null

    const bucketName = encodeURIComponent(ticketPayload.b)
    const fileKey = encodeURIComponent(ticketPayload.k)
    const authorizationToken = encodeURIComponent(ticketPayload.a)
    return `${downloadUrl.origin}/file/${bucketName}/${fileKey}?Authorization=${authorizationToken}`
  } catch {
    return null
  }
}
