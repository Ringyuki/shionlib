import path from 'node:path'
import process from 'node:process'
import { createRequestHandler } from '@react-router/express'
import compression from 'compression'
import express from 'express'
import morgan from 'morgan'

const port = Number(process.env.PORT ?? 3000)
const client = path.join(import.meta.dirname, 'build', 'client')
const build = await import('./build/server/index.js')

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])
app.use(compression())
app.use('/assets', express.static(path.join(client, 'assets'), { immutable: true, maxAge: '1y' }))
app.use(express.static(client))
app.use('/.well-known', express.static(path.join(client, '.well-known')))
app.use(morgan('tiny'))
app.all('/{*splat}', createRequestHandler({ build, mode: process.env.NODE_ENV }))

const server = app.listen(port, () => {
  process.stdout.write(`web server listening on port ${port}\n`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => server.close())
}
