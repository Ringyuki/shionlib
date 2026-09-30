import { DurableObject } from 'cloudflare:workers'
import { parsePositiveInt } from '../helpers/number'
import type { LeaseRecord, AcquireResponse, SessionWindow } from '../types/download-limiter'
import type { Env } from '../types/env'

export class DownloadLimiter extends DurableObject<Env> {
  private static readonly LAST_ACTIVE_KEY = 'lastActiveAt'
  private static readonly ACTIVITY_PERSIST_INTERVAL_MS = 60_000

  private leases = new Map<string, LeaseRecord>()
  private lastActiveAt = 0
  private persistedActiveAt = 0

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.lastActiveAt = (await ctx.storage.get<number>(DownloadLimiter.LAST_ACTIVE_KEY)) ?? 0
      this.persistedActiveAt = this.lastActiveAt
    })
  }

  async acquire(maxConn: number, session: SessionWindow): Promise<AcquireResponse> {
    const now = Date.now()
    if (!this.isSessionActive(now, session)) {
      return { ok: false, reason: 'session_expired' }
    }

    this.cleanupExpired(now)

    if (this.leases.size >= Math.max(1, maxConn)) {
      return { ok: false, reason: 'max_conn_exceeded' }
    }

    const leaseId = crypto.randomUUID()
    this.leases.set(leaseId, { lastSeenAt: now })

    if (!this.persistedActiveAt) {
      await this.ctx.storage.setAlarm((session.hx ?? session.exp) * 1000)
    }
    await this.markActive(now)

    return {
      ok: true,
      leaseId,
      ttlMs: this.leaseTtlMs,
      heartbeatMs: this.heartbeatMs,
    }
  }

  async isActive(session: SessionWindow) {
    return this.isSessionActive(Date.now(), session)
  }

  async heartbeat(leaseId: string) {
    const now = Date.now()
    this.cleanupExpired(now)

    if (!this.leases.has(leaseId)) {
      return { ok: false, reason: 'lease_not_found' }
    }

    this.leases.set(leaseId, { lastSeenAt: now })
    await this.markActive(now)
    return { ok: true }
  }

  async release(leaseId: string) {
    if (this.leases.delete(leaseId)) {
      await this.markActive(Date.now())
    }
    return { ok: true }
  }

  async alarm() {
    const now = Date.now()
    this.cleanupExpired(now)

    if (this.leases.size > 0) {
      await this.ctx.storage.setAlarm(now + this.leaseTtlMs)
      return
    }

    await this.ctx.storage.deleteAll()
    this.lastActiveAt = 0
    this.persistedActiveAt = 0
  }

  private isSessionActive(now: number, session: SessionWindow) {
    if (now < session.exp * 1000) return true
    if (!session.hx || now >= session.hx * 1000) return false
    return now - this.lastActiveAt < this.sessionIdleTtlMs
  }

  private async markActive(now: number) {
    this.lastActiveAt = now
    if (now - this.persistedActiveAt < DownloadLimiter.ACTIVITY_PERSIST_INTERVAL_MS) return

    this.persistedActiveAt = now
    await this.ctx.storage.put(DownloadLimiter.LAST_ACTIVE_KEY, now)
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

  private get sessionIdleTtlMs() {
    return parsePositiveInt(this.env.DOWNLOAD_SESSION_IDLE_TTL_MS, 3_600_000)
  }
}
