import { UploadQuotaTask } from './upload-quota.task'

describe('UploadQuotaTask', () => {
  const createTask = () => {
    const prisma = {
      user: {
        findMany: jest.fn(),
      },
    }
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'file_upload.upload_quota.grant_after_days') return 7
        if (key === 'file_upload.upload_quota.longest_inactive_days') return 14
        return 0
      }),
    }
    const uploadQuotaService = {
      initialGrant: jest.fn().mockResolvedValue(undefined),
      dynamicTopup: jest.fn().mockResolvedValue(undefined),
      dynamicReduce: jest.fn().mockResolvedValue(undefined),
      resetUsed: jest.fn().mockResolvedValue(undefined),
      resetQuota: jest.fn().mockResolvedValue(undefined),
    }
    const task = new UploadQuotaTask(prisma as any, configService as any, uploadQuotaService as any)
    const logger = { error: jest.fn() }
    ;(task as any).logger = logger

    return { task, prisma, configService, uploadQuotaService, logger }
  }

  it('handles initial grant for eligible users', async () => {
    const { task, prisma, uploadQuotaService } = createTask()
    prisma.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }])

    await task.handleInitialGrant()

    expect(uploadQuotaService.initialGrant).toHaveBeenCalledWith(1)
    expect(uploadQuotaService.initialGrant).toHaveBeenCalledWith(2)
  })

  it('handles dynamic topup and dynamic reduce', async () => {
    const { task, prisma, uploadQuotaService } = createTask()
    prisma.user.findMany.mockResolvedValue([{ id: 11 }, { id: 12 }])

    await task.handleDynamicTopup()
    await task.handleDynamicReduce()

    expect(uploadQuotaService.dynamicTopup).toHaveBeenCalledWith(11)
    expect(uploadQuotaService.dynamicTopup).toHaveBeenCalledWith(12)
    expect(uploadQuotaService.dynamicReduce).toHaveBeenCalledWith(11)
    expect(uploadQuotaService.dynamicReduce).toHaveBeenCalledWith(12)
  })

  it('handles reset used and longest inactive quota reset', async () => {
    const { task, prisma, uploadQuotaService, configService } = createTask()
    prisma.user.findMany.mockResolvedValue([{ id: 21 }])

    await task.handleResetUsed()
    await task.handleLongestInactive()

    expect(uploadQuotaService.resetUsed).toHaveBeenCalledWith(21)
    expect(uploadQuotaService.resetQuota).toHaveBeenCalledWith(21)
    expect(configService.get).toHaveBeenCalledWith('file_upload.upload_quota.longest_inactive_days')
  })

  it('logs errors when initial grant query fails', async () => {
    const { task, prisma, logger } = createTask()
    const error = new Error('query failed')
    prisma.user.findMany.mockRejectedValue(error)

    await task.handleInitialGrant()

    expect(logger.error).toHaveBeenCalledWith('Error running upload quota cron', error)
  })
})
