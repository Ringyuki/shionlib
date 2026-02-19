import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { MessageGateway } from '../../src/modules/message/gateways/message.gateway'
import { MessageQueryService } from '../../src/modules/message/services/message-query.service'
import { ShionConfigService } from '../../src/common/config/services/config.service'
import { CacheService } from '../../src/modules/cache/services/cache.service'

describe('MessageGateway (integration)', () => {
  let gateway: MessageGateway

  const messageQueryService = {
    getUnreadCount: jest.fn(),
  }
  const jwtService = {
    verifyAsync: jest.fn(),
  }
  const configService = {
    get: jest.fn(() => 'secret'),
  }
  const cacheService = {
    get: jest.fn(),
  }

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        MessageGateway,
        { provide: MessageQueryService, useValue: messageQueryService },
        { provide: JwtService, useValue: jwtService },
        { provide: ShionConfigService, useValue: configService },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile()

    gateway = moduleFixture.get(MessageGateway)
    ;(gateway as any).logger = { log: jest.fn() }
    jest.clearAllMocks()
  })

  it('auth middleware in afterInit handles unauthorized/blocked/ok handshake', async () => {
    const server = { use: jest.fn() }
    gateway.afterInit(server as any)
    const middleware = (server.use as jest.Mock).mock.calls[0][0]

    const nextMissing = jest.fn()
    await middleware({ handshake: { headers: { cookie: '' } }, data: {} } as any, nextMissing)
    expect(nextMissing).toHaveBeenCalledWith(expect.any(Error))
    expect((nextMissing.mock.calls[0][0] as Error).message).toBe('UNAUTHORIZED')

    jwtService.verifyAsync.mockResolvedValueOnce({ sub: 1, fid: 'family-1' })
    cacheService.get.mockResolvedValueOnce(true)
    const nextBlocked = jest.fn()
    await middleware(
      { handshake: { headers: { cookie: 'shionlib_access_token=token-1' } }, data: {} } as any,
      nextBlocked,
    )
    expect(nextBlocked).toHaveBeenCalledWith(expect.any(Error))
    expect((nextBlocked.mock.calls[0][0] as Error).message).toBe('FAMILY_BLOCKED')

    jwtService.verifyAsync.mockResolvedValueOnce({ sub: 2, fid: 'family-2' })
    cacheService.get.mockResolvedValueOnce(false)
    const socket: any = {
      handshake: { headers: { cookie: 'x=1; shionlib_access_token=token-2' } },
      data: {},
    }
    const nextOk = jest.fn()
    await middleware(socket, nextOk)
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-2', { secret: 'secret' })
    expect(cacheService.get).toHaveBeenCalledWith('auth:family:blocked:family-2')
    expect(socket.data.user).toEqual({ sub: 2, fid: 'family-2' })
    expect(nextOk).toHaveBeenCalledWith()
  })

  it('covers connection join/notify pushes and unread pull', async () => {
    const emit = jest.fn()
    const to = jest.fn(() => ({ emit }))
    gateway.server = { to } as any

    const unauthClient = { data: {}, disconnect: jest.fn(), join: jest.fn() }
    gateway.handleConnection(unauthClient as any)
    expect(unauthClient.disconnect).toHaveBeenCalledTimes(1)

    const authedClient = { data: { user: { sub: 7 } }, disconnect: jest.fn(), join: jest.fn() }
    gateway.handleConnection(authedClient as any)
    expect(authedClient.join).toHaveBeenCalledWith('user:7')

    gateway.notifyMessageCreated(7, {
      id: 10,
      title: 'new message',
      type: 1 as any,
      tone: 1 as any,
      created: new Date('2026-01-01T00:00:00.000Z'),
    })
    gateway.notifyUnreadCount(7, 5)
    expect(to).toHaveBeenCalledWith('user:7')
    expect(emit).toHaveBeenCalledWith('message:new', expect.objectContaining({ id: 10 }))
    expect(emit).toHaveBeenCalledWith('message:unread', { unread: 5 })

    messageQueryService.getUnreadCount.mockResolvedValueOnce(12)
    const pullClient = { data: { user: { sub: 9 } }, emit: jest.fn() }
    await gateway.handleUnreadPull(pullClient as any)
    expect(messageQueryService.getUnreadCount).toHaveBeenCalledWith(9)
    expect(pullClient.emit).toHaveBeenCalledWith('message:unread', { unread: 12 })
  })
})
