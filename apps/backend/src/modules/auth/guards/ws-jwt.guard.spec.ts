import { ExecutionContext, HttpStatus } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { WsException } from '@nestjs/websockets'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { CacheService } from '../../cache/services/cache.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { WsJwtGuard } from './ws-jwt.guard'

const createWsContext = (client: Record<string, any>): ExecutionContext =>
  ({
    switchToWs: () => ({
      getClient: () => client,
    }),
  }) as unknown as ExecutionContext

describe('WsJwtGuard', () => {
  const payload = { sub: 1, fid: 'family-1', role: 1, content_limit: 0, type: 'access' as const }

  let jwtService: { verifyAsync: jest.Mock }
  let configService: { get: jest.Mock }
  let cacheService: { get: jest.Mock }
  let guard: WsJwtGuard

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) }
    configService = { get: jest.fn().mockReturnValue('test-secret') }
    cacheService = { get: jest.fn().mockResolvedValue(false) }
    guard = new WsJwtGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ShionConfigService,
      cacheService as unknown as CacheService,
    )
  })

  const expectWsError = async (
    promise: Promise<boolean>,
    code: ShionBizCode,
    status: HttpStatus,
  ) => {
    await expect(promise).rejects.toBeInstanceOf(WsException)
    await promise.catch((error: WsException) => {
      expect(error.getError()).toEqual({ code, status })
    })
  }

  it('throws unauthorized when no token is provided', async () => {
    const client = {
      handshake: { headers: {} },
      data: {},
    }

    await expectWsError(
      guard.canActivate(createWsContext(client)),
      ShionBizCode.AUTH_UNAUTHORIZED,
      HttpStatus.UNAUTHORIZED,
    )
  })

  it('uses bearer token and stores decoded payload into client data', async () => {
    const client = {
      handshake: {
        headers: {
          authorization: 'Bearer ws-token',
        },
      },
      data: {},
    }

    await expect(guard.canActivate(createWsContext(client))).resolves.toBe(true)
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('ws-token', {
      secret: 'test-secret',
    })
    expect(cacheService.get).toHaveBeenCalledWith('auth:family:blocked:family-1')
    expect((client.data as any).user).toEqual(payload)
  })

  it('falls back to cookie token when authorization header is absent', async () => {
    const client = {
      handshake: {
        headers: {
          cookie: 'a=1; shionlib_access_token=cookie-token; b=2',
        },
      },
      data: {},
    }

    await expect(guard.canActivate(createWsContext(client))).resolves.toBe(true)
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('cookie-token', {
      secret: 'test-secret',
    })
  })

  it('throws unauthorized when token verification fails', async () => {
    const client = {
      handshake: {
        headers: {
          authorization: 'Bearer ws-token',
        },
      },
      data: {},
    }
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'))

    await expectWsError(
      guard.canActivate(createWsContext(client)),
      ShionBizCode.AUTH_UNAUTHORIZED,
      HttpStatus.UNAUTHORIZED,
    )
  })

  it('throws forbidden when auth family is blocked', async () => {
    const client = {
      handshake: {
        headers: {
          authorization: 'Bearer ws-token',
        },
      },
      data: {},
    }
    cacheService.get.mockResolvedValue(true)

    await expectWsError(
      guard.canActivate(createWsContext(client)),
      ShionBizCode.AUTH_FAMILY_BLOCKED,
      HttpStatus.FORBIDDEN,
    )
  })
})
