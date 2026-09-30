import type { DownloadLimiter } from '../durable-objects/download-limiter'
import type { SessionWindow } from '../types/download-limiter'

export const acquireLease = (
  limiter: DurableObjectStub<DownloadLimiter>,
  maxConn: number,
  session: SessionWindow,
) => limiter.acquire(maxConn, session)

export const isSessionActive = async (
  limiter: DurableObjectStub<DownloadLimiter>,
  session: SessionWindow,
) => session.exp > Math.floor(Date.now() / 1000) || (await limiter.isActive(session))

export const heartbeatLease = (limiter: DurableObjectStub<DownloadLimiter>, leaseId: string) =>
  limiter.heartbeat(leaseId)

export const releaseLease = (limiter: DurableObjectStub<DownloadLimiter>, leaseId: string) =>
  limiter.release(leaseId)
