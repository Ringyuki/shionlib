import { buildOriginHeaders } from '../helpers/request'
import { normalizeBaseUrl } from '../helpers/url'
import { decryptTicket } from './download-ticket'
import type { Env } from '../types/env'
import type { DownloadRequestResolution } from '../types/download-request-context'

const DOWNLOAD_ROUTE = /^\/dl\/(\d+)\/([^/]+)$/

export const resolveDownloadRequest = async (
  request: Request,
  env: Env,
): Promise<DownloadRequestResolution> => {
  const url = new URL(request.url)
  const ticket = url.searchParams.get('ticket')
  if (!ticket) {
    return reject(new Response('Missing ticket', { status: 400 }))
  }

  const ticketPayload = await decryptTicket(ticket, env.TICKET_SECRET)
  if (!ticketPayload) {
    return reject(new Response('Invalid ticket', { status: 403 }))
  }
  if (ticketPayload.exp <= Math.floor(Date.now() / 1000)) {
    return reject(new Response('Expired ticket', { status: 410 }))
  }

  const routeMatch = url.pathname.match(DOWNLOAD_ROUTE)
  if (!routeMatch) {
    return reject(new Response('Not Found', { status: 404 }))
  }

  const [, fileIdRaw, fileNameRaw] = routeMatch
  const fileId = Number(fileIdRaw)
  const fileName = decodeURIComponent(fileNameRaw)
  if (fileId !== ticketPayload.fid || fileName !== ticketPayload.n) {
    return reject(new Response('Ticket mismatch', { status: 403 }))
  }

  const originUrl = new URL(ticketPayload.p, normalizeBaseUrl(env.DOWNLOAD_CDN_HOST))
  const originRequest = new Request(originUrl.toString(), {
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
