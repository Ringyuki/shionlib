import { UserDataController } from './user-data.controller'

describe('UserDataController', () => {
  const createController = () => {
    const userDataService = {
      getGameResources: jest.fn(),
      getComments: jest.fn(),
      getEditRecords: jest.fn(),
    }

    return {
      userDataService,
      controller: new UserDataController(userDataService as any),
    }
  }

  it('delegates getGameResources', async () => {
    const { controller, userDataService } = createController()
    const req = { user: { sub: 1 } }
    const dto = { page: 1, page_size: 20 }

    await controller.getGameResources(req as any, dto as any, 12)

    expect(userDataService.getGameResources).toHaveBeenCalledWith(12, req, dto)
  })

  it('delegates getComments', async () => {
    const { controller, userDataService } = createController()
    const req = { user: { sub: 2 } }
    const dto = { page: 2, page_size: 10 }

    await controller.getComments(req as any, dto as any, 34)

    expect(userDataService.getComments).toHaveBeenCalledWith(34, req, dto)
  })

  it('delegates getEditRecords', async () => {
    const { controller, userDataService } = createController()
    const dto = { page: 3, page_size: 5 }

    await controller.getEditRecords(dto as any, 56)

    expect(userDataService.getEditRecords).toHaveBeenCalledWith(56, dto)
  })
})
