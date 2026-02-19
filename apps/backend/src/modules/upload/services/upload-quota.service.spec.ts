import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { UploadQuotaService } from './upload-quota.service'

describe('UploadQuotaService', () => {
  const createService = () => {
    const prisma = {
      userUploadQuota: {
        findUnique: jest.fn(),
      },
      gameDownloadResourceFile: {
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const configValues = new Map<string, any>([
      ['file_upload.upload_quota.base_size_bytes', 10 * 1024 * 1024 * 1024],
      ['file_upload.upload_quota.cap_size_bytes', 50 * 1024 * 1024 * 1024],
      ['file_upload.upload_quota.dynamic_threshold_bytes', 2 * 1024 * 1024 * 1024],
      ['file_upload.upload_quota.dynamic_step_bytes', 5 * 1024 * 1024 * 1024],
      ['file_upload.upload_quota.dynamic_reduce_inactive_days', 30],
      ['file_upload.upload_quota.dynamic_reduce_step_bytes', 3 * 1024 * 1024 * 1024],
    ])
    const configService = {
      get: jest.fn((key: string) => configValues.get(key)),
    }

    const service = new UploadQuotaService(prisma as any, configService as any)

    return {
      prisma,
      configService,
      service,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getUploadQuota returns defaults when quota missing and maps bigint fields', async () => {
    const { service, prisma } = createService()
    prisma.userUploadQuota.findUnique.mockResolvedValueOnce(null)
    await expect(service.getUploadQuota(1)).resolves.toEqual({ size: 0, used: 0 })

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({ size: 1024n, used: 128n })
    await expect(service.getUploadQuota(1)).resolves.toEqual({ size: 1024, used: 128 })
  })

  it('adjustUploadQuotaUsedAmount validates not found and overflow/negative cases', async () => {
    const { service, prisma } = createService()
    const tx = {
      userUploadQuota: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    tx.userUploadQuota.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.adjustUploadQuotaUsedAmount(1, {
        action: 'USE',
        amount: 1,
        upload_session_id: 1,
      } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
    })

    tx.userUploadQuota.findUnique.mockResolvedValueOnce({ id: 10, used: 9n, size: 10n })
    await expect(
      service.adjustUploadQuotaUsedAmount(1, {
        action: 'USE',
        amount: 2,
        upload_session_id: 1,
      } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_EXCEEDED,
    })

    tx.userUploadQuota.findUnique.mockResolvedValueOnce({ id: 10, used: 1n, size: 10n })
    await expect(
      service.adjustUploadQuotaUsedAmount(1, {
        action: 'ADD',
        amount: 2,
        upload_session_id: 1,
      } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_USE_CANT_BE_NEGATIVE,
    })
  })

  it('adjustUploadQuotaUsedAmount writes record and updates used for USE/ADD', async () => {
    const { service, prisma } = createService()
    const tx = {
      userUploadQuota: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    tx.userUploadQuota.findUnique.mockResolvedValueOnce({ id: 10, used: 1n, size: 10n })
    await service.adjustUploadQuotaUsedAmount(1, {
      action: 'USE',
      amount: 2,
      upload_session_id: 11,
      action_reason: 'UPLOAD',
    } as any)
    expect(tx.userUploadQuotaRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          field: 'USED',
          amount: 2n,
          action: 'USE',
          upload_session_id: 11,
          user_upload_quota_id: 10,
        }),
      }),
    )
    expect(tx.userUploadQuota.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { used: { increment: 2n } },
    })

    jest.clearAllMocks()
    tx.userUploadQuota.findUnique.mockResolvedValueOnce({ id: 10, used: 5n, size: 10n })
    await service.adjustUploadQuotaUsedAmount(1, {
      action: 'ADD',
      amount: 2,
      upload_session_id: 12,
    } as any)
    expect(tx.userUploadQuota.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { used: { increment: -2n } },
    })
  })

  it('adjustUploadQuotaSizeAmount validates existence, updates size and marks initial grant', async () => {
    const { service, prisma } = createService()
    const tx = {
      userUploadQuota: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    tx.userUploadQuota.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.adjustUploadQuotaSizeAmount(1, {
        action: 'ADD',
        amount: 1,
      } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
    })

    tx.userUploadQuota.findUnique.mockResolvedValueOnce({ id: 10 })
    await expect(
      service.adjustUploadQuotaSizeAmount(1, {
        action: 'SUB',
        amount: 3,
        action_reason: 'PENALTY',
      } as any),
    ).resolves.toBe(3)
    expect(tx.userUploadQuotaRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          field: 'SIZE',
          amount: 3n,
          action: 'SUB',
        }),
      }),
    )
    expect(tx.userUploadQuota.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { size: { increment: -3n } },
    })

    jest.clearAllMocks()
    tx.userUploadQuota.findUnique.mockResolvedValueOnce({ id: 10 })
    await service.adjustUploadQuotaSizeAmount(1, {
      action: 'ADD',
      amount: 5,
      action_reason: 'INITIAL_GRANT',
    } as any)
    expect(tx.userUploadQuota.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { is_first_grant: true },
    })
  })

  it('withdrawUploadQuotaUseAdjustment handles no record and both USE/ADD record actions', async () => {
    const { service, prisma } = createService()
    const tx = {
      userUploadQuotaRecord: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuota: {
        update: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    tx.userUploadQuotaRecord.findFirst.mockResolvedValueOnce(null)
    await service.withdrawUploadQuotaUseAdjustment(1, 10)
    expect(tx.userUploadQuotaRecord.update).not.toHaveBeenCalled()

    tx.userUploadQuotaRecord.findFirst.mockResolvedValueOnce({
      id: 1,
      action: 'USE',
      amount: 5n,
      user_upload_quota_id: 9,
    })
    await service.withdrawUploadQuotaUseAdjustment(1, 10)
    expect(tx.userUploadQuota.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { used: { decrement: 5n } },
    })

    jest.clearAllMocks()
    tx.userUploadQuotaRecord.findFirst.mockResolvedValueOnce({
      id: 2,
      action: 'ADD',
      amount: 3n,
      user_upload_quota_id: 9,
    })
    await service.withdrawUploadQuotaUseAdjustment(1, 10)
    expect(tx.userUploadQuota.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { used: { decrement: -3n } },
    })
  })

  it('isExceeded validates quota existence and compares used + amount', async () => {
    const { service, prisma } = createService()
    prisma.userUploadQuota.findUnique.mockResolvedValueOnce(null)
    await expect(service.isExceeded(1, 1)).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
    })

    prisma.userUploadQuota.findUnique
      .mockResolvedValueOnce({ used: 5n, size: 10n })
      .mockResolvedValueOnce({ used: 9n, size: 10n })
    await expect(service.isExceeded(1, 4)).resolves.toBe(false)
    await expect(service.isExceeded(1, 2)).resolves.toBe(true)
  })

  it('initialGrant validates quota and calls size adjustment when needed', async () => {
    const { service, prisma } = createService()
    prisma.userUploadQuota.findUnique.mockResolvedValueOnce(null)
    await expect(service.initialGrant(1)).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
    })

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({ is_first_grant: true })
    const adjustSpy = jest.spyOn(service, 'adjustUploadQuotaSizeAmount').mockResolvedValue(0)
    await service.initialGrant(1)
    expect(adjustSpy).not.toHaveBeenCalled()

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({ is_first_grant: false })
    await service.initialGrant(1)
    expect(adjustSpy).toHaveBeenCalledWith(1, {
      action: 'ADD',
      amount: 10 * 1024 * 1024 * 1024,
      action_reason: 'INITIAL_GRANT',
    })
  })

  it('resetUsed validates quota and resets non-zero used with record', async () => {
    const { service, prisma } = createService()
    const tx = {
      userUploadQuota: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userUploadQuotaRecord: {
        create: jest.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    tx.userUploadQuota.findUnique.mockResolvedValueOnce(null)
    await expect(service.resetUsed(1)).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
    })

    tx.userUploadQuota.findUnique.mockResolvedValueOnce({ id: 11, used: 0n })
    await service.resetUsed(1)
    expect(tx.userUploadQuota.update).not.toHaveBeenCalled()

    tx.userUploadQuota.findUnique.mockResolvedValueOnce({ id: 11, used: 9n })
    await service.resetUsed(1)
    expect(tx.userUploadQuota.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { used: 0n },
    })
    expect(tx.userUploadQuotaRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          field: 'USED',
          amount: 9n,
          action: 'ADD',
          action_reason: 'RESET_USED',
          user_upload_quota_id: 11,
        }),
      }),
    )
  })

  it('dynamicTopup validates quota and runs topup only when threshold + approvals are met', async () => {
    const { service, prisma } = createService()
    prisma.userUploadQuota.findUnique.mockResolvedValueOnce(null)
    await expect(service.dynamicTopup(1)).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
    })

    const adjustSpy = jest.spyOn(service, 'adjustUploadQuotaSizeAmount').mockResolvedValue(0)

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({
      id: 1,
      size: 20n,
      used: 1n,
      is_first_grant: false,
    })
    await service.dynamicTopup(1)
    expect(adjustSpy).not.toHaveBeenCalled()

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({
      id: 1,
      size: BigInt(20 * 1024 * 1024 * 1024),
      used: BigInt(19 * 1024 * 1024 * 1024),
      is_first_grant: true,
    })
    prisma.gameDownloadResourceFile.count.mockResolvedValueOnce(0)
    await service.dynamicTopup(1)
    expect(adjustSpy).not.toHaveBeenCalled()

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({
      id: 1,
      size: BigInt(20 * 1024 * 1024 * 1024),
      used: BigInt(19 * 1024 * 1024 * 1024),
      is_first_grant: true,
    })
    prisma.gameDownloadResourceFile.count.mockResolvedValueOnce(2)
    await service.dynamicTopup(1)
    expect(adjustSpy).toHaveBeenCalledWith(1, {
      action: 'ADD',
      amount: 5 * 1024 * 1024 * 1024,
      action_reason: 'DYNAMIC_TOPUP',
    })
  })

  it('dynamicReduce validates quota and reduces only under strict conditions', async () => {
    const { service, prisma, configService } = createService()
    prisma.userUploadQuota.findUnique.mockResolvedValueOnce(null)
    await expect(service.dynamicReduce(1)).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
    })

    const adjustSpy = jest.spyOn(service, 'adjustUploadQuotaSizeAmount').mockResolvedValue(0)

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({
      id: 1,
      size: 20n,
      is_first_grant: false,
    })
    await service.dynamicReduce(1)
    expect(adjustSpy).not.toHaveBeenCalled()

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({
      id: 1,
      size: BigInt(5 * 1024 * 1024 * 1024),
      is_first_grant: true,
    })
    await service.dynamicReduce(1)
    expect(adjustSpy).not.toHaveBeenCalled()

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({
      id: 1,
      size: BigInt(20 * 1024 * 1024 * 1024),
      is_first_grant: true,
    })
    configService.get.mockImplementation((key: string) => {
      if (key === 'file_upload.upload_quota.base_size_bytes') return 10 * 1024 * 1024 * 1024
      if (key === 'file_upload.upload_quota.dynamic_reduce_inactive_days') return 0
      if (key === 'file_upload.upload_quota.dynamic_reduce_step_bytes')
        return 3 * 1024 * 1024 * 1024
      if (key === 'file_upload.upload_quota.cap_size_bytes') return 50 * 1024 * 1024 * 1024
      if (key === 'file_upload.upload_quota.dynamic_threshold_bytes') return 2 * 1024 * 1024 * 1024
      if (key === 'file_upload.upload_quota.dynamic_step_bytes') return 5 * 1024 * 1024 * 1024
      return undefined
    })
    await service.dynamicReduce(1)
    expect(adjustSpy).not.toHaveBeenCalled()

    configService.get.mockImplementation((key: string) => {
      if (key === 'file_upload.upload_quota.base_size_bytes') return 10 * 1024 * 1024 * 1024
      if (key === 'file_upload.upload_quota.dynamic_reduce_inactive_days') return 30
      if (key === 'file_upload.upload_quota.dynamic_reduce_step_bytes')
        return 3 * 1024 * 1024 * 1024
      if (key === 'file_upload.upload_quota.cap_size_bytes') return 50 * 1024 * 1024 * 1024
      if (key === 'file_upload.upload_quota.dynamic_threshold_bytes') return 2 * 1024 * 1024 * 1024
      if (key === 'file_upload.upload_quota.dynamic_step_bytes') return 5 * 1024 * 1024 * 1024
      return undefined
    })

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({
      id: 1,
      size: BigInt(20 * 1024 * 1024 * 1024),
      is_first_grant: true,
    })
    prisma.gameDownloadResourceFile.count.mockResolvedValueOnce(1)
    await service.dynamicReduce(1)
    expect(adjustSpy).not.toHaveBeenCalled()

    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({
      id: 1,
      size: BigInt(20 * 1024 * 1024 * 1024),
      is_first_grant: true,
    })
    prisma.gameDownloadResourceFile.count.mockResolvedValueOnce(0)
    await service.dynamicReduce(1)
    expect(adjustSpy).toHaveBeenCalledWith(1, {
      action: 'SUB',
      amount: 3 * 1024 * 1024 * 1024,
      action_reason: 'DYNAMIC_REDUCE',
    })
  })

  it('resetQuota validates quota and subtracts current size', async () => {
    const { service, prisma } = createService()
    prisma.userUploadQuota.findUnique.mockResolvedValueOnce(null)
    await expect(service.resetQuota(1)).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
    })

    const adjustSpy = jest.spyOn(service, 'adjustUploadQuotaSizeAmount').mockResolvedValue(0)
    prisma.userUploadQuota.findUnique.mockResolvedValueOnce({ size: 999n })
    await service.resetQuota(1)
    expect(adjustSpy).toHaveBeenCalledWith(1, {
      action: 'SUB',
      amount: 999,
      action_reason: 'RESET_QUOTA',
    })
  })
})
