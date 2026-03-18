import type { DownloadProxyTicketPayload } from './download-proxy-ticket'

export type DownloadRequestContext = {
  originRequest: Request
  ticketPayload: DownloadProxyTicketPayload
}

export type DownloadRequestResolution =
  | {
      ok: true
      value: DownloadRequestContext
    }
  | {
      ok: false
      response: Response
    }
