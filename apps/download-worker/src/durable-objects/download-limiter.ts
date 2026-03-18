import { DurableObject } from 'cloudflare:workers'
import { jsonResponse } from '../helpers/http'
import { parsePositiveInt } from '../helpers/number'
import type { LeaseRecord, AcquireResponse } from '../types/download-limiter'
import type { Env } from '../types/env'

export class DownloadLimiter extends DurableObject<Env> {
  private leases = new Map<string, LeaseRecord>()

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const now = Date.now()
    this.cleanupExpired(now)

    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405)
    }

    if (url.pathname === '/acquire') {
      const body = (await request.json()) as { maxConn?: number }
      const maxConn = Math.max(1, body.maxConn ?? 1)

      if (this.leases.size >= maxConn) {
        return jsonResponse<AcquireResponse>({ ok: false, reason: 'max_conn_exceeded' }, 429)
      }

      const leaseId = crypto.randomUUID()
      this.leases.set(leaseId, { lastSeenAt: now })

      return jsonResponse<AcquireResponse>({
        ok: true,
        leaseId,
        ttlMs: this.leaseTtlMs,
        heartbeatMs: this.heartbeatMs,
      })
    }

    if (url.pathname === '/heartbeat') {
      const body = (await request.json()) as { leaseId?: string }
      if (!body.leaseId || !this.leases.has(body.leaseId)) {
        return jsonResponse({ ok: false, reason: 'lease_not_found' }, 404)
      }

      this.leases.set(body.leaseId, { lastSeenAt: now })
      return jsonResponse({ ok: true })
    }

    if (url.pathname === '/release') {
      const body = (await request.json()) as { leaseId?: string }
      if (body.leaseId) {
        this.leases.delete(body.leaseId)
      }

      return jsonResponse({ ok: true })
    }

    return jsonResponse({ ok: false, reason: 'not_found' }, 404)
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
