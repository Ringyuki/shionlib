jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomUUID: jest.fn(() => 'flow-fixed'),
}))

jest.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: jest.fn(),
  generateRegistrationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
}))

import { HttpStatus } from '@nestjs/common'
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'
import { PasskeyService } from './passkey.service'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { CacheService } from '../../cache/services/cache.service'
import { LoginSessionService } from './login-session.service'
import { UserStatus } from '../../../shared/enums/auth/user-status.enum'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

describe('PasskeyService', () => {
  const generateAuthenticationOptionsMock = generateAuthenticationOptions as jest.Mock
  const verifyAuthenticationResponseMock = verifyAuthenticationResponse as jest.Mock

  const createService = () => {
    const prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      userPasskeyCredential: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as PrismaService

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'webauthn.rpId') return 'example.com'
        if (key === 'webauthn.rpName') return 'Shionlib'
        if (key === 'webauthn.timeoutMs') return 60_000
        if (key === 'webauthn.challengeTtlSec') return 180
        if (key === 'webauthn.origins') return ['https://example.com']
        return undefined
      }),
    } as unknown as ShionConfigService

    const cacheService = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    } as unknown as CacheService

    const loginSessionService = {
      issueOnLogin: jest.fn(),
    } as unknown as LoginSessionService

    const service = new PasskeyService(prisma, configService, cacheService, loginSessionService)

    return {
      service,
      prisma,
      configService,
      cacheService,
      loginSessionService,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    generateAuthenticationOptionsMock.mockResolvedValue({
      challenge: 'challenge-1',
      rpId: 'example.com',
    })
  })

  it('createLoginOptions saves login challenge without identifier', async () => {
    const { service, prisma, cacheService } = createService()

    const result = await service.createLoginOptions()

    expect(prisma.user.findFirst).not.toHaveBeenCalled()
    expect(generateAuthenticationOptionsMock).toHaveBeenCalledWith({
      rpID: 'example.com',
      timeout: 60_000,
      userVerification: 'required',
      allowCredentials: undefined,
    })
    expect(cacheService.set).toHaveBeenCalledWith(
      'auth:passkey:challenge:flow-fixed',
      {
        kind: 'login',
        challenge: 'challenge-1',
        userId: undefined,
      },
      180_000,
    )
    expect(result).toEqual({
      flow_id: 'flow-fixed',
      options: { challenge: 'challenge-1', rpId: 'example.com' },
    })
  })

  it('createLoginOptions resolves identifier and maps allowCredentials', async () => {
    const { service, prisma, cacheService } = createService()
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 7, status: UserStatus.ACTIVE })
    ;(prisma.userPasskeyCredential.findMany as jest.Mock).mockResolvedValue([
      { credential_id: 'cred-1', transports: ['internal'] },
      { credential_id: 'cred-2', transports: null },
    ])
    generateAuthenticationOptionsMock.mockResolvedValueOnce({
      challenge: 'challenge-2',
    })

    await service.createLoginOptions(' Alice@example.com ')

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { email: { equals: 'Alice@example.com', mode: 'insensitive' } },
          { name: { equals: 'Alice@example.com', mode: 'insensitive' } },
        ],
      },
      select: { id: true, status: true },
    })
    expect(prisma.userPasskeyCredential.findMany).toHaveBeenCalledWith({
      where: { user_id: 7, revoked_at: null },
      select: { credential_id: true, transports: true },
    })
    expect(generateAuthenticationOptionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowCredentials: [
          { id: 'cred-1', transports: ['internal'] },
          { id: 'cred-2', transports: undefined },
        ],
      }),
    )
    expect(cacheService.set).toHaveBeenCalledWith(
      'auth:passkey:challenge:flow-fixed',
      expect.objectContaining({ kind: 'login', challenge: 'challenge-2', userId: 7 }),
      180_000,
    )
  })

  it('createLoginOptions throws USER_NOT_FOUND when identifier does not exist', async () => {
    const { service, prisma } = createService()
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(service.createLoginOptions('missing')).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })
  })

  it('createLoginOptions throws USER_BANNED for banned user', async () => {
    const { service, prisma } = createService()
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 7, status: UserStatus.BANNED })

    await expect(service.createLoginOptions('banned')).rejects.toMatchObject({
      code: ShionBizCode.USER_BANNED,
    })
  })

  it('verifyLogin maps invalid/expired challenge to AUTH_FORBIDDEN', async () => {
    const { service, cacheService, prisma } = createService()
    ;(cacheService.get as jest.Mock).mockResolvedValue(null)
    ;(cacheService.del as jest.Mock).mockResolvedValue(undefined)

    await expect(
      service.verifyLogin(
        'missing-flow',
        { id: 'cred-x' } as any,
        { headers: {}, user: {} } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    })

    expect(prisma.userPasskeyCredential.findFirst).not.toHaveBeenCalled()
  })

  it('verifyLogin verifies assertion and issues session tokens', async () => {
    const { service, cacheService, prisma, loginSessionService } = createService()
    ;(cacheService.get as jest.Mock).mockResolvedValue({
      kind: 'login',
      challenge: 'challenge-ok',
      userId: 7,
    })
    ;(cacheService.del as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.userPasskeyCredential.findFirst as jest.Mock).mockResolvedValue({
      id: 11,
      user_id: 7,
      credential_id: 'cred-1',
      public_key: 'AQI',
      counter: 1,
      transports: ['internal'],
      user: {
        id: 7,
        role: 1,
        content_limit: 2,
        status: UserStatus.ACTIVE,
      },
    })
    verifyAuthenticationResponseMock.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 9,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
      },
    })
    ;(loginSessionService.issueOnLogin as jest.Mock).mockResolvedValue({
      token: 'access-token',
      refreshToken: 'refresh-token',
      tokenExp: new Date('2026-02-28T10:00:00.000Z'),
      refreshTokenExp: new Date('2026-03-07T10:00:00.000Z'),
    })

    const result = await service.verifyLogin(
      'flow-fixed',
      { id: 'cred-1' } as any,
      {
        headers: {
          'x-real-ip': '1.1.1.1',
          'user-agent': 'jest-agent',
        },
      } as any,
    )

    expect(verifyAuthenticationResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: 'challenge-ok',
        expectedRPID: 'example.com',
        expectedOrigin: ['https://example.com'],
        requireUserVerification: true,
      }),
    )
    expect(prisma.userPasskeyCredential.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: expect.objectContaining({
        counter: 9,
        device_type: 'singleDevice',
        credential_backed_up: false,
        last_used_at: expect.any(Date),
      }),
    })
    expect(loginSessionService.issueOnLogin).toHaveBeenCalledWith(
      7,
      { ip: '1.1.1.1', user_agent: 'jest-agent' },
      1,
      2,
    )
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { last_login_at: expect.any(Date) },
    })
    expect(result).toEqual({
      token: 'access-token',
      refresh_token: 'refresh-token',
      tokenExp: new Date('2026-02-28T10:00:00.000Z'),
      refreshTokenExp: new Date('2026-03-07T10:00:00.000Z'),
    })
  })

  it('listMyPasskeys delegates query with expected ordering/select', async () => {
    const { service, prisma } = createService()
    ;(prisma.userPasskeyCredential.findMany as jest.Mock).mockResolvedValue([{ id: 1 }])

    const result = await service.listMyPasskeys(77)

    expect(prisma.userPasskeyCredential.findMany).toHaveBeenCalledWith({
      where: { user_id: 77, revoked_at: null },
      orderBy: [{ last_used_at: 'desc' }, { created: 'desc' }],
      select: expect.objectContaining({
        id: true,
        credential_id: true,
        name: true,
        device_type: true,
      }),
    })
    expect(result).toEqual([{ id: 1 }])
  })

  it('revokeMyPasskey throws USER_NOT_FOUND when credential is absent', async () => {
    const { service, prisma } = createService()
    ;(prisma.userPasskeyCredential.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(service.revokeMyPasskey(7, 99)).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    })
  })

  it('revokeMyPasskey disables two_factor_enabled when last passkey is removed', async () => {
    const { service, prisma } = createService()
    ;(prisma.userPasskeyCredential.findFirst as jest.Mock).mockResolvedValue({ id: 99 })
    ;(prisma.userPasskeyCredential.update as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.userPasskeyCredential.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.user.update as jest.Mock).mockResolvedValue(undefined)

    const result = await service.revokeMyPasskey(7, 99)

    expect(prisma.userPasskeyCredential.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { revoked_at: expect.any(Date) },
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { two_factor_enabled: false },
    })
    expect(result).toEqual({ id: 99 })
  })

  it('revokeMyPasskey keeps two_factor_enabled when active passkeys remain', async () => {
    const { service, prisma } = createService()
    ;(prisma.userPasskeyCredential.findFirst as jest.Mock).mockResolvedValue({ id: 10 })
    ;(prisma.userPasskeyCredential.update as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.userPasskeyCredential.count as jest.Mock).mockResolvedValue(2)

    await service.revokeMyPasskey(1, 10)

    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
