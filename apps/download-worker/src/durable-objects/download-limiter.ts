import { DurableObject } from 'cloudflare:workers'
import { parsePositiveInt } from '../helpers/number'
import type { LeaseRecord, AcquireResponse } from '../types/download-limiter'
import type { Env } from '../types/env'

export class DownloadLimiter extends DurableObject<Env> {
  private leases = new Map<string, LeaseRecord>()

  async acquire(maxConn: number): Promise<AcquireResponse> {
    const now = Date.now()
    this.cleanupExpired(now)

    if (this.leases.size >= Math.max(1, maxConn)) {
      return { ok: false, reason: 'max_conn_exceeded' }
    }

    const leaseId = crypto.randomUUID()
    this.leases.set(leaseId, { lastSeenAt: now })

    return {
      ok: true,
      leaseId,
      ttlMs: this.leaseTtlMs,
      heartbeatMs: this.heartbeatMs,
    }
  }

  async heartbeat(leaseId: string) {
    const now = Date.now()
    this.cleanupExpired(now)

    if (!this.leases.has(leaseId)) {
      return { ok: false, reason: 'lease_not_found' }
    }

    this.leases.set(leaseId, { lastSeenAt: now })
    return { ok: true }
  }

  async release(leaseId: string) {
    this.leases.delete(leaseId)
    return { ok: true }
  }

  private cleanupExpired(now: number) {
    for (const [leaseId, lease] of this.leases.entries()) {
      if (now - lease.lastSeenAt > this.leaseTtlMs) {
        this.leases.delete(leaseId)
      }
    }
  }

  private get leaseTtlMs() {
    return parsePositiveInt(this.env.DOWNLOAD_LEASE_TTL_MS, 45_000)
  }

  private get heartbeatMs() {
    return parsePositiveInt(this.env.DOWNLOAD_HEARTBEAT_MS, 15_000)
  }
}
