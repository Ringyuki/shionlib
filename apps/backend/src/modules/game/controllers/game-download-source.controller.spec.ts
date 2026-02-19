import { GameDownloadSourceController } from './game-download-source.controller'

describe('GameDownloadSourceController', () => {
  const createController = () => {
    const gameDownloadSourceService = {
      getList: jest.fn(),
      delete: jest.fn(),
      edit: jest.fn(),
      migrateCreate: jest.fn(),
      migrateCreateFile: jest.fn(),
      reuploadFile: jest.fn(),
      getFileHistory: jest.fn(),
    }
    const gameDownloadSourceReportService = {
      create: jest.fn(),
    }

    return {
      gameDownloadSourceService,
      gameDownloadSourceReportService,
      controller: new GameDownloadSourceController(
        gameDownloadSourceService as any,
        gameDownloadSourceReportService as any,
      ),
    }
  }

  it('delegates getDownloadSourceList', async () => {
    const { controller, gameDownloadSourceService } = createController()
    const dto = { page: 1, pageSize: 20 }

    await controller.getDownloadSourceList(dto as any)

    expect(gameDownloadSourceService.getList).toHaveBeenCalledWith(dto)
  })

  it('delegates deleteDownloadResource', async () => {
    const { controller, gameDownloadSourceService } = createController()
    const req = { user: { sub: 'u1' } }

    await controller.deleteDownloadResource(10, req as any)

    expect(gameDownloadSourceService.delete).toHaveBeenCalledWith(10, req)
  })

  it('delegates editDownloadResource', async () => {
    const { controller, gameDownloadSourceService } = createController()
    const dto = { title: 'new title' }
    const req = { user: { sub: 'u2' } }

    await controller.editDownloadResource(dto as any, 11, req as any)

    expect(gameDownloadSourceService.edit).toHaveBeenCalledWith(11, dto, req)
  })

  it('delegates migrate create endpoints', async () => {
    const { controller, gameDownloadSourceService } = createController()
    const sourceDto = { title: 'src' }
    const fileDto = { name: 'file.zip' }

    await controller.createDownloadResource(sourceDto as any, 12)
    await controller.createDownloadResourceFile(fileDto as any, 13)

    expect(gameDownloadSourceService.migrateCreate).toHaveBeenCalledWith(sourceDto, 12)
    expect(gameDownloadSourceService.migrateCreateFile).toHaveBeenCalledWith(fileDto, 13)
  })

  it('delegates reuploadFile and getFileHistory', async () => {
    const { controller, gameDownloadSourceService } = createController()
    const dto = { reason: 'checksum mismatch' }
    const req = { user: { sub: 'u3' } }

    await controller.reuploadFile(14, dto as any, req as any)
    await controller.getFileHistory(15)

    expect(gameDownloadSourceService.reuploadFile).toHaveBeenCalledWith(14, dto, req)
    expect(gameDownloadSourceService.getFileHistory).toHaveBeenCalledWith(15)
  })

  it('delegates reportDownloadResource', async () => {
    const { controller, gameDownloadSourceReportService } = createController()
    const dto = { reason: 'broken link' }

    await controller.reportDownloadResource(16, dto as any, { user: { sub: 'u4' } } as any)

    expect(gameDownloadSourceReportService.create).toHaveBeenCalledWith(16, dto, 'u4')
  })
})
