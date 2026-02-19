import { BangumiController } from './bangumi.controller'

describe('BangumiController', () => {
  it('uses default path and forwards request to bangumi service', async () => {
    const bangumiAuthService = {
      bangumiRequest: jest.fn(),
    }
    const controller = new BangumiController(bangumiAuthService as any)

    await controller.search(undefined as any, '42')

    expect(bangumiAuthService.bangumiRequest).toHaveBeenCalledWith(
      'https://api.bgm.tv/v0/subjects/42',
      'GET',
    )
  })

  it('builds url with explicit path and type', async () => {
    const bangumiAuthService = {
      bangumiRequest: jest.fn(),
    }
    const controller = new BangumiController(bangumiAuthService as any)

    await controller.search('characters', '7', 'persons')

    expect(bangumiAuthService.bangumiRequest).toHaveBeenCalledWith(
      'https://api.bgm.tv/v0/characters/7/persons',
      'GET',
    )
  })
})
