import { BackupTask } from './backup.task'

describe('BackupTask', () => {
  it('runs backup and logs start message', async () => {
    const backupService = { backupToS3: jest.fn().mockResolvedValue(undefined) }
    const task = new BackupTask(backupService as any)
    const logger = { log: jest.fn(), error: jest.fn() }
    ;(task as any).logger = logger

    await task.handleCron()

    expect(logger.log).toHaveBeenCalledWith('Starting database backup')
    expect(backupService.backupToS3).toHaveBeenCalledTimes(1)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('logs error when backup throws', async () => {
    const error = new Error('boom')
    const backupService = { backupToS3: jest.fn().mockRejectedValue(error) }
    const task = new BackupTask(backupService as any)
    const logger = { log: jest.fn(), error: jest.fn() }
    ;(task as any).logger = logger

    await task.handleCron()

    expect(logger.error).toHaveBeenCalledWith('Error running database backup', error)
  })
})
