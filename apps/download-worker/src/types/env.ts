import type { DownloadLimiter } from '../durable-objects/download-limiter'

export type Env = {
  DOWNLOAD_CDN_HOST: string
  DOWNLOAD_MAX_CONNS_CAP?: string
  DOWNLOAD_LEASE_TTL_MS?: string
  DOWNLOAD_HEARTBEAT_MS?: string
  TICKET_SECRET: string
  DOWNLOAD_LIMITER: DurableObjectNamespace<DownloadLimiter>
}
