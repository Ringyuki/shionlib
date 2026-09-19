import { MoyuPatchController } from './moyu-patch.controller'

describe('MoyuPatchController', () => {
  it('getGamePatches delegates with the game id', async () => {
    const moyuPatchService = { getResourcesByGameId: jest.fn().mockResolvedValue([]) }
    const controller = new MoyuPatchController(moyuPatchService as never)

    await expect(controller.getGamePatches(42)).resolves.toEqual([])
    expect(moyuPatchService.getResourcesByGameId).toHaveBeenCalledWith(42)
  })
})
