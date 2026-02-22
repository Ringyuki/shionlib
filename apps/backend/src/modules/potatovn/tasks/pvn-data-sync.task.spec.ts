import { PvnDataSyncTask } from './pvn-data-sync.task'

describe('PvnDataSyncTask', () => {
  it('calls syncLibrary for each binding', async () => {
    const potatovnGameMappingService = {
      syncLibrary: jest.fn().mockResolvedValue(undefined),
    }
    const prisma = {
      userPvnBinding: {
        findMany: jest.fn().mockResolvedValue([{ user_id: 1 }, { user_id: 3 }]),
      },
    }
    const task = new PvnDataSyncTask(potatovnGameMappingService as any, prisma as any)

    await task.handleCron()

    expect(prisma.userPvnBinding.findMany).toHaveBeenCalledWith({
      select: { user_id: true },
    })
    expect(potatovnGameMappingService.syncLibrary).toHaveBeenCalledTimes(2)
    expect(potatovnGameMappingService.syncLibrary).toHaveBeenCalledWith(1)
    expect(potatovnGameMappingService.syncLibrary).toHaveBeenCalledWith(3)
  })

  it('does nothing when no bindings', async () => {
    const potatovnGameMappingService = {
      syncLibrary: jest.fn(),
    }
    const prisma = {
      userPvnBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const task = new PvnDataSyncTask(potatovnGameMappingService as any, prisma as any)

    await task.handleCron()

    expect(prisma.userPvnBinding.findMany).toHaveBeenCalled()
    expect(potatovnGameMappingService.syncLibrary).not.toHaveBeenCalled()
  })
})
