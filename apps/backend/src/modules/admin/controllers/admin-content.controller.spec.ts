import { AdminContentController } from './admin-content.controller'

describe('AdminContentController', () => {
  const createController = () => {
    const adminContentService = {
      getGameList: jest.fn(),
      updateGameStatus: jest.fn(),
      editGameScalar: jest.fn(),
      deleteGame: jest.fn(),
      addGameToRecentUpdate: jest.fn(),
      removeGameFromRecentUpdate: jest.fn(),
      getCharacterList: jest.fn(),
      getDeveloperList: jest.fn(),
      getDownloadResourceReportList: jest.fn(),
      getDownloadResourceReportDetail: jest.fn(),
      reviewDownloadResourceReport: jest.fn(),
      getMalwareScanCaseList: jest.fn(),
      getMalwareScanCaseDetail: jest.fn(),
      reviewMalwareScanCase: jest.fn(),
    }
    const adminGameService = {
      getScalar: jest.fn(),
    }

    return {
      adminContentService,
      adminGameService,
      controller: new AdminContentController(adminContentService as any, adminGameService as any),
    }
  }

  it('delegates game list and status methods', async () => {
    const { controller, adminContentService, adminGameService } = createController()

    await controller.getGameList({ page: 1, pageSize: 10 } as any)
    await controller.updateGameStatus(1, 2)
    await controller.getGameScalar(3)
    await controller.editGameScalar(4, { title: 'x' })
    await controller.deleteGame(5)
    await controller.addGameToRecentUpdate(6)
    await controller.removeGameFromRecentUpdate(7)

    expect(adminContentService.getGameList).toHaveBeenCalled()
    expect(adminContentService.updateGameStatus).toHaveBeenCalledWith(1, 2)
    expect(adminGameService.getScalar).toHaveBeenCalledWith(3)
    expect(adminContentService.editGameScalar).toHaveBeenCalledWith(4, { title: 'x' })
    expect(adminContentService.deleteGame).toHaveBeenCalledWith(5)
    expect(adminContentService.addGameToRecentUpdate).toHaveBeenCalledWith(6)
    expect(adminContentService.removeGameFromRecentUpdate).toHaveBeenCalledWith(7)
  })

  it('delegates content list and report methods', async () => {
    const { controller, adminContentService } = createController()
    const req = { user: { sub: 'admin' } }

    await controller.getCharacterList({ page: 1 } as any)
    await controller.getDeveloperList({ page: 1 } as any)
    await controller.getDownloadResourceReportList({ page: 1 } as any)
    await controller.getDownloadResourceReportDetail(9)
    await controller.reviewDownloadResourceReport(10, { status: 1 } as any, req as any)

    expect(adminContentService.getCharacterList).toHaveBeenCalled()
    expect(adminContentService.getDeveloperList).toHaveBeenCalled()
    expect(adminContentService.getDownloadResourceReportList).toHaveBeenCalled()
    expect(adminContentService.getDownloadResourceReportDetail).toHaveBeenCalledWith(9)
    expect(adminContentService.reviewDownloadResourceReport).toHaveBeenCalledWith(
      10,
      { status: 1 },
      req.user,
    )
  })

  it('delegates malware scan methods', async () => {
    const { controller, adminContentService } = createController()
    const req = { user: { sub: 'admin2' } }

    await controller.getMalwareScanCaseList({ page: 2 } as any)
    await controller.getMalwareScanCaseDetail(11)
    await controller.reviewMalwareScanCase(12, { decision: 1 } as any, req as any)

    expect(adminContentService.getMalwareScanCaseList).toHaveBeenCalled()
    expect(adminContentService.getMalwareScanCaseDetail).toHaveBeenCalledWith(11)
    expect(adminContentService.reviewMalwareScanCase).toHaveBeenCalledWith(
      12,
      { decision: 1 },
      req.user,
    )
  })
})
