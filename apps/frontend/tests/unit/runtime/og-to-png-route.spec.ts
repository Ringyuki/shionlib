import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const toBuffer = vi.fn(async () => Buffer.from([1, 2, 3]))
  const png = vi.fn(() => ({ toBuffer }))
  const sharpMock = vi.fn(() => ({ png }))

  return {
    sharpMock,
    png,
    toBuffer,
  }
})

vi.mock('sharp', () => ({
  default: hoisted.sharpMock,
}))

describe('runtime/og/to-png/route (unit)', () => {
  beforeEach(() => {
    vi.resetModules()
    hoisted.sharpMock.mockClear()
    hoisted.png.mockClear()
    hoisted.toBuffer.mockClear()
    process.env.NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL = 'https://images.yurari.moe'
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns 400 when url query is missing', async () => {
    const { GET } = await import('../../../app/og/to-png/route')

    const response = await GET(new Request('https://example.com/og/to-png'))

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Invalid request')
  })

  it('returns 400 for invalid host', async () => {
    const { GET } = await import('../../../app/og/to-png/route')

    const response = await GET(
      new Request('https://example.com/og/to-png?u=https://evil.com/x.webp'),
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Invalid image URL')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches image, converts it to png and returns cacheable response', async () => {
    ;(global.fetch as any).mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer,
    })

    const { GET } = await import('../../../app/og/to-png/route')

    const response = await GET(new Request('https://example.com/og/to-png?u=/banner.webp'))

    expect(global.fetch).toHaveBeenCalledWith('https://images.yurari.moe/banner.webp')
    expect(hoisted.sharpMock).toHaveBeenCalledWith(Buffer.from([9, 9, 9]))
    expect(hoisted.png).toHaveBeenCalledTimes(1)
    expect(hoisted.toBuffer).toHaveBeenCalledTimes(1)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toBe('public, max-age=604800')

    const body = new Uint8Array(await response.arrayBuffer())
    expect(Array.from(body)).toEqual([1, 2, 3])
  })
})
