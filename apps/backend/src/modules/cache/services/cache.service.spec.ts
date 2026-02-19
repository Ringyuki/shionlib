import { Cache } from 'cache-manager'
import { Redis } from 'ioredis'
import { CacheService } from './cache.service'

describe('CacheService', () => {
  const createService = () => {
    const cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as Cache

    const redis = {
      options: { keyPrefix: 'app:' },
      setnx: jest.fn(),
      zadd: jest.fn(),
      zrem: jest.fn(),
      zcard: jest.fn(),
      zrevrange: jest.fn(),
      zrange: jest.fn(),
      zremrangebyscore: jest.fn(),
      scan: jest.fn(),
      unlink: jest.fn(),
    } as unknown as Redis

    const service = new CacheService(cache, redis)
    return { service, cache, redis }
  }

  it('delegates get/set/del to cache manager', async () => {
    const { service, cache } = createService()
    ;(cache.get as jest.Mock).mockResolvedValue({ ok: true })

    await expect(service.get('k1')).resolves.toEqual({ ok: true })
    await service.set('k2', { n: 1 }, 5000)
    await service.del('k3')

    expect(cache.get).toHaveBeenCalledWith('k1')
    expect(cache.set).toHaveBeenCalledWith('k2', { n: 1 }, 5000)
    expect(cache.del).toHaveBeenCalledWith('k3')
  })

  it('parses zrangeWithScores for both DESC and ASC order', async () => {
    const { service, redis } = createService()
    ;(redis.zrevrange as jest.Mock).mockResolvedValue(['a', '2', 'b', '1'])
    ;(redis.zrange as jest.Mock).mockResolvedValue(['c', '3'])

    await expect(service.zrangeWithScores('key', 0, 1)).resolves.toEqual([
      { member: 'a', score: 2 },
      { member: 'b', score: 1 },
    ])
    await expect(service.zrangeWithScores('key', 0, 0, 'ASC')).resolves.toEqual([
      { member: 'c', score: 3 },
    ])
  })

  it('delByContains scans and unlinks normalized keys', async () => {
    const { service, redis } = createService()
    ;(redis.scan as jest.Mock)
      .mockResolvedValueOnce(['1', ['app:a:1', 'app:a:2']])
      .mockResolvedValueOnce(['0', ['app:a:3']])
    ;(redis.unlink as jest.Mock).mockResolvedValueOnce(2).mockResolvedValueOnce(1)

    const deleted = await service.delByContains('a', 50)

    expect(redis.scan).toHaveBeenNthCalledWith(1, '0', 'MATCH', '*a*', 'COUNT', 50)
    expect(redis.scan).toHaveBeenNthCalledWith(2, '1', 'MATCH', '*a*', 'COUNT', 50)
    expect(redis.unlink).toHaveBeenNthCalledWith(1, 'a:1', 'a:2')
    expect(redis.unlink).toHaveBeenNthCalledWith(2, 'a:3')
    expect(deleted).toBe(3)
  })
})
