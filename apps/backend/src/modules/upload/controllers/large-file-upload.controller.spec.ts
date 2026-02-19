import { LargeFileUploadController } from './large-file-upload.controller'

describe('LargeFileUploadController', () => {
  const createController = () => {
    const largeFileUploadService = {
      getOngoingSessions: jest.fn(),
      init: jest.fn(),
      writeChunk: jest.fn(),
      status: jest.fn(),
      complete: jest.fn(),
      abort: jest.fn(),
    }

    return {
      largeFileUploadService,
      controller: new LargeFileUploadController(largeFileUploadService as any),
    }
  }

  it('delegates ongoing/init/status/complete/abort actions', async () => {
    const { controller, largeFileUploadService } = createController()
    const req = { user: { sub: 1 }, headers: {} }
    const body = { total_size: 1024, chunk_size: 256 }

    await controller.getOngoingSessions(req as any)
    await controller.init(body as any, req as any)
    await controller.getStatus(7, req as any)
    await controller.complete(7, req as any)
    await controller.abort(7, req as any)

    expect(largeFileUploadService.getOngoingSessions).toHaveBeenCalledWith(req)
    expect(largeFileUploadService.init).toHaveBeenCalledWith(body, req)
    expect(largeFileUploadService.status).toHaveBeenCalledWith(7, req)
    expect(largeFileUploadService.complete).toHaveBeenCalledWith(7, req)
    expect(largeFileUploadService.abort).toHaveBeenCalledWith(7, req)
  })

  it('parses chunk headers and delegates writeChunk', async () => {
    const { controller, largeFileUploadService } = createController()
    const req = {
      headers: {
        'content-length': '4096',
        'chunk-sha256': 'abc123',
      },
    }

    await controller.putChunk(req as any, 3, 8)

    expect(largeFileUploadService.writeChunk).toHaveBeenCalledWith(8, 3, 'abc123', req, 4096)
  })
})
