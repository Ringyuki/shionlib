import { GameHotScoreCalcTask } from './game-hot-score-calc.task'

describe('GameHotScoreCalcTask', () => {
  it('delegates handle to game hot score service', async () => {
    const gameHotScoreService = {
      refreshScore: jest.fn().mockResolvedValue(undefined),
    }
    const task = new GameHotScoreCalcTask(gameHotScoreService as any)

    await task.handle()

    expect(gameHotScoreService.refreshScore).toHaveBeenCalledTimes(1)
  })
})
