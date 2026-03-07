import { BackupTask } from './backup.task'

describe('BackupTask', () => {
  function createTask() {
    const backupService = { backupToS3: jest.fn().mockResolvedValue(undefined) }
    const task = new BackupTask(backupService as any)
    const logger = { log: jest.fn(), error: jest.fn() }
    ;(task as any).logger = logger
    return { task, backupService, logger }
  }

  it('handleDailyCron runs daily backup and logs start message', async () => {
    const { task, backupService, logger } = createTask()

    await task.handleDailyCron()

    expect(logger.log).toHaveBeenCalledWith('Starting daily database backup')
    expect(backupService.backupToS3).toHaveBeenCalledWith('daily')
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('handleDailyCron logs error when backup throws', async () => {
    const { task, backupService, logger } = createTask()
    const error = new Error('boom')
    backupService.backupToS3.mockRejectedValue(error)

    await task.handleDailyCron()

    expect(logger.error).toHaveBeenCalledWith('Error running daily database backup', error)
  })

  it('handleWeeklyCron runs weekly backup and logs start message', async () => {
    const { task, backupService, logger } = createTask()

    await task.handleWeeklyCron()

    expect(logger.log).toHaveBeenCalledWith('Starting weekly database backup')
    expect(backupService.backupToS3).toHaveBeenCalledWith('weekly')
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('handleWeeklyCron logs error when backup throws', async () => {
    const { task, backupService, logger } = createTask()
    const error = new Error('weekly boom')
    backupService.backupToS3.mockRejectedValue(error)

    await task.handleWeeklyCron()

    expect(logger.error).toHaveBeenCalledWith('Error running weekly database backup', error)
  })
})
