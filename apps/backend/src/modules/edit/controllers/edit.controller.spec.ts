import { EditController } from './edit.controller'

describe('EditController', () => {
  const createController = () => {
    const dataService = {
      getGameScalar: jest.fn(),
      getGameCover: jest.fn(),
      getGameImage: jest.fn(),
      getGameDevelopers: jest.fn(),
      getGameCharacters: jest.fn(),
      getGameEditHistory: jest.fn(),
      getDeveloperScalar: jest.fn(),
      getDeveloperEditHistory: jest.fn(),
      getCharacterScalar: jest.fn(),
      getCharacterEditHistory: jest.fn(),
    }

    return {
      dataService,
      controller: new EditController(dataService as any),
    }
  }

  it('delegates game endpoints', async () => {
    const { controller, dataService } = createController()
    const dto = { page: 1, page_size: 20 }

    await controller.getGameScalar(1)
    await controller.getGameCover(2)
    await controller.getGameImage(3)
    await controller.getGameDevelopers(4)
    await controller.getGameCharacters(5)
    await controller.getGameEditHistory(6, dto as any)

    expect(dataService.getGameScalar).toHaveBeenCalledWith(1)
    expect(dataService.getGameCover).toHaveBeenCalledWith(2)
    expect(dataService.getGameImage).toHaveBeenCalledWith(3)
    expect(dataService.getGameDevelopers).toHaveBeenCalledWith(4)
    expect(dataService.getGameCharacters).toHaveBeenCalledWith(5)
    expect(dataService.getGameEditHistory).toHaveBeenCalledWith(6, dto)
  })

  it('delegates developer and character endpoints', async () => {
    const { controller, dataService } = createController()
    const dto = { page: 2, page_size: 10 }

    await controller.getDeveloperScalar(7)
    await controller.getDeveloperEditHistory(8, dto as any)
    await controller.getCharacterScalar(9)
    await controller.getCharacterEditHistory(10, dto as any)

    expect(dataService.getDeveloperScalar).toHaveBeenCalledWith(7)
    expect(dataService.getDeveloperEditHistory).toHaveBeenCalledWith(8, dto)
    expect(dataService.getCharacterScalar).toHaveBeenCalledWith(9)
    expect(dataService.getCharacterEditHistory).toHaveBeenCalledWith(10, dto)
  })
})
