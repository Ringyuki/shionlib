import { MessageGateway } from './message.gateway'

describe('MessageGateway', () => {
  const createGateway = () => {
    const messageQueryService = {
      getUnreadCount: jest.fn(),
    }
    const jwtService = {
      verifyAsync: jest.fn(),
    }
    const configService = {
      get: jest.fn().mockReturnValue('secret'),
    }
    const cacheService = {
      get: jest.fn().mockResolvedValue(false),
    }

    const gateway = new MessageGateway(
      messageQueryService as any,
      jwtService as any,
      configService as any,
      cacheService as any,
    )
    const logger = { log: jest.fn() }
    ;(gateway as any).logger = logger

    return { gateway, messageQueryService, jwtService, configService, cacheService, logger }
  }

  it('authenticates socket middleware in afterInit', async () => {
    const { gateway, jwtService, cacheService } = createGateway()
    const server = { use: jest.fn() }
    gateway.afterInit(server as any)
    const middleware = server.use.mock.calls[0][0]

    const nextMissing = jest.fn()
    await middleware({ handshake: { headers: { cookie: '' } }, data: {} } as any, nextMissing)
    expect(nextMissing.mock.calls[0][0]).toEqual(new Error('UNAUTHORIZED'))

    const nextBlocked = jest.fn()
    jwtService.verifyAsync.mockResolvedValue({ sub: 1, fid: 'fid-1' })
    cacheService.get.mockResolvedValueOnce(true)
    await middleware(
      { handshake: { headers: { cookie: 'shionlib_access_token=t' } }, data: {} } as any,
      nextBlocked,
    )
    expect(nextBlocked.mock.calls[0][0]).toEqual(new Error('FAMILY_BLOCKED'))

    const nextOk = jest.fn()
    cacheService.get.mockResolvedValueOnce(false)
    const socket: any = {
      handshake: { headers: { cookie: 'x=1; shionlib_access_token=ok-token' } },
      data: {},
    }
    await middleware(socket, nextOk)
    expect(socket.data.user).toEqual({ sub: 1, fid: 'fid-1' })
    expect(nextOk).toHaveBeenCalledWith()
  })

  it('handles connection, notifications and unread pull', async () => {
    const { gateway, messageQueryService, logger } = createGateway()
    const emit = jest.fn()
    const to = jest.fn().mockReturnValue({ emit })
    gateway.server = { to } as any

    const unauthClient = { data: {}, disconnect: jest.fn(), join: jest.fn() }
    gateway.handleConnection(unauthClient as any)
    expect(unauthClient.disconnect).toHaveBeenCalledTimes(1)

    const authedClient = { data: { user: { sub: 7 } }, disconnect: jest.fn(), join: jest.fn() }
    gateway.handleConnection(authedClient as any)
    expect(authedClient.join).toHaveBeenCalledWith('user:7')
    expect(logger.log).toHaveBeenCalledWith('WS connected user=7 room=user:7')

    gateway.notifyMessageCreated(7, {
      id: 1,
      title: 't',
      type: 1,
      tone: 1,
      created: new Date(),
    } as any)
    gateway.notifyUnreadCount(7, 5)
    expect(to).toHaveBeenCalledWith('user:7')
    expect(emit).toHaveBeenCalledWith('message:new', expect.any(Object))
    expect(emit).toHaveBeenCalledWith('message:unread', { unread: 5 })

    const pullClient = { data: { user: { sub: 9 } }, emit: jest.fn() }
    messageQueryService.getUnreadCount.mockResolvedValue(12)
    await gateway.handleUnreadPull(pullClient as any)
    expect(messageQueryService.getUnreadCount).toHaveBeenCalledWith(9)
    expect(pullClient.emit).toHaveBeenCalledWith('message:unread', { unread: 12 })
  })
})
