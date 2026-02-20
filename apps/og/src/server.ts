import { Hono } from 'hono'
import { config } from '@/config'
import { loadRenderer } from '@/services/renderer'
import gameRouter from '@/routes/game'
import characterRouter from '@/routes/character'
import developerRouter from '@/routes/developer'
import defaultRouter from '@/routes/default'

const app = new Hono()

app.get('/health', c => c.json({ status: 'ok' }))
app.route('/game', gameRouter)
app.route('/character', characterRouter)
app.route('/developer', developerRouter)
app.route('/', defaultRouter)

app.onError((err, c) => {
  console.error('[server] unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

app.notFound(c => c.json({ error: 'Not found' }, 404))

console.log('[og] loading renderer…')
await loadRenderer()
console.log('[og] renderer ready')
console.log(`[og] listening on http://0.0.0.0:${config.PORT}`)

export default {
  port: config.PORT,
  fetch: app.fetch,
}
