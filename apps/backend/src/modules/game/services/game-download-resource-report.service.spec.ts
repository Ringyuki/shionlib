import {
  GameDownloadResourceReportReason,
  GameDownloadResourceReportStatus,
  ReportMaliciousLevel,
} from '@prisma/client'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { UserStatus } from '../../user/interfaces/user.interface'
import { ONE_GB_BYTES } from '../constants/download-resource-report.constant'
import { GameDownloadResourceReportService } from './game-download-resource-report.service'

const GameDownloadSourceReportVerdict = {
  VALID: 'VALID',
  INVALID: 'INVALID',
} as const

describe('GameDownloadResourceReportService', () => {
  const createService = () => {
    const prisma = {
      gameDownloadResource: {
        findUnique: jest.fn(),
      },
      gameDownloadResourceReport: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const userService = {
      ban: jest.fn(),
    }

    const messageService = {
      send: jest.fn(),
    }

    const uploadQuotaService = {
      adjustUploadQuotaSizeAmount: jest.fn(),
    }

    const gameDownloadSourceService = {
      delete: jest.fn(),
    }

    const emailService = {
      sendReportNotification: jest.fn(),
    }

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'siteUrl') return 'https://shionlib.example'
        return undefined
      }),
    }

    const service = new GameDownloadResourceReportService(
      prisma as any,
      userService as any,
      messageService as any,
      uploadQuotaService as any,
      gameDownloadSourceService as any,
      emailService as any,
      configService as any,
    )
    ;(service as any).logger = {
      error: jest.fn(),
    }

    return {
      prisma,
      userService,
      messageService,
      uploadQuotaService,
      gameDownloadSourceService,
      emailService,
      configService,
      service,
    }
  }

  const makeResource = () => ({
    id: 10,
    creator_id: 100,
    status: 1,
    game_id: 1000,
    game: {
      id: 1000,
      title_jp: 'jp',
      title_zh: 'zh',
      title_en: 'en',
    },
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('create validates resource/state/self-report/suspension/duplication', async () => {
    const { service, prisma } = createService()
    const dto = { reason: GameDownloadResourceReportReason.MALWARE, detail: 'x' }

    prisma.gameDownloadResource.findUnique.mockResolvedValueOnce(null)
    await expect(service.create(1, dto as any, 2)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_FOUND,
    })

    prisma.gameDownloadResource.findUnique.mockResolvedValueOnce({ ...makeResource(), status: 2 })
    await expect(service.create(1, dto as any, 2)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_FOUND,
    })

    prisma.gameDownloadResource.findUnique.mockResolvedValueOnce(makeResource())
    await expect(service.create(1, dto as any, 100)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_SELF_NOT_ALLOWED,
    })

    prisma.gameDownloadResource.findUnique.mockResolvedValueOnce(makeResource())
    jest.spyOn(service as any, 'isReporterSuspended').mockResolvedValueOnce(true)
    await expect(service.create(1, dto as any, 2)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_SUSPENDED,
    })

    prisma.gameDownloadResource.findUnique.mockResolvedValueOnce(makeResource())
    jest.spyOn(service as any, 'isReporterSuspended').mockResolvedValueOnce(false)
    prisma.gameDownloadResourceReport.findFirst.mockResolvedValueOnce({ id: 999 })
    await expect(service.create(1, dto as any, 2)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_DUPLICATED,
    })
  })

  it('create persists report and triggers async admin notification', async () => {
    const { service, prisma } = createService()
    const dto = { reason: GameDownloadResourceReportReason.BROKEN_LINK, detail: 'dead link' }

    prisma.gameDownloadResource.findUnique.mockResolvedValue(makeResource())
    jest.spyOn(service as any, 'isReporterSuspended').mockResolvedValue(false)
    prisma.gameDownloadResourceReport.findFirst.mockResolvedValue(null)
    prisma.gameDownloadResourceReport.create.mockResolvedValue({
      id: 77,
      status: GameDownloadResourceReportStatus.PENDING,
      reason: GameDownloadResourceReportReason.BROKEN_LINK,
      malicious_level: ReportMaliciousLevel.LOW,
      created: new Date('2026-02-18T00:00:00.000Z'),
    })
    const notifySpy = jest
      .spyOn(service as any, 'notifyAdminsNewReport')
      .mockResolvedValue(undefined)

    const result = await service.create(10, dto as any, 2)

    expect(prisma.gameDownloadResourceReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resource_id: 10,
          reporter_id: 2,
          reported_user_id: 100,
          reason: GameDownloadResourceReportReason.BROKEN_LINK,
          malicious_level: ReportMaliciousLevel.LOW,
        }),
      }),
    )
    expect(result.id).toBe(77)
    expect(notifySpy).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        resourceId: 10,
        reporterId: 2,
        reportedUserId: 100,
      }),
    )
  })

  it('create logs when async notification fails', async () => {
    const { service, prisma } = createService()
    prisma.gameDownloadResource.findUnique.mockResolvedValue(makeResource())
    jest.spyOn(service as any, 'isReporterSuspended').mockResolvedValue(false)
    prisma.gameDownloadResourceReport.findFirst.mockResolvedValue(null)
    prisma.gameDownloadResourceReport.create.mockResolvedValue({
      id: 78,
      status: GameDownloadResourceReportStatus.PENDING,
      reason: GameDownloadResourceReportReason.MALWARE,
      malicious_level: ReportMaliciousLevel.CRITICAL,
      created: new Date('2026-02-18T00:00:00.000Z'),
    })
    jest.spyOn(service as any, 'notifyAdminsNewReport').mockRejectedValue(new Error('notify fail'))

    await service.create(10, { reason: GameDownloadResourceReportReason.MALWARE } as any, 2)
    await Promise.resolve()
    await Promise.resolve()

    expect((service as any).logger.error).toHaveBeenCalledWith(
      'Failed to notify admins about new report:',
      expect.any(Error),
    )
  })

  it('getList builds where/sort and pagination meta', async () => {
    const { service, prisma } = createService()
    prisma.gameDownloadResourceReport.findMany.mockResolvedValue([{ id: 1 }])
    prisma.gameDownloadResourceReport.count.mockResolvedValue(6)

    const result = await service.getList({
      page: 2,
      pageSize: 2,
      status: GameDownloadResourceReportStatus.PENDING,
      reason: GameDownloadResourceReportReason.OTHER,
      malicious_level: ReportMaliciousLevel.MEDIUM,
      resource_id: 9,
      reporter_id: 8,
      reported_user_id: 7,
      sortBy: 'id',
      sortOrder: 'asc',
    } as any)

    expect(prisma.gameDownloadResourceReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: GameDownloadResourceReportStatus.PENDING,
          reason: GameDownloadResourceReportReason.OTHER,
          malicious_level: ReportMaliciousLevel.MEDIUM,
          resource_id: 9,
          reporter_id: 8,
          reported_user_id: 7,
        },
        orderBy: { id: 'asc' },
        skip: 2,
        take: 2,
      }),
    )
    expect(result.meta).toEqual({
      totalItems: 6,
      itemCount: 1,
      itemsPerPage: 2,
      totalPages: 3,
      currentPage: 2,
    })
  })

  it('getById validates existence and maps file_size bigint to number', async () => {
    const { service, prisma } = createService()
    prisma.gameDownloadResourceReport.findUnique.mockResolvedValueOnce(null)
    await expect(service.getById(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_NOT_FOUND,
    })

    prisma.gameDownloadResourceReport.findUnique.mockResolvedValueOnce({
      id: 1,
      resource: {
        id: 10,
        files: [{ id: 1, file_size: 123n }],
      },
    })
    const result = await service.getById(1)
    expect(result.resource.files[0].file_size).toBe(123)
  })

  it('review validates report state', async () => {
    const { service, prisma } = createService()
    prisma.gameDownloadResourceReport.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.review(1, { verdict: GameDownloadSourceReportVerdict.VALID } as any, {
        sub: 9,
        role: ShionlibUserRoles.ADMIN,
      }),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_NOT_FOUND,
    })

    prisma.gameDownloadResourceReport.findUnique.mockResolvedValueOnce({
      id: 1,
      status: GameDownloadResourceReportStatus.VALID,
    })
    await expect(
      service.review(1, { verdict: GameDownloadSourceReportVerdict.VALID } as any, {
        sub: 9,
        role: ShionlibUserRoles.ADMIN,
      }),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_ALREADY_PROCESSED,
    })
  })

  it('review VALID applies reported-user penalty, sends notifications and soft-deletes resource', async () => {
    const { service, prisma, messageService, gameDownloadSourceService } = createService()
    const report = {
      id: 2,
      status: GameDownloadResourceReportStatus.PENDING,
      reason: GameDownloadResourceReportReason.MALWARE,
      malicious_level: ReportMaliciousLevel.LOW,
      reporter_id: 88,
      reported_user_id: 99,
      resource_id: 100,
      resource: {
        id: 100,
        game_id: 1000,
        game: { id: 1000, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
      },
    }
    prisma.gameDownloadResourceReport.findUnique.mockResolvedValue(report)
    const tx = {
      gameDownloadResourceReport: {
        update: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))
    jest.spyOn(service as any, 'applyReportedUserPenalty').mockResolvedValue({
      banApplied: true,
      banDays: 30,
      quotaReducedBytes: 2 * ONE_GB_BYTES,
    })
    jest.spyOn(service, 'getById').mockResolvedValue({ id: 2, status: 'snap' } as any)

    const result = await service.review(
      2,
      {
        verdict: GameDownloadSourceReportVerdict.VALID,
        malicious_level: ReportMaliciousLevel.LOW,
        process_note: 'verified',
      } as any,
      { sub: 7, role: ShionlibUserRoles.ADMIN },
    )

    expect((service as any).applyReportedUserPenalty).toHaveBeenCalledWith(
      tx,
      99,
      ReportMaliciousLevel.CRITICAL,
      GameDownloadResourceReportReason.MALWARE,
      7,
    )
    expect(tx.gameDownloadResourceReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GameDownloadResourceReportStatus.VALID,
          malicious_level: ReportMaliciousLevel.CRITICAL,
          processed_by: 7,
        }),
      }),
    )
    expect(messageService.send).toHaveBeenCalledTimes(2)
    expect(gameDownloadSourceService.delete).toHaveBeenCalledWith(
      100,
      { user: { sub: 7, role: ShionlibUserRoles.ADMIN } },
      true,
    )
    expect(result).toEqual({ id: 2, status: 'snap' })
  })

  it('review INVALID applies reporter penalty and can skip notify/delete', async () => {
    const { service, prisma, messageService, gameDownloadSourceService } = createService()
    prisma.gameDownloadResourceReport.findUnique.mockResolvedValue({
      id: 3,
      status: GameDownloadResourceReportStatus.PENDING,
      reason: GameDownloadResourceReportReason.OTHER,
      malicious_level: ReportMaliciousLevel.MEDIUM,
      reporter_id: 8,
      reported_user_id: 9,
      resource_id: 101,
      resource: {
        id: 101,
        game_id: 1001,
        game: { id: 1001, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
      },
    })
    const tx = {
      gameDownloadResourceReport: {
        update: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))
    jest.spyOn(service as any, 'applyReporterInvalidPenalty').mockResolvedValue({
      falseReportCount: 5,
      banApplied: true,
      banDays: 3,
      quotaReducedBytes: ONE_GB_BYTES,
    })
    jest.spyOn(service, 'getById').mockResolvedValue({ id: 3 } as any)

    await service.review(
      3,
      {
        verdict: GameDownloadSourceReportVerdict.INVALID,
        notify: false,
      } as any,
      { sub: 7, role: ShionlibUserRoles.ADMIN },
    )

    expect((service as any).applyReporterInvalidPenalty).toHaveBeenCalledWith(tx, 8, 7)
    expect(messageService.send).not.toHaveBeenCalled()
    expect(gameDownloadSourceService.delete).not.toHaveBeenCalled()
    expect(tx.gameDownloadResourceReport.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 3 },
        data: expect.objectContaining({
          status: GameDownloadResourceReportStatus.INVALID,
        }),
      }),
    )
    expect(tx.gameDownloadResourceReport.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 3 },
        data: expect.objectContaining({
          reporter_penalty_applied: true,
        }),
      }),
    )
  })

  it('isReporterSuspended checks invalid report count in rolling window', async () => {
    const { service, prisma } = createService()
    prisma.gameDownloadResourceReport.count.mockResolvedValueOnce(11).mockResolvedValueOnce(12)
    await expect((service as any).isReporterSuspended(1)).resolves.toBe(false)
    await expect((service as any).isReporterSuspended(1)).resolves.toBe(true)
  })

  it('applyReportedUserPenalty handles target skip/quota-only/ban paths', async () => {
    const { service, uploadQuotaService } = createService()
    const tx = {
      user: { findUnique: jest.fn() },
    }
    tx.user.findUnique.mockResolvedValueOnce(null)
    await expect(
      (service as any).applyReportedUserPenalty(
        tx,
        1,
        ReportMaliciousLevel.HIGH,
        GameDownloadResourceReportReason.MALWARE,
        9,
      ),
    ).resolves.toEqual({
      banApplied: false,
      banDays: 0,
      quotaReducedBytes: 0,
    })

    tx.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: ShionlibUserRoles.USER,
      status: UserStatus.ACTIVE,
    })
    jest.spyOn(service as any, 'tryBanUser').mockResolvedValue(true)
    await expect(
      (service as any).applyReportedUserPenalty(
        tx,
        1,
        ReportMaliciousLevel.HIGH,
        GameDownloadResourceReportReason.MALWARE,
        9,
      ),
    ).resolves.toEqual({
      banApplied: true,
      banDays: 7,
      quotaReducedBytes: 2 * ONE_GB_BYTES,
    })
    expect(uploadQuotaService.adjustUploadQuotaSizeAmount).toHaveBeenCalledWith(1, {
      action: 'SUB',
      amount: 2 * ONE_GB_BYTES,
      action_reason: 'REPORT_MALWARE',
    })

    tx.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: ShionlibUserRoles.USER,
      status: UserStatus.BANNED,
    })
    await expect(
      (service as any).applyReportedUserPenalty(
        tx,
        1,
        ReportMaliciousLevel.CRITICAL,
        GameDownloadResourceReportReason.MALWARE,
        9,
      ),
    ).resolves.toEqual({
      banApplied: false,
      banDays: 0,
      quotaReducedBytes: 5 * ONE_GB_BYTES,
    })
  })

  it('applyReporterInvalidPenalty handles skip/quota-only/ban branches', async () => {
    const { service, uploadQuotaService } = createService()
    const tx = {
      user: { findUnique: jest.fn() },
      gameDownloadResourceReport: { count: jest.fn() },
    }
    tx.user.findUnique.mockResolvedValueOnce(null)
    await expect((service as any).applyReporterInvalidPenalty(tx, 1, 9)).resolves.toEqual({
      falseReportCount: 0,
      banApplied: false,
      banDays: 0,
      quotaReducedBytes: 0,
    })

    tx.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: ShionlibUserRoles.USER,
      status: UserStatus.ACTIVE,
    })
    tx.gameDownloadResourceReport.count.mockResolvedValueOnce(3)
    uploadQuotaService.adjustUploadQuotaSizeAmount.mockResolvedValueOnce(ONE_GB_BYTES)
    jest.spyOn(service as any, 'tryBanUser').mockResolvedValue(false)
    await expect((service as any).applyReporterInvalidPenalty(tx, 1, 9)).resolves.toEqual({
      falseReportCount: 3,
      banApplied: false,
      banDays: 0,
      quotaReducedBytes: ONE_GB_BYTES,
    })
    expect(uploadQuotaService.adjustUploadQuotaSizeAmount).toHaveBeenCalledWith(1, {
      action: 'SUB',
      amount: ONE_GB_BYTES,
      action_reason: 'REPORT_FALSE_POSITIVE',
    })

    tx.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: ShionlibUserRoles.USER,
      status: UserStatus.ACTIVE,
    })
    tx.gameDownloadResourceReport.count.mockResolvedValueOnce(5)
    jest.spyOn(service as any, 'tryBanUser').mockResolvedValue(true)
    await expect((service as any).applyReporterInvalidPenalty(tx, 1, 9)).resolves.toEqual({
      falseReportCount: 5,
      banApplied: true,
      banDays: 3,
      quotaReducedBytes: 0,
    })

    tx.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: ShionlibUserRoles.USER,
      status: UserStatus.BANNED,
    })
    tx.gameDownloadResourceReport.count.mockResolvedValueOnce(8)
    await expect((service as any).applyReporterInvalidPenalty(tx, 1, 9)).resolves.toEqual({
      falseReportCount: 8,
      banApplied: false,
      banDays: 0,
      quotaReducedBytes: 0,
    })
  })

  it('tryBanUser returns true/false for known biz case and rethrows unknown errors', async () => {
    const { service, userService } = createService()
    const tx = {} as any

    userService.ban.mockResolvedValueOnce(undefined)
    await expect((service as any).tryBanUser(tx, 1, 2, 3, 'r')).resolves.toBe(true)

    userService.ban.mockRejectedValueOnce(new ShionBizException(ShionBizCode.USER_ALREADY_BANNED))
    await expect((service as any).tryBanUser(tx, 1, 2, 3, 'r')).resolves.toBe(false)

    userService.ban.mockRejectedValueOnce(new Error('boom'))
    await expect((service as any).tryBanUser(tx, 1, 2, 3, 'r')).rejects.toThrow('boom')
  })

  it('notifyAdminsNewReport handles no-admin and sends message/email for admins', async () => {
    const { service, prisma, messageService, emailService } = createService()
    jest.spyOn(service as any, 'getAdmins').mockResolvedValueOnce([])
    await (service as any).notifyAdminsNewReport(1, {
      resourceId: 10,
      reporterId: 2,
      reportedUserId: 3,
      reason: GameDownloadResourceReportReason.OTHER,
      maliciousLevel: ReportMaliciousLevel.LOW,
      gameId: 100,
      gameTitle: 'g',
    })
    expect(messageService.send).not.toHaveBeenCalled()
    expect(emailService.sendReportNotification).not.toHaveBeenCalled()

    jest.spyOn(service as any, 'getAdmins').mockResolvedValueOnce([
      { id: 10, name: 'admin1', email: 'a@x.com' },
      { id: 11, name: 'admin2', email: null },
    ])
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 2, name: 'reporter' })
      .mockResolvedValueOnce({ id: 3, name: 'target' })

    await (service as any).notifyAdminsNewReport(2, {
      resourceId: 10,
      reporterId: 2,
      reportedUserId: 3,
      reason: GameDownloadResourceReportReason.MALWARE,
      maliciousLevel: ReportMaliciousLevel.CRITICAL,
      detail: 'detail',
      gameId: 100,
      gameTitle: 'Game',
    })

    expect(messageService.send).toHaveBeenCalledTimes(2)
    expect(emailService.sendReportNotification).toHaveBeenCalledWith(
      ['a@x.com'],
      expect.objectContaining({
        reportId: 2,
        adminReviewUrl: 'https://shionlib.example/admin/reports?id=2',
      }),
    )
  })

  it('getAdmins queries active admin users', async () => {
    const { service, prisma } = createService()
    prisma.user.findMany.mockResolvedValue([{ id: 1, name: 'admin', email: 'a@x.com' }])

    const result = await (service as any).getAdmins()
    expect(result).toEqual([{ id: 1, name: 'admin', email: 'a@x.com' }])
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: { gte: ShionlibUserRoles.ADMIN },
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })
  })
})
