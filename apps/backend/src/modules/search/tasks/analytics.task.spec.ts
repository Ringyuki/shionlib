import { SUGG_DECAY_FACTOR, SUGG_MIN_SCORE, TREND_WINDOWS, trendKey } from '../constants/analytics'
import { SearchAnalyticsTask } from './analytics.task'

describe('SearchAnalyticsTask', () => {
  const createTask = () => {
    const pipeline = {
      zrem: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      zremrangebyrank: jest.fn().mockReturnThis(),
      zunionstore: jest.fn().mockReturnThis(),
      zremrangebyscore: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }
    const client = {
      zrange: jest.fn(),
      pipeline: jest.fn().mockReturnValue(pipeline),
      scan: jest.fn(),
    }
    const redis = {
      getClient: jest.fn().mockResolvedValue(client),
    }
    const task = new SearchAnalyticsTask(redis as any)

    return { task, redis, client, pipeline }
  }

  it('decays trend scores and removes tiny values', async () => {
    const { task, client, pipeline } = createTask()
    client.zrange.mockResolvedValue(['item1', '2', 'item2', '0.005'])

    await task.decayTrends()

    expect(client.zrange).toHaveBeenCalledTimes(TREND_WINDOWS.length)
    expect(client.zrange).toHaveBeenCalledWith(trendKey('1h'), 0, -1, 'WITHSCORES')
    expect(pipeline.zadd).toHaveBeenCalledWith(trendKey('1h'), 1.8, 'item1')
    expect(pipeline.zrem).toHaveBeenCalledWith(trendKey('1h'), 'item2')
    expect(pipeline.exec).toHaveBeenCalledTimes(TREND_WINDOWS.length)
  })

  it('trims suggest prefix candidate sets while scanning keys', async () => {
    const { task, client, pipeline } = createTask()
    client.scan
      .mockResolvedValueOnce(['1', ['sugg:prefix:a', 'sugg:prefix:b']])
      .mockResolvedValueOnce(['0', []])

    await task.trimSuggestPrefixes()

    expect(client.scan).toHaveBeenCalledTimes(2)
    expect(pipeline.zremrangebyrank).toHaveBeenCalledWith('sugg:prefix:a', 0, -201)
    expect(pipeline.zremrangebyrank).toHaveBeenCalledWith('sugg:prefix:b', 0, -201)
    expect(pipeline.exec).toHaveBeenCalledTimes(2)
  })

  it('decays suggestions and removes low scores', async () => {
    const { task, client, pipeline } = createTask()
    client.scan.mockResolvedValueOnce(['2', ['sugg:prefix:x']]).mockResolvedValueOnce(['0', []])

    await task.decaySuggestions()

    expect(pipeline.zunionstore).toHaveBeenCalledWith(
      'sugg:prefix:x',
      1,
      'sugg:prefix:x',
      'WEIGHTS',
      SUGG_DECAY_FACTOR,
    )
    expect(pipeline.zremrangebyscore).toHaveBeenCalledWith('sugg:prefix:x', '-inf', SUGG_MIN_SCORE)
    expect(pipeline.exec).toHaveBeenCalledTimes(2)
  })
})
