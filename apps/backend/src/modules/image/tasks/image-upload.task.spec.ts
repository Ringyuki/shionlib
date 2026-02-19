import { ImageUploadTask } from './image-upload.task'

describe('ImageUploadTask', () => {
  const createTask = (enabled: boolean) => {
    const imageUploadService = {
      uploadGameCovers: jest.fn().mockResolvedValue(0),
      uploadGameImages: jest.fn().mockResolvedValue(0),
      uploadGameCharacterImages: jest.fn().mockResolvedValue(0),
      uploadGameCharacterRelationImages: jest.fn().mockResolvedValue(0),
      uploadGameDeveloperImages: jest.fn().mockResolvedValue(0),
    }
    const configService = {
      get: jest.fn().mockReturnValue(enabled),
    }
    const task = new ImageUploadTask(imageUploadService as any, configService as any)
    const logger = { log: jest.fn(), error: jest.fn() }
    ;(task as any).logger = logger

    return { task, imageUploadService, configService, logger }
  }

  it('skips upload when task is disabled', async () => {
    const { task, imageUploadService } = createTask(false)

    await task.handleCron()

    expect(imageUploadService.uploadGameCovers).not.toHaveBeenCalled()
  })

  it('runs uploads and logs when uploaded count is greater than zero', async () => {
    const { task, imageUploadService, logger } = createTask(true)
    imageUploadService.uploadGameCovers.mockResolvedValue(1)
    imageUploadService.uploadGameImages.mockResolvedValue(2)

    await task.handleCron()

    expect(imageUploadService.uploadGameCovers).toHaveBeenCalledTimes(1)
    expect(logger.log).toHaveBeenCalledWith('3 images uploaded')
  })

  it('does not log when total uploaded count is zero', async () => {
    const { task, logger } = createTask(true)

    await task.handleCron()

    expect(logger.log).not.toHaveBeenCalled()
  })
})
