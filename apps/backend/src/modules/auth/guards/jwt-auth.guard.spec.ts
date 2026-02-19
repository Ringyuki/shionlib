import { ExecutionContext, HttpStatus } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Reflector } from '@nestjs/core'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { CacheService } from '../../cache/services/cache.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { ShionConfigService } from '../../../common/config/services/config.service'

const createContext = (req: Record<string, any>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => function handler() {},
    getClass: () => class TestClass {},
  }) as unknown as ExecutionContext

describe('JwtAuthGuard', () => {
  const payload = { sub: 1, fid: 'family-1', role: 1, content_limit: 0, type: 'access' }

  let jwtService: { verifyAsync: jest.Mock }
  let configService: { get: jest.Mock }
  let cacheService: { get: jest.Mock }
  let reflector: { getAllAndOverride: jest.Mock }
  let guard: JwtAuthGuard

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) }
    configService = { get: jest.fn().mockReturnValue('test-secret') }
    cacheService = { get: jest.fn().mockResolvedValue(false) }
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) }

    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ShionConfigService,
      cacheService as unknown as CacheService,
      reflector as unknown as Reflector,
    )
  })

  it('allows public routes without token verification', async () => {
    reflector.getAllAndOverride.mockReturnValue(true)
    const req = { headers: {}, cookies: {} }

    await expect(guard.canActivate(createContext(req))).resolves.toBe(true)
    expect(jwtService.verifyAsync).not.toHaveBeenCalled()
  })

  it('throws unauthorized when no token is provided', async () => {
    const req = { headers: {}, cookies: {} }

    await expect(guard.canActivate(createContext(req))).rejects.toMatchObject({
      code: ShionBizCode.AUTH_UNAUTHORIZED,
      status: HttpStatus.UNAUTHORIZED,
    })
  })

  it('uses bearer token and attaches payload to request user', async () => {
    const req = {
      headers: { authorization: 'Bearer token-1' },
      cookies: {},
    }

    await expect(guard.canActivate(createContext(req))).resolves.toBe(true)
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-1', {
      secret: 'test-secret',
    })
    expect(cacheService.get).toHaveBeenCalledWith('auth:family:blocked:family-1')
    expect((req as any).user).toEqual(payload)
  })

  it('falls back to cookie token when bearer token is invalid', async () => {
    const req = {
      headers: { authorization: 'Bearer undefined' },
      cookies: { shionlib_access_token: 'cookie-token' },
    }

    await expect(guard.canActivate(createContext(req))).resolves.toBe(true)
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('cookie-token', {
      secret: 'test-secret',
    })
  })

  it('throws forbidden when family is blocked', async () => {
    const req = {
      headers: { authorization: 'Bearer token-1' },
      cookies: {},
    }
    cacheService.get.mockResolvedValue(true)

    await expect(guard.canActivate(createContext(req))).rejects.toMatchObject({
      code: ShionBizCode.AUTH_FAMILY_BLOCKED,
      status: HttpStatus.FORBIDDEN,
    })
  })

  it('throws unauthorized when jwt verification fails', async () => {
    const req = {
      headers: { authorization: 'Bearer token-1' },
      cookies: {},
    }
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'))

    await expect(guard.canActivate(createContext(req))).rejects.toMatchObject({
      code: ShionBizCode.AUTH_UNAUTHORIZED,
      status: HttpStatus.UNAUTHORIZED,
    })
  })
})
