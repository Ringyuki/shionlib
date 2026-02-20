import Redis from 'ioredis'
import { config } from '@/config'

let _client: Redis | null = null

export function getRedis(): Redis {
  if (!_client) {
    _client = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      db: config.REDIS_DB,
      password: config.REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    })

    _client.on('error', err => {
      console.error('[redis] connection error:', err.message)
    })
  }
  return _client
}
