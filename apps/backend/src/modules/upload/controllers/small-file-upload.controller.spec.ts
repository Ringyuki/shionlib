type FileFilterCallback = (error: unknown, acceptFile: boolean) => void
type FileFilterFn = (req: unknown, file: { mimetype?: string }, cb: FileFilterCallback) => void

const capturedFileInterceptorOptions: Array<{ fileFilter: FileFilterFn }> = []

jest.mock('@nestjs/platform-express', () => ({
  FileInterceptor: jest.fn((_field: string, options: { fileFilter: FileFilterFn }) => {
    capturedFileInterceptorOptions.push(options)
    return () => undefined
  }),
}))

jest.mock('multer', () => ({
  memoryStorage: jest.fn(() => ({ storage: 'memory' })),
}))

import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { SmallFileUploadController } from './small-file-upload.controller'

describe('SmallFileUploadController', () => {
  const createController = () => {
    const smallFileUploadService = {
      uploadGameCover: jest.fn(),
      uploadGameImage: jest.fn(),
      uploadDeveloperLogo: jest.fn(),
      uploadCharacterImage: jest.fn(),
    }

    return {
      smallFileUploadService,
      controller: new SmallFileUploadController(smallFileUploadService as any),
    }
  }

  it('delegates all small file upload endpoints', async () => {
    const { controller, smallFileUploadService } = createController()
    const req = { user: { sub: 1 } }
    const file = { mimetype: 'image/png', size: 100 } as any

    await controller.uploadGameCover(1, file, req as any)
    await controller.uploadGameImage(2, file, req as any)
    await controller.uploadDeveloperLogo(3, file, req as any)
    await controller.uploadCharacterImage(4, file, req as any)

    expect(smallFileUploadService.uploadGameCover).toHaveBeenCalledWith(1, file, req)
    expect(smallFileUploadService.uploadGameImage).toHaveBeenCalledWith(2, file, req)
    expect(smallFileUploadService.uploadDeveloperLogo).toHaveBeenCalledWith(3, file, req)
    expect(smallFileUploadService.uploadCharacterImage).toHaveBeenCalledWith(4, file, req)
  })

  it('accepts supported image mimetypes and rejects unsupported ones in every fileFilter', () => {
    expect(capturedFileInterceptorOptions).toHaveLength(4)

    for (const options of capturedFileInterceptorOptions) {
      const okCb = jest.fn()
      options.fileFilter({} as any, { mimetype: 'image/webp' } as any, okCb)
      expect(okCb).toHaveBeenCalledWith(null, true)

      const badCb = jest.fn()
      options.fileFilter({} as any, { mimetype: 'application/pdf' } as any, badCb)
      expect(badCb).toHaveBeenCalledWith(expect.any(ShionBizException), false)
    }
  })
})
