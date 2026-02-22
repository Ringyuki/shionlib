import { PotatoVNGameMappingController } from './potatovn-game-mapping.controller'

describe('PotatoVNGameMappingController', () => {
  const createController = () => {
    const potatovnGameMappingService = {
      getPvnGameData: jest.fn(),
      addGameToPvn: jest.fn(),
    }
    const controller = new PotatoVNGameMappingController(potatovnGameMappingService as any)
    return { controller, potatovnGameMappingService }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getPvnGameData delegates with req.user.sub and gameId', async () => {
    const { controller, potatovnGameMappingService } = createController()
    const req = { user: { sub: 100 } }
    const result = { pvn_galgame_id: 1, total_play_time: 0 }
    potatovnGameMappingService.getPvnGameData.mockResolvedValue(result)

    const out = await controller.getPvnGameData(42, req as any)

    expect(potatovnGameMappingService.getPvnGameData).toHaveBeenCalledWith(100, 42)
    expect(out).toEqual(result)
  })

  it('addGameToPvn delegates with req.user.sub and gameId', async () => {
    const { controller, potatovnGameMappingService } = createController()
    const req = { user: { sub: 200 } }
    const result = { pvn_galgame_id: 2, total_play_time: 60 }
    potatovnGameMappingService.addGameToPvn.mockResolvedValue(result)

    const out = await controller.addGameToPvn(88, req as any)

    expect(potatovnGameMappingService.addGameToPvn).toHaveBeenCalledWith(200, 88)
    expect(out).toEqual(result)
  })
})
