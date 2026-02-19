import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('runtime/patch route (unit)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('proxies GET request and sanitizes response headers', async () => {
    ;(global.fetch as any).mockResolvedValue(
      new Response('ok', {
        status: 201,
        statusText: 'Created',
        headers: {
          'x-upstream': 'ok',
          'content-encoding': 'gzip',
          'content-length': '2',
          'transfer-encoding': 'chunked',
          connection: 'keep-alive',
        },
      }),
    )

    const { GET } = await import('../../../app/patch/[[...path]]/route')

    const request = {
      method: 'GET',
      headers: new Headers({ host: 'localhost:3000', 'x-test': 'abc' }),
      body: 'ignored',
      nextUrl: { search: '?lang=en' },
    } as any

    const response = await GET(request, {
      params: Promise.resolve({ path: ['v1', 'games'] }),
    } as any)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = (global.fetch as any).mock.calls[0]
    expect(url).toBe('https://www.moyu.moe/api/hikari/v1/games?lang=en')
    expect(options.method).toBe('GET')
    expect(options.redirect).toBe('manual')
    expect(options.body).toBeUndefined()

    const forwarded = options.headers as Headers
    expect(forwarded.get('Referer')).toBe('https://shionlib.com')
    expect(forwarded.get('Origin')).toBe('https://shionlib.com')
    expect(forwarded.get('host')).toBeNull()
    expect(forwarded.get('x-test')).toBe('abc')

    expect(response.status).toBe(201)
    expect(response.statusText).toBe('Created')
    expect(response.headers.get('x-upstream')).toBe('ok')
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(response.headers.get('content-length')).toBeNull()
    expect(response.headers.get('transfer-encoding')).toBeNull()
    expect(response.headers.get('connection')).toBeNull()
  })

  it('forwards request body for POST method', async () => {
    ;(global.fetch as any).mockResolvedValue(new Response('posted', { status: 200 }))

    const { POST } = await import('../../../app/patch/[[...path]]/route')

    const request = {
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      body: '{"id":1}',
      nextUrl: { search: '' },
    } as any

    const response = await POST(request, { params: Promise.resolve({}) } as any)

    const [url, options] = (global.fetch as any).mock.calls[0]
    expect(url).toBe('https://www.moyu.moe/api/hikari')
    expect(options.body).toBe('{"id":1}')
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('posted')
  })

  it('returns 502 when upstream request throws', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('upstream down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { GET } = await import('../../../app/patch/[[...path]]/route')

    const request = {
      method: 'GET',
      headers: new Headers(),
      nextUrl: { search: '' },
    } as any

    const response = await GET(request, { params: Promise.resolve({ path: ['x'] }) } as any)

    expect(response.status).toBe(502)
    expect(await response.text()).toBe('Upstream request failed')

    errorSpy.mockRestore()
  })
})
