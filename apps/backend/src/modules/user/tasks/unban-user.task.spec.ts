import { UnbanUserTask } from './unban-user.task'

describe('UnbanUserTask', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('unbans only users whose temporary ban has expired', async () => {
    const prisma = {
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]),
      },
      userBannedRecord: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            is_permanent: true,
            banned_at: new Date('2025-12-01T00:00:00.000Z'),
            banned_duration_days: 30,
          })
          .mockResolvedValueOnce({
            is_permanent: false,
            banned_at: new Date('2025-12-20T00:00:00.000Z'),
            banned_duration_days: 0,
          })
          .mockResolvedValueOnce({
            is_permanent: false,
            banned_at: new Date('2025-12-31T12:00:00.000Z'),
            banned_duration_days: 2,
          })
          .mockResolvedValueOnce({
            is_permanent: false,
            banned_at: new Date('2025-12-25T00:00:00.000Z'),
            banned_duration_days: 2,
          }),
      },
    }
    const userService = {
      unban: jest.fn().mockResolvedValue(undefined),
    }
    const task = new UnbanUserTask(prisma as any, userService as any)

    await task.handleCron()

    expect(userService.unban).toHaveBeenCalledTimes(1)
    expect(userService.unban).toHaveBeenCalledWith(5)
  })
})
