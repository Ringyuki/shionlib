import { env } from 'cloudflare:workers'
import {
  createExecutionContext,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
  waitOnExecutionContext,
} from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from '../src/index'
import type { DownloadProxyTicketPayload } from '../src/types/download-proxy-ticket'
import { encryptTicket } from './helpers/ticket'

const HOUR = 60 * 60
const ORIGIN = 'https://f005.backblazeb2.com'

const nowSec = () => Math.floor(Date.now() / 1000)

const buildTicket = (
  sid: string,
  overrides: Partial<DownloadProxyTicketPayload> = {},
): DownloadProxyTicketPayload => ({
  v: 3,
  sid,
  fid: 1,
  n: 'game.7z',
  exp: nowSec() + HOUR,
  hx: nowSec() + 24 * HOUR,
  mc: 8,
  gid: 1,
  b: 'shionlib-games',
  k: 'games/game.7z',
  a: 'b2-token',
  u: ORIGIN,
  ...overrides,
})

const download = async (payload: DownloadProxyTicketPayload, method: 'GET' | 'HEAD' = 'GET') => {
  const ticket = await encryptTicket(payload, env.TICKET_SECRET)
  const request = new Request(
    `https://dl.example.com/dl/${payload.fid}/${payload.sid}?ticket=${encodeURIComponent(ticket)}`,
    { method },
  ) as Request<unknown, IncomingRequestCfProperties>
  const ctx = createExecutionContext()
  const response = await worker.fetch(request, env, ctx)
  await response.arrayBuffer()
  await waitOnExecutionContext(ctx)
  return response
}

const limiterFor = (sid: string) => env.DOWNLOAD_LIMITER.get(env.DOWNLOAD_LIMITER.idFromName(sid))

describe('download session expiry', () => {
  let sid: string
  let originFetch: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    sid = crypto.randomUUID()
    const passthrough = globalThis.fetch
    originFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (!url.startsWith(`${ORIGIN}/`)) return passthrough(input, init)
      return new Response('payload', { headers: { 'content-length': '7' } })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('serves a fresh ticket and schedules cleanup at the hard expiry', async () => {
    const payload = buildTicket(sid)

    const response = await download(payload)

    expect(response.status).toBe(200)
    expect(originFetch).toHaveBeenCalledTimes(1)
    await runInDurableObject(limiterFor(sid), async (_, state) => {
      expect(await state.storage.get('lastActiveAt')).toBeTypeOf('number')
      expect(await state.storage.getAlarm()).toBe(payload.hx! * 1000)
    })
  })

  it('rejects a ticket past exp that was never used', async () => {
    const payload = buildTicket(sid, { exp: nowSec() - 1 })

    expect((await download(payload)).status).toBe(410)
    expect((await download(payload, 'HEAD')).status).toBe(410)
    expect(originFetch).not.toHaveBeenCalled()
  })

  it('keeps serving after exp while the session was recently active, across eviction', async () => {
    expect((await download(buildTicket(sid))).status).toBe(200)
    await evictDurableObject(limiterFor(sid))

    const resumed = buildTicket(sid, { exp: nowSec() - 1 })

    expect((await download(resumed)).status).toBe(200)
    expect((await download(resumed, 'HEAD')).status).toBe(200)
  })

  it('rejects after exp once the session has been idle past the idle window', async () => {
    expect((await download(buildTicket(sid))).status).toBe(200)
    await runInDurableObject(limiterFor(sid), (_, state) =>
      state.storage.put('lastActiveAt', Date.now() - 2 * HOUR * 1000),
    )
    await evictDurableObject(limiterFor(sid))

    const resumed = buildTicket(sid, { exp: nowSec() - 1 })

    expect((await download(resumed)).status).toBe(410)
    expect((await download(resumed, 'HEAD')).status).toBe(410)
  })

  it('rejects every request once the hard expiry has passed', async () => {
    expect((await download(buildTicket(sid))).status).toBe(200)
    originFetch.mockClear()

    const expired = buildTicket(sid, { exp: nowSec() - 10, hx: nowSec() - 1 })

    expect((await download(expired)).status).toBe(410)
    expect(originFetch).not.toHaveBeenCalled()
  })

  it('treats exp as the only deadline for tickets issued without hx', async () => {
    const legacy = buildTicket(sid, { hx: undefined })
    expect((await download(legacy)).status).toBe(200)

    expect((await download({ ...legacy, exp: nowSec() - 1 })).status).toBe(410)
  })

  it('clears session storage when the alarm fires with no open connections', async () => {
    expect((await download(buildTicket(sid))).status).toBe(200)

    expect(await runDurableObjectAlarm(limiterFor(sid))).toBe(true)

    await runInDurableObject(limiterFor(sid), async (_, state) => {
      expect(await state.storage.get('lastActiveAt')).toBeUndefined()
    })
    expect((await download(buildTicket(sid, { exp: nowSec() - 1 }))).status).toBe(410)
  })

  it('postpones cleanup while a connection is still open', async () => {
    const limiter = limiterFor(sid)
    const lease = await limiter.acquire(8, { exp: nowSec() + HOUR, hx: nowSec() + 2 * HOUR })
    expect(lease.ok).toBe(true)

    expect(await runDurableObjectAlarm(limiter)).toBe(true)

    await runInDurableObject(limiter, async (_, state) => {
      expect(await state.storage.get('lastActiveAt')).toBeTypeOf('number')
      expect(await state.storage.getAlarm()).toBeGreaterThan(Date.now())
    })
  })

  it('still caps concurrent connections per session', async () => {
    const limiter = limiterFor(sid)
    const session = { exp: nowSec() + HOUR, hx: nowSec() + 2 * HOUR }

    expect((await limiter.acquire(1, session)).ok).toBe(true)
    expect(await limiter.acquire(1, session)).toEqual({ ok: false, reason: 'max_conn_exceeded' })
  })
})
