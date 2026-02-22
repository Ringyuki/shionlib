import { CleanExpiresTask } from './clean-expires.task'

describe('CleanExpiresTask', () => {
  it('deletes expired bindings and their game mappings', async () => {
    const prisma = {
      userPvnBinding: {
        findMany: jest.fn().mockResolvedValue([{ user_id: 1 }, { user_id: 2 }]),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      userGamePvnMapping: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
    }
    const task = new CleanExpiresTask(prisma as any)

    await task.handleCron()

    expect(prisma.userPvnBinding.findMany).toHaveBeenCalledWith({
      where: { pvn_token_expires: { lt: expect.any(Date) } },
      select: { user_id: true },
    })
    expect(prisma.userPvnBinding.delete).toHaveBeenCalledTimes(2)
    expect(prisma.userPvnBinding.delete).toHaveBeenCalledWith({
      where: { user_id: 1 },
    })
    expect(prisma.userPvnBinding.delete).toHaveBeenCalledWith({
      where: { user_id: 2 },
    })
    expect(prisma.userGamePvnMapping.deleteMany).toHaveBeenCalledTimes(2)
    expect(prisma.userGamePvnMapping.deleteMany).toHaveBeenCalledWith({
      where: { user_id: 1 },
    })
    expect(prisma.userGamePvnMapping.deleteMany).toHaveBeenCalledWith({
      where: { user_id: 2 },
    })
  })

  it('does nothing when no expired bindings', async () => {
    const prisma = {
      userPvnBinding: {
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
      },
      userGamePvnMapping: {
        deleteMany: jest.fn(),
      },
    }
    const task = new CleanExpiresTask(prisma as any)

    await task.handleCron()

    expect(prisma.userPvnBinding.findMany).toHaveBeenCalled()
    expect(prisma.userPvnBinding.delete).not.toHaveBeenCalled()
    expect(prisma.userGamePvnMapping.deleteMany).not.toHaveBeenCalled()
  })
})
