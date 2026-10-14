import { Hono } from 'hono'
import { config } from '@/config'
import { loadRenderer } from '@/services/renderer'
import { cards } from '@/routes/cards'

const app = new Hono()

app.get('/health', c => c.json({ status: 'ok' }))
app.route('/', cards)

app.onError((err, c) => {
  console.error('[server] unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

app.notFound(c => c.json({ error: 'Not found' }, 404))

await loadRenderer()
console.log(`[og] listening on http://0.0.0.0:${config.PORT}`)

export default {
  port: config.PORT,
  fetch: app.fetch,
}
