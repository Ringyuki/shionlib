import { GameCreateController } from './game-create.controller'

describe('GameCreateController', () => {
  const createController = () => {
    const gameDataFetcherService = {
      fetchData: jest.fn(),
    }
    const gameService = {
      createFromBangumiAndVNDB: jest.fn(),
      createGame: jest.fn(),
      createCover: jest.fn(),
      createCharacter: jest.fn(),
      createDeveloper: jest.fn(),
    }

    return {
      gameDataFetcherService,
      gameService,
      controller: new GameCreateController(gameDataFetcherService as any, gameService as any),
    }
  }

  it('delegates fetchData', async () => {
    const { controller, gameDataFetcherService } = createController()

    await controller.fetchData({ b_id: 100, v_id: 200 } as any)

    expect(gameDataFetcherService.fetchData).toHaveBeenCalledWith(100, 200)
  })

  it('delegates createGameFromBV with normalized params', async () => {
    const { controller, gameService } = createController()
    const dto = { b_id: 123, v_id: 456, skip_consistency_check: true }
    const req = { user: { sub: 'u1' } }

    await controller.createGameFromBV(dto as any, req as any)

    expect(gameService.createFromBangumiAndVNDB).toHaveBeenCalledWith('123', '456', true, req)
  })

  it('defaults skip_consistency_check to false when omitted', async () => {
    const { controller, gameService } = createController()

    await controller.createGameFromBV({ b_id: 77 } as any, { user: { sub: 'u2' } } as any)

    expect(gameService.createFromBangumiAndVNDB).toHaveBeenCalledWith('77', undefined, false, {
      user: { sub: 'u2' },
    })
  })

  it('delegates createGame', async () => {
    const { controller, gameService } = createController()
    const dto = { title_jp: 'A' }

    await controller.createGame(dto as any, { user: { sub: 'u3' } } as any)

    expect(gameService.createGame).toHaveBeenCalledWith(dto, 'u3')
  })

  it('delegates createGameCover', async () => {
    const { controller, gameService } = createController()
    const dto = { url: 'https://img' }

    await controller.createGameCover(dto as any, 99)

    expect(gameService.createCover).toHaveBeenCalledWith(dto, 99)
  })

  it('delegates createGameCharacter and createGameDeveloper', async () => {
    const { controller, gameService } = createController()
    const characterDto = { character_id: 1 }
    const developerDto = { developer_id: 2 }

    await controller.createGameCharacter(characterDto as any, 101)
    await controller.createGameDeveloper(developerDto as any, 101)

    expect(gameService.createCharacter).toHaveBeenCalledWith(characterDto, 101)
    expect(gameService.createDeveloper).toHaveBeenCalledWith(developerDto, 101)
  })
})
