jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(),
}))

jest.mock('argon2', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
  },
}))

import { randomUUID } from 'node:crypto'
import argon2 from 'argon2'
import { PrismaService } from '../../../prisma.service'
import { EmailService } from '../../email/services/email.service'
import { CacheService } from '../../cache/services/cache.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'
import { PasswordService } from './password.service'

describe('PasswordService', () => {
  const randomUUIDMock = randomUUID as jest.Mock
  const argon2HashMock = (argon2 as unknown as { hash: jest.Mock }).hash

  const createService = () => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService

    const emailService = {
      sendPasswordResetLink: jest.fn(),
    } as unknown as EmailService

    const cacheService = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    } as unknown as CacheService

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'siteUrl') return 'https://shionlib.test'
        return undefined
      }),
    } as unknown as ShionConfigService

    const service = new PasswordService(prisma, emailService, cacheService, configService)
    return { service, prisma, emailService, cacheService }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    randomUUIDMock.mockReturnValue('11111111-1111-4111-8111-111111111111')
    argon2HashMock.mockResolvedValue('hashed-password')
  })

  it('getEmail throws USER_NOT_FOUND when user does not exist', async () => {
    const { service, prisma } = createService()
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    let error: unknown
    try {
      await service.getEmail({ email: 'missing@example.com' })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ShionBizException)
    expect((error as ShionBizException).code).toBe(ShionBizCode.USER_NOT_FOUND)
  })

  it('getEmail stores reset token in cache and sends reset link', async () => {
    const { service, prisma, cacheService, emailService } = createService()
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, email: 'u@example.com' })

    await service.getEmail({ email: 'u@example.com' })

    expect(cacheService.set).toHaveBeenCalledWith(
      'forgetPassword:11111111-1111-4111-8111-111111111111-u@example.com',
      {
        email: 'u@example.com',
        token: '11111111-1111-4111-8111-111111111111',
      },
      600_000,
    )

    const [, resetLink, ttlSeconds] = (emailService.sendPasswordResetLink as jest.Mock).mock
      .calls[0]
    const url = new URL(resetLink)
    expect(url.origin).toBe('https://shionlib.test')
    expect(url.pathname).toBe('/user/password/forget')
    expect(url.searchParams.get('token')).toBe('11111111-1111-4111-8111-111111111111')
    expect(url.searchParams.get('email')).toBe('u@example.com')
    expect(ttlSeconds).toBe(600)
  })

  it('check returns true only when token/email match cache content', async () => {
    const { service, cacheService } = createService()
    ;(cacheService.get as jest.Mock).mockResolvedValue({
      email: 'u@example.com',
      token: 'token-1',
    })

    await expect(service.check({ email: 'u@example.com', token: 'token-1' })).resolves.toBe(true)
    await expect(service.check({ email: 'u@example.com', token: 'token-2' })).resolves.toBe(false)
  })

  it('resetPassword throws AUTH_INVALID_RESET_PASSWORD_TOKEN when token is invalid', async () => {
    const { service, cacheService } = createService()
    ;(cacheService.get as jest.Mock).mockResolvedValue(null)

    await expect(
      service.resetPassword({
        email: 'u@example.com',
        password: 'new-password',
        token: 'token-1',
      }),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_INVALID_RESET_PASSWORD_TOKEN,
    })
  })

  it('resetPassword throws USER_NOT_FOUND when token valid but user missing', async () => {
    const { service, cacheService, prisma } = createService()
    ;(cacheService.get as jest.Mock).mockResolvedValue({
      email: 'u@example.com',
      token: 'token-1',
    })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      service.resetPassword({
        email: 'u@example.com',
        password: 'new-password',
        token: 'token-1',
      }),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })
  })

  it('resetPassword updates password, blocks sessions and clears cache key', async () => {
    const { service, cacheService, prisma } = createService()
    ;(cacheService.get as jest.Mock).mockResolvedValue({
      email: 'u@example.com',
      token: 'token-1',
    })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 42, email: 'u@example.com' })

    const tx = {
      user: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      userLoginSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async cb => cb(tx))

    await service.resetPassword({
      email: 'u@example.com',
      password: 'new-password',
      token: 'token-1',
    })

    expect(argon2HashMock).toHaveBeenCalledWith('new-password')
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { password: 'hashed-password' },
    })
    expect(tx.userLoginSession.updateMany).toHaveBeenCalledWith({
      where: { user_id: 42 },
      data: {
        status: UserLoginSessionStatus.BLOCKED,
        blocked_at: expect.any(Date),
        blocked_reason: 'user_password_changed',
      },
    })
    expect(cacheService.del).toHaveBeenCalledWith('forgetPassword:token-1-u@example.com')
  })
})
