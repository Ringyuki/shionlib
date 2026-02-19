import { AdminTestController } from './admin-test.controller'

describe('AdminTestController', () => {
  it('delegates file list and file delete actions', async () => {
    const s3Service = {
      getFileList: jest.fn(),
      deleteFile: jest.fn(),
    }
    const controller = new AdminTestController(s3Service as any)

    await controller.getFileList()
    await controller.deleteFile('a/b/c.txt')

    expect(s3Service.getFileList).toHaveBeenCalledTimes(1)
    expect(s3Service.deleteFile).toHaveBeenCalledWith('a/b/c.txt')
  })
})
