// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addUrl, check, sanitizeFilename } from '../../../../components/game/download/helpers/aria2'

describe('components/game/download/helpers/aria2 (unit)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sanitizes invalid and reserved filenames', () => {
    expect(sanitizeFilename('a:b*c?.zip')).toBe('a_b_c_.zip')
    expect(sanitizeFilename('CON')).toBe('CON_')
    expect(sanitizeFilename('   ')).toBe('untitled')
  })

  it('check returns true on ok response and structured error on failure', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true })
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(check('http', 'localhost', 6800, '/jsonrpc', 'secret')).resolves.toBe(true)
    await expect(check('http', 'localhost', 6800, '/jsonrpc', 'secret')).resolves.toEqual({
      success: false,
      details: { message: 'Unauthorized' },
    })
  })

  it('addUrl returns unauthorized when aria2 auth fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'Unauthorized' } }),
      }),
    )

    const result = await addUrl(
      'https://example.com/game.zip',
      'game.zip',
      'http',
      'localhost',
      6800,
      '/jsonrpc',
      'secret',
    )

    expect(result).toEqual({ success: false, message: 'aria2Unauthorized' })
  })

  it('addUrl calls aria2 after readiness check', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true })
    fetchMock.mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const result = await addUrl(
      'https://example.com/game.zip',
      'bad:name?.zip',
      'http',
      'localhost',
      6800,
      '/jsonrpc',
      'secret',
      '/downloads',
    )

    expect(result).toEqual({ success: true, message: 'aria2Added' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string)
    expect(secondBody.method).toBe('aria2.addUri')
    expect(secondBody.params[2].out).toBe('bad_name_.zip')
    expect(secondBody.params[2].dir).toBe('/downloads')
  })
})
