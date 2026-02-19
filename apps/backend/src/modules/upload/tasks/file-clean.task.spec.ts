import { FileCleanTask } from './file-clean.task'

describe('FileCleanTask', () => {
  it('runs clean job', async () => {
    const fileCleanService = { clean: jest.fn().mockResolvedValue(undefined) }
    const task = new FileCleanTask(fileCleanService as any)
    const logger = { error: jest.fn() }
    ;(task as any).logger = logger

    await task.handleCron()

    expect(fileCleanService.clean).toHaveBeenCalledTimes(1)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('logs when clean job fails', async () => {
    const error = new Error('clean failed')
    const fileCleanService = { clean: jest.fn().mockRejectedValue(error) }
    const task = new FileCleanTask(fileCleanService as any)
    const logger = { error: jest.fn() }
    ;(task as any).logger = logger

    await task.handleCron()

    expect(logger.error).toHaveBeenCalledWith('Error cleaning files', error)
  })
})
