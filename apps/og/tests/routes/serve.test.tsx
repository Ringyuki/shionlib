import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'

process.env.OG_CACHE_DISABLED = 'false'

const { serveOgImage } = await import('../../src/routes/serve')
const { loadRenderer } = await import('../../src/services/renderer')
const { NotFoundError } = await import('../../src/services/backend')
const { config } = await import('../../src/config')

config.OG_CACHE_DISABLED = false

await loadRenderer()

let drawn = 0

const app = new Hono()
app.get('/card/:id', c =>
  serveOgImage(c, {
    type: 'test',
    id: c.req.param('id'),
    locale: 'zh',
    card: async () => {
      if (c.req.param('id') === 'missing') throw new NotFoundError('gone')
      drawn += 1
      return {
        element: <div style={{ display: 'flex', width: 1200, height: 630 }}>card</div>,
        pictures: [],
      }
    },
  }),
)

describe('serveOgImage', () => {
  it('lets the edge keep a card for a day and answer a revalidation from the drawn bytes', async () => {
    const first = await app.request('/card/1')
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe(
      'public, max-age=86400, stale-while-revalidate=604800',
    )
    const etag = first.headers.get('etag') ?? ''
    expect(etag).toMatch(/^W\/"[0-9a-f]{64}"$/)
    const again = await app.request('/card/1', { headers: { 'if-none-match': etag } })
    expect(again.status).toBe(304)
    expect(drawn).toBe(1)
    const stale = await app.request('/card/1', { headers: { 'if-none-match': 'W/"old"' } })
    expect(stale.status).toBe(200)
  })

  it('keeps a missing card for five minutes only', async () => {
    const missing = await app.request('/card/missing')
    expect(missing.status).toBe(404)
    expect(missing.headers.get('cache-control')).toBe('public, max-age=300')
  })
})
