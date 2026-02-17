import { Injectable } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Redis } from 'ioredis'
import { Cache } from 'cache-manager'
import { Inject } from '@nestjs/common'

@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly redis: Redis,
  ) {}

  async get<T>(key: string): Promise<T> {
    return this.cache.get(key) as T
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.cache.set(key, value, ttlMs)
  }

  async setnx(
    key: string,
    value: string | number | Buffer<ArrayBufferLike>,
    callback?: () => Promise<void>,
  ) {
    return this.redis.setnx(key, value, callback)
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key)
  }

  async zadd(key: string, score: number, member: string | number): Promise<number> {
    return this.redis.zadd(key, score, String(member))
  }

  async zrem(key: string, ...members: (string | number)[]): Promise<number> {
    return this.redis.zrem(key, ...members.map(String))
  }

  async zcard(key: string): Promise<number> {
    return this.redis.zcard(key)
  }

  async zrangeWithScores(
    key: string,
    start: number,
    stop: number,
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<{ member: string; score: number }[]> {
    const result =
      order === 'DESC'
        ? await this.redis.zrevrange(key, start, stop, 'WITHSCORES')
        : await this.redis.zrange(key, start, stop, 'WITHSCORES')

    const items: { member: string; score: number }[] = []
    for (let i = 0; i < result.length; i += 2) {
      items.push({
        member: result[i],
        score: Number(result[i + 1]),
      })
    }
    return items
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    return this.redis.zremrangebyscore(key, min, max)
  }

  async delByContains(partial: string, batchSize = 100): Promise<number> {
    const pattern = `*${partial}*`
    let cursor = '0'
    let deleted = 0
    const keyPrefix = this.redis.options.keyPrefix ?? ''

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize)
      cursor = nextCursor
      if (keys.length > 0) {
        const normalizedKeys =
          keyPrefix.length > 0
            ? keys.map(key => (key.startsWith(keyPrefix) ? key.slice(keyPrefix.length) : key))
            : keys
        deleted += await this.redis.unlink(...normalizedKeys)
      }
    } while (cursor !== '0')

    return deleted
  }
}
