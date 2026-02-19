import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { ShionWsAdapter } from './ws.adapter'

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(() => 'redis-adapter'),
}))

describe('ShionWsAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('creates io server with configured cors options', () => {
    const server = { adapter: jest.fn() }
    const createIOServerSpy = jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue(server as any)
    const configService = { get: jest.fn().mockReturnValue(['GET', 'POST']) }
    const adapter = new ShionWsAdapter({} as any, configService as any)

    const result = adapter.createIOServer(3001, { path: '/socket' } as any)

    expect(createIOServerSpy).toHaveBeenCalledWith(
      3001,
      expect.objectContaining({
        path: '/socket',
        cors: expect.objectContaining({
          methods: ['GET', 'POST'],
          credentials: true,
        }),
      }),
    )
    expect(result).toBe(server)
    expect(server.adapter).not.toHaveBeenCalled()
  })

  it('initializes redis adapter when redis client is provided', async () => {
    const server = { adapter: jest.fn() }
    jest.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(server as any)
    const pubClient = { connect: jest.fn().mockResolvedValue(undefined) }
    const subClient = { connect: jest.fn().mockResolvedValue(undefined) }
    const redis = {
      duplicate: jest.fn().mockReturnValueOnce(pubClient).mockReturnValueOnce(subClient),
    }
    const configService = { get: jest.fn().mockReturnValue(['GET']) }
    const adapter = new ShionWsAdapter({} as any, configService as any, redis as any)
    const logger = { log: jest.fn(), error: jest.fn() }
    ;(adapter as any).logger = logger

    adapter.createIOServer(3002)
    await Promise.resolve()

    expect(redis.duplicate).toHaveBeenCalledTimes(2)
    expect(createAdapter).toHaveBeenCalledWith(pubClient, subClient)
    expect(server.adapter).toHaveBeenCalledWith('redis-adapter')
    expect(logger.log).toHaveBeenCalledWith('WS Redis adapter initialized')
    expect(logger.log).toHaveBeenCalledWith('WS server initialized')
  })

  it('logs redis connection errors when pub/sub connect fails', async () => {
    const server = { adapter: jest.fn() }
    jest.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(server as any)
    const pubErr = new Error('pub failed')
    const subErr = new Error('sub failed')
    const pubClient = { connect: jest.fn().mockRejectedValue(pubErr) }
    const subClient = { connect: jest.fn().mockRejectedValue(subErr) }
    const redis = {
      duplicate: jest.fn().mockReturnValueOnce(pubClient).mockReturnValueOnce(subClient),
    }
    const configService = { get: jest.fn().mockReturnValue(['GET']) }
    const adapter = new ShionWsAdapter({} as any, configService as any, redis as any)
    const logger = { log: jest.fn(), error: jest.fn() }
    ;(adapter as any).logger = logger

    adapter.createIOServer(3003)
    await Promise.resolve()
    await Promise.resolve()

    expect(logger.error).toHaveBeenCalledWith('Error connecting to Redis', pubErr)
    expect(logger.error).toHaveBeenCalledWith('Error connecting to Redis', subErr)
    expect(server.adapter).toHaveBeenCalledWith('redis-adapter')
  })
})
