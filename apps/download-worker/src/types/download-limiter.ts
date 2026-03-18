export type AcquireResponse =
  | {
      ok: true
      leaseId: string
      ttlMs: number
      heartbeatMs: number
    }
  | {
      ok: false
      reason: 'max_conn_exceeded'
    }

export type LeaseRecord = {
  lastSeenAt: number
}
