import { FileScanTask } from './file-scan.task'

describe('FileScanTask', () => {
  const createTask = () => {
    const fileScanService = {
      scanFiles: jest.fn(),
      processExpiredMalwareCases: jest.fn(),
    }
    const task = new FileScanTask(fileScanService as any)
    const logger = { log: jest.fn(), error: jest.fn() }
    ;(task as any).logger = logger
    return { task, fileScanService, logger }
  }

  it('logs scan and expired counts when they are positive', async () => {
    const { task, fileScanService, logger } = createTask()
    fileScanService.scanFiles.mockResolvedValue(2)
    fileScanService.processExpiredMalwareCases.mockResolvedValue(1)

    await task.handleCron()

    expect(logger.log).toHaveBeenCalledWith('2 files scanned successfully')
    expect(logger.log).toHaveBeenCalledWith('1 expired malware cases auto-processed')
  })

  it('logs error when scanning throws', async () => {
    const { task, fileScanService, logger } = createTask()
    const error = new Error('scan failed')
    fileScanService.scanFiles.mockRejectedValue(error)
    fileScanService.processExpiredMalwareCases.mockResolvedValue(0)

    await task.handleCron()

    expect(logger.error).toHaveBeenCalledWith('Error scanning files', error)
  })
})
