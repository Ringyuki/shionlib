import type { AcquireResponse } from '../types/download-limiter'
import type { DownloadLimiter } from '../durable-objects/download-limiter'

export const acquireLease = async (limiter: DurableObjectStub<DownloadLimiter>, maxConn: number) => {
  const response = await limiter.fetch('https://download-limiter/acquire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxConn }),
  })

  return (await response.json()) as AcquireResponse
}

export const heartbeatLease = async (limiter: DurableObjectStub<DownloadLimiter>, leaseId: string) => {
  await limiter.fetch('https://download-limiter/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leaseId }),
  })
}

export const releaseLease = async (limiter: DurableObjectStub<DownloadLimiter>, leaseId: string) => {
  await limiter.fetch('https://download-limiter/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leaseId }),
  })
}
