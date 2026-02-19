import { trendKey } from '../constants/analytics'
import { RedisService } from './redis.service'
import { SearchAnalyticsService } from './analytics.service'

describe('SearchAnalyticsService', () => {
  const createService = () => {
    const pipeline = {
      zincrby: jest.fn().mockReturnThis(),
      zremrangebyrank: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }
    const client = {
      zincrby: jest.fn().mockResolvedValue(1),
      zrevrange: jest.fn(),
      pipeline: jest.fn().mockReturnValue(pipeline),
    }

    const redisService = {
      getClient: jest.fn().mockResolvedValue(client),
    } as unknown as RedisService

    const service = new SearchAnalyticsService(redisService)
    return { service, client, pipeline, redisService }
  }

  it('recordSearch normalizes query and updates trends/prefix indexes', async () => {
    const { service, client, pipeline } = createService()

    await service.recordSearch('  AbC ')

    expect(client.zincrby).toHaveBeenCalledWith(trendKey('1h'), 1, 'abc')
    expect(client.zincrby).toHaveBeenCalledWith(trendKey('6h'), 1, 'abc')
    expect(client.zincrby).toHaveBeenCalledWith(trendKey('1d'), 1, 'abc')

    expect(pipeline.zincrby).toHaveBeenCalledWith('sugg:prefix:a', 1, 'abc')
    expect(pipeline.zincrby).toHaveBeenCalledWith('sugg:prefix:ab', 1, 'abc')
    expect(pipeline.zincrby).toHaveBeenCalledWith('sugg:prefix:abc', 1, 'abc')
    expect(pipeline.exec).toHaveBeenCalledTimes(1)
  })

  it('recordSearch skips blank query', async () => {
    const { service, client, pipeline } = createService()

    await service.recordSearch('  ')

    expect(client.zincrby).not.toHaveBeenCalled()
    expect(pipeline.zincrby).not.toHaveBeenCalled()
  })

  it('getTrends aggregates scores across windows', async () => {
    const { service, client } = createService()
    ;(client.zrevrange as jest.Mock).mockImplementation((key: string) => {
      if (key === trendKey('1h')) return Promise.resolve(['alice', '2', 'bob', '1'])
      if (key === trendKey('6h')) return Promise.resolve(['bob', '5', 'charlie', '1'])
      return Promise.resolve([])
    })

    const trends = await service.getTrends(2, ['1h', '6h'] as any)

    expect(trends).toEqual([
      { query: 'bob', score: 6 },
      { query: 'alice', score: 2 },
    ])
  })

  it('getSuggestions returns parsed zset results', async () => {
    const { service, client } = createService()
    ;(client.zrevrange as jest.Mock).mockResolvedValue(['abc', '3', 'abd', '1.5'])

    const suggestions = await service.getSuggestions('AB', 2)

    expect(client.zrevrange).toHaveBeenCalledWith('sugg:prefix:ab', 0, 1, 'WITHSCORES')
    expect(suggestions).toEqual([
      { query: 'abc', score: 3 },
      { query: 'abd', score: 1.5 },
    ])
  })
})
