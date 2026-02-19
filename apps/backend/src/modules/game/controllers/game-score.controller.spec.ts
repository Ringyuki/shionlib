import { GameScoreController } from './game-score.controller'

describe('GameScoreController', () => {
  it('delegates score queries', async () => {
    const gameScoreService = {
      getBangumiScore: jest.fn().mockResolvedValue({ score: 7.8 }),
      getVNDBScore: jest.fn().mockResolvedValue({ score: 8.1 }),
    }
    const controller = new GameScoreController(gameScoreService as any)

    const b = await controller.getScore(10)
    const v = await controller.getVNDBScore(11)

    expect(gameScoreService.getBangumiScore).toHaveBeenCalledWith(10)
    expect(gameScoreService.getVNDBScore).toHaveBeenCalledWith(11)
    expect(b).toEqual({ score: 7.8 })
    expect(v).toEqual({ score: 8.1 })
  })
})
