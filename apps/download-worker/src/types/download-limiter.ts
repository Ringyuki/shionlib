export type AcquireResponse =
  | {
      ok: true
      leaseId: string
      ttlMs: number
      heartbeatMs: number
    }
  | {
      ok: false
      reason: 'max_conn_exceeded' | 'session_expired'
    }

export type SessionWindow = {
  exp: number
  hx?: number
}

export type LeaseRecord = {
  lastSeenAt: number
}
