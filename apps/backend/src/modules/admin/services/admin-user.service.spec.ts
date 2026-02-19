jest.mock('argon2', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
  },
}))

import { HttpStatus } from '@nestjs/common'
import argon2 from 'argon2'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { AdminUserService } from './admin-user.service'

describe('AdminUserService', () => {
  const argon2HashMock = argon2.hash as unknown as jest.Mock

  const createService = () => {
    const prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userLoginSession: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      roleFieldPermission: {
        findUnique: jest.fn(),
      },
      userFieldPermission: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      fieldPermissionMapping: {
        findMany: jest.fn(),
      },
      userUploadQuota: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const loginSessionService = {
      blockAllSessions: jest.fn(),
    }

    const userService = {
      ban: jest.fn(),
      unban: jest.fn(),
    }

    return {
      prisma,
      loginSessionService,
      userService,
      service: new AdminUserService(prisma as any, loginSessionService as any, userService as any),
    }
  }

  const superAdmin = { sub: 1000, role: ShionlibUserRoles.SUPER_ADMIN }
  const admin = { sub: 1001, role: ShionlibUserRoles.ADMIN }
  const user = { sub: 1002, role: ShionlibUserRoles.USER }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getUserList maps items and supports numeric search', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-18T00:00:00.000Z')

    prisma.user.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'alice',
        email: 'a@example.com',
        avatar: null,
        role: 1,
        status: 1,
        lang: 'ja',
        content_limit: 2,
        created: now,
        updated: now,
        last_login_at: now,
        two_factor_enabled: false,
        _count: {
          comments: 3,
          game_download_resources: 4,
          favorites: 5,
          edit_records: 6,
        },
      },
    ])
    prisma.user.count.mockResolvedValue(12)

    const result = await service.getUserList({
      page: 2,
      pageSize: 5,
      search: '123',
      role: 1,
      status: 1,
      sortBy: 'id',
      sortOrder: 'desc',
    } as any)

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: 1,
          status: 1,
          OR: expect.arrayContaining([
            { name: { contains: '123', mode: 'insensitive' } },
            { email: { contains: '123', mode: 'insensitive' } },
            { id: 123 },
          ]),
        },
        orderBy: { id: 'desc' },
        skip: 5,
        take: 5,
      }),
    )

    expect(result).toEqual({
      items: [
        {
          id: 1,
          name: 'alice',
          email: 'a@example.com',
          avatar: null,
          role: 1,
          status: 1,
          lang: 'ja',
          content_limit: 2,
          created: now,
          updated: now,
          last_login_at: now,
          two_factor_enabled: false,
          counts: {
            comments: 3,
            resources: 4,
            favorites: 5,
            edits: 6,
          },
        },
      ],
      meta: {
        totalItems: 12,
        itemCount: 1,
        itemsPerPage: 5,
        totalPages: 3,
        currentPage: 2,
      },
    })
  })

  it('getUserDetail throws when user does not exist', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue(null)

    await expect(service.getUserDetail(99)).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })
  })

  it('getUserDetail maps quota bigint fields and latest ban info', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-18T00:00:00.000Z')

    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      name: 'alice',
      email: 'a@example.com',
      avatar: null,
      cover: null,
      role: 1,
      status: 1,
      lang: 'ja',
      content_limit: 2,
      created: now,
      updated: now,
      last_login_at: now,
      two_factor_enabled: false,
      upload_quota: {
        size: 1024n,
        used: 256n,
        is_first_grant: true,
      },
      banned_records: [
        {
          banned_at: now,
          banned_reason: 'spam',
          banned_duration_days: 3,
          is_permanent: false,
          unbanned_at: null,
          banned_by_user: { id: 9, name: 'mod' },
        },
      ],
      _count: {
        comments: 1,
        game_download_resources: 2,
        favorites: 3,
        edit_records: 4,
      },
    })

    const result = await service.getUserDetail(1)

    expect(result).toMatchObject({
      id: 1,
      upload_quota: {
        size: '1024',
        used: '256',
        is_first_grant: true,
      },
      counts: {
        comments: 1,
        resources: 2,
        favorites: 3,
        edits: 4,
      },
      latest_ban: {
        banned_reason: 'spam',
        banned_by: { id: 9, name: 'mod' },
      },
    })
  })

  it('updateUserProfile validates not-found and permission', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValueOnce(null)

    await expect(service.updateUserProfile(1, {} as any, admin as any)).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: ShionlibUserRoles.SUPER_ADMIN,
      name: 'a',
      email: 'a@x.com',
    })
    await expect(
      service.updateUserProfile(1, { name: 'new' } as any, admin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_UNAUTHORIZED,
      status: HttpStatus.FORBIDDEN,
    })
  })

  it('updateUserProfile validates duplicate name/email and returns no-op payload', async () => {
    const { service, prisma } = createService()

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: 1,
      name: 'alice',
      email: 'a@x.com',
    })
    prisma.user.findUnique.mockResolvedValueOnce({ id: 2 })
    await expect(
      service.updateUserProfile(1, { name: 'bob' } as any, superAdmin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_NAME_ALREADY_EXISTS,
    })

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: 1,
      name: 'alice',
      email: 'a@x.com',
    })
    prisma.user.findUnique.mockResolvedValueOnce({ id: 3 })
    await expect(
      service.updateUserProfile(1, { email: 'b@x.com' } as any, superAdmin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_EMAIL_ALREADY_EXISTS,
    })

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: 1,
      name: 'alice',
      email: 'a@x.com',
    })
    const noChange = await service.updateUserProfile(
      1,
      { name: 'alice', email: 'a@x.com' } as any,
      superAdmin as any,
    )
    expect(noChange).toEqual({ id: 1, name: 'alice', email: 'a@x.com' })
  })

  it('updateUserProfile updates mutable fields', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue({ id: 1, role: 1, name: 'alice', email: 'a@x.com' })
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: 1,
      name: 'alice',
      email: 'a@x.com',
    })
    prisma.user.findUnique.mockResolvedValueOnce(null)
    prisma.user.findUnique.mockResolvedValueOnce(null)
    prisma.user.update.mockResolvedValue({
      id: 1,
      name: 'bob',
      email: 'b@x.com',
      lang: 'ja',
      content_limit: 2,
    })

    const result = await service.updateUserProfile(
      1,
      { name: 'bob', email: 'b@x.com', lang: 'ja', content_limit: 2 } as any,
      superAdmin as any,
    )

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: 'bob',
        email: 'b@x.com',
        lang: 'ja',
        content_limit: 2,
      },
      select: {
        id: true,
        name: true,
        email: true,
        lang: true,
        content_limit: true,
      },
    })
    expect(result).toEqual({ id: 1, name: 'bob', email: 'b@x.com', lang: 'ja', content_limit: 2 })
  })

  it('updateUserRole enforces checks and updates for super admin', async () => {
    const { service, prisma } = createService()

    prisma.user.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.updateUserRole(1, { role: 2 } as any, superAdmin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })

    prisma.user.findUnique.mockResolvedValueOnce({ id: 1000, role: 1 })
    await expect(
      service.updateUserRole(1000, { role: 2 } as any, superAdmin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_UNAUTHORIZED,
      status: HttpStatus.FORBIDDEN,
    })

    prisma.user.findUnique.mockResolvedValueOnce({ id: 2, role: 1 })
    await expect(service.updateUserRole(2, { role: 2 } as any, admin as any)).rejects.toMatchObject(
      {
        code: ShionBizCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.FORBIDDEN,
      },
    )

    prisma.user.findUnique.mockResolvedValueOnce({ id: 3, role: 1 })
    await service.updateUserRole(3, { role: 2 } as any, superAdmin as any)
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { role: 2 } })
  })

  it('banUser and unbanUser validate and delegate to user service', async () => {
    const { service, prisma, userService } = createService()

    prisma.user.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.banUser(1, { banned_reason: 'x' } as any, admin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })

    prisma.user.findUnique.mockResolvedValueOnce({ id: 1001, role: 1 })
    await expect(
      service.banUser(1001, { banned_reason: 'x' } as any, admin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_UNAUTHORIZED,
      status: HttpStatus.FORBIDDEN,
    })

    prisma.user.findUnique.mockResolvedValueOnce({ id: 2, role: 2 })
    await expect(
      service.banUser(2, { banned_reason: 'x' } as any, user as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_UNAUTHORIZED,
      status: HttpStatus.FORBIDDEN,
    })

    prisma.user.findUnique.mockResolvedValueOnce({ id: 3, role: 1 })
    await service.banUser(3, { banned_reason: 'spam' } as any, admin as any)
    expect(userService.ban).toHaveBeenCalledWith(3, { banned_reason: 'spam', banned_by: 1001 })

    prisma.user.findUnique.mockResolvedValueOnce({ id: 4, role: 1 })
    await service.unbanUser(4, admin as any)
    expect(userService.unban).toHaveBeenCalledWith(4)
  })

  it('resetPassword hashes, updates, and blocks all user session families', async () => {
    const { service, prisma, loginSessionService } = createService()
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 1 })
    argon2HashMock.mockResolvedValue('new-hash')

    const fam1Exp1 = new Date('2026-02-20T00:00:00.000Z')
    const fam1Exp2 = new Date('2026-02-22T00:00:00.000Z')
    const fam2Exp = new Date('2026-02-21T00:00:00.000Z')
    prisma.userLoginSession.findMany.mockResolvedValue([
      { family_id: 'fam-1', expires_at: fam1Exp1 },
      { family_id: 'fam-1', expires_at: fam1Exp2 },
      { family_id: 'fam-2', expires_at: fam2Exp },
    ])

    await service.resetPassword(5, { password: 'P@ssw0rd1' } as any, superAdmin as any)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { password: 'new-hash' },
    })
    expect(prisma.userLoginSession.updateMany).toHaveBeenCalledWith({
      where: { user_id: 5 },
      data: {
        status: UserLoginSessionStatus.BLOCKED,
        blocked_at: expect.any(Date),
        blocked_reason: 'admin_reset_password',
      },
    })
    expect(loginSessionService.blockAllSessions).toHaveBeenNthCalledWith(1, 'fam-1', fam1Exp2)
    expect(loginSessionService.blockAllSessions).toHaveBeenNthCalledWith(2, 'fam-2', fam2Exp)
  })

  it('forceLogout blocks user sessions after permission checks', async () => {
    const { service, prisma, loginSessionService } = createService()
    prisma.user.findUnique.mockResolvedValueOnce({ id: 6, role: 1 })
    prisma.userLoginSession.findMany.mockResolvedValue([
      { family_id: 'fam-3', expires_at: new Date('2026-02-25T00:00:00.000Z') },
    ])

    await service.forceLogout(6, admin as any)

    expect(prisma.userLoginSession.updateMany).toHaveBeenCalledWith({
      where: { user_id: 6 },
      data: {
        status: UserLoginSessionStatus.BLOCKED,
        blocked_at: expect.any(Date),
        blocked_reason: 'admin_force_logout',
      },
    })
    expect(loginSessionService.blockAllSessions).toHaveBeenCalledWith(
      'fam-3',
      new Date('2026-02-25T00:00:00.000Z'),
    )
  })

  it('getUserSessions maps session pagination payload', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-18T00:00:00.000Z')
    prisma.userLoginSession.findMany.mockResolvedValue([
      {
        id: 1,
        family_id: 'fam-1',
        status: 1,
        ip: '1.1.1.1',
        user_agent: 'ua',
        device_info: { os: 'mac' },
        created: now,
        updated: now,
        last_used_at: now,
        expires_at: now,
        rotated_at: null,
        reused_at: null,
        blocked_at: null,
        blocked_reason: null,
      },
    ])
    prisma.userLoginSession.count.mockResolvedValue(3)

    const result = await service.getUserSessions(1, { page: 2, pageSize: 1, status: 1 } as any)

    expect(prisma.userLoginSession.findMany).toHaveBeenCalledWith({
      where: { user_id: 1, status: 1 },
      skip: 1,
      take: 1,
      orderBy: { created: 'desc' },
      select: expect.any(Object),
    })
    expect(result.meta).toEqual({
      totalItems: 3,
      itemCount: 1,
      itemsPerPage: 1,
      totalPages: 3,
      currentPage: 2,
    })
  })

  it('getUserEditPermissions merges role/user masks and maps groups', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue({ id: 1, role: ShionlibUserRoles.USER })
    prisma.roleFieldPermission.findUnique.mockResolvedValue({ allowMask: 3n })
    prisma.userFieldPermission.findUnique.mockResolvedValue({ allowMask: 1n << 10n })
    prisma.fieldPermissionMapping.findMany.mockResolvedValue([
      { field: 'IDS', bitIndex: 0, isRelation: false },
      { field: 'TITLES', bitIndex: 1, isRelation: false },
      { field: 'MANAGE_LINKS', bitIndex: 10, isRelation: true },
    ])

    const result = await service.getUserEditPermissions(1, PermissionEntity.GAME, admin as any)

    expect(result).toMatchObject({
      entity: PermissionEntity.GAME,
      roleMask: '3',
      userMask: '1024',
      allowMask: '1027',
    })
    expect(result.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'IDS', enabled: true, source: 'role', mutable: false }),
        expect.objectContaining({
          field: 'MANAGE_LINKS',
          enabled: true,
          source: 'user',
          mutable: true,
        }),
      ]),
    )
  })

  it('updateUserEditPermissions validates bits and upserts mask', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue({ id: 1, role: ShionlibUserRoles.USER })

    prisma.fieldPermissionMapping.findMany.mockResolvedValueOnce([{ bitIndex: 0 }, { bitIndex: 1 }])
    await expect(
      service.updateUserEditPermissions(1, PermissionEntity.GAME, [0, 7], admin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.COMMON_VALIDATION_FAILED,
      status: HttpStatus.BAD_REQUEST,
    })

    prisma.fieldPermissionMapping.findMany.mockResolvedValueOnce([{ bitIndex: 0 }, { bitIndex: 1 }])
    const result = await service.updateUserEditPermissions(
      1,
      PermissionEntity.GAME,
      [0, 1],
      admin as any,
    )

    expect(prisma.userFieldPermission.upsert).toHaveBeenCalledWith({
      where: { user_id_entity: { user_id: 1, entity: PermissionEntity.GAME } },
      update: { allowMask: 3n },
      create: { user_id: 1, entity: PermissionEntity.GAME, allowMask: 3n },
    })
    expect(result).toEqual({ allowMask: '3' })
  })

  it('adjustUserUploadQuotaSize handles SUB validation and ADD success', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue({ id: 1, role: 1 })

    const tx1 = {
      userUploadQuota: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, size: 100n, used: 80n }),
        create: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementationOnce(async (cb: any) => cb(tx1))

    await expect(
      service.adjustUserUploadQuotaSize(1, { action: 'SUB', amount: 30 } as any, admin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_EXCEEDED,
    })

    const tx2 = {
      userUploadQuota: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, size: 100n, used: 80n }),
        create: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementationOnce(async (cb: any) => cb(tx2))

    await service.adjustUserUploadQuotaSize(1, { action: 'ADD', amount: 20 } as any, admin as any)

    expect(tx2.userUploadQuotaRecord.create).toHaveBeenCalledWith({
      data: {
        field: 'SIZE',
        amount: 20n,
        action: 'ADD',
        action_reason: 'ADMIN_ADJUST',
        user_upload_quota_id: 10,
      },
    })
    expect(tx2.userUploadQuota.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        size: {
          increment: 20n,
        },
      },
    })
  })

  it('adjustUserUploadQuotaUsed validates limits and supports USE updates', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue({ id: 1, role: 1 })

    const txUseOverflow = {
      userUploadQuota: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, size: 100n, used: 90n }),
        create: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementationOnce(async (cb: any) => cb(txUseOverflow))

    await expect(
      service.adjustUserUploadQuotaUsed(1, { action: 'USE', amount: 20 } as any, admin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_EXCEEDED,
    })

    const txAddNegative = {
      userUploadQuota: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, size: 100n, used: 10n }),
        create: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementationOnce(async (cb: any) => cb(txAddNegative))

    await expect(
      service.adjustUserUploadQuotaUsed(1, { action: 'ADD', amount: 20 } as any, admin as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_USE_CANT_BE_NEGATIVE,
    })

    const txSuccess = {
      userUploadQuota: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, size: 100n, used: 10n }),
        create: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementationOnce(async (cb: any) => cb(txSuccess))

    await service.adjustUserUploadQuotaUsed(1, { action: 'USE', amount: 5 } as any, admin as any)

    expect(txSuccess.userUploadQuotaRecord.create).toHaveBeenCalledWith({
      data: {
        field: 'USED',
        amount: 5n,
        action: 'USE',
        action_reason: 'ADMIN_ADJUST',
        user_upload_quota_id: 10,
      },
    })
    expect(txSuccess.userUploadQuota.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        used: {
          increment: 5n,
        },
      },
    })
  })

  it('resetUserUploadQuotaUsed no-ops when used is zero, and resets when non-zero', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue({ id: 1, role: 1 })

    const txNoop = {
      userUploadQuota: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, size: 100n, used: 0n }),
        create: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementationOnce(async (cb: any) => cb(txNoop))

    await service.resetUserUploadQuotaUsed(1, admin as any)
    expect(txNoop.userUploadQuota.update).not.toHaveBeenCalled()
    expect(txNoop.userUploadQuotaRecord.create).not.toHaveBeenCalled()

    const txReset = {
      userUploadQuota: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, size: 100n, used: 30n }),
        create: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementationOnce(async (cb: any) => cb(txReset))

    await service.resetUserUploadQuotaUsed(1, admin as any)

    expect(txReset.userUploadQuota.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { used: 0n },
    })
    expect(txReset.userUploadQuotaRecord.create).toHaveBeenCalledWith({
      data: {
        field: 'USED',
        amount: 30n,
        action: 'ADD',
        action_reason: 'ADMIN_RESET_USED',
        user_upload_quota_id: 10,
      },
    })
  })
})
