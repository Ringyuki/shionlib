import { DeveloperController } from './developer.controller'

describe('DeveloperController', () => {
  const createController = () => {
    const developerService = {
      getList: jest.fn(),
      getById: jest.fn(),
      deleteById: jest.fn(),
    }

    return {
      developerService,
      controller: new DeveloperController(developerService as any),
    }
  }

  it('delegates getList', async () => {
    const { controller, developerService } = createController()
    const dto = { q: 'abc', page: 1 }

    await controller.getList(dto as any)

    expect(developerService.getList).toHaveBeenCalledWith(dto)
  })

  it('delegates getById', async () => {
    const { controller, developerService } = createController()

    await controller.getById(12)

    expect(developerService.getById).toHaveBeenCalledWith(12)
  })

  it('delegates deleteById', async () => {
    const { controller, developerService } = createController()

    await controller.deleteById(34)

    expect(developerService.deleteById).toHaveBeenCalledWith(34)
  })
})
