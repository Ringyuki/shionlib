import { AdminWalkthroughController } from './admin-walkthrough.controller'

describe('AdminWalkthroughController', () => {
  it('delegates all walkthrough admin operations', async () => {
    const adminWalkthroughService = {
      getWalkthroughList: jest.fn(),
      getWalkthroughDetail: jest.fn(),
      updateWalkthroughStatus: jest.fn(),
      rescanWalkthrough: jest.fn(),
    }

    const controller = new AdminWalkthroughController(adminWalkthroughService as any)

    await controller.getWalkthroughList({ page: 1 } as any)
    await controller.getWalkthroughDetail(1)
    await controller.updateWalkthroughStatus(2, { status: 'HIDDEN' } as any)
    await controller.rescanWalkthrough(3)

    expect(adminWalkthroughService.getWalkthroughList).toHaveBeenCalledWith({ page: 1 })
    expect(adminWalkthroughService.getWalkthroughDetail).toHaveBeenCalledWith(1)
    expect(adminWalkthroughService.updateWalkthroughStatus).toHaveBeenCalledWith(2, {
      status: 'HIDDEN',
    })
    expect(adminWalkthroughService.rescanWalkthrough).toHaveBeenCalledWith(3)
  })
})
