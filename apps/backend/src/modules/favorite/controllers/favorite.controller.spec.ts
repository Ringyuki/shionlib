import { FavoriteController } from './favorite.controller'

describe('FavoriteController', () => {
  const createController = () => {
    const favoriteService = {
      createFavorite: jest.fn(),
      addGameToFavorite: jest.fn(),
      updateFavorite: jest.fn(),
      deleteFavorite: jest.fn(),
      updateFavoriteItem: jest.fn(),
      deleteFavoriteItem: jest.fn(),
      deleteFavoriteItemByGameId: jest.fn(),
      getFavorites: jest.fn(),
      getFavoriteItems: jest.fn(),
      getFavoriteStats: jest.fn(),
    }

    return {
      favoriteService,
      controller: new FavoriteController(favoriteService as any),
    }
  }

  it('delegates createFavorite', async () => {
    const { controller, favoriteService } = createController()
    favoriteService.createFavorite.mockResolvedValue({ id: 1 })

    const dto = { name: 'mine' }
    const req = { user: { sub: 'u1' } }
    const result = await controller.createFavorite(dto as any, req as any)

    expect(favoriteService.createFavorite).toHaveBeenCalledWith(dto, 'u1')
    expect(result).toEqual({ id: 1 })
  })

  it('delegates addGameToFavorite', async () => {
    const { controller, favoriteService } = createController()
    const dto = { game_id: 100 }
    const req = { user: { sub: 'u2' } }

    await controller.addGameToFavorite(7, dto as any, req as any)

    expect(favoriteService.addGameToFavorite).toHaveBeenCalledWith(7, 'u2', dto)
  })

  it('delegates updateFavorite', async () => {
    const { controller, favoriteService } = createController()
    const dto = { name: 'new' }

    await controller.updateFavorite(5, dto as any, { user: { sub: 'u3' } } as any)

    expect(favoriteService.updateFavorite).toHaveBeenCalledWith(5, 'u3', dto)
  })

  it('delegates deleteFavorite', async () => {
    const { controller, favoriteService } = createController()

    await controller.deleteFavorite(9, { user: { sub: 'u4' } } as any)

    expect(favoriteService.deleteFavorite).toHaveBeenCalledWith(9, 'u4')
  })

  it('delegates updateFavoriteItem', async () => {
    const { controller, favoriteService } = createController()
    const dto = { note: 'memo' }

    await controller.updateFavoriteItem(12, dto as any, { user: { sub: 'u5' } } as any)

    expect(favoriteService.updateFavoriteItem).toHaveBeenCalledWith(12, 'u5', dto)
  })

  it('delegates deleteFavoriteItem', async () => {
    const { controller, favoriteService } = createController()

    await controller.deleteFavoriteItem(21, { user: { sub: 'u6' } } as any)

    expect(favoriteService.deleteFavoriteItem).toHaveBeenCalledWith(21, 'u6')
  })

  it('delegates deleteFavoriteItemByGameId', async () => {
    const { controller, favoriteService } = createController()

    await controller.deleteFavoriteItemByGameId(2, 8, { user: { sub: 'u7' } } as any)

    expect(favoriteService.deleteFavoriteItemByGameId).toHaveBeenCalledWith(2, 8, 'u7')
  })

  it('delegates getFavorites', async () => {
    const { controller, favoriteService } = createController()
    const dto = { page: 1, pageSize: 10 }

    await controller.getFavorites({ user: { sub: 'u8' } } as any, dto as any)

    expect(favoriteService.getFavorites).toHaveBeenCalledWith('u8', dto)
  })

  it('delegates getFavoriteItems', async () => {
    const { controller, favoriteService } = createController()
    const dto = { page: 1, pageSize: 5 }
    const req = { user: { sub: 'u9' } }

    await controller.getFavoriteItems(3, dto as any, req as any)

    expect(favoriteService.getFavoriteItems).toHaveBeenCalledWith(3, dto, req)
  })

  it('delegates getFavoriteStats', async () => {
    const { controller, favoriteService } = createController()

    await controller.getFavoriteStats(11, { user: { sub: 'u10' } } as any)

    expect(favoriteService.getFavoriteStats).toHaveBeenCalledWith('u10', 11)
  })
})
