jest.mock('argon2', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
  },
}))

jest.mock('../utils/verify-password.util', () => ({
  verifyPassword: jest.fn(),
}))

import { HttpStatus } from '@nestjs/common'
import argon2 from 'argon2'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { UserStatus } from '../../../shared/enums/auth/user-status.enum'
import { verifyPassword } from '../utils/verify-password.util'
import { UserService } from './user.service'

describe('UserService', () => {
  const argon2HashMock = argon2.hash as unknown as jest.Mock
  const verifyPasswordMock = verifyPassword as jest.Mock

  const createService = () => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      gameDownloadResource: {
        count: jest.fn(),
      },
      comment: {
        count: jest.fn(),
      },
      favoriteItem: {
        count: jest.fn(),
      },
      editRecord: {
        count: jest.fn(),
      },
      walkthrough: {
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const configService = {
      get: jest.fn((key: string): any => {
        if (key === 'allowRegister') return true
        return undefined
      }),
    }

    const loginSessionService = {
      issueOnLogin: jest.fn(),
      refresh: jest.fn(),
      blockAllSessions: jest.fn(),
    }

    const verificationCodeService = {
      verify: jest.fn(),
    }

    return {
      prisma,
      configService,
      loginSessionService,
      verificationCodeService,
      service: new UserService(
        prisma as any,
        configService as any,
        loginSessionService as any,
        verificationCodeService as any,
      ),
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('create throws when verification failed', async () => {
    const { service, verificationCodeService } = createService()
    verificationCodeService.verify.mockResolvedValue({ verified: false })

    await expect(
      service.create(
        {
          email: 'a@example.com',
          name: 'alice',
          password: 'pass',
          code: '111111',
          uuid: 'u-1',
        } as any,
        { headers: {} } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_VERIFICATION_CODE_ERROR,
    })
  })

  it('create throws when registration is disabled', async () => {
    const { service, verificationCodeService, configService } = createService()
    verificationCodeService.verify.mockResolvedValue({ verified: true })
    configService.get.mockImplementation((key: string) => {
      if (key === 'allowRegister') return false
      return undefined
    })

    await expect(
      service.create(
        {
          email: 'a@example.com',
          name: 'alice',
          password: 'pass',
          code: '111111',
          uuid: 'u-1',
        } as any,
        { headers: {} } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_ALLOW_REGISTER,
    })
  })

  it('create validates duplicate email and duplicate name', async () => {
    const { service, verificationCodeService, prisma } = createService()
    verificationCodeService.verify.mockResolvedValue({ verified: true })

    prisma.user.findUnique.mockResolvedValueOnce({ id: 1 })
    await expect(
      service.create(
        {
          email: 'a@example.com',
          name: 'alice',
          password: 'pass',
          code: '111111',
          uuid: 'u-1',
        } as any,
        { headers: {} } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_EMAIL_ALREADY_EXISTS,
    })

    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 2 })
    await expect(
      service.create(
        {
          email: 'b@example.com',
          name: 'alice',
          password: 'pass',
          code: '111111',
          uuid: 'u-1',
        } as any,
        { headers: {} } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_NAME_ALREADY_EXISTS,
    })
  })

  it('create hashes password and creates user with defaults', async () => {
    const { service, verificationCodeService, prisma } = createService()
    verificationCodeService.verify.mockResolvedValue({ verified: true })
    prisma.user.findUnique.mockResolvedValue(null)
    argon2HashMock.mockResolvedValue('hashed-pass')
    prisma.user.create.mockResolvedValue({ id: 9, name: 'alice' })

    const result = await service.create(
      {
        email: 'a@example.com',
        name: 'alice',
        password: 'pass',
        code: '111111',
        uuid: 'u-1',
        lang: 'ja',
      } as any,
      { headers: {} } as any,
    )

    expect(argon2HashMock).toHaveBeenCalledWith('pass')
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'a@example.com',
          name: 'alice',
          password: 'hashed-pass',
          lang: 'ja',
          upload_quota: {
            create: { size: 0n, used: 0n },
          },
          favorites: {
            create: { name: 'default', default: true },
          },
        }),
      }),
    )
    expect(result).toEqual({ id: 9, name: 'alice' })
  })

  it('login throws USER_NOT_FOUND for unknown account', async () => {
    const { service, prisma } = createService()
    prisma.user.findFirst.mockResolvedValue(null)

    await expect(
      service.login(
        { identifier: 'alice', password: 'pass' } as any,
        { headers: { 'x-real-ip': '1.1.1.1', 'user-agent': 'ua' } } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    })
  })

  it('login throws for banned user and invalid password', async () => {
    const { service, prisma } = createService()

    prisma.user.findFirst.mockResolvedValueOnce({ status: UserStatus.BANNED })
    await expect(
      service.login(
        { identifier: 'alice', password: 'pass' } as any,
        { headers: { 'x-real-ip': '1.1.1.1', 'user-agent': 'ua' } } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_BANNED,
    })

    prisma.user.findFirst.mockResolvedValueOnce({
      id: 1,
      status: UserStatus.ACTIVE,
      password: 'hashed',
      role: ShionlibUserRoles.USER,
      content_limit: 1,
    })
    verifyPasswordMock.mockResolvedValue(false)

    await expect(
      service.login(
        { identifier: 'alice', password: 'wrong' } as any,
        { headers: { 'x-real-ip': '1.1.1.1', 'user-agent': 'ua' } } as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_INVALID_PASSWORD,
      status: HttpStatus.UNAUTHORIZED,
    })
  })

  it('login issues session and updates last login', async () => {
    const { service, prisma, loginSessionService } = createService()
    prisma.user.findFirst.mockResolvedValue({
      id: 1,
      name: 'alice',
      password: 'hashed',
      email: 'a@example.com',
      avatar: null,
      cover: null,
      role: ShionlibUserRoles.USER,
      lang: 'ja',
      content_limit: 2,
      status: UserStatus.ACTIVE,
    })
    verifyPasswordMock.mockResolvedValue(true)
    loginSessionService.issueOnLogin.mockResolvedValue({
      token: 't1',
      tokenExp: new Date('2026-02-28T10:00:00.000Z'),
      refreshToken: 'r1',
      refreshTokenExp: new Date('2026-03-07T10:00:00.000Z'),
    })

    const result = await service.login(
      { identifier: 'alice', password: 'pass' } as any,
      { headers: { 'x-real-ip': '1.1.1.1', 'user-agent': 'ua' } } as any,
    )

    expect(loginSessionService.issueOnLogin).toHaveBeenCalledWith(
      1,
      { ip: '1.1.1.1', user_agent: 'ua' },
      ShionlibUserRoles.USER,
      2,
    )
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { last_login_at: expect.any(Date) },
    })
    expect(result).toEqual({
      token: 't1',
      refresh_token: 'r1',
      tokenExp: new Date('2026-02-28T10:00:00.000Z'),
      refreshTokenExp: new Date('2026-03-07T10:00:00.000Z'),
    })
  })

  it('refreshToken validates input and delegates to loginSessionService', async () => {
    const { service, loginSessionService } = createService()

    await expect(service.refreshToken('', { headers: {} } as any)).rejects.toMatchObject({
      code: ShionBizCode.AUTH_INVALID_REFRESH_TOKEN,
      status: HttpStatus.UNAUTHORIZED,
    })

    loginSessionService.refresh.mockResolvedValue({
      token: 'new-t',
      tokenExp: new Date('2026-02-28T11:00:00.000Z'),
      refreshToken: 'new-r',
      refreshTokenExp: new Date('2026-03-07T11:00:00.000Z'),
    })
    const result = await service.refreshToken('old-r', {
      headers: { 'cf-connecting-ip': '2.2.2.2', 'user-agent': 'ua-2' },
    } as any)

    expect(loginSessionService.refresh).toHaveBeenCalledWith('old-r', {
      ip: '2.2.2.2',
      user_agent: 'ua-2',
    })
    expect(result).toEqual({
      token: 'new-t',
      refresh_token: 'new-r',
      tokenExp: new Date('2026-02-28T11:00:00.000Z'),
      refreshTokenExp: new Date('2026-03-07T11:00:00.000Z'),
    })
  })

  it('getMe, checkName and getById work with expected mappings', async () => {
    const { service, prisma } = createService()

    prisma.user.findUnique.mockResolvedValueOnce(null)
    await expect(service.getMe({ user: { sub: 1 } } as any)).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })

    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, name: 'alice' })
    await expect(service.getMe({ user: { sub: 1 } } as any)).resolves.toEqual({
      id: 1,
      name: 'alice',
    })

    prisma.user.findUnique.mockResolvedValueOnce({ id: 2 })
    await expect(service.checkName('taken')).resolves.toEqual({ exists: true })

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 3,
      name: 'u3',
      avatar: null,
      role: 1,
      created: new Date('2026-02-18T00:00:00.000Z'),
      status: 1,
    })
    prisma.gameDownloadResource.count.mockResolvedValue(4)
    prisma.comment.count.mockResolvedValue(5)
    prisma.favoriteItem.count.mockResolvedValue(6)
    prisma.editRecord.count.mockResolvedValue(7)
    prisma.walkthrough.count.mockResolvedValue(3)

    const profile = await service.getById(3)
    expect(profile).toMatchObject({
      id: 3,
      resource_count: 4,
      comment_count: 5,
      favorite_count: 6,
      edit_count: 7,
      walkthrough_count: 3,
    })
  })

  it('getById throws when user does not exist', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue(null)

    await expect(service.getById(99)).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })
  })

  it('ban validates not found / already banned / invalid duration', async () => {
    const { service } = createService()

    const tx = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 1, status: UserStatus.BANNED })
          .mockResolvedValueOnce({ id: 1, status: UserStatus.ACTIVE }),
        update: jest.fn(),
      },
      userBannedRecord: {
        create: jest.fn(),
      },
      userLoginSession: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      comment: {
        deleteMany: jest.fn(),
      },
    }

    await expect(service.ban(1, {} as any, tx as any)).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })
    await expect(service.ban(1, {} as any, tx as any)).rejects.toMatchObject({
      code: ShionBizCode.USER_ALREADY_BANNED,
    })
    await expect(
      service.ban(1, { is_permanent: false, banned_duration_days: 0 } as any, tx as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_INVALID_BAN_DURATION,
    })
  })

  it('ban updates records, blocks sessions, and optionally deletes comments', async () => {
    const { service, loginSessionService } = createService()

    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 5, status: UserStatus.ACTIVE }),
        update: jest.fn(),
      },
      userBannedRecord: {
        create: jest.fn(),
      },
      userLoginSession: {
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ family_id: 'fam-1' }, { family_id: 'fam-2' }]),
      },
      comment: {
        deleteMany: jest.fn(),
      },
    }

    await service.ban(
      5,
      {
        banned_by: 9,
        banned_reason: 'spam',
        banned_duration_days: 3,
        is_permanent: false,
        delete_user_comments: true,
      } as any,
      tx as any,
    )

    expect(tx.userBannedRecord.create).toHaveBeenCalledWith({
      data: {
        user_id: 5,
        banned_by: 9,
        banned_reason: 'spam',
        banned_duration_days: 3,
        is_permanent: false,
      },
    })
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: UserStatus.BANNED },
    })
    expect(tx.userLoginSession.updateMany).toHaveBeenCalledWith({
      where: { user_id: 5 },
      data: {
        status: UserLoginSessionStatus.BLOCKED,
        blocked_at: expect.any(Date),
        blocked_reason: 'user_banned',
      },
    })
    expect(loginSessionService.blockAllSessions).toHaveBeenNthCalledWith(
      1,
      'fam-1',
      expect.any(Date),
    )
    expect(loginSessionService.blockAllSessions).toHaveBeenNthCalledWith(
      2,
      'fam-2',
      expect.any(Date),
    )
    expect(tx.comment.deleteMany).toHaveBeenCalledWith({ where: { creator_id: 5 } })
  })

  it('ban supports notThrowNotFound shortcut', async () => {
    const { service } = createService()
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    }

    await expect(service.ban(1, {} as any, tx as any, true)).resolves.toBeUndefined()
  })

  it('unban validates existence and active status', async () => {
    const { service, prisma } = createService()

    prisma.user.findUnique.mockResolvedValueOnce(null)
    await expect(service.unban(1)).rejects.toMatchObject({ code: ShionBizCode.USER_NOT_FOUND })

    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, status: UserStatus.ACTIVE })
    await expect(service.unban(1)).rejects.toMatchObject({
      code: ShionBizCode.USER_ALREADY_UNBANNED,
    })
  })

  it('unban reopens latest ban record and activates user', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue({ id: 1, status: UserStatus.BANNED })

    const tx = {
      userBannedRecord: {
        findFirst: jest.fn().mockResolvedValue({ id: 99 }),
        update: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    await service.unban(1)

    expect(tx.userBannedRecord.findFirst).toHaveBeenCalledWith({
      where: { user_id: 1, unbanned_at: null },
      orderBy: { banned_at: 'desc' },
      select: { id: true },
    })
    expect(tx.userBannedRecord.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { unbanned_at: expect.any(Date) },
    })
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: UserStatus.ACTIVE },
    })
  })
})
