jest.mock('../utils/refresh-token.util', () => ({
  generateOpaque: jest.fn(),
  calcPrefix: jest.fn(),
  hashOpaque: jest.fn(),
  verifyOpaque: jest.fn(),
  formatRefreshToken: jest.fn(),
  parseRefreshToken: jest.fn(),
}))

import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { CacheService } from '../../cache/services/cache.service'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { TokenService } from './token.service'
import { LoginSessionService } from './login-session.service'
import {
  generateOpaque,
  calcPrefix,
  hashOpaque,
  formatRefreshToken,
  parseRefreshToken,
} from '../utils/refresh-token.util'

describe('LoginSessionService', () => {
  const generateOpaqueMock = generateOpaque as jest.Mock
  const calcPrefixMock = calcPrefix as jest.Mock
  const hashOpaqueMock = hashOpaque as jest.Mock
  const formatRefreshTokenMock = formatRefreshToken as jest.Mock
  const parseRefreshTokenMock = parseRefreshToken as jest.Mock

  const createService = () => {
    const prisma = {
      userLoginSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService

    const tokenService = {
      signToken: jest.fn(),
    } as unknown as TokenService

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'refresh_token.pepper') return 'test-pepper'
        if (key === 'refresh_token.algorithmVersion') return 'slrt1'
        if (key === 'refresh_token.shortWindowSec') return '3600'
        if (key === 'refresh_token.longWindowSec') return '7200'
        if (key === 'refresh_token.rotationGraceSec') return 3
        return undefined
      }),
    } as unknown as ShionConfigService

    const cacheService = {
      set: jest.fn(),
      get: jest.fn(),
    } as unknown as CacheService

    const service = new LoginSessionService(prisma, tokenService, configService, cacheService)
    return { service, prisma, tokenService, cacheService }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    generateOpaqueMock.mockReturnValue('opaque-1')
    calcPrefixMock.mockReturnValue('prefix-1')
    hashOpaqueMock.mockResolvedValue('hash-1')
    formatRefreshTokenMock.mockReturnValue('slrt1.prefix-1.opaque-1')
  })

  it('issueOnLogin creates session and returns access+refresh tokens', async () => {
    const { service, prisma, tokenService } = createService()
    ;(prisma.userLoginSession.create as jest.Mock).mockResolvedValue({ id: 1001 })
    ;(tokenService.signToken as jest.Mock).mockResolvedValue({
      token: 'access-token',
      exp: new Date('2026-01-01T00:00:00.000Z'),
    })

    const result = await service.issueOnLogin(
      7,
      { ip: '1.1.1.1', user_agent: 'ua', device_info: 'ios' },
      ShionlibUserRoles.ADMIN,
      2,
    )

    expect(hashOpaqueMock).toHaveBeenCalledWith('opaque-1', 'test-pepper')
    expect(prisma.userLoginSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 7,
        refresh_token_hash: 'hash-1',
        refresh_token_prefix: 'prefix-1',
        status: UserLoginSessionStatus.ACTIVE,
        ip: '1.1.1.1',
        user_agent: 'ua',
        device_info: 'ios',
      }),
    })
    expect(tokenService.signToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 7,
        sid: 1001,
        role: ShionlibUserRoles.ADMIN,
        content_limit: 2,
        type: 'access',
      }),
    )
    expect(formatRefreshTokenMock).toHaveBeenCalledWith('prefix-1', 'opaque-1', 'slrt1')
    expect(result).toMatchObject({
      token: 'access-token',
      refreshToken: 'slrt1.prefix-1.opaque-1',
      sessionId: 1001,
    })
    expect(result.refreshTokenExp).toBeInstanceOf(Date)
  })

  it('refresh throws AUTH_INVALID_REFRESH_TOKEN when session prefix does not exist', async () => {
    const { service, prisma } = createService()
    parseRefreshTokenMock.mockReturnValue({
      version: 'slrt1',
      prefix: 'prefix-1',
      opaque: 'opaque-1',
    })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async cb =>
      cb({
        userLoginSession: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      }),
    )

    await expect(
      service.refresh('incoming-refresh-token', {
        ip: '1.1.1.1',
      }),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_INVALID_REFRESH_TOKEN,
    })
  })

  it('logout without refresh token is no-op', async () => {
    const { service, prisma } = createService()

    await service.logout(undefined)

    expect(prisma.userLoginSession.findUnique).not.toHaveBeenCalled()
  })

  it('logout blocks all sessions in the same family', async () => {
    const { service, prisma, cacheService } = createService()
    parseRefreshTokenMock.mockReturnValue({
      version: 'slrt1',
      prefix: 'prefix-1',
      opaque: 'opaque-1',
    })
    ;(prisma.userLoginSession.findUnique as jest.Mock).mockResolvedValue({
      user_id: 7,
      family_id: 'family-1',
      expires_at: new Date(Date.now() + 30_000),
    })

    await service.logout('incoming-refresh-token')

    expect(prisma.userLoginSession.updateMany).toHaveBeenCalledWith({
      where: {
        user_id: 7,
        family_id: 'family-1',
      },
      data: {
        status: UserLoginSessionStatus.BLOCKED,
        blocked_at: expect.any(Date),
        blocked_reason: 'user_logout',
      },
    })
    expect(cacheService.set).toHaveBeenCalledWith(
      'auth:family:blocked:family-1',
      true,
      expect.any(Number),
    )
  })

  it('blockAllSessions keeps minimum ttl at 1000ms', async () => {
    const { service, cacheService } = createService()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(10_000)

    await service.blockAllSessions('family-min-ttl', new Date(9_000))

    expect(cacheService.set).toHaveBeenCalledWith('auth:family:blocked:family-min-ttl', true, 1000)
    nowSpy.mockRestore()
  })
})
