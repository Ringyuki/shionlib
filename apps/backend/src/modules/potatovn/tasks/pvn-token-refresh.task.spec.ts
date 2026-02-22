import { PvnTokenRefreshTask } from './pvn-token-refresh.task'

describe('PvnTokenRefreshTask', () => {
  it('calls refreshToken for each binding that expires within threshold', async () => {
    const prisma = {
      userPvnBinding: {
        findMany: jest.fn().mockResolvedValue([{ user_id: 10 }, { user_id: 20 }]),
      },
    }
    const potatovnBindingService = {
      refreshToken: jest.fn().mockResolvedValue(undefined),
    }
    const task = new PvnTokenRefreshTask(prisma as any, potatovnBindingService as any)

    await task.handleCron()

    expect(prisma.userPvnBinding.findMany).toHaveBeenCalledWith({
      where: {
        pvn_token_expires: { lte: expect.any(Date) },
      },
      select: { user_id: true },
    })
    expect(potatovnBindingService.refreshToken).toHaveBeenCalledTimes(2)
    expect(potatovnBindingService.refreshToken).toHaveBeenCalledWith(10)
    expect(potatovnBindingService.refreshToken).toHaveBeenCalledWith(20)
  })

  it('does nothing when no bindings need refresh', async () => {
    const prisma = {
      userPvnBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const potatovnBindingService = {
      refreshToken: jest.fn(),
    }
    const task = new PvnTokenRefreshTask(prisma as any, potatovnBindingService as any)

    await task.handleCron()

    expect(prisma.userPvnBinding.findMany).toHaveBeenCalled()
    expect(potatovnBindingService.refreshToken).not.toHaveBeenCalled()
  })
})
