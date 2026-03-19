import type { DownloadLimiter } from '../durable-objects/download-limiter'

export const acquireLease = (limiter: DurableObjectStub<DownloadLimiter>, maxConn: number) =>
  limiter.acquire(maxConn)

export const heartbeatLease = (limiter: DurableObjectStub<DownloadLimiter>, leaseId: string) =>
  limiter.heartbeat(leaseId)

export const releaseLease = (limiter: DurableObjectStub<DownloadLimiter>, leaseId: string) =>
  limiter.release(leaseId)
