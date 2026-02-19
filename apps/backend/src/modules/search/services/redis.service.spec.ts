jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(),
}))

import IORedis from 'ioredis'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { RedisService } from './redis.service'

describe('RedisService', () => {
  const IORedisMock = IORedis as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws on init when required redis config is missing', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'redis.host') return ''
        if (key === 'redis.port') return 6379
        if (key === 'redis.database') return 0
        return undefined
      }),
    } as unknown as ShionConfigService

    const service = new RedisService(config)

    await expect(service.onModuleInit()).rejects.toThrow(
      'Redis host, port and database are required',
    )
  })

  it('creates client on init and quits on destroy', async () => {
    const quit = jest.fn().mockResolvedValue(undefined)
    IORedisMock.mockImplementation(() => ({ quit }))

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'redis.host') return '127.0.0.1'
        if (key === 'redis.port') return 6379
        if (key === 'redis.password') return 'pw'
        if (key === 'redis.database') return 1
        return undefined
      }),
    } as unknown as ShionConfigService

    const service = new RedisService(config)
    await service.onModuleInit()

    expect(IORedisMock).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 6379,
      password: 'pw',
      db: 1,
    })
    expect(await service.getClient()).toMatchObject({ quit })

    await service.onModuleDestroy()
    expect(quit).toHaveBeenCalledTimes(1)
  })
})
