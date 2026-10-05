import { afterEach, describe, expect, it, vi } from 'vitest'
import { aria2FileName, pushToAria2 } from './aria2'

const target = { endpoint: 'http://127.0.0.1:6800/jsonrpc', secret: 's3cret', directory: '' }
const download = { url: 'https://dl.test/a.7z', fileName: 'a:b?.7z' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pushToAria2', () => {
  it('adds the uri with the secret and a safe file name', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ id: '1', jsonrpc: '2.0', result: 'gid1' }),
    )
    vi.stubGlobal('fetch', fetch)
    await expect(pushToAria2(target, download)).resolves.toEqual({ ok: true, gid: 'gid1' })
    const [, init] = fetch.mock.calls[0] ?? []
    expect(JSON.parse(String(init?.body))).toMatchObject({
      method: 'aria2.addUri',
      params: ['token:s3cret', ['https://dl.test/a.7z'], { out: 'a_b_.7z' }],
    })
  })

  it('tells an unreachable aria2 from a rejected secret', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(pushToAria2(target, download)).resolves.toMatchObject({ reason: 'unreachable' })
    vi.stubGlobal('fetch', async () =>
      Response.json({ id: '1', jsonrpc: '2.0', error: { code: 1, message: 'Unauthorized' } }),
    )
    await expect(pushToAria2(target, download)).resolves.toMatchObject({ reason: 'unauthorized' })
  })
})

describe('aria2FileName', () => {
  it('never leaves an empty name', () => {
    expect(aria2FileName('  ')).toBe('download')
  })
})
